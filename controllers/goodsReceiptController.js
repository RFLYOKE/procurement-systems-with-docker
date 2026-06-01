const GoodsReceipt = require('../models/goodsReceiptModel');
const PurchaseOrder = require('../models/purchaseOrderModel');
const Procurement = require('../models/procurementModel');
const { generateGRNumber } = require('../utils/generateNumber');
const { successResponse, errorResponse } = require('../utils/response');
const pool = require('../config/database');

const goodsReceiptController = {
    /**
     * POST /api/goods-receipts
     * Buat Goods Receipt (penerimaan barang) - partial atau complete
     */
    createGoodsReceipt: async (req, res) => {
        const connection = await pool.getConnection();
        try {
            const { po_id, received_date, notes, items } = req.body;

            const errors = [];
            if (!po_id) errors.push({ field: 'po_id', message: 'PO ID wajib diisi' });
            if (!received_date) errors.push({ field: 'received_date', message: 'Tanggal penerimaan wajib diisi' });
            if (!items || !Array.isArray(items) || items.length === 0) {
                errors.push({ field: 'items', message: 'Items wajib diisi minimal 1' });
            }

            if (errors.length > 0) {
                return res.status(400).json({ success: false, message: 'Validasi gagal', errors });
            }

            // Validasi PO exists & status IN (sent, confirmed)
            const po = await PurchaseOrder.findById(po_id);
            if (!po) {
                return errorResponse(res, 'Purchase Order tidak ditemukan', 404);
            }
            if (!['sent', 'confirmed'].includes(po.status)) {
                return errorResponse(res, 'PO belum siap untuk penerimaan barang', 400);
            }

            // Items validation
            const poItems = await PurchaseOrder.findItems(po_id);
            const poItemMap = {};
            for (const poi of poItems) {
                poItemMap[poi.id] = poi;
            }

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (!item.item_id) errors.push({ field: `items[${i}].item_id`, message: 'Item ID wajib diisi' });
                if (!item.po_item_id) errors.push({ field: `items[${i}].po_item_id`, message: 'PO Item ID wajib diisi' });
                if (!item.quantity_received || Number(item.quantity_received) <= 0) {
                    errors.push({ field: `items[${i}].quantity_received`, message: 'Quantity received harus lebih dari 0' });
                }

                // Cek quantity_received tidak melebihi sisa
                if (item.po_item_id && item.quantity_received) {
                    const poItem = poItemMap[item.po_item_id];
                    if (!poItem) {
                        errors.push({ field: `items[${i}].po_item_id`, message: `PO Item ID ${item.po_item_id} tidak ditemukan` });
                    } else {
                        const totalReceived = await GoodsReceipt.getTotalReceivedByPOItem(item.po_item_id);
                        const remaining = parseFloat(poItem.quantity) - totalReceived;
                        if (Number(item.quantity_received) > remaining) {
                            errors.push({
                                field: `items[${i}].quantity_received`,
                                message: `Quantity melebihi sisa yang belum diterima (sisa: ${remaining})`,
                            });
                        }
                        // Set quantity_ordered for insert
                        item.quantity_ordered = parseFloat(poItem.quantity);
                    }
                }
            }

            if (errors.length > 0) {
                return res.status(400).json({ success: false, message: 'Validasi gagal', errors });
            }

            await connection.beginTransaction();

            // Generate GR number
            const gr_number = await generateGRNumber(connection);

            // Check if all PO items will be fully received after this GR
            let allComplete = true;
            for (const poItem of poItems) {
                const totalReceived = await GoodsReceipt.getTotalReceivedByPOItem(poItem.id);
                // Find matching item in current GR
                const currentItem = items.find(i => i.po_item_id === poItem.id);
                const newReceived = currentItem ? Number(currentItem.quantity_received) : 0;
                const totalAfter = totalReceived + newReceived;

                if (totalAfter < parseFloat(poItem.quantity)) {
                    allComplete = false;
                    break;
                }
            }

            const grStatus = allComplete ? 'complete' : 'partial';

            // INSERT goods_receipts
            const grData = {
                gr_number,
                po_id,
                request_id: po.request_id,
                received_by: req.user.id,
                received_date,
                status: grStatus,
                notes,
            };
            const grId = await GoodsReceipt.create(grData, connection);

            // INSERT goods_receipt_items
            await GoodsReceipt.createItems(grId, items, connection);

            // If complete → update procurement & PO status
            if (grStatus === 'complete') {
                await connection.query(
                    `UPDATE procurement_requests SET status = 'received', updated_at = NOW() WHERE id = ?`,
                    [po.request_id]
                );
                await connection.query(
                    `UPDATE purchase_orders SET status = 'completed', updated_at = NOW() WHERE id = ?`,
                    [po_id]
                );
                await connection.query(
                    `INSERT INTO approval_histories (request_id, approver_id, role, action, notes, status_before, status_after)
                     VALUES (?, ?, ?, 'approved', 'Barang telah diterima lengkap', 'purchased', 'received')`,
                    [po.request_id, req.user.id, req.user.role]
                );
            }

            await connection.commit();

            // Fetch complete GR data
            const newGR = await GoodsReceipt.findById(grId);
            const grItems = await GoodsReceipt.findItems(grId);

            return successResponse(res, 'Goods Receipt berhasil dibuat', {
                id: newGR.id,
                gr_number: newGR.gr_number,
                po_number: newGR.po_number,
                received_date: newGR.received_date,
                status: newGR.status,
                is_complete: grStatus === 'complete',
                notes: newGR.notes,
                created_at: newGR.created_at,
                items: grItems,
            }, 201);
        } catch (error) {
            await connection.rollback();
            console.error('Error createGoodsReceipt:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        } finally {
            connection.release();
        }
    },

    /**
     * GET /api/goods-receipts
     * Ambil semua GR dengan filter & pagination
     */
    getAllGoodsReceipts: async (req, res) => {
        try {
            const { po_id, status, start_date, end_date, page = 1, limit = 10 } = req.query;

            // Requester hanya lihat GR dari procurement miliknya
            let requesterId = null;
            if (req.user.role === 'requester') {
                requesterId = req.user.id;
            }

            const queryParams = {
                poId: po_id,
                requesterId,
                status,
                startDate: start_date,
                endDate: end_date,
                page,
                limit,
            };

            const data = await GoodsReceipt.findAll(queryParams);
            const total = await GoodsReceipt.countAll(queryParams);
            const totalPages = Math.ceil(total / limit);

            return res.status(200).json({
                success: true,
                message: 'Berhasil mengambil data goods receipts',
                data,
                pagination: { total, page: Number(page), limit: Number(limit), totalPages },
            });
        } catch (error) {
            console.error('Error getAllGoodsReceipts:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    /**
     * GET /api/goods-receipts/:id
     * Detail GR lengkap
     */
    getGoodsReceiptById: async (req, res) => {
        try {
            const { id } = req.params;
            const gr = await GoodsReceipt.findById(id);

            if (!gr) {
                return errorResponse(res, 'Goods Receipt tidak ditemukan', 404);
            }

            const items = await GoodsReceipt.findItems(id);

            const responseData = {
                id: gr.id,
                gr_number: gr.gr_number,
                received_date: gr.received_date,
                status: gr.status,
                notes: gr.notes,
                created_at: gr.created_at,
                po: {
                    id: gr.po_id,
                    po_number: gr.po_number,
                    status: gr.po_status,
                },
                procurement: {
                    id: gr.request_id,
                    request_number: gr.request_number,
                    title: gr.request_title,
                },
                received_by: {
                    id: gr.receiver_id,
                    name: gr.receiver_name,
                    department: gr.receiver_department,
                },
                items: items.map(item => ({
                    id: item.id,
                    item_id: item.item_id,
                    item_name: item.item_name,
                    item_code: item.item_code,
                    quantity_ordered: item.quantity_ordered,
                    quantity_received: item.quantity_received,
                    condition_notes: item.condition_notes,
                })),
            };

            return successResponse(res, 'Berhasil mengambil data goods receipt', responseData);
        } catch (error) {
            console.error('Error getGoodsReceiptById:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },
};

module.exports = goodsReceiptController;

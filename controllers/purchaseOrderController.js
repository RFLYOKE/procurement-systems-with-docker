const PurchaseOrder = require('../models/purchaseOrderModel');
const Procurement = require('../models/procurementModel');
const Vendor = require('../models/vendorModel');
const Item = require('../models/itemModel');
const Approval = require('../models/approvalModel');
const { generatePONumber } = require('../utils/generateNumber');
const { successResponse, errorResponse } = require('../utils/response');
const pool = require('../config/database');

const purchaseOrderController = {
    /**
     * POST /api/purchase-orders
     * Buat Purchase Order dari procurement yang sudah approved_purchasing
     */
    createPurchaseOrder: async (req, res) => {
        const connection = await pool.getConnection();
        try {
            const { request_id, vendor_id, po_date, expected_delivery_date, payment_terms, delivery_address, notes, items } = req.body;

            // Validation errors collector
            const errors = [];

            if (!request_id) errors.push({ field: 'request_id', message: 'Request ID wajib diisi' });
            if (!vendor_id) errors.push({ field: 'vendor_id', message: 'Vendor ID wajib diisi' });
            if (!po_date) errors.push({ field: 'po_date', message: 'Tanggal PO wajib diisi' });
            if (!items || !Array.isArray(items) || items.length === 0) {
                errors.push({ field: 'items', message: 'Items wajib diisi minimal 1' });
            }

            if (errors.length > 0) {
                return res.status(400).json({ success: false, message: 'Validasi gagal', errors });
            }

            // Validasi procurement exists & status = approved_purchasing
            const procurement = await Procurement.findById(request_id);
            if (!procurement) {
                return errorResponse(res, 'Pengajuan tidak ditemukan', 404);
            }
            if (procurement.status !== 'approved_purchasing') {
                return errorResponse(res, 'Pengajuan belum disetujui untuk pembuatan PO', 400);
            }

            // Validasi belum ada PO untuk request_id ini
            const existingPO = await PurchaseOrder.findByRequestId(request_id);
            if (existingPO) {
                return errorResponse(res, 'PO sudah dibuat untuk pengajuan ini', 400);
            }

            // Validasi vendor exists & active
            const vendor = await Vendor.findById(vendor_id);
            if (!vendor) {
                return errorResponse(res, 'Vendor tidak ditemukan atau tidak aktif', 404);
            }

            // Validasi items
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (!item.item_id) errors.push({ field: `items[${i}].item_id`, message: 'Item ID wajib diisi' });
                if (!item.quantity || Number(item.quantity) <= 0) errors.push({ field: `items[${i}].quantity`, message: 'Quantity harus lebih dari 0' });
                if (item.unit_price === undefined || Number(item.unit_price) < 0) errors.push({ field: `items[${i}].unit_price`, message: 'Unit price tidak boleh negatif' });

                if (item.item_id) {
                    const existingItem = await Item.findById(item.item_id);
                    if (!existingItem) {
                        errors.push({ field: `items[${i}].item_id`, message: `Item dengan ID ${item.item_id} tidak ditemukan` });
                    } else {
                        item.unit = item.unit || existingItem.unit;
                    }
                }
            }

            if (errors.length > 0) {
                return res.status(400).json({ success: false, message: 'Validasi gagal', errors });
            }

            // Begin transaction
            await connection.beginTransaction();

            // Generate PO number
            const po_number = await generatePONumber(connection);

            // Calculate total_amount
            const total_amount = items.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.unit_price)), 0);

            // INSERT purchase_orders
            const poData = {
                po_number,
                request_id,
                vendor_id,
                created_by: req.user.id,
                po_date,
                expected_delivery_date: expected_delivery_date || null,
                total_amount,
                payment_terms,
                delivery_address,
                notes,
            };
            const poId = await PurchaseOrder.create(poData, connection);

            // INSERT purchase_order_items
            await PurchaseOrder.createItems(poId, items, connection);

            // UPDATE procurement status → purchased
            await connection.query(
                `UPDATE procurement_requests SET status = 'purchased', updated_at = NOW() WHERE id = ?`,
                [request_id]
            );

            // INSERT approval_histories
            await connection.query(
                `INSERT INTO approval_histories (request_id, approver_id, role, action, notes, status_before, status_after)
                 VALUES (?, ?, ?, 'approved', 'Purchase Order telah dibuat', 'approved_purchasing', 'purchased')`,
                [request_id, req.user.id, req.user.role]
            );

            await connection.commit();

            // Fetch complete PO data
            const newPO = await PurchaseOrder.findById(poId);
            const poItems = await PurchaseOrder.findItems(poId);

            return successResponse(res, 'Purchase Order berhasil dibuat', {
                ...newPO,
                items: poItems,
            }, 201);
        } catch (error) {
            await connection.rollback();
            console.error('Error createPurchaseOrder:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        } finally {
            connection.release();
        }
    },

    /**
     * GET /api/purchase-orders
     * Ambil semua PO dengan filter & pagination
     */
    getAllPurchaseOrders: async (req, res) => {
        try {
            const { status, vendor_id, start_date, end_date, page = 1, limit = 10 } = req.query;

            const queryParams = {
                status,
                vendorId: vendor_id,
                startDate: start_date,
                endDate: end_date,
                page,
                limit,
            };

            const data = await PurchaseOrder.findAll(queryParams);
            const total = await PurchaseOrder.countAll(queryParams);
            const totalPages = Math.ceil(total / limit);

            return res.status(200).json({
                success: true,
                message: 'Berhasil mengambil data purchase orders',
                data,
                pagination: { total, page: Number(page), limit: Number(limit), totalPages },
            });
        } catch (error) {
            console.error('Error getAllPurchaseOrders:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    /**
     * GET /api/purchase-orders/:id
     * Detail PO lengkap dengan vendor, procurement, dan items
     */
    getPurchaseOrderById: async (req, res) => {
        try {
            const { id } = req.params;
            const po = await PurchaseOrder.findById(id);

            if (!po) {
                return errorResponse(res, 'Purchase Order tidak ditemukan', 404);
            }

            const items = await PurchaseOrder.findItems(id);

            const responseData = {
                id: po.id,
                po_number: po.po_number,
                po_date: po.po_date,
                expected_delivery_date: po.expected_delivery_date,
                total_amount: po.total_amount,
                status: po.status,
                payment_terms: po.payment_terms,
                delivery_address: po.delivery_address,
                notes: po.notes,
                created_by: po.created_by,
                creator_name: po.creator_name,
                created_at: po.created_at,
                updated_at: po.updated_at,
                vendor: {
                    id: po.vendor_id,
                    code: po.vendor_code,
                    name: po.vendor_name,
                    contact_person: po.contact_person,
                    phone: po.vendor_phone,
                    email: po.vendor_email,
                },
                procurement: {
                    id: po.request_id,
                    request_number: po.request_number,
                    title: po.request_title,
                    status: po.request_status,
                },
                items,
            };

            return successResponse(res, 'Berhasil mengambil data purchase order', responseData);
        } catch (error) {
            console.error('Error getPurchaseOrderById:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    /**
     * PATCH /api/purchase-orders/:id/status
     * Update status PO dengan validasi flow
     */
    updatePOStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!status) {
                return errorResponse(res, 'Status wajib diisi', 400);
            }

            const po = await PurchaseOrder.findById(id);
            if (!po) {
                return errorResponse(res, 'Purchase Order tidak ditemukan', 404);
            }

            // Validasi flow status PO
            const allowedTransitions = {
                'draft':     ['sent', 'cancelled'],
                'sent':      ['confirmed', 'cancelled'],
                'confirmed': ['completed', 'cancelled'],
                'completed': [],
                'cancelled': [],
            };

            const allowed = allowedTransitions[po.status];
            if (!allowed || !allowed.includes(status)) {
                return errorResponse(res, `Perubahan status dari '${po.status}' ke '${status}' tidak diizinkan`, 400);
            }

            await PurchaseOrder.updateStatus(id, status);

            const updatedPO = await PurchaseOrder.findById(id);

            return successResponse(res, 'Status Purchase Order berhasil diperbarui', {
                id: updatedPO.id,
                po_number: updatedPO.po_number,
                status_before: po.status,
                status_after: status,
                updated_at: updatedPO.updated_at,
            });
        } catch (error) {
            console.error('Error updatePOStatus:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },
};

module.exports = purchaseOrderController;

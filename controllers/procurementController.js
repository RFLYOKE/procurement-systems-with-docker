const Procurement = require('../models/procurementModel');
const Item = require('../models/itemModel');
const { generateRequestNumber } = require('../utils/generateNumber');
const { successResponse, errorResponse } = require('../utils/response');
const pool = require('../config/database');

const procurementController = {
    createProcurement: async (req, res) => {
        const connection = await pool.getConnection();
        try {
            const { title, description, required_date, priority, notes, items } = req.body;

            // Validation
            const errors = [];
            if (!title) errors.push({ field: 'title', message: 'Title wajib diisi' });
            else if (title.length > 200) errors.push({ field: 'title', message: 'Title max 200 char' });
            
            if (priority && !['low', 'medium', 'high'].includes(priority)) {
                errors.push({ field: 'priority', message: 'Priority harus low, medium, atau high' });
            }

            if (required_date) {
                const reqDate = new Date(required_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (reqDate < today) {
                    errors.push({ field: 'required_date', message: 'Required date tidak boleh masa lalu' });
                }
            }

            if (!items || !Array.isArray(items) || items.length === 0) {
                errors.push({ field: 'items', message: 'Items wajib diisi minimal 1 elemen' });
            } else {
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (!item.item_id) errors.push({ field: `items[${i}].item_id`, message: 'Item ID wajib diisi' });
                    if (!item.quantity || Number(item.quantity) <= 0) errors.push({ field: `items[${i}].quantity`, message: 'Quantity harus lebih dari 0' });
                    if (item.estimated_price === undefined || Number(item.estimated_price) < 0) errors.push({ field: `items[${i}].estimated_price`, message: 'Estimated price tidak boleh negatif' });
                    
                    // Check item existence
                    if (item.item_id) {
                        const existingItem = await Item.findById(item.item_id);
                        if (!existingItem) {
                            errors.push({ field: `items[${i}].item_id`, message: `Item dengan ID ${item.item_id} tidak ditemukan atau tidak aktif` });
                        } else {
                            // default unit
                            item.unit = item.unit || existingItem.unit;
                        }
                    }
                }
            }

            if (errors.length > 0) {
                return res.status(400).json({ success: false, message: 'Validasi gagal', errors });
            }

            await connection.beginTransaction();

            const request_number = await generateRequestNumber(connection);
            const total_estimated_price = Procurement.calculateTotal(items);

            const headerData = {
                request_number,
                title,
                description,
                requester_id: req.user.id,
                department: req.user.department,
                required_date: required_date || null,
                total_estimated_price,
                priority,
                notes
            };

            const insertId = await Procurement.create(headerData, connection);
            await Procurement.createItems(insertId, items, connection);

            await connection.commit();

            const newProcurement = await Procurement.findById(insertId);
            const newItems = await Procurement.findItems(insertId);

            return successResponse(res, 'Procurement request berhasil dibuat', {
                ...newProcurement,
                items: newItems
            }, 201);
        } catch (error) {
            await connection.rollback();
            console.error('Error createProcurement:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        } finally {
            connection.release();
        }
    },

    getAllProcurements: async (req, res) => {
        try {
            const { status, priority, start_date, end_date, page = 1, limit = 10 } = req.query;
            let requesterId = null;

            if (req.user.role === 'requester') {
                requesterId = req.user.id;
            }

            const queryParams = {
                requesterId,
                status,
                priority,
                startDate: start_date,
                endDate: end_date,
                page,
                limit
            };

            const procurements = await Procurement.findAll(queryParams);
            const total = await Procurement.countAll(queryParams);
            
            const totalPages = Math.ceil(total / limit);

            return res.status(200).json({
                success: true,
                message: 'Berhasil mengambil data procurement requests',
                data: procurements,
                pagination: { total, page: Number(page), limit: Number(limit), totalPages }
            });
        } catch (error) {
            console.error('Error getAllProcurements:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    getProcurementById: async (req, res) => {
        try {
            const { id } = req.params;
            const procurement = await Procurement.findById(id);

            if (!procurement) {
                return errorResponse(res, 'Procurement request tidak ditemukan', 404);
            }

            if (req.user.role === 'requester' && procurement.requester_id !== req.user.id) {
                return errorResponse(res, 'Forbidden: Anda tidak memiliki akses ke data ini', 403);
            }

            const items = await Procurement.findItems(id);

            const responseData = {
                ...procurement,
                requester: {
                    id: procurement.requester_id,
                    name: procurement.requester_name,
                    email: procurement.requester_email,
                    department: procurement.requester_department
                },
                items
            };

            // remove duplicate root keys that were spread
            delete responseData.requester_name;
            delete responseData.requester_email;
            delete responseData.requester_department;

            return successResponse(res, 'Berhasil mengambil data procurement request', responseData);
        } catch (error) {
            console.error('Error getProcurementById:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    updateProcurement: async (req, res) => {
        const connection = await pool.getConnection();
        try {
            const { id } = req.params;
            const { title, description, required_date, priority, notes, items } = req.body;

            const procurement = await Procurement.findById(id);
            if (!procurement) {
                return errorResponse(res, 'Procurement request tidak ditemukan', 404);
            }

            if (req.user.role === 'requester' && procurement.requester_id !== req.user.id) {
                return errorResponse(res, 'Forbidden: Anda tidak memiliki akses ke data ini', 403);
            }

            if (procurement.status !== 'draft') {
                return res.status(400).json({ success: false, message: 'Hanya bisa update saat status draft' });
            }

            // Validation
            const errors = [];
            if (title && title.length > 200) errors.push({ field: 'title', message: 'Title max 200 char' });
            if (priority && !['low', 'medium', 'high'].includes(priority)) {
                errors.push({ field: 'priority', message: 'Priority harus low, medium, atau high' });
            }

            if (required_date) {
                const reqDate = new Date(required_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (reqDate < today) {
                    errors.push({ field: 'required_date', message: 'Required date tidak boleh masa lalu' });
                }
            }

            if (items) {
                if (!Array.isArray(items) || items.length === 0) {
                    errors.push({ field: 'items', message: 'Items wajib diisi minimal 1 elemen' });
                } else {
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        if (!item.item_id) errors.push({ field: `items[${i}].item_id`, message: 'Item ID wajib diisi' });
                        if (!item.quantity || Number(item.quantity) <= 0) errors.push({ field: `items[${i}].quantity`, message: 'Quantity harus lebih dari 0' });
                        if (item.estimated_price === undefined || Number(item.estimated_price) < 0) errors.push({ field: `items[${i}].estimated_price`, message: 'Estimated price tidak boleh negatif' });
                        
                        if (item.item_id) {
                            const existingItem = await Item.findById(item.item_id);
                            if (!existingItem) {
                                errors.push({ field: `items[${i}].item_id`, message: `Item dengan ID ${item.item_id} tidak ditemukan atau tidak aktif` });
                            } else {
                                item.unit = item.unit || existingItem.unit;
                            }
                        }
                    }
                }
            }

            if (errors.length > 0) {
                return res.status(400).json({ success: false, message: 'Validasi gagal', errors });
            }

            await connection.beginTransaction();

            const headerData = {
                title: title || procurement.title,
                description: description !== undefined ? description : procurement.description,
                required_date: required_date !== undefined ? required_date : procurement.required_date,
                priority: priority || procurement.priority,
                notes: notes !== undefined ? notes : procurement.notes
            };

            if (items) {
                headerData.total_estimated_price = Procurement.calculateTotal(items);
                await Procurement.deleteItems(id, connection);
                await Procurement.createItems(id, items, connection);
            } else {
                headerData.total_estimated_price = procurement.total_estimated_price;
            }

            await Procurement.update(id, headerData, connection);
            await connection.commit();

            const updatedProcurement = await Procurement.findById(id);
            const updatedItems = await Procurement.findItems(id);

            return successResponse(res, 'Procurement request berhasil diupdate', {
                ...updatedProcurement,
                items: updatedItems
            });
        } catch (error) {
            await connection.rollback();
            console.error('Error updateProcurement:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        } finally {
            connection.release();
        }
    },

    submitProcurement: async (req, res) => {
        try {
            const { id } = req.params;

            const procurement = await Procurement.findById(id);
            if (!procurement) {
                return errorResponse(res, 'Procurement request tidak ditemukan', 404);
            }

            if (req.user.role === 'requester' && procurement.requester_id !== req.user.id) {
                return errorResponse(res, 'Forbidden: Anda tidak memiliki akses ke data ini', 403);
            }

            if (procurement.status !== 'draft') {
                return res.status(400).json({ success: false, message: 'Hanya bisa submit saat status draft' });
            }

            const items = await Procurement.findItems(id);
            if (!items || items.length === 0) {
                return errorResponse(res, 'Minimal ada 1 item untuk submit', 400);
            }

            await Procurement.softUpdateStatus(id, 'submitted');

            return successResponse(res, 'Procurement request berhasil disubmit', {
                id: procurement.id,
                request_number: procurement.request_number,
                status: 'submitted'
            });
        } catch (error) {
            console.error('Error submitProcurement:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    deleteProcurement: async (req, res) => {
        try {
            const { id } = req.params;

            const procurement = await Procurement.findById(id);
            if (!procurement) {
                return errorResponse(res, 'Procurement request tidak ditemukan', 404);
            }

            if (req.user.role === 'requester' && procurement.requester_id !== req.user.id) {
                return errorResponse(res, 'Forbidden: Anda tidak memiliki akses ke data ini', 403);
            }

            if (procurement.status !== 'draft') {
                return res.status(400).json({ success: false, message: 'Hanya bisa delete saat status draft' });
            }

            await Procurement.deleteProcurement(id);
            return successResponse(res, 'Procurement request berhasil dihapus');
        } catch (error) {
            console.error('Error deleteProcurement:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    }
};

module.exports = procurementController;

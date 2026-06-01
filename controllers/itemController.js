const Item = require('../models/itemModel');
const { successResponse, errorResponse } = require('../utils/response');

const itemController = {
    createItem: async (req, res) => {
        try {
            const { code, name, description, category, unit, estimated_price } = req.body;

            // Validation
            const errors = [];
            if (!code) errors.push({ field: 'code', message: 'Code wajib diisi' });
            else if (code.length > 50) errors.push({ field: 'code', message: 'Code max 50 char' });
            if (!name) errors.push({ field: 'name', message: 'Name wajib diisi' });
            else if (name.length > 200) errors.push({ field: 'name', message: 'Name max 200 char' });
            if (!category) errors.push({ field: 'category', message: 'Category wajib diisi' });
            else if (!['barang', 'jasa'].includes(category)) errors.push({ field: 'category', message: 'Category harus barang atau jasa' });
            if (!unit) errors.push({ field: 'unit', message: 'Unit wajib diisi' });
            else if (unit.length > 50) errors.push({ field: 'unit', message: 'Unit max 50 char' });
            if (estimated_price !== undefined && Number(estimated_price) < 0) errors.push({ field: 'estimated_price', message: 'Estimated price tidak boleh negatif' });

            if (errors.length > 0) {
                return res.status(400).json({ success: false, message: 'Validasi gagal', errors });
            }

            // Check duplicate code
            const existingItem = await Item.findByCode(code);
            if (existingItem) {
                return errorResponse(res, 'Code item sudah terdaftar', 400);
            }

            const itemData = {
                code, name, description, category, unit, 
                estimated_price: estimated_price || 0,
                created_by: req.user.id
            };

            const insertId = await Item.create(itemData);
            const newItem = await Item.findById(insertId);

            return successResponse(res, 'Item berhasil dibuat', newItem, 201);
        } catch (error) {
            console.error('Error createItem:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    getAllItems: async (req, res) => {
        try {
            const { search, category, page = 1, limit = 10 } = req.query;
            
            const items = await Item.findAll({ search, category, page, limit });
            const total = await Item.countAll({ search, category });
            
            const totalPages = Math.ceil(total / limit);

            return res.status(200).json({
                success: true,
                message: 'Berhasil mengambil data items',
                data: items,
                pagination: { total, page: Number(page), limit: Number(limit), totalPages }
            });
        } catch (error) {
            console.error('Error getAllItems:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    getItemById: async (req, res) => {
        try {
            const { id } = req.params;
            const item = await Item.findById(id);

            if (!item) {
                return errorResponse(res, 'Item tidak ditemukan', 404);
            }

            return successResponse(res, 'Berhasil mengambil data item', item);
        } catch (error) {
            console.error('Error getItemById:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    updateItem: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description, unit, estimated_price } = req.body;

            const item = await Item.findById(id);
            if (!item) {
                return errorResponse(res, 'Item tidak ditemukan', 404);
            }

            const errors = [];
            if (name && name.length > 200) errors.push({ field: 'name', message: 'Name max 200 char' });
            if (unit && unit.length > 50) errors.push({ field: 'unit', message: 'Unit max 50 char' });
            if (estimated_price !== undefined && Number(estimated_price) < 0) errors.push({ field: 'estimated_price', message: 'Estimated price tidak boleh negatif' });

            if (errors.length > 0) {
                return res.status(400).json({ success: false, message: 'Validasi gagal', errors });
            }

            await Item.update(id, {
                name: name || item.name,
                description: description || item.description,
                unit: unit || item.unit,
                estimated_price: estimated_price !== undefined ? estimated_price : item.estimated_price
            });

            const updatedItem = await Item.findById(id);
            return successResponse(res, 'Item berhasil diupdate', updatedItem);
        } catch (error) {
            console.error('Error updateItem:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    deleteItem: async (req, res) => {
        try {
            const { id } = req.params;
            const item = await Item.findById(id);

            if (!item) {
                return errorResponse(res, 'Item tidak ditemukan', 404);
            }

            await Item.softDelete(id);
            return successResponse(res, 'Item berhasil dihapus');
        } catch (error) {
            console.error('Error deleteItem:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    }
};

module.exports = itemController;

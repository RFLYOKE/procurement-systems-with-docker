const Vendor = require('../models/vendorModel');
const { successResponse, errorResponse } = require('../utils/response');

const vendorController = {
    createVendor: async (req, res) => {
        try {
            const { code, name, contact_person, phone, email, address, npwp, bank_name, bank_account, bank_account_name, category } = req.body;

            // Validation
            const errors = [];
            if (!code) errors.push({ field: 'code', message: 'Code wajib diisi' });
            else if (code.length > 50) errors.push({ field: 'code', message: 'Code max 50 char' });
            if (!name) errors.push({ field: 'name', message: 'Name wajib diisi' });
            else if (name.length > 200) errors.push({ field: 'name', message: 'Name max 200 char' });
            if (!phone) errors.push({ field: 'phone', message: 'Phone wajib diisi' });
            else if (phone.length > 20) errors.push({ field: 'phone', message: 'Phone max 20 char' });
            if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push({ field: 'email', message: 'Format email tidak valid' });
            if (npwp && npwp.length > 30) errors.push({ field: 'npwp', message: 'NPWP max 30 char' });

            if (errors.length > 0) {
                return res.status(400).json({ success: false, message: 'Validasi gagal', errors });
            }

            // Check duplicate code
            const existingVendor = await Vendor.findByCode(code);
            if (existingVendor) {
                return errorResponse(res, 'Code vendor sudah terdaftar', 400);
            }

            const vendorData = {
                code, name, contact_person, phone, email, address, npwp, 
                bank_name, bank_account, bank_account_name, category,
                created_by: req.user.id
            };

            const insertId = await Vendor.create(vendorData);
            const newVendor = await Vendor.findById(insertId);

            return successResponse(res, 'Vendor berhasil dibuat', newVendor, 201);
        } catch (error) {
            console.error('Error createVendor:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    getAllVendors: async (req, res) => {
        try {
            const { search, category, page = 1, limit = 10 } = req.query;
            
            const vendors = await Vendor.findAll({ search, category, page, limit });
            const total = await Vendor.countAll({ search, category });
            
            const totalPages = Math.ceil(total / limit);

            return res.status(200).json({
                success: true,
                message: 'Berhasil mengambil data vendors',
                data: vendors,
                pagination: { total, page: Number(page), limit: Number(limit), totalPages }
            });
        } catch (error) {
            console.error('Error getAllVendors:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    getVendorById: async (req, res) => {
        try {
            const { id } = req.params;
            const vendor = await Vendor.findById(id);

            if (!vendor) {
                return errorResponse(res, 'Vendor tidak ditemukan', 404);
            }

            return successResponse(res, 'Berhasil mengambil data vendor', vendor);
        } catch (error) {
            console.error('Error getVendorById:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    updateVendor: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, contact_person, phone, email, address, npwp, bank_name, bank_account, bank_account_name, category } = req.body;

            const vendor = await Vendor.findById(id);
            if (!vendor) {
                return errorResponse(res, 'Vendor tidak ditemukan', 404);
            }

            const errors = [];
            if (name && name.length > 200) errors.push({ field: 'name', message: 'Name max 200 char' });
            if (phone && phone.length > 20) errors.push({ field: 'phone', message: 'Phone max 20 char' });
            if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push({ field: 'email', message: 'Format email tidak valid' });
            if (npwp && npwp.length > 30) errors.push({ field: 'npwp', message: 'NPWP max 30 char' });

            if (errors.length > 0) {
                return res.status(400).json({ success: false, message: 'Validasi gagal', errors });
            }

            await Vendor.update(id, {
                name: name || vendor.name,
                contact_person: contact_person !== undefined ? contact_person : vendor.contact_person,
                phone: phone || vendor.phone,
                email: email !== undefined ? email : vendor.email,
                address: address !== undefined ? address : vendor.address,
                npwp: npwp !== undefined ? npwp : vendor.npwp,
                bank_name: bank_name !== undefined ? bank_name : vendor.bank_name,
                bank_account: bank_account !== undefined ? bank_account : vendor.bank_account,
                bank_account_name: bank_account_name !== undefined ? bank_account_name : vendor.bank_account_name,
                category: category !== undefined ? category : vendor.category
            });

            const updatedVendor = await Vendor.findById(id);
            return successResponse(res, 'Vendor berhasil diupdate', updatedVendor);
        } catch (error) {
            console.error('Error updateVendor:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    deleteVendor: async (req, res) => {
        try {
            const { id } = req.params;
            const vendor = await Vendor.findById(id);

            if (!vendor) {
                return errorResponse(res, 'Vendor tidak ditemukan', 404);
            }

            await Vendor.softDelete(id);
            return successResponse(res, 'Vendor berhasil dihapus');
        } catch (error) {
            console.error('Error deleteVendor:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    }
};

module.exports = vendorController;

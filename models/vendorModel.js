const pool = require('../config/database');

const vendorModel = {
    findAll: async ({ search, category, page, limit }) => {
        let query = `SELECT * FROM vendors WHERE is_active = true`;
        const params = [];

        if (search) {
            query += ` AND (name LIKE ? OR code LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            query += ` AND category = ?`;
            params.push(category);
        }

        query += ` ORDER BY id DESC`;

        if (page && limit) {
            const offset = (page - 1) * limit;
            query += ` LIMIT ? OFFSET ?`;
            params.push(Number(limit), Number(offset));
        }

        const [rows] = await pool.query(query, params);
        return rows;
    },

    countAll: async ({ search, category }) => {
        let query = `SELECT COUNT(*) as total FROM vendors WHERE is_active = true`;
        const params = [];

        if (search) {
            query += ` AND (name LIKE ? OR code LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            query += ` AND category = ?`;
            params.push(category);
        }

        const [rows] = await pool.query(query, params);
        return rows[0].total;
    },

    findById: async (id) => {
        const [rows] = await pool.query(`SELECT * FROM vendors WHERE id = ? AND is_active = true`, [id]);
        return rows[0];
    },

    findByCode: async (code) => {
        const [rows] = await pool.query(`SELECT * FROM vendors WHERE code = ?`, [code]);
        return rows[0];
    },

    create: async (data) => {
        const { code, name, contact_person, phone, email, address, npwp, bank_name, bank_account, bank_account_name, category, created_by } = data;
        const [result] = await pool.query(
            `INSERT INTO vendors (code, name, contact_person, phone, email, address, npwp, bank_name, bank_account, bank_account_name, category, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [code, name, contact_person, phone, email, address, npwp, bank_name, bank_account, bank_account_name, category, created_by]
        );
        return result.insertId;
    },

    update: async (id, data) => {
        const { name, contact_person, phone, email, address, npwp, bank_name, bank_account, bank_account_name, category } = data;
        const [result] = await pool.query(
            `UPDATE vendors 
             SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, npwp = ?, bank_name = ?, bank_account = ?, bank_account_name = ?, category = ?
             WHERE id = ?`,
            [name, contact_person, phone, email, address, npwp, bank_name, bank_account, bank_account_name, category, id]
        );
        return result.affectedRows;
    },

    softDelete: async (id) => {
        const [result] = await pool.query(`UPDATE vendors SET is_active = false WHERE id = ?`, [id]);
        return result.affectedRows;
    }
};

module.exports = vendorModel;

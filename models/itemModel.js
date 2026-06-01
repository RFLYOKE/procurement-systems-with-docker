const pool = require('../config/database');

const itemModel = {
    findAll: async ({ search, category, page, limit }) => {
        let query = `SELECT * FROM items WHERE is_active = true`;
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
        let query = `SELECT COUNT(*) as total FROM items WHERE is_active = true`;
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
        const [rows] = await pool.query(`SELECT * FROM items WHERE id = ? AND is_active = true`, [id]);
        return rows[0];
    },

    findByCode: async (code) => {
        const [rows] = await pool.query(`SELECT * FROM items WHERE code = ?`, [code]);
        return rows[0];
    },

    create: async (data) => {
        const { code, name, description, category, unit, estimated_price, created_by } = data;
        const [result] = await pool.query(
            `INSERT INTO items (code, name, description, category, unit, estimated_price, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [code, name, description, category, unit, estimated_price || 0, created_by]
        );
        return result.insertId;
    },

    update: async (id, data) => {
        const { name, description, unit, estimated_price } = data;
        const [result] = await pool.query(
            `UPDATE items 
             SET name = ?, description = ?, unit = ?, estimated_price = ?
             WHERE id = ?`,
            [name, description, unit, estimated_price, id]
        );
        return result.affectedRows;
    },

    softDelete: async (id) => {
        const [result] = await pool.query(`UPDATE items SET is_active = false WHERE id = ?`, [id]);
        return result.affectedRows;
    }
};

module.exports = itemModel;

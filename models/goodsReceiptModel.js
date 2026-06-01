const pool = require('../config/database');

const goodsReceiptModel = {
    findAll: async ({ poId, requesterId, status, startDate, endDate, page, limit }) => {
        let query = `
            SELECT gr.*,
                   po.po_number, po.status as po_status,
                   pr.request_number, pr.title as request_title, pr.requester_id,
                   u.name as receiver_name, u.department as receiver_department
            FROM goods_receipts gr
            JOIN purchase_orders po ON gr.po_id = po.id
            JOIN procurement_requests pr ON gr.request_id = pr.id
            JOIN users u ON gr.received_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (poId) {
            query += ` AND gr.po_id = ?`;
            params.push(poId);
        }
        if (requesterId) {
            query += ` AND pr.requester_id = ?`;
            params.push(requesterId);
        }
        if (status) {
            query += ` AND gr.status = ?`;
            params.push(status);
        }
        if (startDate) {
            query += ` AND gr.received_date >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND gr.received_date <= ?`;
            params.push(endDate);
        }

        query += ` ORDER BY gr.id DESC`;

        if (page && limit) {
            const offset = (page - 1) * limit;
            query += ` LIMIT ? OFFSET ?`;
            params.push(Number(limit), Number(offset));
        }

        const [rows] = await pool.query(query, params);
        return rows;
    },

    countAll: async ({ poId, requesterId, status, startDate, endDate }) => {
        let query = `
            SELECT COUNT(*) as total
            FROM goods_receipts gr
            JOIN procurement_requests pr ON gr.request_id = pr.id
            WHERE 1=1
        `;
        const params = [];

        if (poId) {
            query += ` AND gr.po_id = ?`;
            params.push(poId);
        }
        if (requesterId) {
            query += ` AND pr.requester_id = ?`;
            params.push(requesterId);
        }
        if (status) {
            query += ` AND gr.status = ?`;
            params.push(status);
        }
        if (startDate) {
            query += ` AND gr.received_date >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND gr.received_date <= ?`;
            params.push(endDate);
        }

        const [rows] = await pool.query(query, params);
        return rows[0].total;
    },

    findById: async (id) => {
        const [rows] = await pool.query(`
            SELECT gr.*,
                   po.id as po_pk, po.po_number, po.status as po_status,
                   pr.id as pr_id, pr.request_number, pr.title as request_title,
                   u.id as receiver_id, u.name as receiver_name, u.department as receiver_department
            FROM goods_receipts gr
            JOIN purchase_orders po ON gr.po_id = po.id
            JOIN procurement_requests pr ON gr.request_id = pr.id
            JOIN users u ON gr.received_by = u.id
            WHERE gr.id = ?
        `, [id]);
        return rows[0];
    },

    findItems: async (grId) => {
        const [rows] = await pool.query(`
            SELECT gri.*, i.name as item_name, i.code as item_code
            FROM goods_receipt_items gri
            JOIN items i ON gri.item_id = i.id
            WHERE gri.gr_id = ?
        `, [grId]);
        return rows;
    },

    create: async (data, connection) => {
        const { gr_number, po_id, request_id, received_by, received_date, status, notes } = data;
        const [result] = await connection.query(
            `INSERT INTO goods_receipts (gr_number, po_id, request_id, received_by, received_date, status, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [gr_number, po_id, request_id, received_by, received_date, status, notes || null]
        );
        return result.insertId;
    },

    createItems: async (grId, items, connection) => {
        for (const item of items) {
            await connection.query(
                `INSERT INTO goods_receipt_items (gr_id, item_id, po_item_id, quantity_ordered, quantity_received, condition_notes)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [grId, item.item_id, item.po_item_id, item.quantity_ordered, item.quantity_received, item.condition_notes || null]
            );
        }
    },

    getTotalReceivedByPOItem: async (poItemId, connection) => {
        const db = connection || pool;
        const [rows] = await db.query(
            `SELECT COALESCE(SUM(quantity_received), 0) as total_received 
             FROM goods_receipt_items WHERE po_item_id = ?`,
            [poItemId]
        );
        return parseFloat(rows[0].total_received);
    },
};

module.exports = goodsReceiptModel;

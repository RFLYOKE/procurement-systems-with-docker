const pool = require('../config/database');

const purchaseOrderModel = {
    findAll: async ({ status, vendorId, startDate, endDate, page, limit }) => {
        let query = `
            SELECT po.*, 
                   v.name as vendor_name, v.code as vendor_code,
                   pr.request_number, pr.title as request_title,
                   u.name as creator_name
            FROM purchase_orders po
            JOIN vendors v ON po.vendor_id = v.id
            JOIN procurement_requests pr ON po.request_id = pr.id
            JOIN users u ON po.created_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ` AND po.status = ?`;
            params.push(status);
        }
        if (vendorId) {
            query += ` AND po.vendor_id = ?`;
            params.push(vendorId);
        }
        if (startDate) {
            query += ` AND po.po_date >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND po.po_date <= ?`;
            params.push(endDate);
        }

        query += ` ORDER BY po.id DESC`;

        if (page && limit) {
            const offset = (page - 1) * limit;
            query += ` LIMIT ? OFFSET ?`;
            params.push(Number(limit), Number(offset));
        }

        const [rows] = await pool.query(query, params);
        return rows;
    },

    countAll: async ({ status, vendorId, startDate, endDate }) => {
        let query = `SELECT COUNT(*) as total FROM purchase_orders po WHERE 1=1`;
        const params = [];

        if (status) {
            query += ` AND po.status = ?`;
            params.push(status);
        }
        if (vendorId) {
            query += ` AND po.vendor_id = ?`;
            params.push(vendorId);
        }
        if (startDate) {
            query += ` AND po.po_date >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND po.po_date <= ?`;
            params.push(endDate);
        }

        const [rows] = await pool.query(query, params);
        return rows[0].total;
    },

    findById: async (id) => {
        const [rows] = await pool.query(`
            SELECT po.*,
                   v.id as v_id, v.code as vendor_code, v.name as vendor_name,
                   v.contact_person, v.phone as vendor_phone, v.email as vendor_email,
                   pr.id as pr_id, pr.request_number, pr.title as request_title, pr.status as request_status,
                   u.name as creator_name
            FROM purchase_orders po
            JOIN vendors v ON po.vendor_id = v.id
            JOIN procurement_requests pr ON po.request_id = pr.id
            JOIN users u ON po.created_by = u.id
            WHERE po.id = ?
        `, [id]);
        return rows[0];
    },

    findItems: async (poId) => {
        const [rows] = await pool.query(`
            SELECT poi.*, i.name as item_name, i.code as item_code, i.unit as master_unit
            FROM purchase_order_items poi
            JOIN items i ON poi.item_id = i.id
            WHERE poi.po_id = ?
        `, [poId]);
        return rows;
    },

    create: async (data, connection) => {
        const { po_number, request_id, vendor_id, created_by, po_date, expected_delivery_date, total_amount, payment_terms, delivery_address, notes } = data;
        const [result] = await connection.query(
            `INSERT INTO purchase_orders 
             (po_number, request_id, vendor_id, created_by, po_date, expected_delivery_date, total_amount, payment_terms, delivery_address, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [po_number, request_id, vendor_id, created_by, po_date, expected_delivery_date, total_amount, payment_terms || null, delivery_address || null, notes || null]
        );
        return result.insertId;
    },

    createItems: async (poId, items, connection) => {
        for (const item of items) {
            await connection.query(
                `INSERT INTO purchase_order_items (po_id, item_id, quantity, unit, unit_price, notes)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [poId, item.item_id, item.quantity, item.unit || null, item.unit_price, item.notes || null]
            );
        }
    },

    updateStatus: async (id, status) => {
        const [result] = await pool.query(
            `UPDATE purchase_orders SET status = ?, updated_at = NOW() WHERE id = ?`,
            [status, id]
        );
        return result.affectedRows;
    },

    findByRequestId: async (requestId) => {
        const [rows] = await pool.query(
            `SELECT * FROM purchase_orders WHERE request_id = ? AND status != 'cancelled'`,
            [requestId]
        );
        return rows[0];
    },
};

module.exports = purchaseOrderModel;

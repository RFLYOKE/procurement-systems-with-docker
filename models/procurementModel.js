const pool = require('../config/database');

const procurementModel = {
    findAll: async ({ requesterId, status, priority, startDate, endDate, page, limit }) => {
        let query = `
            SELECT pr.*, u.name as requester_name, u.department as requester_department
            FROM procurement_requests pr
            JOIN users u ON pr.requester_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (requesterId) {
            query += ` AND pr.requester_id = ?`;
            params.push(requesterId);
        }
        if (status) {
            query += ` AND pr.status = ?`;
            params.push(status);
        }
        if (priority) {
            query += ` AND pr.priority = ?`;
            params.push(priority);
        }
        if (startDate) {
            query += ` AND pr.created_at >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND pr.created_at <= ?`;
            params.push(endDate);
        }

        query += ` ORDER BY pr.id DESC`;

        if (page && limit) {
            const offset = (page - 1) * limit;
            query += ` LIMIT ? OFFSET ?`;
            params.push(Number(limit), Number(offset));
        }

        const [rows] = await pool.query(query, params);
        return rows;
    },

    countAll: async ({ requesterId, status, priority, startDate, endDate }) => {
        let query = `SELECT COUNT(*) as total FROM procurement_requests pr WHERE 1=1`;
        const params = [];

        if (requesterId) {
            query += ` AND pr.requester_id = ?`;
            params.push(requesterId);
        }
        if (status) {
            query += ` AND pr.status = ?`;
            params.push(status);
        }
        if (priority) {
            query += ` AND pr.priority = ?`;
            params.push(priority);
        }
        if (startDate) {
            query += ` AND pr.created_at >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND pr.created_at <= ?`;
            params.push(endDate);
        }

        const [rows] = await pool.query(query, params);
        return rows[0].total;
    },

    findById: async (id) => {
        const [rows] = await pool.query(`
            SELECT pr.*, u.name as requester_name, u.email as requester_email, u.department as requester_department
            FROM procurement_requests pr
            JOIN users u ON pr.requester_id = u.id
            WHERE pr.id = ?
        `, [id]);
        return rows[0];
    },

    findItems: async (requestId) => {
        const [rows] = await pool.query(`
            SELECT pri.*, i.name as item_name, i.code as item_code, i.category, i.unit as master_unit
            FROM procurement_request_items pri
            JOIN items i ON pri.item_id = i.id
            WHERE pri.request_id = ?
        `, [requestId]);
        return rows;
    },

    create: async (data, connection) => {
        const { request_number, title, description, requester_id, department, required_date, total_estimated_price, priority, notes } = data;
        const [result] = await connection.query(
            `INSERT INTO procurement_requests (request_number, title, description, requester_id, department, required_date, total_estimated_price, priority, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [request_number, title, description, requester_id, department, required_date, total_estimated_price, priority || 'medium', notes]
        );
        return result.insertId;
    },

    createItems: async (requestId, items, connection) => {
        for (let item of items) {
            await connection.query(
                `INSERT INTO procurement_request_items (request_id, item_id, quantity, unit, estimated_price, notes)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [requestId, item.item_id, item.quantity, item.unit, item.estimated_price, item.notes]
            );
        }
    },

    update: async (id, data, connection) => {
        const { title, description, required_date, total_estimated_price, priority, notes } = data;
        const [result] = await connection.query(
            `UPDATE procurement_requests 
             SET title = ?, description = ?, required_date = ?, total_estimated_price = ?, priority = ?, notes = ?
             WHERE id = ?`,
            [title, description, required_date, total_estimated_price, priority, notes, id]
        );
        return result.affectedRows;
    },

    deleteItems: async (requestId, connection) => {
        const [result] = await connection.query(`DELETE FROM procurement_request_items WHERE request_id = ?`, [requestId]);
        return result.affectedRows;
    },

    softUpdateStatus: async (id, status) => {
        const [result] = await pool.query(`UPDATE procurement_requests SET status = ? WHERE id = ?`, [status, id]);
        return result.affectedRows;
    },
    
    deleteProcurement: async(id) => {
         const [result] = await pool.query(`DELETE FROM procurement_requests WHERE id = ?`, [id]);
         return result.affectedRows;
    },

    calculateTotal: (items) => {
        return items.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.estimated_price)), 0);
    }
};

module.exports = procurementModel;

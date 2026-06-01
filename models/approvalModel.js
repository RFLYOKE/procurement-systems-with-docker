const pool = require('../config/database');

const approvalModel = {
    /**
     * Cari procurement request berdasarkan ID (dengan info requester)
     */
    findRequestById: async (id) => {
        const [rows] = await pool.query(`
            SELECT pr.*, u.name as requester_name, u.department
            FROM procurement_requests pr
            JOIN users u ON pr.requester_id = u.id
            WHERE pr.id = ?
        `, [id]);
        return rows[0];
    },

    /**
     * Update status procurement request
     */
    updateStatus: async (id, status) => {
        const [result] = await pool.query(
            `UPDATE procurement_requests SET status = ?, updated_at = NOW() WHERE id = ?`,
            [status, id]
        );
        return result.affectedRows;
    },

    /**
     * Insert riwayat approval ke tabel approval_histories
     */
    createHistory: async (data) => {
        const { request_id, approver_id, role, action, notes, status_before, status_after } = data;
        const [result] = await pool.query(
            `INSERT INTO approval_histories 
             (request_id, approver_id, role, action, notes, status_before, status_after)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [request_id, approver_id, role, action, notes, status_before, status_after]
        );
        return result.insertId;
    },

    /**
     * Ambil semua riwayat approval berdasarkan request_id
     */
    findHistoriesByRequestId: async (requestId) => {
        const [rows] = await pool.query(`
            SELECT ah.*, u.name as approver_name, u.email as approver_email
            FROM approval_histories ah
            JOIN users u ON ah.approver_id = u.id
            WHERE ah.request_id = ?
            ORDER BY ah.created_at ASC
        `, [requestId]);
        return rows;
    },

    /**
     * Ambil daftar pengajuan yang pending berdasarkan status list & filter
     */
    findPendingByStatus: async (statusList, filters = {}) => {
        const { department, priority, page = 1, limit = 10 } = filters;

        let query = `
            SELECT pr.*, u.name as requester_name, u.department
            FROM procurement_requests pr
            JOIN users u ON pr.requester_id = u.id
            WHERE pr.status IN (?)
        `;
        const params = [statusList];

        if (department) {
            query += ` AND pr.department = ?`;
            params.push(department);
        }
        if (priority) {
            query += ` AND pr.priority = ?`;
            params.push(priority);
        }

        query += ` ORDER BY pr.created_at ASC`;

        const offset = (page - 1) * limit;
        query += ` LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const [rows] = await pool.query(query, params);
        return rows;
    },

    /**
     * Hitung total pengajuan pending untuk pagination
     */
    countPending: async (statusList, filters = {}) => {
        const { department, priority } = filters;

        let query = `
            SELECT COUNT(*) as total
            FROM procurement_requests pr
            WHERE pr.status IN (?)
        `;
        const params = [statusList];

        if (department) {
            query += ` AND pr.department = ?`;
            params.push(department);
        }
        if (priority) {
            query += ` AND pr.priority = ?`;
            params.push(priority);
        }

        const [rows] = await pool.query(query, params);
        return rows[0].total;
    },
};

module.exports = approvalModel;

const pool = require('../config/database');

const reportModel = {
    /**
     * 1. Ringkasan procurement: total, nilai, group by status
     */
    getProcurementSummary: async ({ startDate, endDate, status, department }) => {
        let query = `
            SELECT
                status,
                COUNT(*) as count_per_status,
                SUM(total_estimated_price) as value_per_status
            FROM procurement_requests
            WHERE created_at BETWEEN ? AND ?
        `;
        const params = [startDate, endDate];

        if (status) { query += ` AND status = ?`; params.push(status); }
        if (department) { query += ` AND department = ?`; params.push(department); }

        query += ` GROUP BY status`;

        const [rows] = await pool.query(query, params);

        // Build by_status map with all possible statuses defaulting to 0
        const allStatuses = [
            'draft', 'submitted', 'approved_supervisor',
            'approved_finance', 'approved_purchasing',
            'rejected', 'purchased', 'received'
        ];
        const byStatus = {};
        allStatuses.forEach(s => (byStatus[s] = 0));

        let totalRequests = 0;
        let totalValue = 0;

        for (const row of rows) {
            byStatus[row.status] = Number(row.count_per_status);
            totalRequests += Number(row.count_per_status);
            totalValue += Number(row.value_per_status || 0);
        }

        return { total_requests: totalRequests, total_value: totalValue, by_status: byStatus };
    },

    /**
     * 2. Procurement group by department
     */
    getProcurementByDepartment: async ({ startDate, endDate, department }) => {
        let query = `
            SELECT
                department,
                COUNT(*) as total,
                SUM(total_estimated_price) as total_value
            FROM procurement_requests
            WHERE created_at BETWEEN ? AND ?
        `;
        const params = [startDate, endDate];
        if (department) { query += ` AND department = ?`; params.push(department); }
        query += ` GROUP BY department ORDER BY total_value DESC`;

        const [rows] = await pool.query(query, params);
        return rows;
    },

    /**
     * 3. Procurement group by month
     */
    getProcurementByMonth: async ({ startDate, endDate }) => {
        const [rows] = await pool.query(`
            SELECT
                DATE_FORMAT(created_at, '%Y-%m') as month,
                COUNT(*) as total,
                SUM(total_estimated_price) as total_value
            FROM procurement_requests
            WHERE created_at BETWEEN ? AND ?
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month ASC
        `, [startDate, endDate]);
        return rows;
    },

    /**
     * 4. List procurement dengan pagination
     */
    getProcurementList: async ({ startDate, endDate, status, department, page, limit }) => {
        let query = `
            SELECT pr.*, u.name as requester_name
            FROM procurement_requests pr
            JOIN users u ON pr.requester_id = u.id
            WHERE pr.created_at BETWEEN ? AND ?
        `;
        const params = [startDate, endDate];

        if (status) { query += ` AND pr.status = ?`; params.push(status); }
        if (department) { query += ` AND pr.department = ?`; params.push(department); }

        query += ` ORDER BY pr.created_at DESC`;

        const offset = (page - 1) * limit;
        query += ` LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const [rows] = await pool.query(query, params);
        return rows;
    },

    countProcurementList: async ({ startDate, endDate, status, department }) => {
        let query = `SELECT COUNT(*) as total FROM procurement_requests pr WHERE pr.created_at BETWEEN ? AND ?`;
        const params = [startDate, endDate];
        if (status) { query += ` AND pr.status = ?`; params.push(status); }
        if (department) { query += ` AND pr.department = ?`; params.push(department); }
        const [rows] = await pool.query(query, params);
        return rows[0].total;
    },

    /**
     * 5. Laporan vendor: total PO, nilai, completed
     */
    getVendorReport: async ({ startDate, endDate, vendorId }) => {
        let query = `
            SELECT
                v.id, v.code, v.name, v.category,
                COUNT(po.id) as total_po,
                COALESCE(SUM(po.total_amount), 0) as total_amount,
                COUNT(CASE WHEN po.status = 'completed' THEN 1 END) as completed_po
            FROM vendors v
            LEFT JOIN purchase_orders po
                ON po.vendor_id = v.id
                AND po.created_at BETWEEN ? AND ?
            WHERE v.is_active = true
        `;
        const params = [startDate, endDate];

        if (vendorId) { query += ` AND v.id = ?`; params.push(vendorId); }

        query += ` GROUP BY v.id ORDER BY total_amount DESC`;

        const [rows] = await pool.query(query, params);
        return rows;
    },

    /**
     * 6. Approval performance: avg waktu, approved/rejected per role & approver
     */
    getApprovalPerformance: async ({ startDate, endDate }) => {
        const [rows] = await pool.query(`
            SELECT
                ah.status_before as approval_level,
                ah.role,
                u.name as approver_name,
                AVG(TIMESTAMPDIFF(HOUR, pr.created_at, ah.created_at)) as avg_hours,
                COUNT(CASE WHEN ah.action = 'approved' THEN 1 END) as total_approved,
                COUNT(CASE WHEN ah.action = 'rejected' THEN 1 END) as total_rejected
            FROM approval_histories ah
            JOIN procurement_requests pr ON ah.request_id = pr.id
            JOIN users u ON ah.approver_id = u.id
            WHERE ah.created_at BETWEEN ? AND ?
            GROUP BY ah.role, ah.approver_id
            ORDER BY ah.role
        `, [startDate, endDate]);
        return rows;
    },

    /**
     * 7. Dashboard: Admin
     */
    getDashboardAdmin: async () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const today = now.toISOString().split('T')[0] + ' 23:59:59';

        const [[usersRows]] = await pool.query(`
            SELECT
                SUM(CASE WHEN role = 'requester'  THEN 1 ELSE 0 END) as requester,
                SUM(CASE WHEN role = 'supervisor' THEN 1 ELSE 0 END) as supervisor,
                SUM(CASE WHEN role = 'finance'    THEN 1 ELSE 0 END) as finance,
                SUM(CASE WHEN role = 'purchasing' THEN 1 ELSE 0 END) as purchasing
            FROM users WHERE is_active = true
        `);

        const [statusRows] = await pool.query(`
            SELECT status, COUNT(*) as total
            FROM procurement_requests
            GROUP BY status
        `);
        const allStatuses = ['draft','submitted','approved_supervisor','approved_finance','approved_purchasing','rejected','purchased','received'];
        const byStatus = {};
        allStatuses.forEach(s => (byStatus[s] = 0));
        statusRows.forEach(r => (byStatus[r.status] = Number(r.total)));

        const [[monthProcRow]] = await pool.query(`
            SELECT COALESCE(SUM(total_estimated_price), 0) as total_value
            FROM procurement_requests
            WHERE created_at BETWEEN ? AND ?
        `, [firstDay, today]);

        const [[monthPORow]] = await pool.query(`
            SELECT COUNT(*) as total_count, COALESCE(SUM(total_amount), 0) as total_value
            FROM purchase_orders
            WHERE created_at BETWEEN ? AND ?
        `, [firstDay, today]);

        const [[vendorRow]] = await pool.query(`SELECT COUNT(*) as total FROM vendors WHERE is_active = true`);

        return {
            total_users_active: {
                requester:  Number(usersRows.requester  || 0),
                supervisor: Number(usersRows.supervisor || 0),
                finance:    Number(usersRows.finance    || 0),
                purchasing: Number(usersRows.purchasing || 0),
            },
            procurement_summary: { by_status: byStatus },
            this_month: {
                total_procurement_value: Number(monthProcRow.total_value),
                total_po_value:          Number(monthPORow.total_value),
                total_po_count:          Number(monthPORow.total_count),
            },
            total_vendor_active: Number(vendorRow.total),
        };
    },

    /**
     * 8. Dashboard: Requester (by userId)
     */
    getDashboardByRequester: async (userId) => {
        const [rows] = await pool.query(`
            SELECT status, COUNT(*) as total
            FROM procurement_requests
            WHERE requester_id = ?
            GROUP BY status
        `, [userId]);

        const byStatus = { draft:0, submitted:0, approved_supervisor:0, approved_finance:0, approved_purchasing:0, rejected:0, purchased:0, received:0 };
        let grandTotal = 0;
        rows.forEach(r => {
            byStatus[r.status] = Number(r.total);
            grandTotal += Number(r.total);
        });

        return {
            my_requests: {
                total:               grandTotal,
                draft:               byStatus.draft,
                submitted:           byStatus.submitted,
                approved:            byStatus.approved_supervisor + byStatus.approved_finance + byStatus.approved_purchasing,
                rejected:            byStatus.rejected,
                purchased:           byStatus.purchased,
                received:            byStatus.received,
            }
        };
    },

    /**
     * 9. Dashboard: Supervisor / Finance
     */
    getDashboardByApprover: async (role, userId) => {
        const pendingStatusMap = {
            supervisor: ['submitted'],
            finance:    ['approved_supervisor'],
            purchasing: ['approved_finance'],
        };
        const pendingStatuses = pendingStatusMap[role] || [];

        const [[pendingRow]] = await pool.query(
            `SELECT COUNT(*) as total FROM procurement_requests WHERE status IN (?)`,
            [pendingStatuses]
        );

        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const today = now.toISOString().split('T')[0] + ' 23:59:59';

        const [[thisMonthRow]] = await pool.query(`
            SELECT
                COUNT(CASE WHEN action = 'approved' THEN 1 END) as total_approved,
                COUNT(CASE WHEN action = 'rejected' THEN 1 END) as total_rejected
            FROM approval_histories
            WHERE approver_id = ? AND created_at BETWEEN ? AND ?
        `, [userId, firstDay, today]);

        return {
            pending_approval: Number(pendingRow.total),
            this_month: {
                total_approved: Number(thisMonthRow.total_approved),
                total_rejected: Number(thisMonthRow.total_rejected),
            }
        };
    },

    /**
     * 10. Dashboard: Purchasing (extended with PO info)
     */
    getDashboardByPurchasing: async (userId) => {
        const [[pendingRow]] = await pool.query(`
            SELECT COUNT(*) as total FROM procurement_requests WHERE status = 'approved_finance'
        `);

        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const today = now.toISOString().split('T')[0] + ' 23:59:59';

        const [[approvalRow]] = await pool.query(`
            SELECT
                COUNT(CASE WHEN action = 'approved' THEN 1 END) as total_approved,
                COUNT(CASE WHEN action = 'rejected' THEN 1 END) as total_rejected
            FROM approval_histories
            WHERE approver_id = ? AND created_at BETWEEN ? AND ?
        `, [userId, firstDay, today]);

        const [[poRow]] = await pool.query(`
            SELECT COUNT(*) as total_po, COALESCE(SUM(total_amount), 0) as total_value
            FROM purchase_orders
            WHERE created_by = ? AND created_at BETWEEN ? AND ?
        `, [userId, firstDay, today]);

        return {
            pending_approval:  Number(pendingRow.total),
            this_month: {
                total_approved:   Number(approvalRow.total_approved),
                total_po_created: Number(poRow.total_po),
                total_po_value:   Number(poRow.total_value),
            }
        };
    },
};

module.exports = reportModel;

const Report = require('../models/reportModel');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Helper: default period = first day of current month → today
 */
const getDefaultPeriod = (startDate, endDate) => {
    const now = new Date();
    const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end   = endDate   || now.toISOString().split('T')[0];
    return { start, end: end + ' 23:59:59' };
};

const reportController = {
    /**
     * GET /api/reports/procurement
     */
    getProcurementReport: async (req, res) => {
        try {
            const { start_date, end_date, status, department, page = 1, limit = 10 } = req.query;
            const { start, end } = getDefaultPeriod(start_date, end_date);

            const filters = { startDate: start, endDate: end, status, department };

            // Run all queries in parallel
            const [summary, byDepartment, byMonth, listData, listTotal] = await Promise.all([
                Report.getProcurementSummary(filters),
                Report.getProcurementByDepartment(filters),
                Report.getProcurementByMonth(filters),
                Report.getProcurementList({ ...filters, page, limit }),
                Report.countProcurementList(filters),
            ]);

            const totalPages = Math.ceil(listTotal / limit);

            return successResponse(res, 'Laporan procurement berhasil diambil', {
                period: { start_date: start, end_date: end },
                summary,
                by_department: byDepartment,
                by_month: byMonth,
                requests: {
                    data: listData,
                    pagination: {
                        total: listTotal,
                        page: Number(page),
                        limit: Number(limit),
                        totalPages,
                    },
                },
            });
        } catch (error) {
            console.error('Error getProcurementReport:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    /**
     * GET /api/reports/vendor
     */
    getVendorReport: async (req, res) => {
        try {
            const { start_date, end_date, vendor_id } = req.query;
            const { start, end } = getDefaultPeriod(start_date, end_date);

            const vendors = await Report.getVendorReport({
                startDate: start,
                endDate: end,
                vendorId: vendor_id || null,
            });

            return successResponse(res, 'Laporan vendor berhasil diambil', {
                period: { start_date: start, end_date: end },
                vendors: vendors.map(v => ({
                    id:           v.id,
                    code:         v.code,
                    name:         v.name,
                    category:     v.category,
                    total_po:     Number(v.total_po),
                    completed_po: Number(v.completed_po),
                    total_amount: Number(v.total_amount),
                })),
            });
        } catch (error) {
            console.error('Error getVendorReport:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    /**
     * GET /api/reports/approval-performance
     */
    getApprovalPerformanceReport: async (req, res) => {
        try {
            const { start_date, end_date } = req.query;
            const { start, end } = getDefaultPeriod(start_date, end_date);

            const rows = await Report.getApprovalPerformance({ startDate: start, endDate: end });

            // Separate by_level (aggregated) vs by_approver (individual)
            const byLevel = {};
            const byApprover = [];

            for (const row of rows) {
                const level = row.approval_level;
                if (!byLevel[level]) {
                    byLevel[level] = {
                        approval_level: level,
                        role:           row.role,
                        avg_hours:      0,
                        total_approved: 0,
                        total_rejected: 0,
                        _count:         0,
                    };
                }
                byLevel[level].avg_hours      = ((byLevel[level].avg_hours * byLevel[level]._count) + Number(row.avg_hours || 0)) / (byLevel[level]._count + 1);
                byLevel[level].total_approved += Number(row.total_approved);
                byLevel[level].total_rejected += Number(row.total_rejected);
                byLevel[level]._count++;

                byApprover.push({
                    approver_name:  row.approver_name,
                    role:           row.role,
                    total_approved: Number(row.total_approved),
                    total_rejected: Number(row.total_rejected),
                });
            }

            const byLevelArray = Object.values(byLevel).map(({ _count, ...rest }) => ({
                ...rest,
                avg_hours: Math.round(rest.avg_hours * 10) / 10,
            }));

            return successResponse(res, 'Laporan performa approval berhasil diambil', {
                period:       { start_date: start, end_date: end },
                by_level:     byLevelArray,
                by_approver:  byApprover,
            });
        } catch (error) {
            console.error('Error getApprovalPerformanceReport:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    /**
     * GET /api/reports/dashboard
     */
    getDashboard: async (req, res) => {
        try {
            const { role, id } = req.user;
            let dashboardData;

            switch (role) {
                case 'admin':
                    dashboardData = await Report.getDashboardAdmin();
                    break;
                case 'requester':
                    dashboardData = await Report.getDashboardByRequester(id);
                    break;
                case 'supervisor':
                case 'finance':
                    dashboardData = await Report.getDashboardByApprover(role, id);
                    break;
                case 'purchasing':
                    dashboardData = await Report.getDashboardByPurchasing(id);
                    break;
                default:
                    return errorResponse(res, 'Role tidak dikenali', 403);
            }

            return successResponse(res, 'Dashboard berhasil diambil', {
                role,
                ...dashboardData,
            });
        } catch (error) {
            console.error('Error getDashboard:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },
};

module.exports = reportController;

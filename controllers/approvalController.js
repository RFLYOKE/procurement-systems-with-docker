const Approval = require('../models/approvalModel');
const { isAllowedToApprove, getNextStatus, canBeRejected } = require('../utils/approvalHelper');
const { successResponse, errorResponse } = require('../utils/response');

const approvalController = {
    /**
     * POST /api/approvals/:request_id/approve
     * Approve pengajuan sesuai level berjenjang
     */
    approveProcurement: async (req, res) => {
        try {
            const { request_id } = req.params;

            const procurement = await Approval.findRequestById(request_id);
            if (!procurement) {
                return errorResponse(res, 'Pengajuan tidak ditemukan', 404);
            }

            const currentStatus = procurement.status;

            if (!isAllowedToApprove(currentStatus, req.user.role)) {
                return errorResponse(res, 'Anda tidak berhak approve di tahap ini', 403);
            }

            let nextStatus;
            try {
                nextStatus = getNextStatus(currentStatus);
            } catch (err) {
                return errorResponse(res, err.message, 400);
            }

            await Approval.updateStatus(procurement.id, nextStatus);

            await Approval.createHistory({
                request_id:    procurement.id,
                approver_id:   req.user.id,
                role:          req.user.role,
                action:        'approved',
                notes:         req.body.notes || null,
                status_before: currentStatus,
                status_after:  nextStatus,
            });

            return successResponse(res, 'Pengajuan berhasil disetujui', {
                id:             procurement.id,
                request_number: procurement.request_number,
                status_before:  currentStatus,
                status_after:   nextStatus,
                approved_by: {
                    id:   req.user.id,
                    name: req.user.name,
                    role: req.user.role,
                },
                notes:       req.body.notes || null,
                approved_at: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Error approveProcurement:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    /**
     * POST /api/approvals/:request_id/reject
     * Reject pengajuan dari level manapun yang valid
     */
    rejectProcurement: async (req, res) => {
        try {
            const { request_id } = req.params;

            const procurement = await Approval.findRequestById(request_id);
            if (!procurement) {
                return errorResponse(res, 'Pengajuan tidak ditemukan', 404);
            }

            const currentStatus = procurement.status;

            if (!canBeRejected(currentStatus)) {
                return errorResponse(res, 'Pengajuan tidak bisa ditolak pada status ini', 400);
            }

            if (!isAllowedToApprove(currentStatus, req.user.role)) {
                return errorResponse(res, 'Anda tidak berhak melakukan aksi ini', 403);
            }

            if (!req.body.notes || req.body.notes.trim() === '') {
                return errorResponse(res, 'Catatan penolakan wajib diisi', 400);
            }

            await Approval.updateStatus(procurement.id, 'rejected');

            await Approval.createHistory({
                request_id:    procurement.id,
                approver_id:   req.user.id,
                role:          req.user.role,
                action:        'rejected',
                notes:         req.body.notes,
                status_before: currentStatus,
                status_after:  'rejected',
            });

            return successResponse(res, 'Pengajuan berhasil ditolak', {
                id:             procurement.id,
                request_number: procurement.request_number,
                status_before:  currentStatus,
                status_after:   'rejected',
                rejected_by: {
                    id:   req.user.id,
                    name: req.user.name,
                    role: req.user.role,
                },
                notes:       req.body.notes,
                rejected_at: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Error rejectProcurement:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    /**
     * GET /api/approvals/:request_id/history
     * Ambil riwayat approval lengkap per pengajuan
     */
    getApprovalHistory: async (req, res) => {
        try {
            const { request_id } = req.params;

            const procurement = await Approval.findRequestById(request_id);
            if (!procurement) {
                return errorResponse(res, 'Pengajuan tidak ditemukan', 404);
            }

            const histories = await Approval.findHistoriesByRequestId(request_id);

            const formattedHistories = histories.map((h) => ({
                id:            h.id,
                action:        h.action,
                status_before: h.status_before,
                status_after:  h.status_after,
                notes:         h.notes,
                approver: {
                    id:    h.approver_id,
                    name:  h.approver_name,
                    role:  h.role,
                    email: h.approver_email,
                },
                created_at: h.created_at,
            }));

            return successResponse(res, 'Riwayat approval berhasil diambil', {
                request_id:     procurement.id,
                request_number: procurement.request_number,
                current_status: procurement.status,
                histories:      formattedHistories,
            });
        } catch (error) {
            console.error('Error getApprovalHistory:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },

    /**
     * GET /api/approvals/pending
     * Ambil daftar pengajuan yang menunggu approval sesuai role login
     */
    getPendingApprovals: async (req, res) => {
        try {
            const roleStatusMap = {
                supervisor: ['submitted'],
                finance:    ['approved_supervisor'],
                purchasing: ['approved_finance'],
                admin:      ['submitted', 'approved_supervisor', 'approved_finance'],
            };

            const statusList = roleStatusMap[req.user.role];
            if (!statusList) {
                return errorResponse(res, 'Role Anda tidak memiliki akses ke pending approvals', 403);
            }

            const { department, priority, page = 1, limit = 10 } = req.query;
            const filters = {
                department,
                priority,
                page: Number(page),
                limit: Number(limit),
            };

            const data = await Approval.findPendingByStatus(statusList, filters);
            const total = await Approval.countPending(statusList, filters);
            const totalPages = Math.ceil(total / filters.limit);

            return res.status(200).json({
                success: true,
                message: 'Berhasil mengambil data pending approvals',
                data,
                pagination: {
                    total,
                    page:       filters.page,
                    limit:      filters.limit,
                    totalPages,
                },
            });
        } catch (error) {
            console.error('Error getPendingApprovals:', error);
            return errorResponse(res, 'Terjadi kesalahan server', 500);
        }
    },
};

module.exports = approvalController;

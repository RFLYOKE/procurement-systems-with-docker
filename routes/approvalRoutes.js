const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// PENTING: route '/pending' harus di atas '/:request_id/...'
// agar tidak tertangkap sebagai request_id = "pending"

router.get(
    '/pending',
    verifyToken,
    authorizeRoles('supervisor', 'finance', 'purchasing', 'admin'),
    approvalController.getPendingApprovals
);

router.post(
    '/:request_id/approve',
    verifyToken,
    authorizeRoles('supervisor', 'finance', 'purchasing', 'admin'),
    approvalController.approveProcurement
);

router.post(
    '/:request_id/reject',
    verifyToken,
    authorizeRoles('supervisor', 'finance', 'purchasing', 'admin'),
    approvalController.rejectProcurement
);

router.get(
    '/:request_id/history',
    verifyToken,
    approvalController.getApprovalHistory
);

module.exports = router;

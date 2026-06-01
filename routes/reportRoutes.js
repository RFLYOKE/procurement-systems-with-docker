const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.get('/procurement',
    verifyToken,
    authorizeRoles('admin', 'finance', 'purchasing'),
    reportController.getProcurementReport
);

router.get('/vendor',
    verifyToken,
    authorizeRoles('admin', 'finance', 'purchasing'),
    reportController.getVendorReport
);

router.get('/approval-performance',
    verifyToken,
    authorizeRoles('admin', 'finance'),
    reportController.getApprovalPerformanceReport
);

router.get('/dashboard',
    verifyToken,
    reportController.getDashboard
);

module.exports = router;

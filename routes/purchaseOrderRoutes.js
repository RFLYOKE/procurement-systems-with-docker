const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.post('/',
    verifyToken,
    authorizeRoles('purchasing', 'admin'),
    purchaseOrderController.createPurchaseOrder
);

router.get('/',
    verifyToken,
    authorizeRoles('purchasing', 'admin', 'finance'),
    purchaseOrderController.getAllPurchaseOrders
);

router.get('/:id',
    verifyToken,
    authorizeRoles('purchasing', 'admin', 'finance'),
    purchaseOrderController.getPurchaseOrderById
);

router.patch('/:id/status',
    verifyToken,
    authorizeRoles('purchasing', 'admin'),
    purchaseOrderController.updatePOStatus
);

module.exports = router;

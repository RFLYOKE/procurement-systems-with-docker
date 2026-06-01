const express = require('express');
const router = express.Router();
const goodsReceiptController = require('../controllers/goodsReceiptController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.post('/',
    verifyToken,
    authorizeRoles('requester', 'admin'),
    goodsReceiptController.createGoodsReceipt
);

router.get('/',
    verifyToken,
    goodsReceiptController.getAllGoodsReceipts
);

router.get('/:id',
    verifyToken,
    goodsReceiptController.getGoodsReceiptById
);

module.exports = router;

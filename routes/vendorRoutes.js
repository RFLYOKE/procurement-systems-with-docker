const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.post('/', verifyToken, authorizeRoles('admin', 'purchasing'), vendorController.createVendor);
router.get('/', verifyToken, vendorController.getAllVendors);
router.get('/:id', verifyToken, vendorController.getVendorById);
router.put('/:id', verifyToken, authorizeRoles('admin', 'purchasing'), vendorController.updateVendor);
router.delete('/:id', verifyToken, authorizeRoles('admin'), vendorController.deleteVendor);

module.exports = router;

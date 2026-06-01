const express = require('express');
const router = express.Router();
const procurementController = require('../controllers/procurementController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.post('/', verifyToken, authorizeRoles('admin', 'requester'), procurementController.createProcurement);
router.get('/', verifyToken, procurementController.getAllProcurements);
router.get('/:id', verifyToken, procurementController.getProcurementById);
router.put('/:id', verifyToken, authorizeRoles('admin', 'requester'), procurementController.updateProcurement);
router.patch('/:id/submit', verifyToken, authorizeRoles('admin', 'requester'), procurementController.submitProcurement);
router.delete('/:id', verifyToken, authorizeRoles('admin', 'requester'), procurementController.deleteProcurement);

module.exports = router;

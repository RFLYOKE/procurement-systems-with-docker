const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.post('/', verifyToken, authorizeRoles('admin', 'purchasing'), itemController.createItem);
router.get('/', verifyToken, itemController.getAllItems);
router.get('/:id', verifyToken, itemController.getItemById);
router.put('/:id', verifyToken, authorizeRoles('admin', 'purchasing'), itemController.updateItem);
router.delete('/:id', verifyToken, authorizeRoles('admin'), itemController.deleteItem);

module.exports = router;

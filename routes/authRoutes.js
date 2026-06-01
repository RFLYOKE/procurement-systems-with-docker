const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');

const router = express.Router();

// Register Route
router.post(
    '/register',
    [
        body('name').notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
        body('role').optional().isIn(['admin', 'requester', 'supervisor', 'finance', 'purchasing']).withMessage('Invalid role')
    ],
    authController.register
);

// Login Route
router.post(
    '/login',
    [
        body('email').notEmpty().withMessage('Email is required'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    authController.login
);

// Get Profile Route
router.get(
    '/profile',
    verifyToken,
    authController.getProfile
);

// Get All Users Route (Admin only)
router.get(
    '/users',
    verifyToken,
    authorizeRoles('admin'),
    authController.getAllUsers
);

// Logout Route
router.post(
    '/logout',
    authController.logout
);

module.exports = router;

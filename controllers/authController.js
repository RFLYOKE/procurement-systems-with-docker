const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const userModel = require('../models/userModel');
const { successResponse, errorResponse } = require('../utils/response');

const register = async (req, res) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return errorResponse(res, errors.array()[0].msg, 400);
    }

    try {
        const { name, email, password, role, department } = req.body;

        // Check if email already exists
        const existingUser = await userModel.findUserByEmail(email);
        if (existingUser) {
            return errorResponse(res, 'Email already registered', 400);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save user to database
        const userId = await userModel.createUser({ 
            name,
            email,
            password: hashedPassword,
            role,
            department
        });

        const newUser = await userModel.findUserById(userId);
        
        // Remove password from response
        delete newUser.password;

        return successResponse(res, 'User registered successfully', newUser, 201);
    } catch (error) {
        console.error('Error in register:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
};

const login = async (req, res) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return errorResponse(res, errors.array()[0].msg, 400);
    }

    try {
        const { email, password } = req.body;

        // Check if user exists
        const user = await userModel.findUserByEmail(email);
        if (!user) {
            return errorResponse(res, 'Invalid email or password', 401);
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return errorResponse(res, 'Invalid email or password', 401);
        }

        // Generate JWT token
        const payload = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '1d'
        });

        // Remove password before sending user data
        const userData = { ...user };
        delete userData.password;

        return successResponse(res, 'Login successful', { token, user: userData });
    } catch (error) {
        console.error('Error in login:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
};

const getProfile = async (req, res) => {
    try {
        // req.user is set by authMiddleware
        const user = await userModel.findUserById(req.user.id);
        
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        delete user.password;
        return successResponse(res, 'Profile retrieved successfully', user);
    } catch (error) {
        console.error('Error in getProfile:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await userModel.getAllUsers();
        return successResponse(res, 'Users retrieved successfully', users);
    } catch (error) {
        console.error('Error in getAllUsers:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
};

const logout = async (req, res) => {
    try {
        // Since we are using standard stateless JWT, logout is primarily handled 
        // on the client side by deleting the token. We just return a success response.
        return successResponse(res, 'Logout successful. Please delete your token on the client side.');
    } catch (error) {
        console.error('Error in logout:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
};

module.exports = {
    register,
    login,
    logout,
    getProfile,
    getAllUsers
};

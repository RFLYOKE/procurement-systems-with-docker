const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/response');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return errorResponse(res, 'Access denied. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Inject decoded user data into request
        next();
    } catch (err) {
        return errorResponse(res, 'Invalid or expired token.', 401);
    }
};

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return errorResponse(res, 'Access denied. You do not have permission.', 403);
        }
        next();
    };
};
module.exports = {
    verifyToken,
    authorizeRoles
};

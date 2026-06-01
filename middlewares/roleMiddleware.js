const { errorResponse } = require('../utils/response');

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return errorResponse(res, 'Forbidden. You do not have permission to access this resource.', 403);
        }
        next();
    };
};

module.exports = {
    authorizeRoles
};

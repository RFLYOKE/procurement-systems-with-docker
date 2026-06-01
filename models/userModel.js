const db = require('../config/database');

const createUser = async (userData) => {
    const { name, email, password, role, department } = userData;
    const [result] = await db.execute(
        'INSERT INTO users (name, email, password, role, department) VALUES (?, ?, ?, ?, ?)',
        [name, email, password, role || 'requester', department]
    );
    return result.insertId;
};

const findUserByEmail = async (email) => {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
};

const findUserById = async (id) => {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0];
};

const getAllUsers = async () => {
    const [rows] = await db.execute('SELECT id, name, email, role, department, is_active, created_at, updated_at FROM users');
    return rows;
};

module.exports = {
    createUser,
    findUserByEmail,
    findUserById,
    getAllUsers
};

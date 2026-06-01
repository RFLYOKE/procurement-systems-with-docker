/**
 * Approval Helper
 * Utility functions untuk validasi level approval berjenjang
 */

// Mapping status → role yang diperbolehkan approve/reject
const approvalRoleMap = {
    'submitted':           ['supervisor', 'admin'],
    'approved_supervisor': ['finance', 'admin'],
    'approved_finance':    ['purchasing', 'admin'],
};

// Mapping status → status berikutnya setelah approve
const nextStatusMap = {
    'submitted':           'approved_supervisor',
    'approved_supervisor': 'approved_finance',
    'approved_finance':    'approved_purchasing',
};

// Status yang bisa di-reject
const rejectableStatuses = ['submitted', 'approved_supervisor', 'approved_finance'];

/**
 * Cek apakah role tertentu boleh approve pada status saat ini
 * @param {string} currentStatus - Status pengajuan saat ini
 * @param {string} role - Role user yang ingin approve
 * @returns {boolean}
 */
const isAllowedToApprove = (currentStatus, role) => {
    const allowedRoles = approvalRoleMap[currentStatus];
    if (!allowedRoles) return false;
    return allowedRoles.includes(role);
};

/**
 * Dapatkan status berikutnya setelah approve
 * @param {string} currentStatus - Status pengajuan saat ini
 * @returns {string} Status berikutnya
 * @throws {Error} Jika status tidak valid untuk approve
 */
const getNextStatus = (currentStatus) => {
    const nextStatus = nextStatusMap[currentStatus];
    if (!nextStatus) {
        throw new Error(`Status '${currentStatus}' tidak valid untuk approval`);
    }
    return nextStatus;
};

/**
 * Cek apakah pengajuan bisa di-reject pada status saat ini
 * @param {string} currentStatus - Status pengajuan saat ini
 * @returns {boolean}
 */
const canBeRejected = (currentStatus) => {
    return rejectableStatuses.includes(currentStatus);
};

module.exports = {
    isAllowedToApprove,
    getNextStatus,
    canBeRejected,
};

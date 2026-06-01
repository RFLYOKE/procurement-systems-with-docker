const generateRequestNumber = async (db) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `PRQ-${year}${month}-`;

    const [rows] = await db.query(
        `SELECT request_number FROM procurement_requests 
         WHERE request_number LIKE ? 
         ORDER BY id DESC LIMIT 1`,
        [`${prefix}%`]
    );

    let nextNumber = 1;
    if (rows.length > 0) {
        const lastNumberStr = rows[0].request_number.split('-')[2];
        nextNumber = parseInt(lastNumberStr, 10) + 1;
    }

    const paddedNumber = String(nextNumber).padStart(4, '0');
    return `${prefix}${paddedNumber}`;
};

const generatePONumber = async (db) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `PO-${year}${month}-`;

    const [rows] = await db.query(
        `SELECT po_number FROM purchase_orders 
         WHERE po_number LIKE ? 
         ORDER BY id DESC LIMIT 1`,
        [`${prefix}%`]
    );

    let nextNumber = 1;
    if (rows.length > 0) {
        const lastNumberStr = rows[0].po_number.split('-')[2];
        nextNumber = parseInt(lastNumberStr, 10) + 1;
    }

    const paddedNumber = String(nextNumber).padStart(4, '0');
    return `${prefix}${paddedNumber}`;
};

const generateGRNumber = async (db) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `GR-${year}${month}-`;

    const [rows] = await db.query(
        `SELECT gr_number FROM goods_receipts 
         WHERE gr_number LIKE ? 
         ORDER BY id DESC LIMIT 1`,
        [`${prefix}%`]
    );

    let nextNumber = 1;
    if (rows.length > 0) {
        const lastNumberStr = rows[0].gr_number.split('-')[2];
        nextNumber = parseInt(lastNumberStr, 10) + 1;
    }

    const paddedNumber = String(nextNumber).padStart(4, '0');
    return `${prefix}${paddedNumber}`;
};

module.exports = { generateRequestNumber, generatePONumber, generateGRNumber };

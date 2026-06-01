require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

// ── Core Middlewares ──────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Request Logger ────────────────────────────────
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}` +
            ` ${res.statusCode} ${duration}ms`
        );
    });
    next();
});

// ── Routes ────────────────────────────────────────
app.use('/api/auth',            require('./routes/authRoutes'));
app.use('/api/items',           require('./routes/itemRoutes'));
app.use('/api/vendors',         require('./routes/vendorRoutes'));
app.use('/api/procurements',    require('./routes/procurementRoutes'));
app.use('/api/approvals',       require('./routes/approvalRoutes'));
app.use('/api/purchase-orders', require('./routes/purchaseOrderRoutes'));
app.use('/api/goods-receipts',  require('./routes/goodsReceiptRoutes'));
app.use('/api/reports',         require('./routes/reportRoutes'));

// ── Base Route ────────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Procurement System API v1.0',
        endpoints: [
            'POST   /api/auth/register',
            'POST   /api/auth/login',
            'GET    /api/items',
            'GET    /api/vendors',
            'GET    /api/procurements',
            'GET    /api/approvals/pending',
            'GET    /api/purchase-orders',
            'GET    /api/goods-receipts',
            'GET    /api/reports/dashboard',
        ]
    });
});

// ── 404 Handler ───────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} tidak ditemukan`,
    });
});

// ── Global Error Handler ──────────────────────────
app.use((err, req, res, next) => {
    console.error(
        `[${new Date().toISOString()}] ERROR: ${err.message}`,
        err.stack
    );
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
});

// ── Start Server ──────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
    console.log(`Server running on port ${PORT}`)
);

module.exports = app;

# Sistem Procurement dan Approval Berjenjang

Backend REST API untuk sistem pengadaan barang/jasa dengan alur persetujuan multi-level (supervisor → finance → purchasing), manajemen Purchase Order, penerimaan barang, dan laporan pengadaan.

---

## Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Runtime  | Node.js 18+ |
| Framework | Express.js 4.x |
| Database | MySQL 8.x |
| Auth | JWT (jsonwebtoken) |
| ORM / Query | mysql2/promise (raw SQL) |
| Env | dotenv |
| Dev Server | nodemon |

---

## Prasyarat

- Node.js >= 18
- MySQL >= 8.0 (berjalan di port 3306 atau sesuai `.env`)
- npm >= 9

---

## Instalasi & Menjalankan

```bash
# 1. Clone repository
git clone <repo-url>
cd procurement-system

# 2. Install dependencies
npm install

# 3. Buat database dan jalankan schema
mysql -u root -p < database.sql

# 4. Salin file env dan sesuaikan
cp .env.example .env

# 5. Jalankan dev server
npm run dev

# Server berjalan di http://localhost:3001
```

---

## Environment Variables (`.env`)

```env
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=procurement_db
JWT_SECRET=supersecretjwtkey123
JWT_EXPIRES_IN=1d
```

---

## Struktur Folder

```
procurement-system/
├── app.js                          # Entry point, middleware, routes
├── .env                            # Environment variables
├── .env.example                    # Template env
├── database.sql                    # Full schema + sample data
├── schema.sql                      # Schema saja (referensi)
├── package.json
│
├── config/
│   └── database.js                 # MySQL pool connection
│
├── controllers/
│   ├── authController.js           # Register, Login
│   ├── itemController.js           # CRUD master barang/jasa
│   ├── vendorController.js         # CRUD master vendor
│   ├── procurementController.js    # CRUD pengajuan + submit
│   ├── approvalController.js       # Approve, reject, history, pending
│   ├── purchaseOrderController.js  # CRUD PO + update status
│   ├── goodsReceiptController.js   # Penerimaan barang (partial/complete)
│   └── reportController.js         # Laporan & dashboard
│
├── models/
│   ├── userModel.js
│   ├── itemModel.js
│   ├── vendorModel.js
│   ├── procurementModel.js
│   ├── approvalModel.js
│   ├── purchaseOrderModel.js
│   ├── goodsReceiptModel.js
│   └── reportModel.js
│
├── routes/
│   ├── authRoutes.js
│   ├── itemRoutes.js
│   ├── vendorRoutes.js
│   ├── procurementRoutes.js
│   ├── approvalRoutes.js
│   ├── purchaseOrderRoutes.js
│   ├── goodsReceiptRoutes.js
│   └── reportRoutes.js
│
├── middlewares/
│   ├── authMiddleware.js           # verifyToken, authorizeRoles
│   └── roleMiddleware.js
│
└── utils/
    ├── response.js                 # successResponse, errorResponse
    ├── generateNumber.js           # PRQ/PO/GR number generator
    └── approvalHelper.js           # isAllowedToApprove, getNextStatus, canBeRejected
```

---

## Alur Proses

```
[Requester]
    │
    ├─ Buat Procurement Request (status: draft)
    ├─ Tambah items ke request
    └─ Submit request (status: submitted)
            │
            ▼
[Supervisor]
    └─ Approve → status: approved_supervisor
       Reject  → status: rejected
            │
            ▼
[Finance]
    └─ Approve → status: approved_finance
       Reject  → status: rejected
            │
            ▼
[Purchasing]
    ├─ Approve → status: approved_purchasing
    │   Reject  → status: rejected
    │
    └─ Buat Purchase Order (status PO: draft)
            │ status procurement → purchased
            ▼
    Update PO Status: draft → sent → confirmed
            │
            ▼
[Requester/Admin]
    └─ Buat Goods Receipt (partial/complete)
            │ complete → status PO: completed
            │            status procurement: received
            ▼
       SELESAI ✅
```

---

## Daftar Endpoint

### Auth
| Method | URL | Role |
|--------|-----|------|
| POST | `/api/auth/register` | public |
| POST | `/api/auth/login` | public |
| POST | `/api/auth/logout` | authenticated |
| GET | `/api/auth/profile` | authenticated |
| GET | `/api/auth/users` | admin |

### Master Data — Items
| Method | URL | Role |
|--------|-----|------|
| GET | `/api/items` | authenticated |
| GET | `/api/items/:id` | authenticated |
| POST | `/api/items` | admin |
| PUT | `/api/items/:id` | admin |
| DELETE | `/api/items/:id` | admin |

### Master Data — Vendors
| Method | URL | Role |
|--------|-----|------|
| GET | `/api/vendors` | authenticated |
| GET | `/api/vendors/:id` | authenticated |
| POST | `/api/vendors` | admin, purchasing |
| PUT | `/api/vendors/:id` | admin, purchasing |
| DELETE | `/api/vendors/:id` | admin |

### Procurement Requests
| Method | URL | Role |
|--------|-----|------|
| GET | `/api/procurements` | authenticated |
| GET | `/api/procurements/:id` | authenticated |
| POST | `/api/procurements` | admin, requester |
| PUT | `/api/procurements/:id` | admin, requester |
| PATCH | `/api/procurements/:id/submit` | admin, requester |
| DELETE | `/api/procurements/:id` | admin, requester |

### Approval
| Method | URL | Role |
|--------|-----|------|
| GET | `/api/approvals/pending` | supervisor, finance, purchasing, admin |
| POST | `/api/approvals/:id/approve` | supervisor, finance, purchasing, admin |
| POST | `/api/approvals/:id/reject` | supervisor, finance, purchasing, admin |
| GET | `/api/approvals/:id/history` | authenticated |

### Purchase Orders
| Method | URL | Role |
|--------|-----|------|
| GET | `/api/purchase-orders` | purchasing, admin, finance |
| GET | `/api/purchase-orders/:id` | purchasing, admin, finance |
| POST | `/api/purchase-orders` | purchasing, admin |
| PATCH | `/api/purchase-orders/:id/status` | purchasing, admin |

### Goods Receipts
| Method | URL | Role |
|--------|-----|------|
| GET | `/api/goods-receipts` | authenticated |
| GET | `/api/goods-receipts/:id` | authenticated |
| POST | `/api/goods-receipts` | requester, admin |

### Reports
| Method | URL | Role |
|--------|-----|------|
| GET | `/api/reports/dashboard` | authenticated |
| GET | `/api/reports/procurement` | admin, finance, purchasing |
| GET | `/api/reports/vendor` | admin, finance, purchasing |
| GET | `/api/reports/approval-performance` | admin, finance |

---

## Skema Database

| Tabel | Deskripsi |
|-------|-----------|
| `users` | Data pengguna dengan role (admin, requester, supervisor, finance, purchasing) |
| `items` | Master barang/jasa |
| `vendors` | Master vendor/supplier |
| `procurement_requests` | Header pengajuan pengadaan |
| `procurement_request_items` | Detail item per pengajuan |
| `approval_histories` | Riwayat approval berjenjang |
| `purchase_orders` | Purchase Order dari procurement yang disetujui |
| `purchase_order_items` | Detail item per PO |
| `goods_receipts` | Bukti penerimaan barang (partial/complete) |
| `goods_receipt_items` | Detail item per penerimaan |

### Relasi Utama
```
users ──< procurement_requests ──< procurement_request_items >── items
                  │
                  ├──< approval_histories >── users
                  │
                  └──< purchase_orders >── vendors
                              │
                              └──< purchase_order_items >── items
                                          │
                              goods_receipts ──< goods_receipt_items
```

---

## Status Flow Procurement

```
draft → submitted → approved_supervisor → approved_finance
      → approved_purchasing → purchased → received
      (dari status manapun kecuali draft & approved_purchasing → rejected)
```

## Status Flow Purchase Order

```
draft → sent → confirmed → completed
(dari manapun kecuali completed) → cancelled
```

---

## Format Nomor Dokumen

| Dokumen | Format | Contoh |
|---------|--------|--------|
| Procurement Request | `PRQ-YYYYMM-XXXX` | PRQ-202605-0001 |
| Purchase Order | `PO-YYYYMM-XXXX` | PO-202605-0001 |
| Goods Receipt | `GR-YYYYMM-XXXX` | GR-202605-0001 |

---

## Catatan

- Password di-hash dengan **bcryptjs** (10 salt rounds)
- JWT token berlaku **1 hari** (dapat dikonfigurasi via `JWT_EXPIRES_IN`)
- Semua transaksi multi-tabel menggunakan **DB transaction** (rollback otomatis jika gagal)
- Default periode laporan: **awal bulan ini → hari ini**

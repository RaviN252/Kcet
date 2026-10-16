const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const pool = require('./config/db');
const authRoutes = require('./routes/auth');
const subjectRoutes = require('./routes/subjects');
const paymentRoutes = require('./routes/payments');
const purchaseRoutes = require('./routes/purchases');
const viewerRoutes = require('./routes/viewer');
const adminSubjectRoutes = require('./routes/admin/subjects');
const adminFolderRoutes = require('./routes/admin/folders');
const adminPaperRoutes = require('./routes/admin/papers');
const adminUserRoutes = require('./routes/admin/users');
const adminDashboardRoutes = require('./routes/admin/dashboard');
const adminPaymentRoutes = require('./routes/admin/payments');
const classRoutes = require('./routes/classes');
const adminClassRoutes = require('./routes/admin/classes');
const { checkPendingUpiReminders } = require('./services/paymentReminders');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/viewer', viewerRoutes);
app.use('/api/admin/subjects', adminSubjectRoutes);
app.use('/api/admin/folders', adminFolderRoutes);
app.use('/api/admin/papers', adminPaperRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/payments', adminPaymentRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/admin/classes', adminClassRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.status === 400) {
    return res.status(400).json({ message: err.message });
  }
  console.error(err);
  res.status(500).json({ message: 'Something went wrong', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Nudges students who opened the UPI payment screen but never submitted a UTR.
const REMINDER_CHECK_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
  checkPendingUpiReminders().catch((e) => console.error('Payment reminder check failed:', e.message));
}, REMINDER_CHECK_INTERVAL_MS);
checkPendingUpiReminders().catch((e) => console.error('Payment reminder check failed:', e.message));

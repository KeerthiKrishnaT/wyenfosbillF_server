import express from 'express';
import { EventEmitter } from 'events';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import fs from 'fs';
import registerRouter from './routes/registerRoutes.js';
import ForgotPasswordRoutes from './routes/ForgotPasswordRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import cashBillRoutes from './routes/cashBillRoutes.js';
import CreditBillRoutes from './routes/CreditBillRoutes.js';
import creditNoteRoutes from './routes/creditNoteRoutes.js';
import debitNoteRoutes from './routes/DebitNoteRoutes.js';
import CustomerRoutes from './routes/CustomerRoutes.js';
import authRoutes from './routes/AuthRoutes.js';
import EmailRoutes from './routes/EmailRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import productRoutes from './routes/productRoutes.js';
import marketingRoutes from './routes/MarketingRoutes.js';
import DigitalMarketingRoutes from './routes/DigitalMarketingRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import soldProductRoutes from './routes/soldProductRoutes.js';
import salesMigrationRoutes from './routes/salesMigrationRoutes.js';
import directMigrationRoutes from './routes/directMigrationRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import profitRoutes from './routes/profitRoutes.js';
import ResetPasswordpageroutes from './routes/ResetPasswordpageroutes.js';
import QuotationRoutes from './routes/QuotationRoutes.js';
import priceListRoutes from './routes/priceListRoutes.js';
import revenueRoutes from './routes/revenueRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import piechartRoutes from './routes/piechartRoutes.js';
import totalSpentRoutes from './routes/totalSpentRoutes.js';
import notificationRoutes from './routes/notificationsRoutes.js';
import paymentReceiptRoutes from './routes/paymentReceiptRoutes.js';
import bankDetailsRoutes from './routes/bankDetailsRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import financialRoutes from './routes/financialRoutes.js';
import superAdminProfileRoutes from './routes/superAdminProfileRoutes.js';
import AccountsRoutes from './routes/AccountsRoutes.js';
import punchingTimeRoutes from './routes/punchingTimeRoutes.js';
import appointmentRoutes from './routes/appointmentsRoutes.js';
import terminatedStaffRoutes from './routes/terminatedStaffRoutes.js';
import leaveRequestRoutes from './routes/leaveRequestRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import productReturnRoutes from './routes/productReturnRoutes.js';
import reminderRoutes from './routes/ReminderRoutes.js';
import tasksRoutes from './routes/tasksRoutes.js';
import { initializeCounter } from './services/idGenerator.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

console.log('🚀 Starting Wyenfos Bills Server...');
console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔌 Port: ${PORT}`);

// Initialize Firebase with error handling
let adminAuth, db, adminStorage;
try {
  const { adminAuth: auth, adminFirestore: firestore, adminStorage: storage } = await import('../server/config/firebase-admin.js');
  adminAuth = auth;
  db = firestore;
  adminStorage = storage;
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.warn('⚠️ Firebase initialization failed:', error.message);
  console.log('🔄 Continuing without Firebase - some features may not work');
}

// Import routes with error handling
let registerRouter, ForgotPasswordRoutes, uploadRoutes, cashBillRoutes, CreditBillRoutes;
let creditNoteRoutes, debitNoteRoutes, CustomerRoutes, authRoutes, EmailRoutes;
let requestRoutes, productRoutes, marketingRoutes, DigitalMarketingRoutes, superAdminRoutes;
let purchaseRoutes, departmentRoutes, soldProductRoutes, inventoryRoutes, profitRoutes;
let ResetPasswordpageroutes, QuotationRoutes, priceListRoutes, revenueRoutes, activityRoutes;
let piechartRoutes, totalSpentRoutes, notificationRoutes, paymentReceiptRoutes, bankDetailsRoutes;
let companyRoutes, financialRoutes, superAdminProfileRoutes, AccountsRoutes, punchingTimeRoutes;
let appointmentRoutes, terminatedStaffRoutes, leaveRequestRoutes, staffRoutes, attendanceRoutes;
let productReturnRoutes, reminderRoutes, tasksRoutes;

try {
  registerRouter = (await import('./routes/registerRoutes.js')).default;
  ForgotPasswordRoutes = (await import('./routes/ForgotPasswordRoutes.js')).default;
  uploadRoutes = (await import('./routes/uploadRoutes.js')).default;
  cashBillRoutes = (await import('./routes/cashBillRoutes.js')).default;
  CreditBillRoutes = (await import('./routes/CreditBillRoutes.js')).default;
  creditNoteRoutes = (await import('./routes/creditNoteRoutes.js')).default;
  debitNoteRoutes = (await import('./routes/DebitNoteRoutes.js')).default;
  CustomerRoutes = (await import('./routes/CustomerRoutes.js')).default;
  authRoutes = (await import('./routes/AuthRoutes.js')).default;
  EmailRoutes = (await import('./routes/EmailRoutes.js')).default;
  requestRoutes = (await import('./routes/requestRoutes.js')).default;
  productRoutes = (await import('./routes/productRoutes.js')).default;
  marketingRoutes = (await import('./routes/MarketingRoutes.js')).default;
  DigitalMarketingRoutes = (await import('./routes/DigitalMarketingRoutes.js')).default;
  superAdminRoutes = (await import('./routes/superAdminRoutes.js')).default;
  purchaseRoutes = (await import('./routes/purchaseRoutes.js')).default;
  departmentRoutes = (await import('./routes/departmentRoutes.js')).default;
  soldProductRoutes = (await import('./routes/soldProductRoutes.js')).default;
  inventoryRoutes = (await import('./routes/inventoryRoutes.js')).default;
  profitRoutes = (await import('./routes/profitRoutes.js')).default;
  ResetPasswordpageroutes = (await import('./routes/ResetPasswordpageroutes.js')).default;
  QuotationRoutes = (await import('./routes/QuotationRoutes.js')).default;
  priceListRoutes = (await import('./routes/priceListRoutes.js')).default;
  revenueRoutes = (await import('./routes/revenueRoutes.js')).default;
  activityRoutes = (await import('./routes/activityRoutes.js')).default;
  piechartRoutes = (await import('./routes/piechartRoutes.js')).default;
  totalSpentRoutes = (await import('./routes/totalSpentRoutes.js')).default;
  notificationRoutes = (await import('./routes/notificationsRoutes.js')).default;
  paymentReceiptRoutes = (await import('./routes/paymentReceiptRoutes.js')).default;
  bankDetailsRoutes = (await import('./routes/bankDetailsRoutes.js')).default;
  companyRoutes = (await import('./routes/companyRoutes.js')).default;
  financialRoutes = (await import('./routes/financialRoutes.js')).default;
  superAdminProfileRoutes = (await import('./routes/superAdminProfileRoutes.js')).default;
  AccountsRoutes = (await import('./routes/AccountsRoutes.js')).default;
  punchingTimeRoutes = (await import('./routes/punchingTimeRoutes.js')).default;
  appointmentRoutes = (await import('./routes/appointmentsRoutes.js')).default;
  terminatedStaffRoutes = (await import('./routes/terminatedStaffRoutes.js')).default;
  leaveRequestRoutes = (await import('./routes/leaveRequestRoutes.js')).default;
  staffRoutes = (await import('./routes/staffRoutes.js')).default;
  attendanceRoutes = (await import('./routes/attendanceRoutes.js')).default;
  productReturnRoutes = (await import('./routes/productReturnRoutes.js')).default;
  reminderRoutes = (await import('./routes/ReminderRoutes.js')).default;
  tasksRoutes = (await import('./routes/tasksRoutes.js')).default;
  console.log('✅ All routes imported successfully');
} catch (error) {
  console.error('❌ Error importing routes:', error.message);
  console.log('🔄 Continuing with basic server functionality');
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://wyenfos.in', 'https://www.wyenfos.in']
      : 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  socket.emit('stock-alert', { message: 'Connected to server!' });
  socket.on('disconnect', (reason) => {
    console.log('❌ Client disconnected:', socket.id, reason);
  });
});

EventEmitter.defaultMaxListeners = 15;

// Create uploads directory
const uploadsDir = path.join(process.cwd(), 'Uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: multerStorage, limits: { fileSize: 5 * 1024 * 1024 } });

const validCompanies = [
  'WYENFOS INFOTECH',
  'WYENFOS GOLD AND DIAMONDS',
  'WYENFOS ADS',
  'WYENFOS CASH VAPASE',
  'WYENFOS',
  'WYENFOS BILLS',
  'AYUR FOR HERBALS INDIA',
  'WYENFOS PURE DROPS',
];

const initializeAllCounters = async () => {
  for (const company of validCompanies) {
    try {
      await initializeCounter(company);
      console.log(`Counter initialized for ${company}`);
    } catch (error) {
      console.error(`❌ Failed to initialize counter for ${company}:`, error.message);
    }
  }
};
app.use((req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  const wsOrigin = isProd
    ? "https://wyenfos.in wss://wyenfos.in"
    : "http://localhost:5000 ws://localhost:5000";

  res.setHeader("Content-Security-Policy",
    `default-src 'self'; ` +
    `script-src 'self'; ` +
    `style-src 'self' 'unsafe-inline'; ` +
    `img-src 'self' data: http://localhost:5000 http://localhost:3000 blob: http://localhost:5000/uploads/; ` +
    `font-src 'self'; ` +
    `connect-src 'self' ${wsOrigin};`
  );
  next();
});

// Basic middleware setup
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cors({
  origin: ['http://localhost:3000', 'https://wyenfos.in', 'https://www.wyenfos.in'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(helmet({
  contentSecurityPolicy: false, 
}));

// Static file serving
app.use('/Uploads', express.static(path.join(__dirname, 'Uploads')));

// Profile pictures route
app.get('/uploads/profile-pics/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'uploads', 'profile-pics', filename);
  
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Credentials': 'false',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Access-Control-Expose-Headers': '*',
    'Timing-Allow-Origin': '*'
  });
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Profile picture not found' });
  }
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'image/jpeg';
  if (ext === '.png') contentType = 'image/png';
  else if (ext === '.gif') contentType = 'image/gif';
  else if (ext === '.webp') contentType = 'image/webp';
  
  res.set('Content-Type', contentType);
  res.sendFile(filepath);
});

app.use('/uploads', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', '*');
  res.set('Access-Control-Allow-Credentials', 'false');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Access-Control-Expose-Headers', '*');
  res.set('Timing-Allow-Origin', '*');
  
  if (req.path.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
    res.set('Cache-Control', 'public, max-age=31536000');
    res.set('Vary', 'Origin');
  }
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
}, express.static(path.join(__dirname, 'uploads')));

app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'uploads', filename);
  
  res.set('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (!fs.existsSync(filepath)) {
    console.log(`File ${filename} not found in local uploads folder: ${filepath}`);
    return res.status(404).json({ error: 'Logo not found in local uploads folder' });
  }
  
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(filepath);
});

app.get('/uploads/bank-qr-codes/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'uploads', 'bank-qr-codes', filename);
  
  res.set('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  res.set('Timing-Allow-Origin', 'http://localhost:3000');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'QR Code not found' });
  }
  
  res.set('Content-Type', 'image/png');
  
  fs.readFile(filepath, (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Error reading file' });
    }
    res.send(data);
  });
});

app.get('/api/qr-codes/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'uploads', 'bank-qr-codes', filename);
  
  res.set('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (!fs.existsSync(filepath)) { return res.status(404).json({ error: 'QR Code not found' }); }
  res.set('Content-Type', 'image/png');
  fs.readFile(filepath, (err, data) => {
    if (err) { return res.status(500).json({ error: 'Error reading file' }); }
    res.send(data);
  });
});

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.use('/debitnotes/send-email', upload.single('pdf'));
app.use('/api/register', registerRouter);
app.use('/api/auth', authRoutes);
app.use('/api/forgot-password', ForgotPasswordRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/cashbills', cashBillRoutes);
app.use('/api/creditbills', CreditBillRoutes);
app.use('/api/creditnotes', creditNoteRoutes);
app.use('/api/debitnotes', debitNoteRoutes);
app.use('/api/customers', CustomerRoutes);
app.use('/api/email', EmailRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/sold-products', soldProductRoutes);
app.use('/api/sold', soldProductRoutes);
app.use('/api/sales-migration', salesMigrationRoutes);
app.use('/api/direct-migration', directMigrationRoutes);
app.use('/api', productRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/digital-marketing', DigitalMarketingRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reset-password', ResetPasswordpageroutes);
app.use('/api', profitRoutes);
app.use('/api', QuotationRoutes);
app.use('/api/price-lists', priceListRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/piechart', piechartRoutes);
app.use('/api/totalspent', totalSpentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payment-receipts', paymentReceiptRoutes);
app.use('/api/bank-details', bankDetailsRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/finance', financialRoutes);
app.use('/api/', superAdminProfileRoutes);
app.use('/api/accounts', AccountsRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/punching-times', punchingTimeRoutes);
app.use('/api/terminated-staff', terminatedStaffRoutes);
app.use('/api/leave', leaveRequestRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/product-returns', productReturnRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/tasks', tasksRoutes);

// Root endpoint
app.get('/', (req, res) => {
  console.log('✅ Root endpoint accessed');
  res.status(200).json({ 
    message: 'Wyenfos Bills API Server',
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('✅ Health check endpoint accessed');
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  console.log('✅ Test endpoint accessed');
  res.status(200).json({ 
    message: 'Server is working!',
    timestamp: new Date().toISOString()
  });
});

// Add routes only if they were imported successfully
if (registerRouter) app.use('/api/register', registerRouter);
if (authRoutes) app.use('/api/auth', authRoutes);
if (CustomerRoutes) app.use('/api/customers', CustomerRoutes);
if (cashBillRoutes) app.use('/api/cashbills', cashBillRoutes);
if (CreditBillRoutes) app.use('/api/creditbills', CreditBillRoutes);
if (debitNoteRoutes) app.use('/api/debitnotes', debitNoteRoutes);
if (EmailRoutes) app.use('/api/email', EmailRoutes);

// Start server
async function startServer() {
  try {
    console.log('🚀 Starting server...');
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Server accessible at: http://0.0.0.0:${PORT}`);
      console.log(`🏥 Health check available at: http://0.0.0.0:${PORT}/health`);
      console.log(`📋 Root endpoint available at: http://0.0.0.0:${PORT}/`);
      
      if (db && firebaseStorage) {
        console.log('✅ Firebase initialized, starting counters...');
        initializeCounter().catch(error => {
          console.error('❌ Counter initialization failed:', error.message);
        });
      } else {
        console.warn('⚠️ Firebase not initialized - some features may not work');
      }
    });
    
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
    });
    
  } catch (error) {
    console.error('❌ Server failed to start:', error.message);
    process.exit(1);
  }
}

startServer();

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

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

// Add better logging for Railway
console.log('🚀 Starting Wyenfos Bills Server...');
console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔌 Port: ${PORT}`);
console.log(`📁 Directory: ${__dirname}`);

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

// Root endpoint - this is what Railway healthcheck uses
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

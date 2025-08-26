import express from 'express';
import { adminAuth, adminFirestore as db, adminStorage } from '../server/config/firebase-admin.js';
import { companyLogos } from './config/companyLogos.js';
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
const PORT = process.env.PORT || 5000;

// Add better logging for Railway
console.log('🚀 Starting Wyenfos Bills Server...');
console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔌 Port: ${PORT}`);
console.log(`📁 Directory: ${__dirname}`);

const server = http.createServer(app);
const firebaseStorage = adminStorage;
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
  console.log('🔌 Client connected:', socket.id, socket.handshake.headers);

  socket.emit('stock-alert', { message: 'Connected to server!' });

  socket.on('send-stock-alert', (data) => {
    io.emit('stock-alert', { message: data.message });
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Client disconnected:', socket.id, reason);
  });
});
EventEmitter.defaultMaxListeners = 15;

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
    // Use original filename to preserve wyenfos.png
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: multerStorage, limits: { fileSize: 5 * 1024 * 1024 } });

const validCompanies = [
  'WYENFOS INFOTECH',
  'WYENFOS GOLD & DIAMONDS',
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

app.use(helmet({
  contentSecurityPolicy: false, 
}));

app.use(cors({
  origin: ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition', 'Content-Length'],
  optionsSuccessStatus: 200
}));
app.use('/Uploads', express.static(path.join(__dirname, 'Uploads')));

// Specific route for profile pictures with explicit CORS - place this BEFORE the general /uploads middleware
app.get('/uploads/profile-pics/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'uploads', 'profile-pics', filename);
  
  // Set CORS headers explicitly - most permissive for development
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Credentials': 'false',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Access-Control-Expose-Headers': '*',
    'Timing-Allow-Origin': '*'
  });
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Check if file exists
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Profile picture not found' });
  }
  
  // Determine content type based on file extension
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'image/jpeg'; // default
  if (ext === '.png') contentType = 'image/png';
  else if (ext === '.gif') contentType = 'image/gif';
  else if (ext === '.webp') contentType = 'image/webp';
  
  // Set content type and send file
  res.set('Content-Type', contentType);
  res.sendFile(filepath);
});

// Custom middleware for serving images with proper CORS
app.use('/uploads', (req, res, next) => {
  // Set CORS headers for all uploads requests - more permissive
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', '*');
  res.set('Access-Control-Allow-Credentials', 'false');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Access-Control-Expose-Headers', '*');
  res.set('Timing-Allow-Origin', '*');
  
  // For image files, set additional headers to prevent CORS blocking
  if (req.path.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
    res.set('Cache-Control', 'public, max-age=31536000');
    res.set('Vary', 'Origin');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Specific route for company logos with explicit CORS - serves from local uploads folder
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'uploads', filename);
  
  // Set CORS headers explicitly
  res.set('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Check if file exists
  if (!fs.existsSync(filepath)) {
    console.log(`File ${filename} not found in local uploads folder: ${filepath}`);
    return res.status(404).json({ error: 'Logo not found in local uploads folder' });
  }
  
  // Set appropriate content type
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
  
  // Send the file
  res.sendFile(filepath);
});

// Specific route for bank QR codes with explicit CORS
app.get('/uploads/bank-qr-codes/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'uploads', 'bank-qr-codes', filename);
  
  // Set CORS headers explicitly for image requests
  res.set('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  res.set('Timing-Allow-Origin', 'http://localhost:3000');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Check if file exists
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'QR Code not found' });
  }
  
  // Set content type for image
  res.set('Content-Type', 'image/png');
  
  // Read and send file as buffer to avoid CORS issues
  fs.readFile(filepath, (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Error reading file' });
    }
    res.send(data);
  });
});

// Alternative route for QR codes that bypasses CORS issues
app.get('/api/qr-codes/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'uploads', 'bank-qr-codes', filename);
  
  // Set CORS headers
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
app.use('/api/leave-requests', leaveRequestRoutes); // Add alias for client compatibility
app.use('/api/staff', staffRoutes);
app.use('/api/attendance', attendanceRoutes); // Add missing attendance routes
app.use('/api/product-returns', productReturnRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/tasks', tasksRoutes);

// Add root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Wyenfos Bills API Server',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Add health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

async function startServer() {
  try {
    // Start server first, then initialize Firebase
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🏥 Health check available at: http://localhost:${PORT}/health`);
      
      // Initialize Firebase counters in background (don't block server start)
      if (db && firebaseStorage) {
        console.log('✅ Firebase initialized, starting counters...');
        initializeAllCounters().catch(error => {
          console.error('❌ Counter initialization failed:', error.message);
          // Don't exit - server can still run without counters
        });
      } else {
        console.warn('⚠️ Firebase not initialized - some features may not work');
      }
    });
  } catch (error) {
    console.error('❌ Server failed to start:', error.message);
    process.exit(1);
  }
}

startServer();

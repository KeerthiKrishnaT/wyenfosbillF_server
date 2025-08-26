import express from 'express';
import {
  updateBill,
  saveBill,
  deleteBill,
  getBillByCustomerId,
  getAllBills,
  getLatestInvoice,
  sendBillEmail,
  getBillById,
  fetchCustomerByContact,
  getCustomerById,
  getTodayBills,
  getWeeklyTotalCashBill,
  generatePDF
} from '../controllers/cashBillController.js';
import { verifyToken} from '../middleware/AuthMiddleware.js';
import { hasEditPermission } from '../middleware/RequestMiddleware.js';

const router = express.Router();


// Bill management
router.post('/', verifyToken, saveBill);
router.get('/', verifyToken, getAllBills);
router.get('/today', getTodayBills);
router.get('/weekly-total', verifyToken, getWeeklyTotalCashBill);
router.get('/latest-invoice', verifyToken, getLatestInvoice);

// Individual bill operations
router.get('/:id', verifyToken, getBillById);
router.put('/:id', verifyToken, hasEditPermission, updateBill);
router.delete('/:id', verifyToken, hasEditPermission, deleteBill);

// Customer related routes
router.get('/customer/:customerId', verifyToken, getBillByCustomerId);
router.get('/find', verifyToken, fetchCustomerByContact);
router.get('/customers/:id', verifyToken, getCustomerById);

// Email and utilities
router.post('/send-email', verifyToken, sendBillEmail);

// PDF Generation
router.get('/generate-pdf/:billId', verifyToken, generatePDF);

export default router;
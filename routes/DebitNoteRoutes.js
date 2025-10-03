import express from 'express';
import {
  createCustomer,
  getCustomerByName,
  createCreditBill,
  getCreditBills,
  getCreditBillById,
  getCreditBillByName,
  createDebitNote,
  getDebitNotes,
  getDebitNoteById,
  updateDebitNote,
  deleteDebitNote,
  sendEmail,
  getLatestInvoiceNumber,
  checkPermission,
  requestPermission,
  generatePDFFromUnsaved
} from '../controllers/DebitNoteController.js';
import { getCustomers } from '../controllers/CustomerController.js';
import { requestEdit } from '../controllers/notificationsController.js';
import {
  validateDebitNote,
  validateCreditBill,
  validateEmailRequest,
  validateCustomer
} from '../middleware/DebitNoteMiddleware.js';
import { verifyToken, verifyAdmin } from '../middleware/AuthMiddleware.js';

const router = express.Router();

// Permission routes
router.post('/permission/check', verifyToken, checkPermission);
router.post('/permission/request', verifyToken, requestPermission);

// Notifications routes
router.post('/notifications/request-permission', verifyToken, requestEdit);

// Customer Routes
router.get('/customers', verifyToken, getCustomers);
router.get('/customers/find', verifyToken, (req, res, next) => {
  if (!req.query.company) {
    return res.status(400).json({ message: 'Company query parameter is required' });
  }
  next();
}, getCustomerByName);
router.post('/customers', verifyToken, validateCustomer, createCustomer);

// Credit Bill Routes
router.post('/creditbills', verifyToken, validateCreditBill, createCreditBill);
router.get('/creditbills', verifyToken, getCreditBills);
router.get('/creditbills/:id', verifyToken, getCreditBillById);
router.get('/creditbills/search/:name', verifyToken, getCreditBillByName);

// Debit Note Routes
router.post('/', verifyToken, validateDebitNote, createDebitNote);
router.get('/', verifyToken, getDebitNotes);
router.get('/latest-invoice', verifyToken, getLatestInvoiceNumber);
router.post('/send-email', verifyToken, validateEmailRequest, sendEmail);
router.post('/generate-pdf-unsaved', generatePDFFromUnsaved);
router.get('/:id', verifyToken, getDebitNoteById);
router.put('/:id', verifyToken, verifyAdmin, validateDebitNote, updateDebitNote);
router.delete('/:id', verifyToken, verifyAdmin, deleteDebitNote);

export default router;
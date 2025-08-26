import express from 'express';
import {
  getLatestInvoice,
  getAllBills,
  getCreditBill,
  saveCreditBill,
  updateCreditBill,
  deleteCreditBill,
  sendEmail,
  generatePDF,
  generatePDFFromUnsaved,
  getTodayCreditBills,
  getWeeklyTotalCreditBill,
  generateCustomerIdEndpoint
} from '../controllers/creditBillController.js';
import { validateEmail, validateBill } from '../middleware/CreditBillMiddleware.js';
import { isAdmin } from '../middleware/RequestMiddleware.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

// Customer ID generation
router.get('/generate-customer-id', generateCustomerIdEndpoint);

// Invoice and billing
router.get('/latest-invoice', getLatestInvoice);
router.get('/', getAllBills);
router.post('/', saveCreditBill);
router.get('/today', getTodayCreditBills);
router.get('/weekly-total', verifyToken, getWeeklyTotalCreditBill);

// Individual bill operations
router.get('/:id', getCreditBill);
router.put('/:id', verifyToken, isAdmin, validateBill, updateCreditBill);
router.delete('/:id', verifyToken, isAdmin, deleteCreditBill);

// PDF and email
router.get('/generate-pdf/:billId', generatePDF);
router.post('/generate-pdf-unsaved', generatePDFFromUnsaved);
router.post('/send-email', validateEmail, sendEmail);
router.post('/send-email-unsaved', sendEmail);

export default router;
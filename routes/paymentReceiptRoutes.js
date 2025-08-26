// paymentReceiptRoutes.js
import express from 'express';
import {
  createPaymentReceipt,
  getPaymentReceipts,
  getPaymentReceiptById,
  updatePaymentReceipt,
  deletePaymentReceipt,
  generatePaymentReceiptPDF,
  requestChange,
  getLastReceipt,
  sendReceiptEmail,
  sendTempReceiptEmail,
  sendEmailWithPDF,
  sendEmailWithoutPDF,
  getNextReceiptNumber
} from '../controllers/paymentReceiptController.js';
import { 
  verifyToken as protect, 
  verifyAdmin 
} from '../middleware/AuthMiddleware.js';

const router = express.Router();

// Apply protection to all routes
router.use(protect);

router.get('/last', getLastReceipt);
router.post('/request-change', requestChange);
router.get('/next-number', getNextReceiptNumber);

router.route('/')
  .post(createPaymentReceipt)
  .get(getPaymentReceipts);

router.route('/:id/pdf')
  .get(generatePaymentReceiptPDF);

router.route('/:id')
  .get(getPaymentReceiptById)
  .put(verifyAdmin, updatePaymentReceipt)
  .delete(verifyAdmin, deletePaymentReceipt);

router.post('/:id/send-email', sendReceiptEmail);
router.post('/send-email-temp', sendTempReceiptEmail);
router.post('/send-email-with-pdf', sendEmailWithPDF);
router.post('/send-email-without-pdf', sendEmailWithoutPDF);

export default router;
import express from 'express';
import { verifyToken } from '../middleware/AuthMiddleware.js';
import {
  getLatestCreditNote,
  getAllCreditNotes,
  getCreditNoteById,
  createCreditNote,
  updateCreditNote,
  deleteCreditNote,
  generatePDF,
  sendEmail,
  sendEmailUnsaved,
  generatePDFFromUnsaved,
  findBillByNumber
} from '../controllers/CreditNoteController.js';

const router = express.Router();

router.get('/latest', verifyToken, getLatestCreditNote);
router.get('/latest-invoice', verifyToken, getLatestCreditNote);
router.get('/', verifyToken, getAllCreditNotes);
router.get('/:id', verifyToken, getCreditNoteById);
router.post('/', verifyToken, createCreditNote);
router.put('/:id', verifyToken, updateCreditNote);
router.delete('/:id', verifyToken, deleteCreditNote);
router.get('/pdf/:invoiceNumber', verifyToken, generatePDF);
router.post('/generate-pdf-unsaved', generatePDFFromUnsaved);
router.post('/email', verifyToken, sendEmail);
router.post('/send-email', sendEmailUnsaved);
router.get('/find-bill/:billNumber', verifyToken, findBillByNumber);

export default router;
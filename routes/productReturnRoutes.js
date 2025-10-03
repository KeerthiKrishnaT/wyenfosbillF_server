import express from 'express';
import { getAllCreditNotes } from '../controllers/CreditNoteController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

// Get all product returns (redirected to credit notes)
router.get('/', verifyToken, getAllCreditNotes);

// Get returns by item code (redirected to credit notes)
router.get('/item/:itemCode', verifyToken, getAllCreditNotes);

// Get returns summary statistics (redirected to credit notes)
router.get('/summary', verifyToken, getAllCreditNotes);

export default router;

import express from 'express';
import { createQuotation, getQuotations, getQuotationById, updateQuotation, deleteQuotation, generatePDF } from '../controllers/QuotationController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

// Test route to verify router is working (no auth required)
router.get('/quotations/test', (req, res) => {
  res.json({ message: 'Quotation routes are working!' });
});

// Test route to check if server is running
router.get('/test', (req, res) => {
  res.json({ message: 'Server is running!', timestamp: new Date().toISOString() });
});

// Test PDF generation route (no auth required for testing)
router.post('/quotations-pdf-test', (req, res) => {
  res.json({ 
    message: 'PDF test endpoint working!',
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to list all quotations (no auth required for testing)
router.get('/quotations/debug', (req, res) => {
  res.json({ message: 'Quotations debug endpoint working!' });
});

router.post('/quotations', verifyToken, createQuotation);
router.get('/quotations', verifyToken, getQuotations);
router.post('/quotations-pdf', verifyToken, generatePDF);
router.get('/quotations/:id', verifyToken, getQuotationById);
router.put('/quotations/:id', verifyToken, updateQuotation);
router.delete('/quotations/:id', verifyToken, deleteQuotation);

// Fallback route for quotations without authentication (for testing)
router.get('/quotations/public', async (req, res) => {
  try {
    res.json({ message: 'Quotations public endpoint working', quotations: [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



export default router;
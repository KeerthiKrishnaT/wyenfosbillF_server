import express from 'express';
import { 
  getWeeklyRevenue, 
  getWeeklyCashBills, 
  getWeeklyCreditBills, 
  getWeeklyDebitNotes 
} from '../controllers/revenueController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

// Simple auth middleware for weekly bills (temporary)
const simpleAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false,
      error: 'Authorization token required',
      code: 'MISSING_TOKEN'
    });
  }
  
  // For now, just check if token exists
  req.user = { uid: 'temp-user', role: 'customer' };
  next();
};

// Weekly revenue endpoint
router.get('/weekly', getWeeklyRevenue);

// Weekly bills endpoints
router.get('/cashbills/weekly', simpleAuth, getWeeklyCashBills);
router.get('/creditbills/weekly', simpleAuth, getWeeklyCreditBills);
router.get('/debitnotes/weekly', simpleAuth, getWeeklyDebitNotes);

export default router;

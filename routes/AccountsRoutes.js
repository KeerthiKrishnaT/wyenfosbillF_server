import express from 'express';
import multer from 'multer';
import {
  authenticateToken,
  getBillingData,
  getOrderSummary,
  getPaymentSummary,
  getPaymentHistory,
  getProfitData,
  getBillDistribution,
  getComparisonData,
  getFilteredData,
  getBillDetails,
  getMonthDetails,
  getStaffList,
  getStaffBillDetails,
  addStaff,
  updateStaff,
  sendMessage,
  getPermissionRequests,
  updatePermissionRequest,
} from '../controllers/AccountController.js';

const router = express.Router();

// Configure multer for file uploads (if needed)
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Accounts routes
router.get('/accounts/billing', authenticateToken, getBillingData);
router.get('/accounts/order-summary', authenticateToken, getOrderSummary);
router.get('/accounts/payment-summary', authenticateToken, getPaymentSummary);
router.get('/accounts/payment-history', authenticateToken, getPaymentHistory);
router.get('/accounts/profit-data', authenticateToken, getProfitData);
router.get('/accounts/bill-distribution', authenticateToken, getBillDistribution);
router.get('/accounts/comparison-data', authenticateToken, getComparisonData);
router.post('/accounts/filtered-data', authenticateToken, getFilteredData);
router.get('/accounts/bill-details/:type', authenticateToken, getBillDetails);
router.post('/accounts/month-details', authenticateToken, getMonthDetails);

// Staff routes
router.get('/staff/list', authenticateToken, getStaffList);
router.get('/staff/:staffId/bill-details', authenticateToken, getStaffBillDetails);
router.post('/staff/add', authenticateToken, addStaff);
router.put('/staff/:staffId', authenticateToken, updateStaff);
router.post('/staff/send-message', authenticateToken, sendMessage);

// Permission routes
router.get('/permission', authenticateToken, getPermissionRequests);
router.put('/permission/:requestId', authenticateToken, updatePermissionRequest);

// Message routes
router.post('/send-message', authenticateToken, sendMessage);

export default router;
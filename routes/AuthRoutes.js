import express from 'express';
import {
  login,
  getUserRole,
  addAdmin,
  listUsers,
  getBillingData,
  getOrderSummary,
  getPaymentSummary,
  addPanelFeature,
  getStaffAppointments,
  getStaffDetails,
  getStaffPunchingTime,
  getTerminatedStaff,
  getLeaveRequests,
  updateLeaveRequest,
  getClientDetails,
  getShopDetails,
  getPettyVouchers,
  getPettyCashVouchers,
  getAllDepartments,
  deleteAdmin,
  updateAdmin,
  getAdmins,
  getAllUsers,
  resetStaffPasswords,
  refreshToken,
  getUserSessions,
  recordStaffLogin,
  recordStaffLogout,
  getCurrentUser
} from '../controllers/AuthController.js';
import {
  verifyToken,
  verifyRefreshToken,
  verifyAdminOrSuperAdmin,
  verifyAdmin,
  verifySuperAdmin,
} from '../middleware/AuthMiddleware.js';

const router = express.Router();

// ✅ AUTH ROUTES
router.post('/login', login);
router.get('/me', verifyToken, getCurrentUser); // Add /me endpoint
router.get('/user-role', verifyToken, getUserRole); 
router.post('/refresh-token', verifyRefreshToken, refreshToken); 
router.get('/all-departments', getAllDepartments);

// Add these routes
router.post('/punching-times/record-login', verifyToken, recordStaffLogin);
router.post('/punching-times/record-logout', verifyToken, recordStaffLogout);
router.get('/user-sessions/:userId', verifyToken, getUserSessions);

// ✅ ADMIN MANAGEMENT
router.get('/admins', verifyToken, verifyAdminOrSuperAdmin, getAdmins);
router.post('/admins', verifyToken, verifySuperAdmin, addAdmin);
router.put('/admins/:id', verifyToken, verifySuperAdmin, updateAdmin);
router.get('/list-users', verifyToken, verifyAdminOrSuperAdmin, listUsers);
router.delete('/admins/:id', verifyToken, verifySuperAdmin, deleteAdmin);

// Remove test route completely
router.get('/test-admins', verifyToken, (req, res) => {
  res.json({ message: 'Admin test route' });
});

// ✅ ACCOUNTS ADMIN PANEL
router.get('/accounts/billing', verifyToken, verifyAdmin, getBillingData);
router.get('/accounts/order-summary', verifyToken, verifyAdmin, getOrderSummary);
router.get('/accounts/payment-summary', verifyToken, verifyAdmin, getPaymentSummary);

// ✅ SUPER ADMIN ONLY
router.post('/add-panel-feature', verifyToken, verifySuperAdmin, addPanelFeature);

// ✅ HR ADMIN PANEL
router.get('/hr/staff-appointments', verifyToken, verifyAdmin, getStaffAppointments);
router.get('/hr/staff-details', verifyToken, verifyAdmin, getStaffDetails);
router.get('/hr/staff-punching-time', verifyToken, verifyAdmin, getStaffPunchingTime);
router.get('/hr/terminated-staff', verifyToken, verifyAdmin, getTerminatedStaff);
router.get('/hr/leave-requests', verifyToken, verifyAdmin, getLeaveRequests);
router.put('/hr/leave-request/:id', verifyToken, verifyAdmin, updateLeaveRequest);

// ✅ MARKETING ADMIN PANEL
router.get('/marketing/client-details', verifyToken, verifyAdmin, getClientDetails);
router.get('/marketing/shop-details', verifyToken, verifyAdmin, getShopDetails);

// ✅ DIGITAL MARKETING PANEL
router.get('/digital-marketing/petty-vouchers', verifyToken, verifyAdmin, getPettyVouchers);
router.get('/digital-marketing/petty-cash-vouchers', verifyToken, verifyAdmin, getPettyCashVouchers);

// ✅ RESET PASSWORD
router.get('/users/all', verifyToken, verifyAdminOrSuperAdmin, getAllUsers);
router.put('/users/reset-passwords', verifyToken, verifyAdminOrSuperAdmin, resetStaffPasswords);

export default router;
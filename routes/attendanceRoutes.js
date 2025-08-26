import express from 'express';
import {
  getDailyAttendance,
  getAttendanceSummary,
  markUserPresent,
  markUserAbsent,
  getWorkingHours,
  updateWorkingHours
} from '../controllers/attendanceController.js';
import {
  verifyToken,
  verifyAdminOrSuperAdmin,
  verifySuperAdmin
} from '../middleware/AuthMiddleware.js';

const router = express.Router();

// Get daily attendance for all users
router.get('/daily', verifyToken, verifyAdminOrSuperAdmin, getDailyAttendance);

// Get attendance summary for date range
router.get('/summary', verifyToken, verifyAdminOrSuperAdmin, getAttendanceSummary);

// Mark user as present manually (HR admin only)
router.post('/mark-present', verifyToken, verifyAdminOrSuperAdmin, markUserPresent);

// Mark user as absent manually (HR admin only)
router.post('/mark-absent', verifyToken, verifyAdminOrSuperAdmin, markUserAbsent);

// Get working hours configuration
router.get('/working-hours', verifyToken, getWorkingHours);

// Update working hours configuration (Super admin only)
router.put('/working-hours', verifyToken, verifySuperAdmin, updateWorkingHours);

export default router;
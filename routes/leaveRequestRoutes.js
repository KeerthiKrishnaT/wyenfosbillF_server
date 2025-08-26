import express from 'express';
import {
  createLeaveRequest,
  getLeaveRequests,
  updateLeaveStatus,
  getLeaveRequestById,
  deleteLeaveRequest,
  testDatabase
} from '../controllers/leaveRequestController.js';
import { verifyToken, verifyAdminOrSuperAdmin } from '../middleware/AuthMiddleware.js';

const router = express.Router();

router.route('/')
  .post(verifyToken, createLeaveRequest)
  .get(verifyToken, getLeaveRequests);

router.route('/:id')
  .get(verifyToken, getLeaveRequestById)
  .put(verifyToken, updateLeaveStatus)
  .delete(verifyToken, deleteLeaveRequest);

export default router;
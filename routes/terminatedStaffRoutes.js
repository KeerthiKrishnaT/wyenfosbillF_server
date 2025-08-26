import express from 'express';
import {
  createTerminatedStaff,
  getTerminatedStaff,
  getTerminatedStaffById,
  updateTerminatedStaff,
  deleteTerminatedStaff
} from '../controllers/terminatedStaffController.js';
import { verifyToken, verifyAdminOrSuperAdmin } from '../middleware/AuthMiddleware.js';

const router = express.Router();

router.route('/')
  .post(verifyToken, verifyAdminOrSuperAdmin, createTerminatedStaff)
  .get(verifyToken, verifyAdminOrSuperAdmin, getTerminatedStaff);

router.route('/:id')
  .get(verifyToken, verifyAdminOrSuperAdmin, getTerminatedStaffById)
  .put(verifyToken, verifyAdminOrSuperAdmin, updateTerminatedStaff)
  .delete(verifyToken, verifyAdminOrSuperAdmin, deleteTerminatedStaff);

export default router;
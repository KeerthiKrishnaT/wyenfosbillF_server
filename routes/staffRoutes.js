import express from 'express';
import {
  getAllStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  getAllCompanies,
  getActiveStaffMinimal
} from '../controllers/staffController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

router.route('/')
  .get(verifyToken, getAllStaff)
  .post(verifyToken, createStaff);
router.route('/:id')
  .put(verifyToken, updateStaff)
  .delete(verifyToken, deleteStaff);
router.get('/companies/all', verifyToken, getAllCompanies);
router.get('/active/minimal', verifyToken, getActiveStaffMinimal);
router.get('/active-minimal', verifyToken, getActiveStaffMinimal); // Add alias for client compatibility

export default router;
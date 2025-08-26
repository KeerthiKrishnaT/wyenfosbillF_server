import express from 'express';
import { protect, verifySuperAdmin } from '../middleware/AuthMiddleware.js';
import { getAllStaff, resetAllStaffPasswords } from '../controllers/UserController.js';

const router = express.Router();

router.get('/staff', protect, verifySuperAdmin, getAllStaff);
router.put('/reset-passwords', protect, verifySuperAdmin, resetAllStaffPasswords);

export default router;
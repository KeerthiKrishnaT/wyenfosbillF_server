import express from 'express';
import { getAllFinancialData } from '../controllers/financialController.js';
import { protect, verifySuperAdmin } from '../middleware/AuthMiddleware.js';

const router = express.Router();

router.get('/all', protect, verifySuperAdmin, getAllFinancialData);

export default router;

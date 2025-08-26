import express from 'express';
import { getTotalSpent } from '../controllers/totalSpentController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

router.get('/', verifyToken, getTotalSpent);

export default router;

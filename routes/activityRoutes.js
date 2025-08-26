import express from 'express';
import { getRecentActivity } from '../controllers/activityController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

router.get('/recent', verifyToken, getRecentActivity);

export default router;

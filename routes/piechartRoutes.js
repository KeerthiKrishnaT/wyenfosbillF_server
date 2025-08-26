import express from 'express';
import { getPieChartRevenue, testConnection } from '../controllers/piechartController.js';

const router = express.Router();

router.get('/', getPieChartRevenue);

export default router;

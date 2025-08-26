import express from 'express';
import {
  getAllProductReturns,
  getReturnsByItemCode,
  getReturnsSummary
} from '../controllers/ProductReturnController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

// Get all product returns
router.get('/', verifyToken, getAllProductReturns);

// Get returns by item code
router.get('/item/:itemCode', verifyToken, getReturnsByItemCode);

// Get returns summary statistics
router.get('/summary', verifyToken, getReturnsSummary);

export default router;

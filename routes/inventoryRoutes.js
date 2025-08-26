import express from 'express';
import {
  restockInventory,
  getLowStockAlerts,
  exportLowStockPdf,
  getAllInventory,
  calculateStockBalance,
  getInventoryAlerts,
  testInventoryConnection
} from '../controllers/InventoryController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

router.post('/restock', verifyToken, restockInventory);
router.get('/alerts', verifyToken, getLowStockAlerts);
router.get('/inventory/alerts/pdf', verifyToken, exportLowStockPdf);
router.get('/alerts', verifyToken, getInventoryAlerts);
router.get('/', verifyToken, getAllInventory);
router.get('/calculate-stock', verifyToken, calculateStockBalance);

export default router;

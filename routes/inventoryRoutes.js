import express from 'express';
import {
  restockInventory,
  getLowStockAlerts,
  exportLowStockPdf,
  getAllInventory,
  calculateStockBalance,
  getInventoryAlerts,
  testInventoryConnection,
  testSoldProductsData,
  testSpecificProducts,
  checkAllSalesData,
  getInventoryAnalysis
} from '../controllers/InventoryController.js';
import { 
  getUnifiedInventoryAnalysis,
  getUnifiedSalesData 
} from '../controllers/UnifiedInventoryController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

router.post('/restock', verifyToken, restockInventory);
router.get('/alerts', verifyToken, getLowStockAlerts);
router.get('/inventory/alerts/pdf', verifyToken, exportLowStockPdf);
router.get('/alerts', verifyToken, getInventoryAlerts);
router.get('/', verifyToken, getAllInventory);
router.get('/calculate-stock', verifyToken, calculateStockBalance);
router.get('/analysis', verifyToken, getInventoryAnalysis);
router.get('/test-connection', verifyToken, testInventoryConnection);
router.get('/test-sold-products', verifyToken, testSoldProductsData);
router.get('/test-specific-products', verifyToken, testSpecificProducts);
router.get('/check-all-sales', verifyToken, checkAllSalesData);

// Unified inventory routes (using soldProducts collection only)
router.get('/unified-analysis', verifyToken, getUnifiedInventoryAnalysis);
router.get('/unified-sales', verifyToken, getUnifiedSalesData);

export default router;

import express from 'express';
import { 
  migrateAllSalesToSoldProducts, 
  getUnifiedSalesData, 
  clearSoldProductsCollection 
} from '../controllers/SalesMigrationController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

// Migrate all sales data to soldProducts collection
router.post('/migrate-all-sales', verifyToken, migrateAllSalesToSoldProducts);

// Get unified sales data from soldProducts collection
router.get('/unified-sales', verifyToken, getUnifiedSalesData);

// Clear soldProducts collection (for testing/reset)
router.delete('/clear-sold-products', verifyToken, clearSoldProductsCollection);

export default router;

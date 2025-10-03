import express from 'express';
import { 
  migrateSoldProductsData, 
  verifySoldProductsData 
} from '../controllers/DirectMigrationController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

// Direct migration route
router.post('/migrate-sold-products', verifyToken, migrateSoldProductsData);

// Verification route
router.get('/verify-sold-products', verifyToken, verifySoldProductsData);

export default router;

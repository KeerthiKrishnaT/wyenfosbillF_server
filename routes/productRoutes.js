import express from 'express';
import {
  getAllProducts,
  createBulkProducts,
  deleteProduct,
  updateProduct,
  recordSoldProduct,
  getAllSoldProducts,
  getProductsByCreator,
  getInventory,
  getProductById,

} from '../controllers/ProductController.js';
import { verifyToken, verifySuperAdmin } from '../middleware/AuthMiddleware.js';

const router = express.Router();

console.log('Product routes loaded');
console.log('Registering POST /api/bulk');

// Product management routes
router.get('/products', verifyToken, getAllProducts);
router.get('/products/low-stock', verifyToken, getInventory);
router.get('/products/by-creator/:userId', verifyToken, verifySuperAdmin, getProductsByCreator);
router.get('/products/:id', verifyToken, getProductById);
router.post('/bulk', verifyToken, createBulkProducts);
router.put('/products/:id', verifyToken, updateProduct);
router.delete('/products/:id', verifyToken, deleteProduct);

// Sold products and inventory
router.get('/sold-products', verifyToken, getAllSoldProducts);
router.post('/sold-products', verifyToken, recordSoldProduct);
router.get('/inventory', verifyToken, getInventory);

export default router;
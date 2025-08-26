import express from 'express';
import {
  getAllPurchases,
  createPurchase,
  updatePurchase,
  deletePurchase
} from '../controllers/purchaseController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', verifyToken, getAllPurchases);
router.post('/', upload.single('bill'), verifyToken, createPurchase);
router.put('/:id', upload.single('bill'), verifyToken, updatePurchase);
router.delete('/:id', verifyToken, deletePurchase);

export default router;
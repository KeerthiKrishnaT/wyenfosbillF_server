import express from 'express';
import { getAllSoldItems, createSoldItem, updateSoldItem } from '../controllers/SoldProductController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

router.get('/all-sold-items', verifyToken, getAllSoldItems);
router.get('/', verifyToken, getAllSoldItems); // Add root endpoint for compatibility
router.post('/', verifyToken, createSoldItem);
router.put('/:id', verifyToken, updateSoldItem);

export default router;
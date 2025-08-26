import express from 'express';
import { verifyToken } from '../middleware/AuthMiddleware.js';
import {
  addStaff,
  getStaffs,
  deleteStaff,
  addClient,
  getClients,
  addShop,
  getShops,
  sendMessage,
} from '../controllers/MarketingController.js';

const router = express.Router();

// Staff routes
router.post('/staff-details', verifyToken, addStaff);
router.get('/staff-details', verifyToken, getStaffs);
router.delete('/staff-details/:id', verifyToken, deleteStaff);

// Client routes
router.post('/client-details', verifyToken, addClient);
router.get('/client-details', verifyToken, getClients);

// Shop routes
router.post('/shop-details', verifyToken, addShop);
router.get('/shop-details', verifyToken, getShops);

// Message routes
router.post('/send-message', verifyToken, sendMessage);

export default router;
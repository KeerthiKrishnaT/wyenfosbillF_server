import express from 'express';
import {verifyToken, verifyAdmin } from '../middleware/AuthMiddleware.js';
import {
  getSystemStats,
  getAllUsers,
  updateUser,
  getPendingRequests,
  handleRequest
} from '../controllers/AdminController.js';

const router = express.Router();

// Apply admin middleware to all routes
router.use(verifyToken, verifyAdmin);

// Admin routes
router.get('/stats', getSystemStats);
router.get('/users', getAllUsers);
router.put('/users/:id', updateUser);
router.get('/requests', getPendingRequests);
router.put('/requests/:id', handleRequest);

export default router;

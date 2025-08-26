import express from 'express';
import { 
  getAllUsers, 
  createUser, 
  updateUser, 
  deleteUser, 
  resetUserPassword,
  verifyToken 
} from '../controllers/ResetPasswordController.js';

const router = express.Router();

// Apply token verification middleware to all routes
router.use(verifyToken);

// Get all users
router.get('/', getAllUsers);

// Create new user
router.post('/', createUser);

// Update user
router.patch('/:userId', updateUser);

// Delete user
router.delete('/:userId', deleteUser);

// Reset user password
router.put('/:userId/reset-password', resetUserPassword);

export default router;

import express from 'express';
import {
  getAllUsers,
  resetUserPassword,
  deleteUser,
  createUser,
  updateUser
} from '../controllers/resetPasswordPageController.js';
import { verifyToken, verifySuperAdmin } from '../middleware/AuthMiddleware.js';

const router = express.Router();
router.get('/', verifyToken, verifySuperAdmin, getAllUsers);
router.post('/', verifyToken, verifySuperAdmin, createUser);
router.put('/:id/reset-password', verifyToken, verifySuperAdmin, resetUserPassword);
router.patch('/:id', verifyToken, verifySuperAdmin, updateUser);
router.delete('/:id', verifyToken, verifySuperAdmin, deleteUser);

export default router;

import express from 'express';
import {
  createPermissionRequest,
  getAllPermissionRequests,
  handlePermissionRequest,
} from '../controllers/requestController.js';
import { verifyToken, verifyAdminOrSuperAdmin } from '../middleware/AuthMiddleware.js';

const router = express.Router();

router.post('/', verifyToken, createPermissionRequest);
router.get('/', verifyToken, verifyAdminOrSuperAdmin , getAllPermissionRequests);
router.put('/:id', verifyToken, verifyAdminOrSuperAdmin, handlePermissionRequest);

export default router;
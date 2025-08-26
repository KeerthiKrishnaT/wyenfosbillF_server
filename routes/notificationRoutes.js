import express from 'express';
import {
  sendEditRequest,
  sendDeleteRequest
} from '../controllers/notificationsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Direct notification endpoints
router.post('/send-edit-request', authenticateToken, sendEditRequest);
router.post('/send-delete-request', authenticateToken, sendDeleteRequest);

export default router;


import express from 'express';
import { 
  requestEdit, 
  requestDelete,
  getPendingRequests,
  processRequest,
  checkRequestStatus,
  sendEditRequest,
  sendDeleteRequest
} from '../controllers/notificationsController.js';
import { verifyToken, verifyAdmin } from '../middleware/AuthMiddleware.js';

const router = express.Router();

// User endpoints
router.post('/edit-request', verifyToken, requestEdit);
router.post('/delete-request', verifyToken, requestDelete);
router.get('/check-status/:requestId', verifyToken, checkRequestStatus);

// Permission request endpoint
router.post('/request-permission', verifyToken, requestEdit);

// New notification endpoints
router.post('/send-edit-request', verifyToken, sendEditRequest);
router.post('/send-delete-request', verifyToken, sendDeleteRequest);

// Admin endpoints
router.get('/pending', verifyToken, verifyAdmin, getPendingRequests);
router.post('/process/:requestId', verifyToken, verifyAdmin, processRequest);

export default router;
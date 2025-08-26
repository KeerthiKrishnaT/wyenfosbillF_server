import express from 'express';
import { 
  sendBillEmail,
  sendPasswordResetEmail,
  sendNotificationEmail
} from '../controllers/EmailController.js';
import { 
  validateBillEmail,
  validatePasswordResetEmail,
  validateNotificationEmail
} from '../middleware/emailValidation.js';

const router = express.Router();

router.post('/send-bill', validateBillEmail, sendBillEmail);
router.post('/send-password-reset', validatePasswordResetEmail, sendPasswordResetEmail);
router.post('/send-notification', validateNotificationEmail, sendNotificationEmail);

export default router;
import express from 'express';
import {
  createReminder,
  getReminders,
  getUpcomingReminders,
  getOverdueReminders,
  updateReminder,
  deleteReminder,
  markReminderSent,
  sendReminderNotification,
  createEMIReminder,
  createTestReminder,
  sendSuperAdminNotification,
  sendBulkSuperAdminNotifications
} from '../controllers/ReminderController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

// Reminder management routes
router.post('/', verifyToken, createReminder);
router.post('/emi', verifyToken, createEMIReminder);
router.get('/', verifyToken, getReminders);
router.get('/upcoming', verifyToken, getUpcomingReminders);
router.get('/overdue', verifyToken, getOverdueReminders);
router.put('/:id', verifyToken, updateReminder);
router.delete('/:id', verifyToken, deleteReminder);
router.post('/:id/mark-sent', verifyToken, markReminderSent);
router.post('/:id/send-notification', verifyToken, sendReminderNotification);

// Super admin notification routes
router.post('/:id/send-super-admin', verifyToken, sendSuperAdminNotification);
router.post('/bulk-super-admin', verifyToken, sendBulkSuperAdminNotifications);

export default router;

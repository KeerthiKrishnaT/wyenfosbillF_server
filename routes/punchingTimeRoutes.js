import express from 'express';
import {
  getPunchingTimes,
  createPunchingTime,
  updatePunchingTime,
  deletePunchingTime,
  recordLogin,
  recordLogout,
  getUserSessions,
  getCurrentPunchingTime
} from '../controllers/punchingTimeController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();
router.get('/', verifyToken, getPunchingTimes);
router.get('/current', verifyToken, getCurrentPunchingTime);
router.post('/', verifyToken, createPunchingTime);
router.put('/:id', verifyToken, updatePunchingTime);
router.delete('/:id', verifyToken, deletePunchingTime);
router.post('/record-login', verifyToken, recordLogin);
router.post('/record-logout', verifyToken, recordLogout);
router.get('/user-sessions/:userId', verifyToken, getUserSessions);

export default router;
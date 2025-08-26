import express from 'express';
import { 
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment
} from '../controllers/appointmentsController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

router.get('/', verifyToken, getAppointments);
router.post('/', verifyToken, createAppointment);
router.put('/:id', verifyToken, updateAppointment);
router.delete('/:id', verifyToken, deleteAppointment);

export default router;
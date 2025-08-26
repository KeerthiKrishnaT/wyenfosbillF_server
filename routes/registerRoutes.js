import express from 'express';
import { registerUser } from '../controllers/registerController.js';
import { validateRegister } from '../middleware/registerMiddleware.js';

const router = express.Router();

router.post('/', validateRegister, registerUser);

export default router;
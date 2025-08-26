import express from 'express';
import multer from 'multer';
import uploadProfilePic from '../controllers/uploadController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/profile', verifyToken, upload.single('profilePic'), uploadProfilePic);

export default router;

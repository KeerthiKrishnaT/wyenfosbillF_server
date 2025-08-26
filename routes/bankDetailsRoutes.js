import express from 'express';
import { 
  getBankDetails, 
  getBankDetailById,
  saveBankDetails, 
  deleteBankDetails,
  updateBankDetails,
  generateQRCode
} from '../controllers/bankDetailsController.js';
import {verifyToken, verifySuperAdmin,authorize } from '../middleware/AuthMiddleware.js';
import multer from 'multer';

const router = express.Router();

// Use memory storage for Firebase Storage uploads
const upload = multer({ storage: multer.memoryStorage() });

router.route('/')
  .get(verifyToken, authorize(['admin', 'staff', 'super_admin', 'superadmin']), getBankDetails)
  .post(verifyToken, verifySuperAdmin, upload.single('qrCode'), saveBankDetails);

router
  .route('/:id')
  .get(verifyToken, authorize(['admin', 'staff', 'super_admin', 'superadmin']), getBankDetailById)
  .put(verifyToken, verifySuperAdmin, upload.single('qrCode'), updateBankDetails)
  .delete(verifyToken, verifySuperAdmin, deleteBankDetails);

// Generate QR code for existing bank details
router.post('/:id/generate-qr', verifyToken, verifySuperAdmin, generateQRCode);

export default router;
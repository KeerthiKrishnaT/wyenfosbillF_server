import express from 'express';
import {
  createPettyCashVoucher,
  getAllPettyCashVouchers,
  updatePettyCashVoucher,
  deletePettyCashVoucher,
} from '../controllers/pettyCashVoucherController.js';
import {
  createPettyVoucher,
  getAllPettyVouchers,
  updatePettyVoucher,
} from '../controllers/pettyVoucherController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

// Petty Voucher Routes
router.get('/petty-vouchers', verifyToken, getAllPettyVouchers);
router.post('/petty-vouchers', verifyToken, createPettyVoucher);
router.put('/petty-vouchers/:id', verifyToken, updatePettyVoucher);

// Petty Cash Voucher Routes
router.get('/petty-cash-vouchers', verifyToken, getAllPettyCashVouchers);
router.post('/petty-cash-vouchers', verifyToken, createPettyCashVoucher);
router.put('/petty-cash-vouchers/:id', verifyToken, updatePettyCashVoucher);
router.delete('/petty-cash-vouchers/:id', verifyToken, deletePettyCashVoucher);

export default router;

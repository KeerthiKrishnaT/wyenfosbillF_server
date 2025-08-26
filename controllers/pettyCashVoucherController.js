import { 
  firebaseService 
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

function generateCashVoucherId(latestNumber) {
  return `CASH${String(latestNumber + 1).padStart(3, '0')}`;
}

export const createPettyCashVoucher = async (req, res) => {
  try {
    const { date, amount, purpose, cashStatus } = req.body;

    // Validate input
    if (!date || !amount || !purpose) {
      return res.status(400).json({ error: 'Date, amount, and purpose are required' });
    }

    // Get highest number from voucherId
    const allVouchers = await firebaseService.getAll('pettyCashVouchers');
    const latest = allVouchers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    const latestNumber = latest ? parseInt(latest.voucherId.replace(/[^\d]/g, '')) : 0;
    const voucherId = generateCashVoucherId(latestNumber);

    const voucherData = {
      id: generateUniqueId(),
      voucherId,
      date,
      amount,
      purpose,
      cashStatus: cashStatus || 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const voucher = await firebaseService.create('pettyCashVouchers', voucherData);

    res.status(201).json({ message: 'Petty Cash Voucher created', voucher });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllPettyCashVouchers = async (req, res) => {
  try {
    const vouchers = await firebaseService.getAll('pettyCashVouchers');
    // Sort by creation date (newest first)
    vouchers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(vouchers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updatePettyCashVoucher = async (req, res) => {
  try {
    const { voucherId, date, amount, purpose, cashStatus } = req.body;

    // Validate input
    if (!voucherId || !date || !amount || !purpose || !cashStatus) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const updateData = {
      voucherId,
      date,
      amount,
      purpose,
      cashStatus,
      updatedAt: new Date()
    };

    const voucher = await firebaseService.update('pettyCashVouchers', req.params.id, updateData);

    if (!voucher) {
      return res.status(404).json({ error: 'Petty Cash Voucher not found' });
    }

    res.json({ message: 'Petty Cash Voucher updated', voucher });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deletePettyCashVoucher = async (req, res) => {
  try {
    const voucher = await firebaseService.delete('pettyCashVouchers', req.params.id);
    if (!voucher) {
      return res.status(404).json({ error: 'Petty Cash Voucher not found' });
    }
    res.json({ message: 'Petty Cash Voucher deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
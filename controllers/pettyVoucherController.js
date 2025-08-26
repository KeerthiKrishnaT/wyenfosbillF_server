import { 
  firebaseService 
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

function generateVoucherId(latestNumber) {
  return `VCH${String(latestNumber + 1).padStart(3, '0')}`;
}

export const createPettyVoucher = async (req, res) => {
  try {
    const { date, amount, purpose } = req.body;

    // Validate input
    if (!date || !amount || !purpose) {
      return res.status(400).json({ error: 'Date, amount, and purpose are required' });
    }

    // Get highest number from voucherId
    const allVouchers = await firebaseService.getAll('pettyVouchers');
    const latest = allVouchers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    const latestNumber = latest ? parseInt(latest.voucherId.replace(/[^\d]/g, '')) : 0;
    const voucherId = generateVoucherId(latestNumber);

    const voucherData = {
      id: generateUniqueId(),
      voucherId,
      date,
      amount,
      purpose,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const voucher = await firebaseService.create('pettyVouchers', voucherData);

    res.status(201).json({ message: 'Petty Voucher created', voucher });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllPettyVouchers = async (req, res) => {
  try {
    const vouchers = await firebaseService.getAll('pettyVouchers');
    // Sort by creation date (newest first)
    vouchers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(vouchers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updatePettyVoucher = async (req, res) => {
  try {
    const { voucherId, date, amount, purpose, paidTo, account, receivedBy, paidBy } = req.body;
    console.log('Update request body:', req.body); // Log the incoming payload
    
    if (!voucherId || !date || !amount || !purpose) {
      return res.status(400).json({ error: 'voucherId, date, amount, and purpose are required' });
    }
    
    const updateData = {
      voucherId,
      date, 
      amount, 
      purpose, 
      paidTo: paidTo || null,
      account: account || null,
      receivedBy: receivedBy || null,
      paidBy: paidBy || null,
      updatedAt: new Date()
    };

    const voucher = await firebaseService.update('pettyVouchers', req.params.id, updateData);
    
    if (!voucher) {
      return res.status(404).json({ error: 'Voucher not found' });
    }
    
    res.json({ message: 'Petty Voucher updated', voucher });
  } catch (err) {
    console.error('Update error:', err.message);
    res.status(400).json({ error: err.message });
  }
};
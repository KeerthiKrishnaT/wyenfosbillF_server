import { 
  firebaseService 
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

function generateCashVoucherId(latestNumber) {
  return `CASH${String(latestNumber + 1).padStart(3, '0')}`;
}

export const createPettyCashVoucher = async (req, res) => {
  try {
    const { date, amount, purpose, cashStatus, paidTo, account, receivedBy, paidBy, relatedPettyVoucherId } = req.body;
    
    console.log('Creating petty cash voucher with data:', { date, amount, purpose, cashStatus, paidTo, account, receivedBy, paidBy, relatedPettyVoucherId });

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
      relatedPettyVoucherId: relatedPettyVoucherId || null,
      paidTo: paidTo || null,
      account: account || null,
      receivedBy: receivedBy || null,
      paidBy: paidBy || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const voucher = await firebaseService.create('pettyCashVouchers', voucherData);
    
    console.log('Petty cash voucher created successfully:', voucher);
    console.log('Voucher data being returned:', {
      id: voucher.id,
      voucherId: voucher.voucherId,
      date: voucher.date,
      amount: voucher.amount,
      purpose: voucher.purpose,
      cashStatus: voucher.cashStatus,
      relatedPettyVoucherId: voucher.relatedPettyVoucherId,
      paidTo: voucher.paidTo,
      account: voucher.account,
      receivedBy: voucher.receivedBy,
      paidBy: voucher.paidBy
    });

    res.status(201).json(voucher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllPettyCashVouchers = async (req, res) => {
  try {
    const vouchers = await firebaseService.getAll('pettyCashVouchers');
    console.log('All petty cash vouchers from database:', vouchers);
    console.log('Sample petty cash voucher data:', vouchers[0] ? {
      id: vouchers[0].id,
      voucherId: vouchers[0].voucherId,
      relatedPettyVoucherId: vouchers[0].relatedPettyVoucherId,
      paidTo: vouchers[0].paidTo,
      account: vouchers[0].account,
      receivedBy: vouchers[0].receivedBy,
      paidBy: vouchers[0].paidBy
    } : 'No vouchers found');
    
    // Sort by creation date (newest first)
    vouchers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(vouchers);
  } catch (err) {
    console.error('Error fetching petty cash vouchers:', err);
    res.status(500).json({ error: err.message });
  }
};

export const updatePettyCashVoucher = async (req, res) => {
  try {
    const { voucherId, date, amount, purpose, cashStatus, paidTo, account, receivedBy, paidBy, relatedPettyVoucherId } = req.body;

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
      relatedPettyVoucherId: relatedPettyVoucherId || null,
      paidTo: paidTo || null,
      account: account || null,
      receivedBy: receivedBy || null,
      paidBy: paidBy || null,
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
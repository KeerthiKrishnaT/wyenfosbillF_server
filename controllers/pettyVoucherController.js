import { 
  firebaseService 
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

function generateVoucherId(latestNumber) {
  return `VCH${String(latestNumber + 1).padStart(3, '0')}`;
}

export const createPettyVoucher = async (req, res) => {
  try {
    const { date, amount, purpose, paidTo, account, receivedBy, paidBy } = req.body;
    
    console.log('Creating petty voucher with data:', { date, amount, purpose, paidTo, account, receivedBy, paidBy });

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
      paidTo: paidTo || null,
      account: account || null,
      receivedBy: receivedBy || null,
      paidBy: paidBy || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const voucher = await firebaseService.create('pettyVouchers', voucherData);
    
    console.log('Petty voucher created successfully:', voucher);
    console.log('Voucher data being returned:', {
      id: voucher.id,
      voucherId: voucher.voucherId,
      date: voucher.date,
      amount: voucher.amount,
      purpose: voucher.purpose,
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

export const getAllPettyVouchers = async (req, res) => {
  try {
    const vouchers = await firebaseService.getAll('pettyVouchers');
    console.log('All petty vouchers from database:', vouchers);
    console.log('Sample voucher data:', vouchers[0] ? {
      id: vouchers[0].id,
      voucherId: vouchers[0].voucherId,
      paidTo: vouchers[0].paidTo,
      account: vouchers[0].account,
      receivedBy: vouchers[0].receivedBy,
      paidBy: vouchers[0].paidBy
    } : 'No vouchers found');
    
    // Sort by creation date (newest first)
    vouchers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(vouchers);
  } catch (err) {
    console.error('Error fetching petty vouchers:', err);
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

export const deletePettyVoucher = async (req, res) => {
  try {
    const voucher = await firebaseService.delete('pettyVouchers', req.params.id);
    
    if (!voucher) {
      return res.status(404).json({ error: 'Petty voucher not found' });
    }
    
    console.log('Petty voucher deleted successfully:', req.params.id);
    res.json({ message: 'Petty voucher deleted successfully' });
  } catch (err) {
    console.error('Delete petty voucher error:', err);
    res.status(500).json({ error: err.message });
  }
};
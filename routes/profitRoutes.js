import express from 'express';
import { billService, firebaseService } from '../services/firebaseService.js';

const router = express.Router();

const getTotalAmount = (items, field) => {
  return items.reduce((sum, item) => {
    const value = field.split('.').reduce((obj, key) => (obj ? obj[key] : 0), item);
    return sum + (typeof value === 'number' ? value : 0);
  }, 0);
};

router.get('/profit-subtotals', async (req, res) => {
  try {
    const [cashBills, creditBills, creditNotes, debitNotes] = await Promise.all([
      billService.getCashBills(),
      billService.getCreditBills(),
      firebaseService.getAll('creditnotes'),
      firebaseService.getAll('debitnotes')
    ]);
    const totalCash = getTotalAmount(cashBills, 'totals.grandTotal');
    const totalCredit = getTotalAmount(creditBills, 'totals.grandTotal');
    const totalCreditNotes = getTotalAmount(creditNotes, 'totals.rounded');
    const totalDebitNotes = getTotalAmount(debitNotes, 'totals.totalAmount');
    res.json({
      totalCash,
      totalCredit,
      totalCreditNotes,
      totalDebitNotes
    });
  } catch (err) {
    console.error('Profit Subtotals Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch profit subtotals' });
  }
});

export default router;

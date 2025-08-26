
import { billService, firebaseService } from '../services/firebaseService.js';

export const getTotalSpent = async (req, res) => {
  try {
    const [cashBills, debitNotes] = await Promise.all([
      billService.getCashBills(),
      firebaseService.getAll('debitnotes')
    ]);

    const cash = cashBills.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);
    const debit = debitNotes.reduce((sum, note) => sum + (note.totalAmount || 0), 0);
    const totalSpent = cash + debit;

    res.status(200).json({ cash, debit, totalSpent });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch total spent', error });
  }
};

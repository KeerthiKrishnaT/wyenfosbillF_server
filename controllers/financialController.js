import { 
  billService, 
  firebaseService 
} from '../services/firebaseService.js';

export const getAllFinancialData = async (req, res) => {
  try {
    const [cashBills, creditBills, creditNotes, debitNotes] = await Promise.all([
      billService.getCashBills(),
      billService.getCreditBills(),
      firebaseService.getAll('creditnotes'),
      firebaseService.getAll('debitnotes')
    ]);
    
    res.json({ cashBills, creditBills, creditNotes, debitNotes });
  } catch (err) {
    console.error('Error fetching financial data:', err);
    res.status(500).json({ error: 'Server error while fetching financial data' });
  }
};

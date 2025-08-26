import { 
  billService, 
  firebaseService 
} from '../services/firebaseService.js';

export const testConnection = async (req, res) => {
  try {
    res.status(200).json({ 
      message: 'Pie chart controller is working',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Test connection failed',
      error: err.message
    });
  }
};

export const getPieChartRevenue = async (req, res) => {
  try {
    // Test each service call individually with better error handling
    let cashBills = [];
    let creditBills = [];
    let debitNotes = [];
    let creditNotes = [];

    try {
      cashBills = await billService.getCashBills();
    } catch (error) {
      cashBills = [];
    }

    try {
      creditBills = await billService.getCreditBills();
    } catch (error) {
      creditBills = [];
    }

    try {
      debitNotes = await firebaseService.getAll('debitnotes');
    } catch (error) {
      debitNotes = [];
    }

    try {
      creditNotes = await firebaseService.getAll('creditnotes');
    } catch (error) {
      creditNotes = [];
    }

    // Return counts instead of amounts
    const cash = cashBills.length || 0;
    const credit = creditBills.length || 0;
    const debit = debitNotes.length || 0;
    const creditNote = creditNotes.length || 0;

    res.status(200).json({
      cash: cash,
      credit: credit,
      debit: debit,
      creditNote: creditNote,
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Error fetching pie chart data',
      error: err.message
    });
  }
};

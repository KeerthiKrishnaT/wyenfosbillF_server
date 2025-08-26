import { billService, firebaseService } from '../services/firebaseService.js';

export const getWeeklyRevenue = async (req, res) => {
  try {
    console.log('🔍 Starting weekly revenue calculation...');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    console.log('📅 Start date for weekly calculation:', startDate);

    // Test each service call individually with better error handling
    let cashBills = [];
    let creditBills = [];
    let debitNotes = [];

    try {
      console.log('🔍 Fetching cash bills...');
      cashBills = await billService.getCashBills();
      console.log(`✅ Cash bills fetched: ${cashBills.length} found`);
    } catch (error) {
      console.error('❌ Error fetching cash bills:', error.message);
      cashBills = [];
    }

    try {
      console.log('🔍 Fetching credit bills...');
      creditBills = await billService.getCreditBills();
      console.log(`✅ Credit bills fetched: ${creditBills.length} found`);
    } catch (error) {
      console.error('❌ Error fetching credit bills:', error.message);
      creditBills = [];
    }

    try {
      console.log('🔍 Fetching debit notes...');
      debitNotes = await firebaseService.getAll('debitnotes');
      console.log(`✅ Debit notes fetched: ${debitNotes.length} found`);
    } catch (error) {
      console.error('❌ Error fetching debit notes:', error.message);
      debitNotes = [];
    }

    const cashTotal = cashBills
      .filter(bill => new Date(bill.createdAt) >= startDate)
      .reduce((sum, bill) => sum + (bill.totalAmount || bill.total || 0), 0);
    const creditTotal = creditBills
      .filter(bill => new Date(bill.createdAt) >= startDate)
      .reduce((sum, bill) => sum + (bill.totalAmount || bill.total || 0), 0);
    const debitTotal = debitNotes
      .filter(note => new Date(note.createdAt) >= startDate)
      .reduce((sum, note) => sum + (note.totalAmount || note.total || 0), 0);

    const totalRevenue = cashTotal + creditTotal + debitTotal;

    console.log('📊 Weekly revenue calculated:', { cashTotal, creditTotal, debitTotal, totalRevenue });

    res.status(200).json({
      cash: cashTotal,
      credit: creditTotal,
      debit: debitTotal,
      totalRevenue
    });
  } catch (err) {
    console.error('❌ Error calculating weekly revenue:', err);
    res.status(500).json({ 
      error: 'Failed to fetch weekly revenue',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// Get weekly cash bills (count and bills)
export const getWeeklyCashBills = async (req, res) => {
  try {
    console.log('🔍 Starting weekly cash bills fetch...');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    console.log('📅 Start date for weekly calculation:', startDate);

    let cashBills = [];
    try {
      console.log('🔍 Fetching cash bills...');
      cashBills = await billService.getCashBills();
      console.log(`✅ Cash bills fetched: ${cashBills.length} found`);
    } catch (error) {
      console.error('❌ Error fetching cash bills:', error.message);
      cashBills = [];
    }

    const weeklyCashBills = cashBills.filter(bill => 
      new Date(bill.createdAt) >= startDate
    );

    console.log('📊 Weekly cash bills calculated:', { count: weeklyCashBills.length });

    res.status(200).json(weeklyCashBills);
  } catch (err) {
    console.error('❌ Error fetching weekly cash bills:', err);
    res.status(500).json({ 
      error: 'Failed to fetch weekly cash bills',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// Get weekly credit bills (count and bills)
export const getWeeklyCreditBills = async (req, res) => {
  try {
    console.log('🔍 Starting weekly credit bills fetch...');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    console.log('📅 Start date for weekly calculation:', startDate);

    let creditBills = [];
    try {
      console.log('🔍 Fetching credit bills...');
      creditBills = await billService.getCreditBills();
      console.log(`✅ Credit bills fetched: ${creditBills.length} found`);
    } catch (error) {
      console.error('❌ Error fetching credit bills:', error.message);
      creditBills = [];
    }

    const weeklyCreditBills = creditBills.filter(bill => 
      new Date(bill.createdAt) >= startDate
    );

    console.log('📊 Weekly credit bills calculated:', { count: weeklyCreditBills.length });

    res.status(200).json(weeklyCreditBills);
  } catch (err) {
    console.error('❌ Error fetching weekly credit bills:', err);
    res.status(500).json({ 
      error: 'Failed to fetch weekly credit bills',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// Get weekly debit notes (count and notes)
export const getWeeklyDebitNotes = async (req, res) => {
  try {
    console.log('🔍 Starting weekly debit notes fetch...');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    console.log('📅 Start date for weekly calculation:', startDate);

    let debitNotes = [];
    try {
      console.log('🔍 Fetching debit notes...');
      debitNotes = await firebaseService.getAll('debitnotes');
      console.log(`✅ Debit notes fetched: ${debitNotes.length} found`);
    } catch (error) {
      console.error('❌ Error fetching debit notes:', error.message);
      debitNotes = [];
    }

    const weeklyDebitNotes = debitNotes.filter(note => 
      new Date(note.createdAt) >= startDate
    );

    console.log('📊 Weekly debit notes calculated:', { count: weeklyDebitNotes.length });

    res.status(200).json(weeklyDebitNotes);
  } catch (err) {
    console.error('❌ Error fetching weekly debit notes:', err);
    res.status(500).json({ 
      error: 'Failed to fetch weekly debit notes',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

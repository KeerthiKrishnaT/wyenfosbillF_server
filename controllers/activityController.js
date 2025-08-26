import { 
  billService, 
  firebaseService 
} from '../services/firebaseService.js';

export const getRecentActivity = async (req, res) => {
  try {
    // Get recent bills from Firebase
    const [recentCash, recentCredit, recentDebit] = await Promise.all([
      billService.getCashBills(),
      billService.getCreditBills(),
      firebaseService.getAll('debitnotes')
    ]);

    // Sort by creation date and limit to 3 each
    const sortByDate = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
    
    const recentCashSorted = recentCash.sort(sortByDate).slice(0, 3);
    const recentCreditSorted = recentCredit.sort(sortByDate).slice(0, 3);
    const recentDebitSorted = recentDebit.sort(sortByDate).slice(0, 3);

    const format = (data, type) => data.map(item => ({
      type,
      createdAt: item.createdAt,
      message:
        type === 'cashbill'
          ? `Cash Bill #${item.invoiceNumber} created for ₹${item.totalAmount}`
          : type === 'creditbill'
          ? `Credit Bill #${item.invoiceNumber} issued for ₹${item.totalAmount}`
          : `Debit Note #${item.invoiceNumber} logged for ₹${item.totalAmount}`,
    }));

    const allActivities = [
      ...format(recentCashSorted, 'cashbill'),
      ...format(recentCreditSorted, 'creditbill'),
      ...format(recentDebitSorted, 'debitnote'),
    ];

    allActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.status(200).json(allActivities.slice(0, 6));
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ message: 'Failed to fetch recent activity' });
  }
};

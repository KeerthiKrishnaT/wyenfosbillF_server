import jwt from 'jsonwebtoken';

export const validateEmail = async (req, res, next) => {
  try {
    const { invoiceNo, customerEmail } = req.body;

    if (!invoiceNo) {
      return res.status(400).json({ message: 'Invoice number is required' });
    }

    if (!customerEmail) {
      return res.status(400).json({ message: 'Customer email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const bill = await CreditBill.findOne({ invoiceNo });
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    next();
  } catch (error) {
    console.error('Error in validateEmail middleware:', error);
    res.status(500).json({ message: 'Server error during email validation' });
  }
};

// Validate bill data for update endpoint
export const validateBill = async (req, res, next) => {
  try {
    const billData = req.body;
    const { invoiceNo } = req.params;

    // Check required fields
    if (!billData.customerId) {
      return res.status(400).json({ message: 'Customer ID is required' });
    }

    if (!billData.customerName?.trim()) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    if (!billData.invoiceNo || billData.invoiceNo !== invoiceNo) {
      return res.status(400).json({ message: 'Invoice number mismatch or invalid' });
    }

    const invoiceRegex = /^CB-\d{8}-\d{3}$/;
    if (!invoiceRegex.test(billData.invoiceNo)) {
      return res.status(400).json({ message: 'Invoice number must be in format CB-YYYYMMDD-XXX' });
    }

    // Validate customer contact
    if (billData.customerContact) {
      if (billData.customerContact.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(billData.customerContact.email)) {
          return res.status(400).json({ message: 'Invalid email format' });
        }
      }

      if (billData.customerContact.phone) {
        const phoneRegex = /^\+?[\d\s-]{10,15}$/;
        if (!phoneRegex.test(billData.customerContact.phone)) {
          return res.status(400).json({ message: 'Invalid phone number format' });
        }
      }

      if (billData.customerContact.gstin) {
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstinRegex.test(billData.customerContact.gstin)) {
          return res.status(400).json({ message: 'Invalid GSTIN format' });
        }
      }
    }

    // Validate items
    if (!Array.isArray(billData.items) || billData.items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    for (const [index, item] of billData.items.entries()) {
      if (!item.description?.trim()) {
        return res.status(400).json({ message: `Item ${index + 1}: Description is required` });
      }
      if (isNaN(item.rate) || item.rate <= 0) {
        return res.status(400).json({ message: `Item ${index + 1}: Rate must be a positive number` });
      }
      if (isNaN(item.charge) || item.charge <= 0) {
        return res.status(400).json({ message: `Item ${index + 1}: Quantity must be a positive number` });
      }
      if (isNaN(item.amountToPay) || item.amountToPay < 0) {
        return res.status(400).json({ message: `Item ${index + 1}: Amount to pay cannot be negative` });
      }
      if (item.amountToPay > (item.total || 0)) {
        return res.status(400).json({ message: `Item ${index + 1}: Amount to pay cannot exceed total` });
      }
    }

    // Validate due dates
    if (!Array.isArray(billData.dueDates) || billData.dueDates.length === 0) {
      return res.status(400).json({ message: 'At least one due date is required' });
    }

    const today = new Date().toISOString().slice(0, 10);
    for (const [index, dueDate] of billData.dueDates.entries()) {
      if (!dueDate.date) {
        return res.status(400).json({ message: `Due date ${index + 1}: Date is required` });
      }
      if (dueDate.date < today) {
        return res.status(400).json({ message: `Due date ${index + 1}: Must be in the future` });
      }
      if (index > 0 && dueDate.date <= billData.dueDates[index - 1].date) {
        return res.status(400).json({ message: `Due date ${index + 1}: Must be after due date ${index}` });
      }
    }

    // Validate tax rate and discount
    if (isNaN(billData.taxRate) || billData.taxRate < 0) {
      return res.status(400).json({ message: 'Tax rate must be a non-negative number' });
    }

    if (billData.discount && (isNaN(billData.discount) || billData.discount < 0)) {
      return res.status(400).json({ message: 'Discount must be a non-negative number' });
    }

    // Check if bill exists
    const bill = await CreditBill.findOne({ invoiceNo });
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    next();
  } catch (error) {
    console.error('Error in validateBill middleware:', error);
    res.status(500).json({ message: 'Server error during bill validation' });
  }
};
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    if (!['super_admin', 'account_admin'].includes(decoded.role)) {
      return res.status(401).json({ error: 'Unauthorized: Super Admin or Account Admin access required' });
    }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
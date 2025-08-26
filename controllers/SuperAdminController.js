import { billService, firebaseService, userService } from '../services/firebaseService.js';
import { adminAuth } from '../config/firebase-admin.js';

// Middleware to verify super admin role
const verifySuperAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const user = await userService.getUserById(decoded.uid);
    if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied: Super admin only' });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Fetch all cash bills
const getCashBills = async (req, res) => {
  try {
    const bills = await billService.getCashBills();
    res.json({ bills });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cash bills', error: error.message });
  }
};

// Fetch all credit bills
const getCreditBills = async (req, res) => {
  try {
    const bills = await billService.getCreditBills();
    res.json({ data: bills });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching credit bills', error: error.message });
  }
};

// Fetch all credit notes
const getCreditNotes = async (req, res) => {
  try {
    const notes = await firebaseService.getAll('creditnotes');
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching credit notes', error: error.message });
  }
};

// Fetch all debit notes
const getDebitNotes = async (req, res) => {
  try {
    const notes = await firebaseService.getAll('debitnotes');
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching debit notes', error: error.message });
  }
};

// Fetch pending edit permission requests for specified resources
const getEditRequests = async (req, res) => {
  try {
    const resources = ['CashBill', 'CreditBill', 'CreditNote', 'DebitNote'];
    const requests = await firebaseService.getAll('requests');
    const filteredRequests = requests.filter(r => resources.includes(r.resourceType) && r.action === 'edit' && r.status === 'pending');
    // Populate user and handledBy data
    const populatedRequests = await Promise.all(
      filteredRequests.map(async (request) => {
        const user = request.userId ? await userService.getUserById(request.userId) : null;
        const handledBy = request.handledBy ? await userService.getUserById(request.handledBy) : null;
        return {
          ...request,
          user: user ? { name: user.name, email: user.email } : null,
          handledBy: handledBy ? { name: handledBy.name, email: handledBy.email } : null
        };
      })
    );
    res.json(populatedRequests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching edit requests', error: error.message });
  }
};

// Approve or reject edit permission request
const handleEditRequest = async (req, res) => {
  const { requestId, status } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  try {
    const request = await firebaseService.getById('requests', requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    await firebaseService.update('requests', requestId, {
      status,
      handledBy: req.user.id,
      reviewedAt: new Date(),
      updatedAt: new Date()
    });
    res.json({ message: `Request ${status} successfully`, request });
  } catch (error) {
    res.status(500).json({ message: 'Error handling edit request', error: error.message });
  }
};

export {
  verifySuperAdmin,
  getCashBills,
  getCreditBills,
  getCreditNotes,
  getDebitNotes,
  getEditRequests,
  handleEditRequest
};
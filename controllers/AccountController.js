import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { 
  userService, 
  billService, 
  orderService,
  paymentService,
  profitService,
  billDistributionService,
  permissionService,
  messageService
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied, no token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

const getBillingData = async (req, res) => {
  try {
    const bills = await billService.getAllBills();
    res.json({ bills });
  } catch (err) {
    console.error('getBillingData Error:', err);
    res.status(500).json({ message: 'Failed to fetch billing data' });
  }
};

const getOrderSummary = async (req, res) => {
  try {
    const orders = await orderService.getAllOrders();
    const order = orders[0] || {};
    res.json(order);
  } catch (err) {
    console.error('getOrderSummary Error:', err);
    res.status(500).json({ message: 'Failed to fetch order summary' });
  }
};

const getPaymentSummary = async (req, res) => {
  try {
    const payments = await paymentService.getAllPayments();
    const payment = payments[0] || {};
    res.json(payment);
  } catch (err) {
    console.error('getPaymentSummary Error:', err);
    res.status(500).json({ message: 'Failed to fetch payment summary' });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const payments = await paymentService.getAllPayments();
    res.json(payments);
  } catch (err) {
    console.error('getPaymentHistory Error:', err);
    res.status(500).json({ message: 'Failed to fetch payment history' });
  }
};

const getProfitData = async (req, res) => {
  try {
    const profits = await profitService.getAllProfits();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const profitData = {
      cashBills: [],
      creditBills: [],
      creditNotes: [],
      debitNotes: [],
      expenses: [],
    };
    months.forEach((month) => {
      const profit = profits.find((p) => p.month === month && p.year === 2024);
      profitData.cashBills.push(profit ? profit.cashBills : 0);
      profitData.creditBills.push(profit ? profit.creditBills : 0);
      profitData.creditNotes.push(profit ? profit.creditNotes : 0);
      profitData.debitNotes.push(profit ? profit.debitNotes : 0);
      profitData.expenses.push(profit ? profit.expenses : 0);
    });
    res.json(profitData);
  } catch (err) {
    console.error('getProfitData Error:', err);
    res.status(500).json({ message: 'Failed to fetch profit data' });
  }
};

const getBillDistribution = async (req, res) => {
  try {
    // For now, return mock data to test if the endpoint works
    const distribution = {
      cashBills: 15000,
      creditBills: 25000,
      creditNotes: 5000,
      debitNotes: 3000,
      date: new Date().toISOString()
    };
    res.json(distribution);
  } catch (err) {
    console.error('getBillDistribution Error:', err);
    // Return default data if service fails
    res.json({
      cashBills: 0,
      creditBills: 0,
      creditNotes: 0,
      debitNotes: 0,
      date: new Date().toISOString()
    });
  }
};

const getComparisonData = async (req, res) => {
  try {
    // For now, return mock data to test if the endpoint works
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const comparisonData = {
      currentYear: months.map(() => Math.floor(Math.random() * 50000) + 10000),
      previousYear: months.map(() => Math.floor(Math.random() * 40000) + 8000)
    };
    res.json(comparisonData);
  } catch (err) {
    console.error('getComparisonData Error:', err);
    // Return default data if service fails
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    res.json({
      currentYear: months.map(() => 0),
      previousYear: months.map(() => 0)
    });
  }
};

const getFilteredData = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const profits = await profitService.getAllProfits();
    const filteredProfits = profits.filter(profit => {
      const profitDate = new Date(profit.date);
      return profitDate >= start && profitDate <= end;
    });
    
    const distributions = await billDistributionService.getAllBillDistributions();
    const filteredDistribution = distributions.find(dist => {
      const distDate = new Date(dist.date);
      return distDate >= start && distDate <= end;
    });
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const profitData = {
      cashBills: [],
      creditBills: [],
      creditNotes: [],
      debitNotes: [],
      expenses: [],
    };
    months.forEach((month) => {
      const profit = filteredProfits.find((p) => p.month === month && p.year === 2024);
      profitData.cashBills.push(profit ? profit.cashBills : 0);
      profitData.creditBills.push(profit ? profit.creditBills : 0);
      profitData.creditNotes.push(profit ? profit.creditNotes : 0);
      profitData.debitNotes.push(profit ? profit.debitNotes : 0);
      profitData.expenses.push(profit ? profit.expenses : 0);
    });
    res.json({ profitData, distributionData: filteredDistribution || {} });
  } catch (err) {
    console.error('getFilteredData Error:', err);
    res.status(500).json({ message: 'Failed to apply date filter' });
  }
};

const getBillDetails = async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['cashBills', 'creditBills', 'creditNotes', 'debitNotes'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid bill type' });
    }
    const bills = await billService.getBillsByType(type);
    res.json(bills);
  } catch (err) {
    console.error('getBillDetails Error:', err);
    res.status(500).json({ message: `Failed to fetch ${type} details` });
  }
};

const getMonthDetails = async (req, res) => {
  try {
    const { month, type } = req.body;
    const validTypes = ['cashBills', 'creditBills', 'creditNotes', 'debitNotes'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid type' });
    }
    const bills = await billService.getAllBills();
    const filteredBills = bills.filter(bill => 
      bill.type === type && bill.date && bill.date.includes(month)
    );
    res.json(filteredBills.map((bill) => ({ ...bill, type })));
  } catch (err) {
    console.error('getMonthDetails Error:', err);
    res.status(500).json({ message: `Failed to fetch details for ${month} ${type}` });
  }
};

const getStaffList = async (req, res) => {
  try {
    // For now, return mock data to test if the endpoint works
    const staffList = [
      {
        _id: '1',
        name: 'John Doe',
        email: 'john.doe@example.com',
        role: 'staff',
        department: 'sales',
        profilePhoto: null
      },
      {
        _id: '2',
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        role: 'staff',
        department: 'marketing',
        profilePhoto: null
      },
      {
        _id: '3',
        name: 'Mike Johnson',
        email: 'mike.johnson@example.com',
        role: 'staff',
        department: 'operations',
        profilePhoto: null
      }
    ];
    res.json(staffList);
  } catch (err) {
    console.error('getStaffList Error:', err);
    res.status(500).json({ message: 'Failed to fetch staff list' });
  }
};

const getStaffBillDetails = async (req, res) => {
  try {
    const { staffId } = req.params;
    const staff = await userService.getUserById(staffId);
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    res.json({
      cashBill: staff.cashBill || 0,
      creditBill: staff.creditBill || 0,
      creditNote: staff.creditNote || 0,
      debitNote: staff.debitNote || 0,
    });
  } catch (err) {
    console.error('getStaffBillDetails Error:', err);
    res.status(500).json({ message: 'Failed to fetch bill details for staff' });
  }
};

const addStaff = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (role !== 'Staff') {
      return res.status(400).json({ message: 'Only staff role is allowed' });
    }
    
    // Check if user already exists
    const existingUsers = await userService.getAllUsers();
    const existingUser = existingUsers.find(user => user.email === email);
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const staffData = {
      name,
      email,
      password: hashedPassword,
      role,
      passwordEditCount: 0,
      createdAt: new Date()
    };
    
    const newStaff = await userService.createUser(staffData);
    res.status(201).json({ name, email, role });
  } catch (err) {
    console.error('addStaff Error:', err);
    res.status(500).json({ message: err.message || 'Failed to add staff' });
  }
};

const updateStaff = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { name, email, password, role } = req.body;
    
    const staff = await userService.getUserById(staffId);
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    
    if (password && staff.passwordEditCount >= 2) {
      return res.status(400).json({ message: 'Password edit limit reached (max 2 times)' });
    }
    
    const updateData = { name, email, role };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
      updateData.passwordEditCount = (staff.passwordEditCount || 0) + 1;
    }
    
    const updatedStaff = await userService.updateUser(staffId, updateData);
    res.json({ 
      name: updatedStaff.name, 
      email: updatedStaff.email, 
      role: updatedStaff.role 
    });
  } catch (err) {
    console.error('updateStaff Error:', err);
    res.status(500).json({ message: 'Failed to update staff' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { staffIds, message } = req.body;
    const messageData = {
      staffIds,
      message,
      sentAt: new Date()
    };
    
    await messageService.createMessage(messageData);
    res.status(201).json({ message: 'Message sent successfully' });
  } catch (err) {
    console.error('sendMessage Error:', err);
    res.status(500).json({ message: 'Failed to send message' });
  }
};

const getPermissionRequests = async (req, res) => {
  try {
    const { status } = req.query;
    let permissions;
    
    if (status) {
      permissions = await permissionService.getPermissionsByStatus(status);
    } else {
      permissions = await permissionService.getAllPermissions();
    }
    
    res.json({ data: permissions });
  } catch (err) {
    console.error('getPermissionRequests Error:', err);
    res.status(500).json({ message: 'Failed to fetch permission requests' });
  }
};

const updatePermissionRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;
    
    const permission = await permissionService.updatePermission(requestId, { status });
    if (!permission) {
      return res.status(404).json({ message: 'Permission request not found' });
    }
    res.json(permission);
  } catch (err) {
    console.error('updatePermissionRequest Error:', err);
    res.status(500).json({ message: `Failed to ${status} request` });
  }
};

export {
  authenticateToken,
  getBillingData,
  getOrderSummary,
  getPaymentSummary,
  getPaymentHistory,
  getProfitData,
  getBillDistribution,
  getComparisonData,
  getFilteredData,
  getBillDetails,
  getMonthDetails,
  getStaffList,
  getStaffBillDetails,
  addStaff,
  updateStaff,
  sendMessage,
  getPermissionRequests,
  updatePermissionRequest,
};
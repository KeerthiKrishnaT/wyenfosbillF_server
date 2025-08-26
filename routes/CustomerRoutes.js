import express from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  findCustomer,
  getCustomerBills,
  updateCustomerTransaction,
  getTodayCustomers,
  
} from '../controllers/CustomerController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();

// Customer management routes
router.post('/', verifyToken, createCustomer); 
router.get('/', verifyToken, getCustomers);
router.get('/today', verifyToken, getTodayCustomers);
router.get('/find', verifyToken, findCustomer);
router.get('/:id', verifyToken, getCustomerById);
router.put('/:id', verifyToken, updateCustomer);
router.delete('/:id', verifyToken, deleteCustomer);

// Customer related data
router.get('/:id/bills', verifyToken, getCustomerBills);
router.post('/update-transaction', verifyToken, updateCustomerTransaction);

export default router;
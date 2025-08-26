import express from 'express';
import { verifyToken } from '../middleware/AuthMiddleware.js';
import {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getTasksByUser
} from '../controllers/tasksController.js';

const router = express.Router();

// Simple auth middleware for tasks (temporary)
const simpleAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false,
      error: 'Authorization token required',
      code: 'MISSING_TOKEN'
    });
  }
  
  // For now, just check if token exists
  req.user = { uid: 'temp-user', role: 'customer' };
  next();
};

// Get all tasks
router.get('/', simpleAuth, getAllTasks);

// Get task by ID
router.get('/:id', simpleAuth, getTaskById);

// Create new task
router.post('/', simpleAuth, createTask);

// Update task
router.put('/:id', simpleAuth, updateTask);

// Delete task
router.delete('/:id', simpleAuth, deleteTask);

// Get tasks by user
router.get('/user/:userId', simpleAuth, getTasksByUser);

export default router;

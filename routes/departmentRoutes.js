import express from 'express';
import { verifyToken, verifySuperAdmin, verifyHrAdminOrSuperAdmin } from '../middleware/AuthMiddleware.js';
import { firebaseService } from '../services/firebaseService.js';
import { check, validationResult } from 'express-validator';
import { generateUniqueId } from '../services/firebaseService.js';

const router = express.Router();

// Get all department names (public)
router.get('/public', async (req, res) => {
  try {
    const departments = await firebaseService.getAll('departments');
    res.json(departments.map(dept => dept.name));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create department
router.post(
  '/',
  [
    verifyToken,
    verifySuperAdmin,
    [
      check('name', 'Department name is required').trim().not().isEmpty(),
      check('contents', 'Contents must be an array').optional().isArray()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      // Check if department already exists
      const departments = await firebaseService.getAll('departments');
      if (departments.some(dept => dept.name === req.body.name)) {
        return res.status(400).json({ error: 'Department already exists' });
      }
      // Create new department
      const departmentData = {
        name: req.body.name,
        contents: req.body.contents || [],
        createdBy: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const department = await firebaseService.create('departments', departmentData);
      res.status(201).json(department);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Get all departments
router.get('/', verifyToken, verifyHrAdminOrSuperAdmin, async (req, res) => {
  try {
    console.log('GET: Fetching all departments...');
    const departments = await firebaseService.getAll('departments', 'name', 'asc');
    console.log('GET: Found departments:', departments.map(d => ({ id: d.id, name: d.name })));
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.json(departments);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a department
router.put(
  '/:id',
  [
    verifyToken,
    verifySuperAdmin,
    [
      check('name', 'Department name is required').trim().not().isEmpty(),
      check('contents', 'Contents must be an array').optional().isArray()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      console.log('Looking for department with ID:', req.params.id);
      // Check if department exists - try both document ID and custom ID field
      let department = await firebaseService.getById('departments', req.params.id);
      console.log('Found by document ID:', department ? 'Yes' : 'No');
      
      // If not found by document ID, try to find by custom ID field
      if (!department) {
        const allDepartments = await firebaseService.getAll('departments');
        console.log('All departments:', allDepartments.map(d => ({ id: d.id, name: d.name })));
        department = allDepartments.find(dept => dept.id === req.params.id);
        console.log('Found by custom ID:', department ? 'Yes' : 'No');
      }
      
      if (!department) {
        console.log('Department not found');
        return res.status(404).json({ error: 'Department not found' });
      }
      
      console.log('Found department:', department);
      // Check if new name conflicts with other departments
      const departments = await firebaseService.getAll('departments');
      if (req.body.name !== department.name && departments.some(dept => dept.name === req.body.name)) {
        return res.status(400).json({ error: 'Department name already exists' });
      }
      // Update department - use the actual document ID from the found department
      const updateData = {
        name: req.body.name,
        contents: req.body.contents || [],
        updatedAt: new Date()
      };
      const updatedDepartment = await firebaseService.update('departments', department.id, updateData);
      res.json(updatedDepartment);
    } catch (err) {
      console.error('PUT route error:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  }
);

// Delete a department
router.delete(
  '/:id',
  [verifyToken, verifySuperAdmin],
  async (req, res) => {
    try {
      console.log('DELETE: Looking for department with ID:', req.params.id);
      // Check if department exists - try both document ID and custom ID field
      let department = await firebaseService.getById('departments', req.params.id);
      console.log('DELETE: Found by document ID:', department ? 'Yes' : 'No');
      
      // If not found by document ID, try to find by custom ID field
      if (!department) {
        const allDepartments = await firebaseService.getAll('departments');
        console.log('DELETE: All departments:', allDepartments.map(d => ({ id: d.id, name: d.name })));
        department = allDepartments.find(dept => dept.id === req.params.id);
        console.log('DELETE: Found by custom ID:', department ? 'Yes' : 'No');
      }
      
      if (!department) {
        console.log('DELETE: Department not found - it may have been already deleted');
        // Return success even if department doesn't exist (idempotent delete)
        res.set({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        return res.json({ message: 'Department deleted or not found' });
      }
      
      console.log('DELETE: Found department:', department);
      console.log('DELETE: Deleting department with ID:', department.id);
      await firebaseService.delete('departments', department.id);
      console.log('DELETE: Department deleted successfully');
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.json({ message: 'Department deleted' });
    } catch (err) {
      console.error('DELETE route error:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  }
);

export default router;
import { firebaseService } from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';
import { adminAuth } from '../config/firebase-admin.js';

export const createTerminatedStaff = async (req, res) => {
  try {
    const { name, role, department, reason, terminationDate, details, lastWorkingDay, noticePeriodServed, exitInterview, company } = req.body;
    if (!reason || !terminationDate || !company) {
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields: {
          company: !company,
          reason: !reason,
          terminationDate: !terminationDate
        }
      });
    }
    const terminatedStaffData = {
      id: generateUniqueId(),
      company,
      name,
      role,
      department,
      reason,
      terminationDate: new Date(terminationDate),
      details,
      lastWorkingDay: lastWorkingDay ? new Date(lastWorkingDay) : undefined,
      noticePeriodServed,
      exitInterview,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const terminatedStaff = await firebaseService.create('terminatedStaff', terminatedStaffData);
    res.status(201).json(terminatedStaff);
  } catch (err) {
    console.error('Error creating terminated staff:', err);
    res.status(500).json({
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const getTerminatedStaff = async (req, res) => {
  try {
    const terminatedStaff = await firebaseService.getAll('terminatedStaff', 'createdAt', 'desc');
    res.status(200).json(terminatedStaff || []);
  } catch (err) {
    console.error('getTerminatedStaff error:', err);
    res.json([]);
  }
};

export const getTerminatedStaffById = async (req, res) => {
  try {
    const terminatedStaff = await firebaseService.getById('terminatedStaff', req.params.id);
    if (!terminatedStaff) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(terminatedStaff);
  } catch (err) {
    console.error('Error fetching terminated staff record:', err);
    res.status(500).json({
      error: 'Failed to fetch record',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const updateTerminatedStaff = async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    const terminatedStaff = await firebaseService.update('terminatedStaff', req.params.id, updateData);
    if (!terminatedStaff) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(terminatedStaff);
  } catch (err) {
    console.error('Error updating terminated staff:', err);
    res.status(400).json({
      error: 'Failed to update record',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const deleteTerminatedStaff = async (req, res) => {
  try {
    const terminatedStaff = await firebaseService.getById('terminatedStaff', req.params.id);
    if (!terminatedStaff) {
      return res.status(404).json({ error: 'Record not found' });
    }
    await firebaseService.delete('terminatedStaff', req.params.id);
    res.json({
      message: 'Terminated staff record deleted',
      deletedRecord: terminatedStaff
    });
  } catch (err) {
    console.error('Error deleting terminated staff:', err);
    res.status(500).json({
      error: 'Failed to delete record',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
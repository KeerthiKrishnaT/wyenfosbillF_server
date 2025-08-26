import { 
  firebaseService, 
  staffService 
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

// Helper function to get user by ID from the users collection
const getUserById = async (userId) => {
  try {
    return await firebaseService.getById('users', userId);
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
};

// Helper function to find leave request by ID (handles both id and _id fields)
const findLeaveRequestById = async (requestId) => {
  try {
    
    // First try to get by the ID directly (Firestore document ID)
    let leaveRequest = await firebaseService.getById('leaveRequests', requestId);
    if (leaveRequest) {
      return leaveRequest;
    }
    
    // If not found, try to find by the 'id' field
    const allRequests = await firebaseService.getAll('leaveRequests');
    
    // Search for the document by custom ID field
    // The custom ID is stored as 'customId' field
    leaveRequest = allRequests.find(req => {
      // req.id is the Firestore document ID
      // req.customId is the custom ID we generated
      const matches = req.customId === requestId;
      return matches;
    });
    
    if (leaveRequest) {
      return leaveRequest;
    }
    
    return null;
  } catch (error) {
    console.error('Error finding leave request by ID:', error);
    return null;
  }
};

export const createLeaveRequest = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason, attachment, staffId } = req.body;
    
    // Determine the requesting staff ID based on user role
    const requestingStaffId = (req.user.role === 'admin' || req.user.role === 'super_admin') ? staffId : req.user.uid;
    
    // Validate required fields
    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'Missing required fields: leaveType, startDate, endDate, reason' });
    }
    
    // If admin is creating for someone else, validate staffId
    if ((req.user.role === 'admin' || req.user.role === 'super_admin') && !staffId) {
      return res.status(400).json({ error: 'Staff ID is required when creating leave request for another user' });
    }
    
    // Validate date range
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const leaveRequestData = {
      customId: generateUniqueId(), // Changed from 'id' to 'customId' to avoid conflict
      staffId: requestingStaffId,
      leaveType,
      startDate,
      endDate,
      reason,
      attachment: attachment || null,
      company: req.user?.company || 'WYENFOS BILLS',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const leaveRequest = await firebaseService.create('leaveRequests', leaveRequestData);
    
    // Populate staff data
    const staff = await getUserById(requestingStaffId);
    const populatedRequest = {
      ...leaveRequest,
      _id: leaveRequest.customId || leaveRequest.id, // Use customId for client compatibility
      staffId: {
        _id: requestingStaffId,
        name: staff?.name || 'Unknown',
        role: staff?.role || 'Unknown'
      }
    };
    
    res.status(201).json(populatedRequest);
  } catch (err) {
    console.error('Error creating leave request:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getLeaveRequests = async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ data: [] });
    }

    let leaveRequests;
    
    // Get all leave requests and filter based on user role
    let allRequests = await firebaseService.getAll('leaveRequests', 'createdAt', 'desc');
    
    // DEBUG: Try alternative collection names if no data found
    if (!allRequests || allRequests.length === 0) {
      try {
        const altRequests = await firebaseService.getAll('leave-requests', 'createdAt', 'desc');
        if (altRequests && altRequests.length > 0) {
          allRequests = altRequests;
        }
      } catch (err) {
        // No data in leave-requests collection either
      }
    }
    
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      // Admins and super admins can see all requests
      leaveRequests = allRequests || [];
    } else {
      // Staff can only see their own requests - try multiple ID formats
      leaveRequests = (allRequests || []).filter(request => {
        const matches = request.staffId === req.user.uid || 
                       request.staffId === req.user._id ||
                       request.staffId === req.user.id;
        return matches;
      });
      
      // DEBUG: If no requests found, show all requests for debugging
      if (leaveRequests.length === 0 && allRequests.length > 0) {
        // No matching requests found, showing all requests for debugging
      }
    }
    
    // Populate staff and approver data
    const populatedRequests = await Promise.all(
      leaveRequests.map(async (request) => {
        const staff = await getUserById(request.staffId);
        const approver = request.approvedBy ? await getUserById(request.approvedBy) : null;
        
                 const populatedRequest = {
           ...request,
           _id: request.customId || request.id, // Use customId for client compatibility
           staffId: {
             _id: request.staffId,
             name: staff?.name || 'Unknown',
             role: staff?.role || 'Unknown'
           },
           approver: approver ? { name: approver.name } : null
         };
        
        return populatedRequest;
      })
    );
    
    res.json({ data: populatedRequests });
  } catch (err) {
    console.error('getLeaveRequests error:', err);
    res.json({ data: [] });
  }
};

export const updateLeaveStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    
    // Check if user has permission to update status (admin or super admin)
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only admins can update leave request status' });
    }
    
    const updateData = { 
      status,
      updatedAt: new Date()
    };
    
    if (status === 'approved') {
      updateData.approvedBy = req.user.uid;
      updateData.approvalDate = new Date();
    }
    if (status === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    // Use the helper function to find the leave request
    const existingRequest = await findLeaveRequestById(req.params.id);
    
    if (!existingRequest) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    // Use the actual Firestore document ID for the update
    const documentId = existingRequest.id;
    
    const leaveRequest = await firebaseService.update('leaveRequests', documentId, updateData);
    
    // Populate staff data
    const staff = await getUserById(leaveRequest.staffId);
    const populatedRequest = {
      ...leaveRequest,
      _id: leaveRequest.customId || leaveRequest.id, // Use customId for client compatibility
      staffId: {
        _id: leaveRequest.staffId,
        name: staff?.name || 'Unknown',
        role: staff?.role || 'Unknown'
      }
    };
    
    res.json(populatedRequest);
  } catch (err) {
    console.error('Error updating leave status:', err);
    res.status(400).json({ error: err.message });
  }
};

export const getLeaveRequestById = async (req, res) => {
  try {
    
    const leaveRequest = await findLeaveRequestById(req.params.id);
    if (!leaveRequest) return res.status(404).json({ error: 'Leave request not found' });
    
    // Verify access
    if (req.user.role === 'staff' && leaveRequest.staffId !== req.user.uid) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Populate staff and approver data
    const staff = await getUserById(leaveRequest.staffId);
    const approver = leaveRequest.approvedBy ? await getUserById(leaveRequest.approvedBy) : null;
    
    const populatedRequest = {
      ...leaveRequest,
      staff: staff ? { name: staff.name, role: staff.role, department: staff.department } : null,
      approver: approver ? { name: approver.name } : null
    };
    
    res.json(populatedRequest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteLeaveRequest = async (req, res) => {
  try {
    
    // Use the helper function to find the leave request
    const leaveRequest = await findLeaveRequestById(req.params.id);
    
    if (!leaveRequest) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    
    // Check permissions: staff can only delete their own pending requests, admins can delete any
    if (req.user.role === 'staff') {
      if (leaveRequest.staffId !== req.user.uid) {
        return res.status(403).json({ error: 'You can only delete your own leave requests' });
      }
      if (leaveRequest.status !== 'pending') {
        return res.status(403).json({ error: 'Only pending leaves can be deleted' });
      }
    }
    
    // Use the actual Firestore document ID for deletion
    const documentId = leaveRequest.id;
    
    await firebaseService.delete('leaveRequests', documentId);
    res.json({ message: 'Leave request deleted' });
  } catch (err) {
    console.error('Error deleting leave request:', err);
    res.status(500).json({ error: err.message });
  }
};

// Test endpoint to check database collections
export const testDatabase = async (req, res) => {
  try {
    
    // Test getting all collections
    const collections = await firebaseService.db.listCollections();
    
    // Test getting leave requests
    const leaveRequests = await firebaseService.getAll('leaveRequests');
    
    // Check if there are any requests for the current user
    const userRequests = leaveRequests.filter(req => 
      req.staffId === req.user.uid || 
      req.staffId === req.user._id || 
      req.staffId === req.user.id
    );
    
    res.json({ 
      collections: collections.map(col => col.id),
      leaveRequestsCount: leaveRequests.length,
      leaveRequests: leaveRequests,
      userRequestsCount: userRequests.length,
      userRequests: userRequests,
      currentUser: {
        uid: req.user.uid,
        _id: req.user._id,
        id: req.user.id,
        role: req.user.role
      }
    });
  } catch (err) {
    console.error('Database test error:', err);
    res.status(500).json({ error: err.message });
  }
};
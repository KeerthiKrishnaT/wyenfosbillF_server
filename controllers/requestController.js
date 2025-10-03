import { firebaseService, userService } from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

export const createPermissionRequest = async (req, res) => {
  try {
    // Handle both old format (debit notes) and new format (vouchers)
    const { 
      resourceId, 
      resourceType, 
      action, 
      reason,
      // New format fields
      billType,
      billId,
      requestedBy,
      status,
      voucherData
    } = req.body;

    if (!reason || reason.length < 10) {
      return res.status(400).json({ success: false, message: 'Reason must be at least 10 characters' });
    }

    // Determine the actual resource ID and type
    const actualResourceId = resourceId || billId;
    const actualResourceType = resourceType || billType;
    const actualAction = action || 'edit'; // Default to edit if not specified

    if (!actualResourceId) {
      return res.status(400).json({ success: false, message: 'Resource ID is required' });
    }

    const resourceLink = actualResourceType === 'debitnote' 
      ? `/debitnotes/${actualResourceId}`
      : `/${actualResourceType}/${actualResourceId}`;
    
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const formattedDate = new Date().toISOString().split('T')[0];

    const requestData = {
      id: generateUniqueId(),
      resourceId: actualResourceId,
      resourceType: actualResourceType,
      resourceLink,
      userId: req.user.id,
      action: actualAction,
      reason,
      status: status || 'pending',
      formattedDate,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Additional fields for voucher requests
      ...(voucherData && { voucherData }),
      ...(requestedBy && { requestedBy })
    };

    await firebaseService.create('requests', requestData);
    res.status(201).json({ success: true, message: 'Permission request submitted' });
  } catch (error) {
    console.error('Error creating permission request:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const checkPermission = async (req, res) => {
  try {
    const { userId, resourceId, action } = req.body;
    if (!userId || !resourceId || !action) {
      return res.status(400).json({ success: false, message: 'Missing required fields: userId, resourceId, action' });
    }

    const user = await userService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'admin' || user.role === 'super_admin') {
      return res.status(200).json({ success: true, hasPermission: true });
    }

    const requests = await firebaseService.getWhere('requests', 'userId', '==', userId);
    const request = requests.find(r => r.resourceId === resourceId && r.action === action && r.status === 'approved' && new Date(r.expiresAt) > new Date());

    return res.status(200).json({ success: true, hasPermission: !!request });
  } catch (error) {
    console.error('Error checking permission:', error.message);
    return res.status(500).json({ success: false, message: 'Error checking permission', error: error.message });
  }
};

export const getAllPermissionRequests = async (req, res) => {
  try {
    const requests = await firebaseService.getAll('requests');
    // Populate user and handledBy data
    const populatedRequests = await Promise.all(
      requests.map(async (request) => {
        const user = request.userId ? await userService.getUserById(request.userId) : null;
        const handledBy = request.handledBy ? await userService.getUserById(request.handledBy) : null;
        return {
          ...request,
          user: user ? { name: user.name, email: user.email, role: user.role } : null,
          handledBy: handledBy ? { name: handledBy.name, email: handledBy.email, role: handledBy.role } : null
        };
      })
    );
    // Sort by creation date (newest first)
    populatedRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.status(200).json({ success: true, data: populatedRequests });
  } catch (error) {
    console.error('Error fetching permission requests:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch requests', error: error.message });
  }
};

export const handlePermissionRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectedReason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const updateData = {
      status,
      handledBy: req.user.id,
      reviewedAt: new Date(),
      updatedAt: new Date()
    };
    if (status === 'rejected' && rejectedReason) {
      updateData.rejectedReason = rejectedReason;
    }

    const updated = await firebaseService.update('requests', id, updateData);

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    res.status(200).json({ success: true, message: `Request ${status}`, data: updated });
  } catch (error) {
    console.error('Error handling permission request:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

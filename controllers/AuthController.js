import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import { adminAuth, adminFirestore as db } from '../config/firebase-admin.js';
import { userService, firebaseService } from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

const getRedirectPath = (role, department) => {
  const normalizedRole = (role || '').toLowerCase().replace(/[ _]/g, '');
  const normalizedDept = (department || '')
    .toLowerCase()
    .replace(/[ _]+/g, '-')
    .trim();

  if (normalizedRole === 'superadmin') return '/super-admin';
  if (normalizedRole === 'admin') {
    switch (normalizedDept) {
      case 'purchasing':
        return '/purchasing-admin';
      case 'accounts':
        return '/admin';
      case 'hr':
        return '/hr-admin';
      case 'marketing':
        return '/marketing-admin';
      case 'digital-marketing':
        return '/digital-marketing-admin';
      default:
        return '/dashboard';
    }
  }
  return '/dashboard';
};

export const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      role: user.role, 
      department: user.department 
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await userService.getUserById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, department: user.department || null },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    res.status(200).json({ success: true, token });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

export const login = asyncHandler(async (req, res) => {
  const { email, password, role, department } = req.body;

  try {
    // Get user from Firebase Auth
    const userRecord = await adminAuth.getUserByEmail(email);
    
    // Get user data from Firestore
    const user = await userService.getUserById(userRecord.uid);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    // Verify role (normalize underscores/spaces)
    const dbRole = (user.role || '').toLowerCase().replace(/[ _]/g, '');
    const reqRole = (role || '').toLowerCase().replace(/[ _]/g, '');
    if (dbRole !== reqRole) {
      return res.status(403).json({ 
        success: false, 
        message: `Account role (${user.role}) doesn't match selected role (${role})`
      });
    }

    // Verify department for admin users
    if (reqRole === 'admin') {
      const dbDept = (user.department || '')
        .toLowerCase()
        .replace(/[ _]+/g, '-')
        .trim();
      const reqDept = (department || '')
        .toLowerCase()
        .replace(/[ _]+/g, '-')
        .trim();
      if (!reqDept || dbDept !== reqDept) {
        return res.status(403).json({
          success: false,
          message: `Department mismatch. Your account is for ${user.department} department`
        });
      }
    }

    // Create custom token for client-side authentication
    const customToken = await adminAuth.createCustomToken(userRecord.uid);

    // Update last login time
    const currentTime = new Date();
    await userService.updateUser(userRecord.uid, {
      lastLogin: currentTime
    });

    // Record punch-in time automatically
    try {
      const punchInData = {
        id: generateUniqueId(),
        email: userRecord.email,
        role: user.role,
        name: user.name,
        punchIn: currentTime.toISOString(),
        date: currentTime.toISOString().split('T')[0],
        loginType: 'automatic', // Mark as automatic login
        createdAt: currentTime,
        updatedAt: currentTime
      };

      await firebaseService.create('punchingTimes', punchInData);
      console.log(`Auto-recorded punch-in for ${user.name} (${userRecord.email})`);
    } catch (punchError) {
      console.error('Failed to record automatic punch-in:', punchError);
      // Don't fail login if punch-in recording fails
    }

    res.status(200).json({
      success: true,
      token: customToken,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        name: user.name,
        role: user.role,
        department: user.department
      },
      redirectTo: getRedirectPath(user.role, user.department)
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid credentials or authentication failed' 
    });
  }
});

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, department } = req.body;

  try {
    // Check if user already exists
    const existingUser = await userService.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User with this email already exists' 
      });
    }

    // Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name
    });

    // Create user document in Firestore
    const userData = {
      name,
      email,
      role: role || 'staff',
      department: department || null,
      isActive: true,
      createdAt: new Date(),
      lastLogin: new Date()
    };

    await userService.createUser({
      id: userRecord.uid,
      ...userData
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        name: userData.name,
        role: userData.role,
        department: userData.department
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Registration failed' 
    });
  }
});

export const getCurrentUser = async (req, res) => {
  try {
    const user = await userService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      isActive: user.isActive
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getUserRole = async (req, res) => {
  try {
    // Get user from the token (set by verifyToken middleware)
    const userEmail = req.user?.email;
    
    if (!userEmail) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const user = await userService.getUserByEmail(userEmail);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return the format expected by CashBill component
    res.json({ 
      isAdmin: user.role === 'admin' || user.role === 'super_admin' || user.role === 'superadmin',
      EditPermission: user.editPermissions || {},
      canDelete: user.canDelete || false,
      role: user.role,
      department: user.department
    });
  } catch (error) {
    console.error('Get user role error:', error);
    res.status(500).json({ message: 'Error fetching user role' });
  }
};

export const addAdmin = async (req, res) => {
  const { name, email, password, role, department } = req.body;

  try {
    // Check if user already exists
    const existingUser = await userService.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User with this email already exists' 
      });
    }

    // Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name
    });

    // Create admin document in Firestore
    const adminData = {
      name,
      email,
      role: role || 'admin',
      department: department || null,
      isActive: true,
      createdAt: new Date(),
      lastLogin: new Date()
    };

    await userService.createUser({
      id: userRecord.uid,
      ...adminData
    });

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      admin: {
        uid: userRecord.uid,
        email: userRecord.email,
        name: adminData.name,
        role: adminData.role,
        department: adminData.department
      }
    });

  } catch (error) {
    console.error('Add admin error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create admin' 
    });
  }
};

export const listUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

export const getBillingData = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    // Implementation for billing data
    res.json({ message: 'Billing data endpoint' });
  } catch (error) {
    console.error('Get billing data error:', error);
    res.status(500).json({ message: 'Error fetching billing data' });
  }
};

export const getOrderSummary = async (req, res) => {
  try {
    // Implementation for order summary
    res.json({ message: 'Order summary endpoint' });
  } catch (error) {
    console.error('Get order summary error:', error);
    res.status(500).json({ message: 'Error fetching order summary' });
  }
};

export const getAdmins = async (req, res) => {
  try {
    console.log('getAdmins: Fetching admins from database...');
    console.log('getAdmins: User making request:', req.user);
    
    // Get both admin and super_admin users
    const [admins, superAdmins] = await Promise.all([
      userService.getUsersByRole('admin'),
      userService.getUsersByRole('super_admin')
    ]);
    
    console.log('getAdmins: Raw admin results:', admins);
    console.log('getAdmins: Raw superAdmin results:', superAdmins);
    
    // Combine and sort by name, filter out any null/undefined entries
    const allAdmins = [...(admins || []), ...(superAdmins || [])]
      .filter(admin => admin && admin.name) // Ensure admin exists and has a name
      .sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`getAdmins: Found ${allAdmins.length} admins (${admins?.length || 0} admin, ${superAdmins?.length || 0} super_admin)`);
    console.log('getAdmins: Final result:', allAdmins);
    
    // If no admins found, return empty array instead of error
    if (allAdmins.length === 0) {
      console.log('getAdmins: No admins found, returning empty array');
    }
    
    res.json(allAdmins);
  } catch (error) {
    console.error('Get admins error:', error);
    console.error('Get admins error stack:', error.stack);
    res.status(500).json({ message: 'Error fetching admins', error: error.message });
  }
};

export const getPaymentSummary = async (req, res) => {
  try {
    // Implementation for payment summary
    res.json({ message: 'Payment summary endpoint' });
  } catch (error) {
    console.error('Get payment summary error:', error);
    res.status(500).json({ message: 'Error fetching payment summary' });
  }
};

export const addPanelFeature = async (req, res) => {
  try {
    // Implementation for adding panel features
    res.json({ message: 'Panel feature added' });
  } catch (error) {
    console.error('Add panel feature error:', error);
    res.status(500).json({ message: 'Error adding panel feature' });
  }
};

export const getStaffAppointments = async (req, res) => {
  try {
    // Implementation for staff appointments
    res.json({ message: 'Staff appointments endpoint' });
  } catch (error) {
    console.error('Get staff appointments error:', error);
    res.status(500).json({ message: 'Error fetching staff appointments' });
  }
};

export const getStaffDetails = async (req, res) => {
  try {
    const { staffId } = req.params;
    const staff = await userService.getUserById(staffId);
    
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    res.json(staff);
  } catch (error) {
    console.error('Get staff details error:', error);
    res.status(500).json({ message: 'Error fetching staff details' });
  }
};

export const getStaffPunchingTime = async (req, res) => {
  try {
    // Implementation for staff punching time
    res.json({ message: 'Staff punching time endpoint' });
  } catch (error) {
    console.error('Get staff punching time error:', error);
    res.status(500).json({ message: 'Error fetching staff punching time' });
  }
};

export const getTerminatedStaff = async (req, res) => {
  try {
    // Implementation for terminated staff
    res.json({ message: 'Terminated staff endpoint' });
  } catch (error) {
    console.error('Get terminated staff error:', error);
    res.status(500).json({ message: 'Error fetching terminated staff' });
  }
};

export const getLeaveRequests = async (req, res) => {
  try {
    // Implementation for leave requests
    res.json({ message: 'Leave requests endpoint' });
  } catch (error) {
    console.error('Get leave requests error:', error);
    res.status(500).json({ message: 'Error fetching leave requests' });
  }
};

export const updateLeaveRequest = async (req, res) => {
  try {
    // Implementation for updating leave requests
    res.json({ message: 'Leave request updated' });
  } catch (error) {
    console.error('Update leave request error:', error);
    res.status(500).json({ message: 'Error updating leave request' });
  }
};

export const getClientDetails = async (req, res) => {
  try {
    // Implementation for client details
    res.json({ message: 'Client details endpoint' });
  } catch (error) {
    console.error('Get client details error:', error);
    res.status(500).json({ message: 'Error fetching client details' });
  }
};

export const getShopDetails = async (req, res) => {
  try {
    // Implementation for shop details
    res.json({ message: 'Shop details endpoint' });
  } catch (error) {
    console.error('Get shop details error:', error);
    res.status(500).json({ message: 'Error fetching shop details' });
  }
};

export const getPettyVouchers = async (req, res) => {
  try {
    // Implementation for petty vouchers
    res.json({ message: 'Petty vouchers endpoint' });
  } catch (error) {
    console.error('Get petty vouchers error:', error);
    res.status(500).json({ message: 'Error fetching petty vouchers' });
  }
};

export const getPettyCashVouchers = async (req, res) => {
  try {
    // Implementation for petty cash vouchers
    res.json({ message: 'Petty cash vouchers endpoint' });
  } catch (error) {
    console.error('Get petty cash vouchers error:', error);
    res.status(500).json({ message: 'Error fetching petty cash vouchers' });
  }
};

export const getAllDepartments = async (req, res) => {
  try {
    const departments = await firebaseService.getAll('departments', 'name', 'asc');
    res.json(departments || []);
  } catch (error) {
    console.error('Get all departments error:', error);
    res.status(500).json({ message: 'Error fetching departments' });
  }
};

export const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`deleteAdmin: Attempting to delete admin with ID: ${id}`);
    
    // Delete from Firebase Auth
    await adminAuth.deleteUser(id);
    
    // Delete from Firestore
    await userService.deleteUser(id);

    console.log(`deleteAdmin: Successfully deleted admin with ID: ${id}`);
    res.json({ success: true, message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ message: 'Error deleting admin', error: error.message });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    console.log(`updateAdmin: Attempting to update admin with ID: ${id}`, updateData);

    // Update in Firebase Auth if email is being changed
    if (updateData.email) {
      await adminAuth.updateUser(id, {
        email: updateData.email,
        displayName: updateData.name
      });
    }

    // Update in Firestore
    const updatedAdmin = await userService.updateUser(id, updateData);

    console.log(`updateAdmin: Successfully updated admin with ID: ${id}`);
    res.json({ success: true, message: 'Admin updated successfully', admin: updatedAdmin });
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ message: 'Error updating admin', error: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

export const resetStaffPasswords = async (req, res) => {
  try {
    // Implementation for resetting staff passwords
    res.json({ message: 'Staff passwords reset' });
  } catch (error) {
    console.error('Reset staff passwords error:', error);
    res.status(500).json({ message: 'Error resetting staff passwords' });
  }
};

export const getUserSessions = async (req, res) => {
  try {
    const { userId } = req.params;
    // Adjust collection name if needed
    const snapshot = await db.collection('punchingTimes')
      .where('userId', '==', userId)
      .orderBy('loginTime', 'desc')
      .get();

    const sessions = [];
    snapshot.forEach(doc => {
      sessions.push({ id: doc.id, ...doc.data() });
    });

    res.json({ sessions });
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({ error: 'Error fetching user sessions' });
  }
};

export const recordStaffLogin = async (req, res) => {
  try {
    const userId = req.user.id;
    const loginTime = new Date();
    // Create a new punchingTimes document for this login
    const docRef = await db.collection('punchingTimes').add({
      userId,
      loginTime,
      logoutTime: null,
      createdAt: loginTime
    });
    res.status(201).json({ success: true, message: 'Login time recorded', id: docRef.id });
  } catch (error) {
    console.error('Error recording staff login:', error);
    res.status(500).json({ success: false, message: 'Error recording login time' });
  }
};

export const recordStaffLogout = async (req, res) => {
  try {
    const userId = req.user.id;
    const logoutTime = new Date();
    // Find the latest punchingTimes document for this user with null logoutTime
    const snapshot = await db.collection('punchingTimes')
      .where('userId', '==', userId)
      .where('logoutTime', '==', null)
      .orderBy('loginTime', 'desc')
      .limit(1)
      .get();
    if (snapshot.empty) {
      return res.status(404).json({ success: false, message: 'No active login session found for logout' });
    }
    const doc = snapshot.docs[0];
    await doc.ref.update({ logoutTime });
    res.json({ success: true, message: 'Logout time recorded', id: doc.id });
  } catch (error) {
    console.error('Error recording staff logout:', error);
    res.status(500).json({ success: false, message: 'Error recording logout time' });
  }
};

export const submitChangeRequest = asyncHandler(async (req, res) => {
  const { type, oldPassword, newPassword, confirmPassword, oldEmail, newEmail, confirmEmail, reason } = req.body;

  try {
    // Validate request type
    if (!type || !['password', 'email'].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request type' 
      });
    }

    // Create change request document
    const requestData = {
      type,
      oldPassword: type === 'password' ? oldPassword : null,
      newPassword: type === 'password' ? newPassword : null,
      oldEmail: type === 'email' ? oldEmail : null,
      newEmail: type === 'email' ? newEmail : null,
      reason,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to Firestore
    const requestRef = await db.collection('changeRequests').add(requestData);
    
    // Send email to super admin
    const emailContent = `
      <h2>New Change Request</h2>
      <p><strong>Type:</strong> ${type === 'password' ? 'Password Reset' : 'Email Reset'}</p>
      <p><strong>Old ${type === 'password' ? 'Password' : 'Email'}:</strong> ${type === 'password' ? '***' : oldEmail}</p>
      <p><strong>New ${type === 'password' ? 'Password' : 'Email'}:</strong> ${type === 'password' ? '***' : newEmail}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p><strong>Request ID:</strong> ${requestRef.id}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
    `;

    // You'll need to implement email sending here
    // For now, just log it
    console.log('Change request email to wyenfos014@gmail.com:', emailContent);

    res.status(201).json({
      success: true,
      message: 'Request submitted successfully. Super admin will review and notify you.',
      requestId: requestRef.id
    });

  } catch (error) {
    console.error('Submit change request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit request' 
    });
  }
});

// Add function to approve/reject requests (for super admin)
export const handleChangeRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { action, adminNotes } = req.body; // action: 'approve' or 'reject'

  try {
    const requestRef = db.collection('changeRequests').doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Request not found' 
      });
    }

    const requestData = requestDoc.data();

    if (action === 'approve') {
      // Update user's password or email
      if (requestData.type === 'password') {
        // Find user by email and update password
        const userQuery = await db.collection('users').where('email', '==', requestData.oldEmail).limit(1).get();
        if (!userQuery.empty) {
          const userDoc = userQuery.docs[0];
          await adminAuth.updateUser(userDoc.id, { password: requestData.newPassword });
          await userDoc.ref.update({ 
            password: requestData.newPassword,
            updatedAt: new Date()
          });
        }
      } else if (requestData.type === 'email') {
        // Find user by old email and update to new email
        const userQuery = await db.collection('users').where('email', '==', requestData.oldEmail).limit(1).get();
        if (!userQuery.empty) {
          const userDoc = userQuery.docs[0];
          await adminAuth.updateUser(userDoc.id, { email: requestData.newEmail });
          await userDoc.ref.update({ 
            email: requestData.newEmail,
            updatedAt: new Date()
          });
        }
      }

      // Update request status
      await requestRef.update({
        status: 'approved',
        adminNotes,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Request approved successfully'
      });

    } else if (action === 'reject') {
      // Update request status
      await requestRef.update({
        status: 'rejected',
        adminNotes,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Request rejected'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid action'
      });
    }

  } catch (error) {
    console.error('Handle change request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process request' 
    });
  }
});

// Get all change requests (for super admin)
export const getChangeRequests = asyncHandler(async (req, res) => {
  try {
    const requestsSnapshot = await db.collection('changeRequests')
      .orderBy('createdAt', 'desc')
      .get();

    const requests = requestsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      requests
    });

  } catch (error) {
    console.error('Get change requests error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch requests' 
    });
  }
});

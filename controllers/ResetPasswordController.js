import admin from 'firebase-admin';
import { adminFirestore as db } from '../config/firebase-admin.js';

// Verify Firebase ID token and get user profile
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Get user profile from Firestore
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return res.status(401).json({ message: 'User profile not found' });
    }
    
    req.user = {
      uid: decodedToken.uid,
      ...userDoc.data()
    };
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Get all users from Firestore
export const getAllUsers = async (req, res) => {
  try {
    // Verify user is super admin
    if (req.user.role !== 'super_admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Super admin privileges required.' });
    }

    const usersRef = db.collection('users');
    const snapshot = await usersRef.orderBy('name', 'asc').get();
    
    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// Create new user
export const createUser = async (req, res) => {
  try {
    // Verify user is super admin
    if (req.user.role !== 'super_admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Super admin privileges required.' });
    }

    const { name, email, password, role, department, isActive } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Create user in Firebase Auth
    const authUser = await admin.auth().createUser({
      email,
      password,
      displayName: name
    });

    // Create user document in Firestore
    const userDoc = {
      name,
      email,
      role,
      department: department || null,
      isActive: isActive !== false,
      accessibleSections: getAccessibleSections(role, department),
      hasEditPermission: role === 'admin' || role === 'super_admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: null,
      createdBy: req.user.uid
    };

    await db.collection('users').doc(authUser.uid).set(userDoc);

    res.status(201).json({ 
      message: 'User created successfully',
      user: { id: authUser.uid, ...userDoc }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: error.message || 'Failed to create user' });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    // Verify user is super admin
    if (req.user.role !== 'super_admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Super admin privileges required.' });
    }

    const { userId } = req.params;
    const { name, email, role, department, isActive, password } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Update user in Firebase Auth
    const updateData = {
      displayName: name,
      email
    };

    await admin.auth().updateUser(userId, updateData);

    // Update password if provided
    if (password && password.length >= 6) {
      await admin.auth().updateUser(userId, { password });
    }

    // Update user document in Firestore
    const userRef = db.collection('users').doc(userId);
    const updateDoc = {
      name,
      email,
      role,
      department: department || null,
      isActive: isActive !== false,
      accessibleSections: getAccessibleSections(role, department),
      hasEditPermission: role === 'admin' || role === 'super_admin',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user.uid
    };

    await userRef.update(updateDoc);

    res.json({ 
      message: 'User updated successfully',
      user: { id: userId, ...updateDoc }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: error.message || 'Failed to update user' });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    // Verify user is super admin
    if (req.user.role !== 'super_admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Super admin privileges required.' });
    }

    const { userId } = req.params;

    // Check if user exists and get their role
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = userDoc.data();
    if (userData.role === 'super_admin' || userData.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot delete Super Admin' });
    }

    // Delete user from Firebase Auth
    await admin.auth().deleteUser(userId);

    // Delete user document from Firestore
    await db.collection('users').doc(userId).delete();

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: error.message || 'Failed to delete user' });
  }
};

// Reset user password
export const resetUserPassword = async (req, res) => {
  try {
    // Verify user is super admin
    if (req.user.role !== 'super_admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Super admin privileges required.' });
    }

    const { userId } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Update password in Firebase Auth
    await admin.auth().updateUser(userId, { password });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: error.message || 'Failed to reset password' });
  }
};

// Helper function to get accessible sections based on role and department
const getAccessibleSections = (role, department) => {
  const baseSections = ['dashboard'];
  
  if (role === 'super_admin' || role === 'superadmin') {
    return [
      'dashboard', 'inventory', 'orders', 'purchase', 'reporting',
      'support', 'settings', 'billing', 'customers', 'staff_management', 'vouchers'
    ];
  }
  
  if (role === 'admin') {
    switch (department) {
      case 'hr':
        return [...baseSections, 'hr'];
      case 'marketing':
        return [...baseSections, 'marketing'];
      case 'digital-marketing':
        return [...baseSections, 'digital-marketing'];
      case 'accounts':
        return [...baseSections, 'accounts'];
      case 'purchase':
        return [...baseSections, 'purchase'];
      default:
        return baseSections;
    }
  }
  
  return baseSections;
};

export { verifyToken };

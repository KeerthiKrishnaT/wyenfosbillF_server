import { userService } from '../services/firebaseService.js';
import { adminAuth } from '../config/firebase-admin.js';

export const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    // Return all necessary fields for the UI
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      isActive: user.isActive !== false,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }));
    res.json(formattedUsers);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: `Failed to fetch users: ${err.message}` });
  }
};

export const resetUserPassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
  }

  try {
    const user = await userService.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    await adminAuth.updateUser(id, { password });
    await userService.updateUser(id, { password, updatedAt: new Date() });
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ message: `Failed to reset password: ${err.message}` });
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await userService.getUserById(id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.role === 'super_admin') {
      return res.status(403).json({ message: 'Cannot delete Super Admin.' });
    }
    await adminAuth.deleteUser(id);
    await userService.deleteUser(id);
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: `Failed to delete user: ${err.message}` });
  }
};

export const createUser = async (req, res) => {
  const { name, email, password, role, department } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, email, password, and role are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  try {
    // Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name
    });

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

    // Save user data to Firestore
    await userService.createUser({
      id: userRecord.uid,
      name,
      email,
      role,
      department: department || null,
      isActive: true,
      accessibleSections: getAccessibleSections(role, department),
      hasEditPermission: role === 'admin' || role === 'super_admin',
      createdAt: new Date(),
      createdBy: req.user.uid
    });

    res.status(201).json({ 
      message: 'User created successfully.',
      user: {
        id: userRecord.uid,
        name,
        email,
        role,
        department
      }
    });
  } catch (err) {
    console.error('Error creating user:', err);
    if (err.code === 'auth/email-already-exists') {
      return res.status(400).json({ message: 'Email already exists.' });
    }
    res.status(500).json({ message: `Failed to create user: ${err.message}` });
  }
};

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, department, isActive, password } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({ message: 'Name, email, and role are required.' });
  }

  try {
    const user = await userService.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Update user in Firebase Auth
    const updateData = {
      email,
      displayName: name
    };

    // Update password if provided
    if (password && password.length >= 6) {
      updateData.password = password;
    }

    await adminAuth.updateUser(id, updateData);

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

    // Update user data in Firestore
    const firestoreUpdate = {
      name,
      email,
      role,
      department: department || null,
      isActive: isActive !== false,
      accessibleSections: getAccessibleSections(role, department),
      hasEditPermission: role === 'admin' || role === 'super_admin',
      updatedAt: new Date(),
      updatedBy: req.user.uid
    };

    await userService.updateUser(id, firestoreUpdate);

    res.json({ 
      message: 'User updated successfully.',
      user: {
        id,
        name,
        email,
        role,
        department
      }
    });
  } catch (err) {
    console.error('Error updating user:', err);
    if (err.code === 'auth/email-already-exists') {
      return res.status(400).json({ message: 'Email already exists.' });
    }
    res.status(500).json({ message: `Failed to update user: ${err.message}` });
  }
};
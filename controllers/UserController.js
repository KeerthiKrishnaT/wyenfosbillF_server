import { userService } from '../services/firebaseService.js';
import { adminAuth } from '../config/firebase-admin.js';

// Fetch all staff users
export const getAllStaff = async (req, res) => {
  try {
    const staffUsers = await userService.getAllUsers();
    const staff = staffUsers.filter(user => user.role === 'staff');
    res.status(200).json(staff);
  } catch (error) {
    console.error('Error fetching staff users:', error);
    res.status(500).json({ message: 'Failed to fetch staff users' });
  }
};

// Reset passwords for all staff users
export const resetAllStaffPasswords = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }
    // Get all staff users
    const staffUsers = await userService.getAllUsers();
    const staff = staffUsers.filter(user => user.role === 'staff');
    let resetCount = 0;
    for (const user of staff) {
      await adminAuth.updateUser(user.id, { password: newPassword });
      await userService.updateUser(user.id, { password: newPassword, updatedAt: new Date() });
      resetCount++;
    }
    res.status(200).json({
      message: `${resetCount} staff passwords reset successfully`,
    });
  } catch (error) {
    console.error('Error resetting staff passwords:', error);
    res.status(500).json({ message: 'Failed to reset staff passwords' });
  }
};
import { userService } from '../services/firebaseService.js';
import { adminAuth } from '../config/firebase-admin.js';

export const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user already exists
    const existingUsers = await userService.getAllUsers();
    if (existingUsers.some(user => user.email === email)) {
      return res.status(400).json({ success: false, errors: [{ msg: 'Email already registered' }] });
    }

    // Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name
    });

    // Create user in Firestore
    const userData = {
      id: userRecord.uid,
      name,
      email,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await userService.createUser(userData);

    // Generate custom token for client login
    const token = await adminAuth.createCustomToken(userRecord.uid);

    res.json({
      success: true,
      token,
      user: { id: userRecord.uid, name, email }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, errors: [{ msg: error.message || 'Server error' }] });
  }
};
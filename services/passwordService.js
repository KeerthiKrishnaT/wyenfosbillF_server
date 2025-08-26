import { adminAuth } from '../config/firebase-admin.js';
import { sendPasswordResetEmail } from '../utils/emailService.js';

const COMMON_PASSWORDS = ['password', '12345678', 'qwerty'];
const resetAttempts = new Map();
const RESET_LIMIT = 3;

export const PasswordService = {
  async sendResetLink(email) {
    try {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Invalid email format');
      }

      const attempts = resetAttempts.get(email) || 0;
      if (attempts >= RESET_LIMIT) {
        throw new Error('Too many reset attempts. Please try again later.');
      }

      console.log(`Password reset initiated for: ${email}`);
      const resetLink = await adminAuth.generatePasswordResetLink(email, {
        url: `${process.env.FRONTEND_URL}/reset-password`,
        handleCodeInApp: true
      });
      
      await sendPasswordResetEmail(email, resetLink);
      resetAttempts.set(email, attempts + 1);
      return { success: true };
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  },

  async confirmReset(oobCode, newPassword) {
    try {
      if (newPassword.length < 8) throw new Error('Password too short (min 8 chars)');
      if (newPassword.length > 64) throw new Error('Password too long (max 64 chars)');
      if (!/[A-Z]/.test(newPassword)) throw new Error('Missing uppercase letter');
      if (!/[0-9]/.test(newPassword)) throw new Error('Missing number');
      if (COMMON_PASSWORDS.includes(newPassword.toLowerCase())) {
        throw new Error('Password is too common');
      }

      const email = await adminAuth.verifyPasswordResetCode(oobCode);
      await adminAuth.confirmPasswordReset(oobCode, newPassword);
      return { success: true, email };
    } catch (error) {
      console.error('Reset confirmation error:', error);
      throw error;
    }
  },

  async updatePassword(email, newPassword, currentUserToken) {
    try {
      const decodedToken = await adminAuth.verifyIdToken(currentUserToken);
      
      if (decodedToken.exp * 1000 < Date.now()) {
        throw new Error('Token expired');
      }
      if (decodedToken.email !== email) {
        throw new Error('Unauthorized password change');
      }
      
      const user = await adminAuth.getUserByEmail(email);
      await adminAuth.updateUser(user.uid, { password: newPassword });
      
      return { 
        success: true,
        uid: user.uid,
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Password update error:', error);
      throw error;
    }
  }
};
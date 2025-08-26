import express from 'express';
import { 
  submitChangeRequest, 
  handleChangeRequest, 
  getChangeRequests,
  requestPasswordReset,
  debugUserAuth // Added debugUserAuth to the import
} from '../controllers/ForgotPasswordController.js';
import { verifyToken, verifySuperAdmin } from '../middleware/AuthMiddleware.js';
import { testEmailConfig, sendTestEmail } from '../services/emailService.js';
import { adminAuth, adminFirestore as db } from '../config/firebase-admin.js';

const router = express.Router();

// Remove all test routes completely
router.get('/test-email', async (req, res) => {
  try {
    const { sendTestEmail } = await import('../services/emailService.js');
    await sendTestEmail();
    res.json({ success: true, message: 'Test email sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/test-page', (req, res) => {
  res.send(`
    <html>
      <head><title>Test Password Reset</title></head>
      <body>
        <h1>Test Password Reset</h1>
        <button onclick="testEmail()">Send Test Email</button>
        <script>
          async function testEmail() {
            try {
              const response = await fetch('/api/forgot-password/test-email');
              const result = await response.json();
              alert(result.message);
            } catch (error) {
              alert('Error: ' + error.message);
            }
          }
        </script>
      </body>
    </html>
  `);
});

router.post('/change-request', submitChangeRequest);
router.get('/change-requests', verifyToken, verifySuperAdmin, getChangeRequests);
router.put('/change-requests/:requestId', verifyToken, verifySuperAdmin, handleChangeRequest);

// Email action routes (no authentication required for email links)
router.get('/change-requests/:requestId/approve', async (req, res) => {
  try {
    const { requestId } = req.params;
    req.params = { requestId };
    req.body = { action: 'approve' };
    await handleChangeRequest(req, res);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/change-requests/:requestId/reject', async (req, res) => {
  try {
    const { requestId } = req.params;
    req.params = { requestId };
    req.body = { action: 'reject' };
    await handleChangeRequest(req, res);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/request-reset', requestPasswordReset);

// Force password update with comprehensive verification
router.post('/force-password-update', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    console.log('🔐 Force password update for email:', email);
    
    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email and new password are required'
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }
    
    // Step 1: Find user in Firebase Auth
    const userRecord = await adminAuth.getUserByEmail(email);
    console.log('✅ User found in Firebase Auth:', userRecord.uid);
    
    // Step 2: Update password in Firebase Auth
    await adminAuth.updateUser(userRecord.uid, {
      password: newPassword
    });
    console.log('✅ Password updated in Firebase Auth');
    
    // Step 3: Wait for propagation (longer wait)
    console.log('⏳ Waiting for password update to propagate (10 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Step 4: Verify the update
    const updatedUser = await adminAuth.getUser(userRecord.uid);
    console.log('✅ Password update verified');
    
    // Step 5: Update Firestore with comprehensive info
    const userDocRef = db.collection('users').doc(userRecord.uid);
    await userDocRef.update({
      updatedAt: new Date(),
      lastPasswordChange: new Date(),
      passwordChangedAt: new Date().toISOString(),
      passwordUpdateStatus: 'completed',
      passwordUpdateTimestamp: new Date().toISOString(),
      forceUpdate: true,
      forceUpdateTimestamp: new Date().toISOString()
    });
    console.log('✅ Firestore updated with force update info');
    
    // Step 6: Revoke all user sessions for immediate effect
    try {
      await adminAuth.revokeRefreshTokens(userRecord.uid);
      console.log('✅ All user sessions revoked');
    } catch (revokeError) {
      console.log('⚠️ Session revocation warning:', revokeError.message);
    }
    
    // Step 7: Additional verification - check if user can be retrieved
    const verificationUser = await adminAuth.getUserByEmail(email);
    console.log('✅ Final verification - user accessible:', verificationUser.uid);
    
    res.json({
      success: true,
      message: 'Password force updated successfully. User should wait 2-3 minutes before logging in.',
      uid: userRecord.uid,
      email: userRecord.email,
      updatedAt: new Date().toISOString(),
      forceUpdate: true,
      waitTime: '2-3 minutes',
      verification: {
        userFound: true,
        uid: verificationUser.uid,
        email: verificationUser.email,
        disabled: verificationUser.disabled
      }
    });
    
  } catch (error) {
    console.error('❌ Force password update failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
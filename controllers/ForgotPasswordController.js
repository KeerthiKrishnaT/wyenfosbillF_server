import { userService } from '../services/firebaseService.js';
import { adminAuth, adminFirestore as db } from '../config/firebase-admin.js';
import asyncHandler from 'express-async-handler';
import { sendChangeRequestEmail, sendApprovalEmail } from '../services/emailService.js';

// New function to handle change requests
export const submitChangeRequest = asyncHandler(async (req, res) => {
  console.log('=== CHANGE REQUEST RECEIVED ===');
  console.log('Request body:', req.body);
  console.log('Request type:', req.body.type);
  
  const { type, email, currentPassword, newPassword, confirmPassword, currentEmail, newEmail, confirmEmail, reason } = req.body;

  try {
    // Validate request type
    if (!type || !['password', 'email'].includes(type)) {
      console.log('❌ Invalid request type:', type);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request type' 
      });
    }

    // Validate password request
    if (type === 'password') {
      console.log('🔐 Validating password request...');
      console.log('Email:', email);
      console.log('Current password:', currentPassword ? '***' : 'missing');
      console.log('New password:', newPassword ? '***' : 'missing');
      console.log('Confirm password:', confirmPassword ? '***' : 'missing');
      
      if (!email || !currentPassword || !newPassword || !confirmPassword) {
        console.log('❌ Missing required fields for password request');
        return res.status(400).json({ 
          success: false, 
          message: 'All password fields are required' 
        });
      }
      
      console.log('✅ Password validation passed');
    }

    // Validate email request
    if (type === 'email') {
      console.log('📧 Validating email request...');
      console.log('Current email:', currentEmail);
      console.log('New email:', newEmail);
      console.log('Confirm email:', confirmEmail);
      
      if (!currentEmail || !newEmail || !confirmEmail) {
        console.log('❌ Missing required fields for email request');
        return res.status(400).json({ 
          success: false, 
          message: 'All email fields are required' 
        });
      }
      
      console.log('✅ Email validation passed');
    }

    // Create change request document
    const requestData = {
      type,
      email: type === 'password' ? email : null,
      currentPassword: type === 'password' ? currentPassword : null,
      newPassword: type === 'password' ? newPassword : null,
      currentEmail: type === 'email' ? currentEmail : null,
      newEmail: type === 'email' ? newEmail : null,
      reason,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('💾 Saving request to Firestore...');

    // Save to Firestore
    const requestRef = await db.collection('changeRequests').add(requestData);
    
    console.log('✅ Request saved with ID:', requestRef.id);
    
    // Send email to super admin
    const emailResult = await sendChangeRequestEmail({
      ...requestData,
      requestId: requestRef.id
    });
    
    if (emailResult.success) {
      console.log('📧 Email sent successfully to wyenfos014@gmail.com');
    } else {
      console.log('⚠️ Email sending failed:', emailResult.error);
    }

    res.status(201).json({
      success: true,
      message: 'Request submitted successfully. Super admin will review and notify you.',
      requestId: requestRef.id
    });

  } catch (error) {
    console.error('❌ Submit change request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit request' 
    });
  }
});

// Enhanced password update function with better verification
async function updateUserPassword(email, newPassword) {
  try {
    console.log('🔐 Starting enhanced password update for:', email);
    
    // Step 1: Find user in Firebase Auth
    const userRecord = await adminAuth.getUserByEmail(email);
    console.log('✅ User found in Firebase Auth:', userRecord.uid);
    
    // Step 2: Validate password requirements
    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    // Step 3: Update password in Firebase Auth
    console.log('🔄 Updating password in Firebase Auth...');
    await adminAuth.updateUser(userRecord.uid, {
      password: newPassword
    });
    console.log('✅ Password updated in Firebase Auth');
    
    // Step 4: Wait for propagation (increased wait time)
    console.log('⏳ Waiting for password update to propagate (5 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 5: Verify the update by getting user info
    console.log('🔍 Verifying password update...');
    const updatedUser = await adminAuth.getUser(userRecord.uid);
    console.log('✅ User verification successful:', {
      uid: updatedUser.uid,
      email: updatedUser.email,
      disabled: updatedUser.disabled,
      lastSignInTime: updatedUser.metadata.lastSignInTime
    });
    
    // Step 6: Update Firestore with password change timestamp
    console.log('📄 Updating Firestore with password change info...');
    const userDocRef = db.collection('users').doc(userRecord.uid);
    await userDocRef.update({
      updatedAt: new Date(),
      lastPasswordChange: new Date(),
      passwordChangedAt: new Date().toISOString(),
      passwordUpdateStatus: 'completed',
      passwordUpdateTimestamp: new Date().toISOString()
    });
    console.log('✅ Firestore updated with password change info');
    
    // Step 7: Force refresh user sessions (optional - for immediate effect)
    try {
      console.log('🔄 Revoking user sessions for immediate effect...');
      await adminAuth.revokeRefreshTokens(userRecord.uid);
      console.log('✅ User sessions revoked - user will need to login again');
    } catch (revokeError) {
      console.log('⚠️ Session revocation warning:', revokeError.message);
    }
    
    console.log('🎉 Enhanced password update completed successfully!');
    
    return {
      success: true,
      uid: userRecord.uid,
      email: userRecord.email,
      updatedAt: new Date().toISOString(),
      message: 'Password updated successfully. User should wait 1-2 minutes before logging in.'
    };
    
  } catch (error) {
    console.error('❌ Enhanced password update failed:', error);
    throw error;
  }
}

// Function to approve/reject requests (for super admin)
export const handleChangeRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { action, adminNotes } = req.body; // action: 'approve' or 'reject'

  try {
    console.log('🔍 Super admin approval process started');
    console.log('📋 Request ID:', requestId);
    console.log('📋 Action:', action);
    console.log('📋 Admin Notes:', adminNotes);

    const requestRef = db.collection('changeRequests').doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      console.log('❌ Request not found:', requestId);
      return res.status(404).json({ 
        success: false, 
        message: 'Request not found' 
      });
    }

    const requestData = requestDoc.data();
    console.log('📋 Request data:', {
      type: requestData.type,
      email: requestData.email,
      status: requestData.status,
      createdAt: requestData.createdAt
    });

    if (action === 'approve') {
      console.log('✅ Approving request:', requestId);
      console.log('📧 Request type:', requestData.type);
      
      // Update user's password or email
      if (requestData.type === 'password') {
        console.log('🔐 Processing password update...');
        console.log('📧 User email:', requestData.email);
        console.log('🔑 New password provided:', requestData.newPassword ? 'Yes' : 'No');
        
        if (!requestData.email || !requestData.newPassword) {
          console.log('❌ Missing required data for password update');
          return res.status(400).json({
            success: false,
            message: 'Missing email or new password in request data'
          });
        }
        
        try {
          // Use the enhanced password update function
          console.log('🔄 Calling enhanced password update function...');
          const updateResult = await updateUserPassword(requestData.email, requestData.newPassword);
          console.log('✅ Enhanced password update completed:', updateResult);
          
          // Additional verification
          console.log('🔍 Performing additional verification...');
          const verificationUser = await adminAuth.getUserByEmail(requestData.email);
          console.log('✅ User verification successful:', verificationUser.uid);
          
        } catch (error) {
          console.error('❌ Error updating password:', error);
          return res.status(500).json({
            success: false,
            message: 'Failed to update password: ' + error.message
          });
        }
        
      } else if (requestData.type === 'email') {
        console.log('📧 Processing email update...');
        console.log('📧 Current email:', requestData.currentEmail);
        console.log('📧 New email:', requestData.newEmail);
        
        try {
          // First, find the user in Firebase Auth by current email
          const userRecord = await adminAuth.getUserByEmail(requestData.currentEmail);
          console.log('👤 Found user in Firebase Auth:', userRecord.uid);
          
          // Update email in Firebase Auth
          await adminAuth.updateUser(userRecord.uid, {
            email: requestData.newEmail
          });
          console.log('✅ Email updated in Firebase Auth');
          
          // Update user profile in Firestore
          const userDocRef = db.collection('users').doc(userRecord.uid);
          await userDocRef.update({
            email: requestData.newEmail,
            updatedAt: new Date()
          });
          console.log('✅ User profile updated in Firestore');
          
        } catch (error) {
          console.error('❌ Error updating email:', error);
          return res.status(500).json({
            success: false,
            message: 'Failed to update email: ' + error.message
          });
        }
      }

      // Update request status
      console.log('📋 Updating request status to approved...');
      await requestRef.update({
        status: 'approved',
        adminNotes,
        updatedAt: new Date(),
        approvedAt: new Date().toISOString(),
        approvedBy: req.user?.uid || 'super-admin',
        approvalTimestamp: new Date().toISOString()
      });
      
      console.log('✅ Request status updated to approved');
      
      // Log the final result
      console.log('🎉 CHANGE REQUEST APPROVED SUCCESSFULLY');
      console.log('📧 User email:', requestData.type === 'password' ? requestData.email : requestData.currentEmail);
      console.log('🆔 Request ID:', requestId);
      console.log('📅 Approval time:', new Date().toISOString());
      
      // Send approval email to user
      try {
        console.log('📧 Sending approval email to user...');
        const emailResult = await sendApprovalEmail(requestData, 'approved');
        if (emailResult.success) {
          console.log('📧 Approval email sent successfully');
        } else {
          console.log('⚠️ Approval email failed:', emailResult.error);
        }
      } catch (emailError) {
        console.error('❌ Error sending approval email:', emailError);
      }

      res.json({
        success: true,
        message: 'Request approved successfully. User has been notified. Please wait 1-2 minutes before attempting to login.',
        details: {
          type: requestData.type,
          email: requestData.type === 'password' ? requestData.email : requestData.currentEmail,
          updatedAt: new Date().toISOString(),
          waitTime: '1-2 minutes',
          requestId: requestId,
          approvalTimestamp: new Date().toISOString()
        }
      });

    } else if (action === 'reject') {
      console.log('❌ Rejecting request:', requestId);
      
      // Update request status
      await requestRef.update({
        status: 'rejected',
        adminNotes,
        updatedAt: new Date(),
        rejectedAt: new Date().toISOString(),
        rejectedBy: req.user?.uid || 'super-admin'
      });
      
      console.log('✅ Request status updated to rejected');
      
      // Send rejection email to user
      try {
        const emailResult = await sendApprovalEmail(requestData, 'rejected');
        if (emailResult.success) {
          console.log('📧 Rejection email sent successfully');
        } else {
          console.log('⚠️ Rejection email failed:', emailResult.error);
        }
      } catch (emailError) {
        console.error('❌ Error sending rejection email:', emailError);
      }

      res.json({
        success: true,
        message: 'Request rejected. User has been notified.'
      });
    } else {
      console.log('❌ Invalid action:', action);
      res.status(400).json({
        success: false,
        message: 'Invalid action'
      });
    }

  } catch (error) {
    console.error('❌ Handle change request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process request',
      error: error.message
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

// Keep the old function for backward compatibility
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Check if user exists in Firebase
    const users = await userService.getAllUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    // Generate password reset link using Firebase Auth
    const resetLink = await adminAuth.generatePasswordResetLink(email);
    
    // Here you would typically send the email with the reset link
    // For now, we'll just return success
    res.status(200).json({ 
      success: true,
      message: 'Password reset email sent if account exists',
      resetLink: resetLink // In production, this should be sent via email
    });
  } catch (error) {
    console.error('Reset request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing request',
      error: error.message
    });
  }
};

export const updatePasswordDirectly = async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    // Find user by email
    const users = await userService.getAllUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Update password in Firebase Auth
    await adminAuth.updateUser(user.uid, {
      password: newPassword
    });
    
    // Update user record in Firestore
    await userService.updateUser(user.id, {
      password: newPassword, // Note: In production, this should be hashed
      updatedAt: new Date()
    });
    
    res.status(200).json({ 
      success: true,
      message: 'Password updated successfully' 
    });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message 
    });
  }
};

// Debug function to check user authentication status
export const debugUserAuth = asyncHandler(async (req, res) => {
  const { email } = req.body;

  try {
    // Check if user exists in Firebase Auth
    let authUser = null;
    try {
      authUser = await adminAuth.getUserByEmail(email);
      console.log('✅ User found in Firebase Auth:', {
        uid: authUser.uid,
        email: authUser.email,
        disabled: authUser.disabled,
        emailVerified: authUser.emailVerified,
        lastSignInTime: authUser.metadata.lastSignInTime,
        creationTime: authUser.metadata.creationTime
      });
    } catch (authError) {
      console.log('❌ User not found in Firebase Auth:', authError.message);
    }
    
    // Check if user exists in Firestore
    let firestoreUser = null;
    if (authUser) {
      try {
        const userDoc = await db.collection('users').doc(authUser.uid).get();
        if (userDoc.exists) {
          firestoreUser = userDoc.data();
          console.log('✅ User found in Firestore:', {
            id: firestoreUser.id,
            name: firestoreUser.name,
            role: firestoreUser.role,
            isActive: firestoreUser.isActive,
            lastLogin: firestoreUser.lastLogin,
            lastPasswordChange: firestoreUser.lastPasswordChange
          });
        } else {
          console.log('❌ User not found in Firestore');
        }
      } catch (firestoreError) {
        console.log('❌ Error accessing Firestore:', firestoreError.message);
      }
    }
    
    // Check for recent password change requests
    let recentRequests = [];
    try {
      const requestsQuery = await db.collection('changeRequests')
        .where('email', '==', email)
        .where('type', '==', 'password')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
      
      recentRequests = requestsQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('📋 Recent password change requests:', recentRequests.length);
    } catch (requestError) {
      console.log('❌ Error checking change requests:', requestError.message);
    }
    
    res.json({
      success: true,
      debug: {
        email,
        authUser: authUser ? {
          uid: authUser.uid,
          email: authUser.email,
          disabled: authUser.disabled,
          emailVerified: authUser.emailVerified,
          lastSignInTime: authUser.metadata.lastSignInTime,
          creationTime: authUser.metadata.creationTime
        } : null,
        firestoreUser: firestoreUser ? {
          id: firestoreUser.id,
          name: firestoreUser.name,
          role: firestoreUser.role,
          isActive: firestoreUser.isActive,
          lastLogin: firestoreUser.lastLogin,
          lastPasswordChange: firestoreUser.lastPasswordChange
        } : null,
        recentRequests: recentRequests.map(req => ({
          id: req.id,
          status: req.status,
          createdAt: req.createdAt,
          updatedAt: req.updatedAt
        }))
      },
      message: 'User authentication debug information retrieved'
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
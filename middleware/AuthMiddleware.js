import admin from 'firebase-admin';
import 'dotenv/config';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import asyncHandler from 'express-async-handler';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_MAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const auth = getAuth();
const db = getFirestore();

export const verifyToken = asyncHandler(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        error: 'Authorization token required',
        code: 'MISSING_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1];
    


    const decodedToken = await auth.verifyIdToken(token);
    const userRef = db.collection('users').doc(decodedToken.uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false,
        error: 'User account not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const userData = userDoc.data();
    
    if (userData.isActive === false) {
      return res.status(403).json({
        success: false,
        error: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || userData.email,
      name: userData.name || '',
      role: userData.role?.toLowerCase() || 'staff', // Normalize role to lowercase
      department: userData.department?.toLowerCase() || null, // Normalize department to lowercase
      company: userData.company || null, // Add company field
      accessibleSections: userData.accessibleSections || [],
      ...userData
    };

    next();
  } catch (error) {
    console.error('Authentication Error:', error.message);
    
    const errorResponse = {
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    };

    switch (error.code) {
      case 'auth/id-token-expired':
        return res.status(401).json({ 
          ...errorResponse,
          error: 'Session expired',
          code: 'TOKEN_EXPIRED'
        });
      case 'auth/user-not-found':
        return res.status(404).json({ 
          ...errorResponse,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      case 'auth/quota-exceeded':
        return res.status(429).json({ 
          ...errorResponse,
          error: 'Firebase quota exceeded. Please try again later or upgrade your plan.',
          code: 'QUOTA_EXCEEDED'
        });
      default:
        return res.status(500).json(errorResponse);
    }
  }
});

export const authorize = (roles = [], departments = []) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHENTICATED'
      });
    }

    const normalizedRoles = roles.map(r => r.toLowerCase());
    const normalizedDepartments = departments.map(d => d.toLowerCase());
    const userRole = req.user.role?.toLowerCase();
    const userDept = req.user.department?.toLowerCase();

    // Always allow super admin to pass any authorization checks
    if (userRole === 'super_admin' || userRole === 'superadmin') {
      return next();
    }

    if (normalizedRoles.length > 0 && !normalizedRoles.includes(userRole)) {
      return res.status(403).json({ 
        success: false,
        error: `Insufficient permissions. Required roles: ${roles.join(', ')}`,
        code: 'ROLE_REQUIRED',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    if (normalizedDepartments.length > 0 && 
        userRole === 'admin' && 
        (!userDept || !normalizedDepartments.includes(userDept))) {
      return res.status(403).json({ 
        success: false,
        error: `Department access denied. Required departments: ${departments.join(', ')}`,
        code: 'DEPARTMENT_REQUIRED',
        requiredDepartments: departments,
        userDepartment: req.user.department
      });
    }

    next();
  });
};

export const protect = verifyToken;
export const verifyAdmin = authorize(['admin']);
export const verifySuperAdmin = authorize(['super_admin', 'superadmin']);
export const verifyHrAdmin = authorize(['admin'], ['hr']);
export const verifyPurchaseAdmin = authorize(['admin'], ['purchase']);
export const verifyAccountsAdmin = authorize(['admin'], ['accounts']);
export const verifyMarketingAdmin = authorize(['admin'], ['marketing']);
export const verifyDigitalMarketingAdmin = authorize(['admin'], ['digital marketing']);
export const verifyAdminOrSuperAdmin = authorize(['admin', 'super_admin', 'superadmin']);

// Combined role/department verifier for HR
export const verifyHrAdminOrSuperAdmin = authorize(['admin', 'super_admin'], ['hr']);

// Section-based access control
export const verifySectionAccess = (section) => asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHENTICATED'
    });
  }

  if (req.user.role === 'super_admin') {
    return next();
  }

  if (req.user.role === 'admin') {
    return next();
  }

  if (!req.user.accessibleSections?.includes(section)) {
    return res.status(403).json({ 
      success: false,
      error: `Access denied to ${section} section`,
      code: 'SECTION_ACCESS_DENIED',
      requiredSection: section,
      userSections: req.user.accessibleSections
    });
  }

  next();
});

export const verifyFinanceAccess = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHENTICATED'
    });
  }

  const allowedRoles = ['super_admin', 'admin', 'finance_manager'];
  const allowedDepartments = ['finance', 'accounting'];
  const hasAllowedRole = allowedRoles.includes(req.user.role);
  const hasAllowedDepartment = req.user.role === 'admin' && 
                             req.user.department && 
                             allowedDepartments.includes(req.user.department.toLowerCase());
  
  const hasSectionAccess = req.user.accessibleSections?.includes('finance');

  if (hasAllowedRole || hasAllowedDepartment || hasSectionAccess) {
    return next();
  }
  
  res.status(403).json({ 
    success: false,
    error: 'Finance access required',
    code: 'FINANCE_ACCESS_DENIED',
    required: {
      roles: allowedRoles,
      departments: allowedDepartments,
      sections: ['finance']
    },
    user: {
      role: req.user.role,
      department: req.user.department,
      accessibleSections: req.user.accessibleSections
    }
  });
});

export const handleAutoLogout = async (userId) => {
  try {
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();
    
    const activeSessionQuery = await db.collection('userSessions')
      .where('userId', '==', userId)
      .where('logoutTime', '==', null)
      .orderBy('loginTime', 'desc')
      .limit(1)
      .get();

    if (!activeSessionQuery.empty) {
      const sessionRef = activeSessionQuery.docs[0].ref;
      const loginTime = activeSessionQuery.docs[0].data().loginTime;
      const duration = Math.floor((now.toDate() - loginTime.toDate()) / (1000 * 60)); // minutes
      
      batch.update(sessionRef, {
        logoutTime: now,
        duration,
        automaticLogout: true
      });
    }

    const activePunchQuery = await db.collection('punchingTimes')
      .where('staffId', '==', userId)
      .where('punchOut', '==', null)
      .orderBy('punchIn', 'desc')
      .limit(1)
      .get();

    if (!activePunchQuery.empty) {
      const punchRef = activePunchQuery.docs[0].ref;
      const punchIn = activePunchQuery.docs[0].data().punchIn;
      const duration = Math.floor((now.toDate() - punchIn.toDate()) / (1000 * 60)); // minutes
      
      batch.update(punchRef, {
        punchOut: now,
        duration,
        automaticLogout: true
      });
    }

    await batch.commit();
  } catch (error) {
    console.error('Auto-logout error:', error);
    throw error;
  }
};

export const verifyRefreshToken = asyncHandler(async (req, res, next) => {
  return res.status(501).json({ 
    success: false, 
    error: 'Refresh tokens should be handled client-side with Firebase SDK',
    code: 'CLIENT_SIDE_REFRESH'
  });
});
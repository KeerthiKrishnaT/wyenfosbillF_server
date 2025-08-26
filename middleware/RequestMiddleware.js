
 export  const hasEditPermission = (resourceType) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id;
      const userId = req.user.id;
      
      if (req.user.isAdmin) return next();
      
      const permission = await Request.findOne({
        resourceId,
        resourceType,
        userId,
        status: 'approved',
        expiresAt: { $gt: new Date() }
      });
      
      if (permission) return next();
      
      return res.status(403).json({
        success: false,
        message: 'You need permission to edit this resource',
        error: error.message

      });
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

export const isAdmin = (req, res, next) => {
  if (req.user.role === 'admin') return next();
  res.status(403).json({
    success: false,
    message: 'Admin access required'
  });
};


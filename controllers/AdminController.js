import { 
  userService, 
  firebaseService 
} from '../services/firebaseService.js';

export const getSystemStats = async (req, res) => {
  try {
    const [users, requests, bills] = await Promise.all([
      userService.getAllUsers(),
      firebaseService.getAll('requests'),
      firebaseService.getAll('bills')
    ]);
    
    const totalUsers = users.length;
    const activeUsers = users.filter(user => user.isActive).length;
    const pendingRequests = requests.filter(req => req.status === 'pending').length;
    const totalBills = bills.length;
    
    res.json({ totalUsers, activeUsers, pendingRequests, totalBills });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch stats',
      error: error.message
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    // Remove sensitive data
    const sanitizedUsers = users.map(user => {
      const { password, __v, ...sanitizedUser } = user;
      return sanitizedUser;
    });
    res.json(sanitizedUsers);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent non-admins from changing roles
    if (updates.role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Only admins can grant admin privileges'
      });
    }

    const user = await userService.updateUser(id, updates);

    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Remove sensitive data
    const { password, __v, ...sanitizedUser } = user;
    res.json(sanitizedUser);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to update user',
      error: error.message
    });
  }
};

export const getPendingRequests = async (req, res) => {
  try {
    const requests = await firebaseService.getWhere('requests', 'status', '==', 'pending');
    
    // Populate user data for each request
    const populatedRequests = await Promise.all(
      requests.map(async (request) => {
        const user = await userService.getUserById(request.userId);
        return {
          ...request,
          user: user ? { name: user.name, email: user.email } : null
        };
      })
    );
    
    // Sort by creation date
    populatedRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(populatedRequests);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch requests',
      error: error.message
    });
  }
};

export const handleRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const request = await firebaseService.update('requests', id, { status });
    
    if (!request) return res.status(404).json({ message: 'Request not found' });
    
    if (status === 'approved') {
      await userService.updateUser(request.userId, {
        hasEditPermission: true,
        permissionRequested: false
      });
    }
    
    res.json(request);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to handle request',
      error: error.message
    });
  }
};
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error('Authentication required');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id);

    if (!user) throw new Error('User not found');
    
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};

export default authMiddleware;
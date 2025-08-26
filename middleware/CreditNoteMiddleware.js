// middleware/CreditNoteMiddleware.js
import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    if (!['super_admin', 'account_admin'].includes(decoded.role)) {
      return res.status(401).json({ error: 'Unauthorized: Super Admin or Account Admin access required' });
    }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
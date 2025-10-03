import express from 'express';
import {
  verifyToken,
  verifySuperAdmin,
  authorize
} from '../middleware/AuthMiddleware.js';
import multer from 'multer';
import {
  getCompanyById,
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  getCompanyNames,
  getCompanyByName
} from '../controllers/companyController.js';

const router = express.Router();

// Use memory storage for Firebase Storage uploads
const upload = multer({ storage: multer.memoryStorage() });

// Public health check endpoint (no auth required)
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Company API is working!',
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
});

// Company management routes
router.post('/', verifyToken, verifySuperAdmin, upload.any(), createCompany);
router.get('/', verifyToken, getCompanies);
router.get('/names', verifyToken, getCompanyNames);
router.get('/details-by-name/:name', verifyToken, authorize(['admin', 'staff']), getCompanyByName);
router.get('/:id', verifyToken, authorize(['admin', 'staff']), getCompanyById);
router.put('/:id', verifyToken, verifySuperAdmin, upload.any(), updateCompany);
router.delete('/:id', verifyToken, verifySuperAdmin, deleteCompany);

export default router;

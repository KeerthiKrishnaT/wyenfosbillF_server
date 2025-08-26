import express from 'express';
import { createPriceList, getAllPriceLists } from '../controllers/priceListController.js';
import { verifyToken } from '../middleware/AuthMiddleware.js';

const router = express.Router();
router.use(verifyToken);
router.use((req, res, next) => {
  const user = req.user;
  if (
    user.role === 'super_admin' ||
    user.role === 'purchasing_admin' ||
    (user.role === 'admin' && user.department === 'Purchase')
  ) {
    return next();
  } 
  return res.status(403).json({ message: 'Unauthorized' });
});

router.post('/', createPriceList);
router.get('/', getAllPriceLists);

export default router;

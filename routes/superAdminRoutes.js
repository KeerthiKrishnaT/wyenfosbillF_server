import express from 'express';
import {
  verifySuperAdmin,
  getCashBills,
  getCreditBills,
  getCreditNotes,
  getDebitNotes,
  getEditRequests,
  handleEditRequest,
} from '../controllers/SuperAdminController.js';

const router = express.Router();

// Super admin-only routes
router.get('/cashbills', verifySuperAdmin, getCashBills);
router.get('/creditbills', verifySuperAdmin, getCreditBills);
router.get('/creditnotes', verifySuperAdmin, getCreditNotes);
router.get('/debitnotes', verifySuperAdmin, getDebitNotes);
router.get('/edit-requests', verifySuperAdmin, getEditRequests);
router.put('/edit-requests/:requestId', verifySuperAdmin, handleEditRequest);

export default router;
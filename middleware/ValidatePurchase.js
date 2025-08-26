import { body, query, param } from 'express-validator';

export const purchaseValidations = [
  body('itemCode')
    .trim()
    .notEmpty().withMessage('Item code is required')
    .isLength({ max: 50 }).withMessage('Item code max length is 50 characters'),
  
  body('itemName')
    .trim()
    .notEmpty().withMessage('Item name is required')
    .isLength({ max: 100 }).withMessage('Item name max length is 100 characters'),
  
  body('quantity')
    .isFloat({ min: 1 }).withMessage('Quantity must be at least 1'),
  
  body('unitPrice')
    .isFloat({ min: 0.01 }).withMessage('Unit price must be positive'),
  
  body('gst')
    .isFloat({ min: 0 }).withMessage('GST must be non-negative'),
  
  body('purchaseDate')
    .optional()
    .isISO8601().withMessage('Invalid date format (YYYY-MM-DD)'),
  
  body('vendor')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Vendor max length is 100 characters'),
  
  body('invoiceNumber')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Invoice number max length is 50 characters')
];

export const purchaseFilterValidations = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  
  query('itemCode')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Item code max length is 50 characters'),
  
  query('fromDate')
    .optional()
    .isISO8601().withMessage('Invalid date format (YYYY-MM-DD)'),
  
  query('toDate')
    .optional()
    .isISO8601().withMessage('Invalid date format (YYYY-MM-DD)'),
  
  query('lowStockThreshold')
    .optional()
    .isInt({ min: 1 }).withMessage('Low stock threshold must be a positive integer')
];
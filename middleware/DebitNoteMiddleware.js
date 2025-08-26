import Joi from 'joi';

const validateDebitNote = (req, res, next) => {
  const schema = Joi.object({
    invoiceNumber: Joi.string().optional(),
    customerId: Joi.string().required(),
    customerName: Joi.string().required(),
    customerAddress: Joi.string().allow(''),
    customerGSTIN: Joi.string().allow(''),
    date: Joi.string().required(),
    dueDate: Joi.string().required(),
    creditBillId: Joi.string().required(),
    company: Joi.object({
      name: Joi.string().required()
    }).required(),
    items: Joi.array().items(
      Joi.object({
        description: Joi.string().required(),
        hsnSac: Joi.string().allow(''),
        quantity: Joi.number().min(0).required(),
        unit: Joi.string().required(),
        rate: Joi.number().min(0).required(),
        taxableValue: Joi.number().min(0).required(),
        cgstRate: Joi.number().min(0).required(),
        cgstAmount: Joi.number().min(0).required(),
        sgstRate: Joi.number().min(0).required(),
        sgstAmount: Joi.number().min(0).required(),
        igstRate: Joi.number().min(0).required(),
        igstAmount: Joi.number().min(0).required(),
      })
    ).required(),
    totals: Joi.object({
      taxableAmount: Joi.number().min(0).required(),
      cgstTotal: Joi.number().min(0).required(),
      sgstTotal: Joi.number().min(0).required(),
      igstTotal: Joi.number().min(0).required(),
      totalAmount: Joi.number().min(0).required(),
    }).required(),
    reason: Joi.string().allow(''),
    isOtherState: Joi.boolean(),
    cancelled: Joi.boolean(),
    createdBy: Joi.string().required(),
    lastUpdatedBy: Joi.string().required(),
    bankDetails: Joi.object().optional(),
    signature: Joi.string().allow(''),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  next();
};

const verifyToken = (req, res, next) => {
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

 const validateCreditBill = (req, res, next) => {
  verifyToken(req, res, () => {
    const { invoiceNo, customerName } = req.body;
    if (!invoiceNo || !customerName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    next();
  });
}

 const validateEmailRequest = (req, res, next) => {
  const { to, subject } = req.body;
  if (!to || !subject) {
    return res.status(400).json({ error: 'Missing email fields' });
  }
  next();
};

 const validateCustomer = (req, res, next) => {
  const { name, contactDetails } = req.body;
  
  if (!name || name.length < 4) {
    return res.status(400).json({ message: 'Customer name must be at least 4 characters' });
  }
  
  if (!contactDetails) {
    return res.status(400).json({ message: 'Contact details are required' });
  }
  
  next();
};

export { validateDebitNote, validateCreditBill, validateEmailRequest,validateCustomer };
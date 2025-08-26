
export const validateEmail = (req, res, next) => {
  const { customerEmail, invoiceNo } = req.body;
  if (!customerEmail || !invoiceNo) {
    return res.status(400).json({ message: "customerEmail and invoiceNo are required" });
  }
  next();
};

export const validateResetInput = (req, res, next) => {
  const errors = {};
  const { password } = req.body;
  const { token } = req.params;

  if (!token || token.trim() === '') {
    errors.token = 'Invalid or missing reset token';
  }

  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!password) {
    errors.password = 'New password is required';
  } else if (typeof password !== 'string' || !passwordRegex.test(password)) {
    errors.password =
      'Password must be at least 8 characters with an uppercase letter, a number, and a special character';
  }

  // If there are errors, return 400 with error details
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors,
    });
  }

  next();
};


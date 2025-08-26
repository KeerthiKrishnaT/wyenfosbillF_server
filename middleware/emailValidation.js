// Helper function to validate email format
const isValidEmail = (email) => {
  return /^\S+@\S+\.\S+$/.test(email);
};

// Helper function to validate URLs
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

// Validate bill email
export const validateBillEmail = (req, res, next) => {
  const { emailTo, pdfBase64 } = req.body;
  
  if (!emailTo || !pdfBase64) {
    return res.status(400).json({
      success: false,
      message: 'Recipient and PDF are required'
    });
  }
  
  if (!isValidEmail(emailTo)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format'
    });
  }
  
  // Basic base64 validation
  if (!/^[A-Za-z0-9+/=]+$/.test(pdfBase64)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid PDF format'
    });
  }
  
  next();
};

// Validate password reset email
export const validatePasswordResetEmail = (req, res, next) => {
  const { email, resetLink } = req.body;
  
  if (!email || !resetLink) {
    return res.status(400).json({
      success: false,
      message: 'Email and reset link are required'
    });
  }
  
  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format'
    });
  }
  
  if (!isValidUrl(resetLink)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid reset link format'
    });
  }
  
  next();
};

// Validate notification email
export const validateNotificationEmail = (req, res, next) => {
  const { to, subject, message } = req.body;
  
  if (!to || !subject || !message) {
    return res.status(400).json({
      success: false,
      message: 'Recipient, subject, and message are required'
    });
  }
  
  // Validate all recipients in a comma-separated list
  const recipients = to.split(',').map(e => e.trim());
  const allValid = recipients.every(isValidEmail);
  
  if (!allValid) {
    return res.status(400).json({
      success: false,
      message: 'One or more recipient emails are invalid'
    });
  }
  
  next();
};
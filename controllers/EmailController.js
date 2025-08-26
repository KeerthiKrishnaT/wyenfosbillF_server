import nodemailer from 'nodemailer';
import { userService } from '../services/firebaseService.js';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  },
  // Better error handling
  connectionTimeout: 10000, // 10 seconds
  socketTimeout: 30000, // 30 seconds
  logger: process.env.NODE_ENV === 'development'
});

// Validate email configuration
transporter.verify((error) => {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Email templates
const emailTemplates = {
  passwordReset: (resetLink) => `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333;">Password Reset Request</h2>
      <p>You requested a password reset for your WYENFOS account.</p>
      <p>Click the link below to reset your password:</p>
      <p style="margin: 20px 0;">
        <a href="${resetLink}" 
           style="display: inline-block; padding: 10px 20px; background: #007bff; 
                  color: #fff; text-decoration: none; border-radius: 4px;">
          Reset Password
        </a>
      </p>
      <p>If you didn't request this, please ignore this email.</p>
      <p style="margin-block-start: 30px; font-size: 0.9em; color: #666;">
        This link will expire in 1 hour for security reasons.
      </p>
    </div>
  `,
  billNotification: () => `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #333;">Your Bill Statement</h2>
      <p>Please find your bill statement attached to this email.</p>
      <p>If you have any questions about your bill, please reply to this email.</p>
      <p style="margin-block-start: 30px; font-size: 0.9em; color: #666;">
        This is an automated message. Please do not reply directly to this email.
      </p>
    </div>
  `
};

// General email sending function
export const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  try {
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'WYENFOS System'}" 
             <${process.env.EMAIL_FROM_ADDRESS || process.env.MAIL_USER}>`,
      to,
      subject,
      html,
      attachments
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Email sending failed to ${to}:`, error);
    return { 
      success: false, 
      error: error.message || 'Email sending failed' 
    };
  }
};

// Send bill email with PDF attachment
export const sendBillEmail = async (req, res) => {
  try {
    const { emailTo, subject, body, pdfBase64, filename = 'CashBill.pdf' } = req.body;
    
    // Validate input
    if (!emailTo || !subject || !pdfBase64) {
      return res.status(400).json({
        success: false,
        message: 'Recipient, subject, and PDF are required'
      });
    }

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    
    const emailContent = body || emailTemplates.billNotification();
    
    const result = await sendEmail({
      to: emailTo,
      subject,
      html: emailContent,
      attachments: [{
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    });
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send email',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Email sending failed:', error);
    res.status(500).json({
      success: false,
      message: 'Email sending failed',
      error: error.message
    });
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (req, res) => {
  try {
    const { email, resetLink } = req.body;
    
    // Validate input
    if (!email || !resetLink) {
      return res.status(400).json({
        success: false,
        message: 'Email and reset link are required'
      });
    }
    
    // Verify user exists in Firebase
    const users = await userService.getAllUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const emailContent = emailTemplates.passwordReset(resetLink);
    
    const result = await sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html: emailContent
    });
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Password reset email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send password reset email',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Password reset email failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send password reset email',
      error: error.message
    });
  }
};

// Send general notification email
export const sendNotificationEmail = async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    
    // Validate input
    if (!to || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Recipient, subject, and message are required'
      });
    }
    
    const result = await sendEmail({
      to,
      subject,
      html: `<div>${message}</div>`
    });
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Notification email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send notification email',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Notification email failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification email',
      error: error.message
    });
  }
};
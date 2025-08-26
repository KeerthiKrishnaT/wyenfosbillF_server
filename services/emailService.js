import nodemailer from 'nodemailer';
import 'dotenv/config';
// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  debug: true, 
  logger: true,
});

// Test email configuration
export const testEmailConfig = async () => {
  try {
    // Show actual values (be careful with sensitive data)
    if (process.env.MAIL_USER) {
      // console.log('📧 MAIL_USER value:', process.env.MAIL_USER);
    }
    if (process.env.MAIL_PASS) {
      // console.log('🔑 MAIL_PASS length:', process.env.MAIL_PASS.length);
      // console.log('🔑 MAIL_PASS first 4 chars:', process.env.MAIL_PASS.substring(0, 4) + '...');
    }
    
    // Verify transporter
    await transporter.verify();
    return { success: true, message: 'Email configuration is working' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Send a simple test email
export const sendTestEmail = async () => {
  try {
    const mailOptions = {
      from: `"Wyenfos Bills" <${process.env.MAIL_USER}>`,
      to: process.env.MAIL_USER, // Send to self for testing
      subject: 'Test Email from Wyenfos Bills',
      text: 'This is a test email to verify email configuration is working.',
      html: '<h1>Test Email</h1><p>This is a test email to verify email configuration is working.</p>'
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const sendChangeRequestEmail = async (requestData) => {
  try {
    // console.log('📧 Starting sendChangeRequestEmail...');
    // console.log('🔍 Environment check - MAIL_USER:', process.env.MAIL_USER ? 'Set' : 'Not set');
    // console.log('🔍 Environment check - MAIL_PASS:', process.env.MAIL_PASS ? 'Set' : 'Not set');
    // console.log('📧 Request type:', requestData.type);
    // console.log('📧 Request data:', JSON.stringify(requestData, null, 2));
    
    const { type, email, currentPassword, newPassword, currentEmail, newEmail, reason, requestId } = requestData;
    
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #764ba2; padding-bottom: 10px;">
          🔄 New Change Request
        </h2>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #764ba2; margin-top: 0;">
            ${type === 'password' ? '🔒 Password Reset Request' : '📧 Email Reset Request'}
          </h3>
          
          ${type === 'password' ? `
            <p><strong>👤 User Email:</strong> ${email}</p>
            <p><strong>🔑 Current Password:</strong> ••••••••</p>
            <p><strong>🔑 New Password:</strong> ••••••••</p>
          ` : `
            <p><strong>📧 Current Email:</strong> ${currentEmail}</p>
            <p><strong>📧 New Email:</strong> ${newEmail}</p>
          `}
          
          <p><strong>📝 Reason:</strong> ${reason}</p>
          <p><strong>🆔 Request ID:</strong> ${requestId}</p>
          <p><strong>📅 Date:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #2d5a2d;">
            <strong>⚠️ Action Required:</strong> Please review this request and take action below.
          </p>
        </div>
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="http://localhost:3000/api/forgot-password/change-requests/${requestId}/approve" 
             style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 0 10px; display: inline-block;">
            ✅ Approve Request
          </a>
          <a href="http://localhost:3000/api/forgot-password/change-requests/${requestId}/reject" 
             style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 0 10px; display: inline-block;">
            ❌ Reject Request
          </a>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #6c757d; font-size: 14px;">
            <strong>📋 Alternative:</strong> You can also manage all requests at: 
            <a href="http://localhost:3000/admin/change-requests" style="color: #007bff;">Admin Panel</a>
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
          <p>This is an automated notification from Wyenfos Bills System</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.MAIL_USER,
      to: 'keerthikrishna920@gmail.com',
      subject: `🔄 Change Request - ${type === 'password' ? 'Password Reset' : 'Email Reset'} - ${requestId}`,
      html: emailContent
    };

    const result = await transporter.sendMail(mailOptions);
    // console.log('✅ Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    // console.error('❌ Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

export const sendApprovalEmail = async (requestData, action) => {
  try {
    const { type, email, currentEmail, newEmail, reason, requestId } = requestData;
    
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${action === 'approved' ? '#28a745' : '#dc3545'}; border-bottom: 2px solid ${action === 'approved' ? '#28a745' : '#dc3545'}; padding-bottom: 10px;">
          ${action === 'approved' ? '✅ Request Approved' : '❌ Request Rejected'}
        </h2>
        
        <div style="background: ${action === 'approved' ? '#d4edda' : '#f8d7da'}; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: ${action === 'approved' ? '#155724' : '#721c24'}; margin-top: 0;">
            ${type === 'password' ? '🔒 Password Reset' : '📧 Email Reset'}
          </h3>
          
          ${type === 'password' ? `
            <p><strong>👤 User Email:</strong> ${email}</p>
          ` : `
            <p><strong>📧 Current Email:</strong> ${currentEmail}</p>
            <p><strong>📧 New Email:</strong> ${newEmail}</p>
          `}
          
          <p><strong>📝 Original Reason:</strong> ${reason}</p>
          <p><strong>🆔 Request ID:</strong> ${requestId}</p>
          <p><strong>📅 Date:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #2d5a2d;">
            <strong>${action === 'approved' ? '✅ Approved' : '❌ Rejected'}:</strong> 
            ${action === 'approved' ? 'Your request has been approved and the changes have been applied.' : 'Your request has been rejected. Please contact the administrator for more information.'}
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
          <p>This is an automated notification from Wyenfos Bills System</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.MAIL_USER,
      to: type === 'password' ? email : currentEmail,
      subject: `🔄 Change Request ${action === 'approved' ? 'Approved' : 'Rejected'} - ${requestId}`,
      html: emailContent
    };

    const result = await transporter.sendMail(mailOptions);
    // console.log('✅ Approval email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    // console.error('❌ Approval email sending failed:', error);
    return { success: false, error: error.message };
  }
};

export const sendNotificationEmail = async (notificationData) => {
  try {
    const { 
      to, 
      subject, 
      message, 
      type = 'general', 
      priority = 'normal',
      data = {},
      attachments = [],
      // New parameters for permission requests
      billType,
      invoiceNo,
      recipient,
      requester,
      notificationId,
      reason
    } = notificationData;

    // Create email content based on type
    let emailContent = '';
    let emailSubject = subject;

    switch (type) {
      case 'sold_product':
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #28a745; padding-bottom: 10px;">
              🛒 Product Sold Notification
            </h2>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #28a745; margin-top: 0;">Product Sale Details</h3>
              
              <p><strong>📦 Product:</strong> ${data.productName || 'N/A'}</p>
              <p><strong>💰 Price:</strong> ₹${data.price || 'N/A'}</p>
              <p><strong>📊 Quantity:</strong> ${data.quantity || 'N/A'}</p>
              <p><strong>👤 Customer:</strong> ${data.customerName || 'N/A'}</p>
              <p><strong>📅 Date:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>📝 Notes:</strong> ${message || 'No additional notes'}</p>
            </div>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #2d5a2d;">
                <strong>✅ Sale Completed:</strong> This product has been successfully sold and recorded in the system.
              </p>
            </div>
          </div>
        `;
        break;

      case 'low_stock':
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #ffc107; padding-bottom: 10px;">
              ⚠️ Low Stock Alert
            </h2>
            
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #856404; margin-top: 0;">Stock Warning</h3>
              
              <p><strong>📦 Product:</strong> ${data.productName || 'N/A'}</p>
              <p><strong>📊 Current Stock:</strong> ${data.currentStock || 'N/A'}</p>
              <p><strong>🔴 Minimum Stock:</strong> ${data.minStock || 'N/A'}</p>
              <p><strong>📅 Alert Date:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>📝 Message:</strong> ${message || 'Stock level is below minimum threshold'}</p>
            </div>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #2d5a2d;">
                <strong>🔄 Action Required:</strong> Please restock this product to maintain inventory levels.
              </p>
            </div>
          </div>
        `;
        break;

      case 'bill_generated':
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
              📄 Bill Generated
            </h2>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #007bff; margin-top: 0;">Bill Details</h3>
              
              <p><strong>🆔 Bill ID:</strong> ${data.billId || 'N/A'}</p>
              <p><strong>👤 Customer:</strong> ${data.customerName || 'N/A'}</p>
              <p><strong>💰 Total Amount:</strong> ₹${data.totalAmount || 'N/A'}</p>
              <p><strong>📅 Date:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>📝 Notes:</strong> ${message || 'Bill has been generated successfully'}</p>
            </div>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #2d5a2d;">
                <strong>✅ Bill Ready:</strong> The bill has been generated and is ready for customer.
              </p>
            </div>
          </div>
        `;
        break;

      case 'payment_received':
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #28a745; padding-bottom: 10px;">
              💰 Payment Received
            </h2>
            
            <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #155724; margin-top: 0;">Payment Details</h3>
              
              <p><strong>💰 Amount:</strong> ₹${data.amount || 'N/A'}</p>
              <p><strong>👤 Customer:</strong> ${data.customerName || 'N/A'}</p>
              <p><strong>💳 Payment Method:</strong> ${data.paymentMethod || 'N/A'}</p>
              <p><strong>📅 Date:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>📝 Notes:</strong> ${message || 'Payment received successfully'}</p>
            </div>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #2d5a2d;">
                <strong>✅ Payment Confirmed:</strong> Payment has been received and recorded in the system.
              </p>
            </div>
          </div>
        `;
        break;

      case 'system_alert':
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #dc3545; padding-bottom: 10px;">
              🚨 System Alert
            </h2>
            
            <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #721c24; margin-top: 0;">System Notification</h3>
              
              <p><strong>⚠️ Alert Type:</strong> ${data.alertType || 'System Alert'}</p>
              <p><strong>📅 Time:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>📝 Message:</strong> ${message || 'System alert notification'}</p>
              ${data.details ? `<p><strong>🔍 Details:</strong> ${data.details}</p>` : ''}
            </div>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #2d5a2d;">
                <strong>⚠️ Attention Required:</strong> Please review this system alert and take appropriate action.
              </p>
            </div>
          </div>
        `;
        break;

      case 'edit_request':
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #ffc107; padding-bottom: 10px;">
              ✏️ Edit Request
            </h2>
            
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #856404; margin-top: 0;">Permission Request</h3>
              
              <p><strong>📄 Bill Type:</strong> ${billType || 'Credit Bill'}</p>
              <p><strong>🆔 Invoice No:</strong> ${invoiceNo || 'N/A'}</p>
              <p><strong>👤 Requested By:</strong> ${requester || 'N/A'}</p>
              <p><strong>📅 Date:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>📝 Reason:</strong> ${reason || 'Staff requested permission to edit bill'}</p>
              <p><strong>🆔 Request ID:</strong> ${notificationId || 'N/A'}</p>
            </div>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #2d5a2d;">
                <strong>⚠️ Action Required:</strong> Please review and approve/deny this edit request.
              </p>
            </div>
          </div>
        `;
        break;

      case 'delete_request':
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #dc3545; padding-bottom: 10px;">
              🗑️ Delete Request
            </h2>
            
            <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #721c24; margin-top: 0;">Permission Request</h3>
              
              <p><strong>📄 Bill Type:</strong> ${billType || 'Credit Bill'}</p>
              <p><strong>🆔 Invoice No:</strong> ${invoiceNo || 'N/A'}</p>
              <p><strong>👤 Requested By:</strong> ${requester || 'N/A'}</p>
              <p><strong>📅 Date:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>📝 Reason:</strong> ${reason || 'Staff requested permission to delete bill'}</p>
              <p><strong>🆔 Request ID:</strong> ${notificationId || 'N/A'}</p>
            </div>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #2d5a2d;">
                <strong>⚠️ Action Required:</strong> Please review and approve/deny this delete request.
              </p>
            </div>
          </div>
        `;
        break;

      default:
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #764ba2; padding-bottom: 10px;">
              📧 Notification
            </h2>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #764ba2; margin-top: 0;">General Notification</h3>
              
              <p><strong>📅 Date:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>📝 Message:</strong> ${message || 'No message provided'}</p>
              ${data.details ? `<p><strong>🔍 Details:</strong> ${data.details}</p>` : ''}
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
              <p>This is an automated notification from Wyenfos Bills System</p>
            </div>
          </div>
        `;
    }

    // Add priority indicator to subject
    if (priority === 'high') {
      emailSubject = `🚨 URGENT: ${emailSubject}`;
    } else if (priority === 'low') {
      emailSubject = `📧 ${emailSubject}`;
    }

    const mailOptions = {
      from: process.env.MAIL_USER,
      to: to,
      subject: emailSubject,
      html: emailContent,
      attachments: attachments
    };

    const result = await transporter.sendMail(mailOptions);
    // console.log('✅ Notification email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    // console.error('❌ Notification email sending failed:', error);
    return { success: false, error: error.message };
  }
};

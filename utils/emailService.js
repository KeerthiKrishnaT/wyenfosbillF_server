import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter for sending emails
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD // Use app password for Gmail
    }
  });
};

// Send email function
export const sendEmail = async (to, subject, htmlContent) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Send reminder notification email
export const sendReminderEmail = async (to, reminderData) => {
  try {
    const subject = `🔔 EMI Reminder: ${reminderData.title}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>EMI Payment Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .reminder-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #007bff; }
          .urgent { border-left-color: #dc3545; }
          .warning { border-left-color: #ffc107; }
          .normal { border-left-color: #28a745; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          .amount { font-size: 24px; font-weight: bold; color: #007bff; }
          .due-date { font-size: 18px; font-weight: bold; color: #dc3545; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 EMI Payment Reminder</h1>
            <p>Automated reminder for upcoming EMI payments</p>
          </div>
          
          <div class="content">
            <div class="reminder-details ${getUrgencyClass(reminderData.reminderDate)}">
              <h2>${reminderData.title}</h2>
              <p><strong>Customer:</strong> ${reminderData.customerName}</p>
              <p><strong>Due Date:</strong> <span class="due-date">${formatDate(reminderData.reminderDate)}</span></p>
              <p><strong>Amount Due:</strong> <span class="amount">₹${reminderData.amount?.toFixed(2) || '0.00'}</span></p>
              <p><strong>Description:</strong> ${reminderData.description}</p>
              ${reminderData.billType ? `<p><strong>Bill Type:</strong> ${reminderData.billType}</p>` : ''}
              ${reminderData.billId ? `<p><strong>Bill ID:</strong> ${reminderData.billId}</p>` : ''}
            </div>
            
            <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <h3>📋 Action Required</h3>
              <ul>
                <li>Contact the customer to confirm payment</li>
                <li>Update payment status in the system</li>
                <li>Send payment confirmation if received</li>
                <li>Follow up if payment is delayed</li>
              </ul>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <h3>⚠️ Important Notes</h3>
              <p>This is an automated reminder. Please ensure timely follow-up to maintain good customer relationships and cash flow.</p>
            </div>
          </div>
          
          <div class="footer">
            <p>This email was sent automatically by the Wyenfos Billing System</p>
            <p>Please do not reply to this email. Contact your system administrator for support.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmail(to, subject, htmlContent);
  } catch (error) {
    console.error('Error sending reminder email:', error);
    throw error;
  }
};

// Helper function to determine urgency class
const getUrgencyClass = (reminderDate) => {
  const today = new Date();
  const dueDate = new Date(reminderDate);
  const diffTime = dueDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'urgent';
  if (diffDays <= 3) return 'urgent';
  if (diffDays <= 7) return 'warning';
  return 'normal';
};

// Helper function to format date
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
};

// Send bulk reminder emails
export const sendBulkReminderEmails = async (reminders, staffEmail) => {
  try {
    const results = [];
    
    for (const reminder of reminders) {
      try {
        const result = await sendReminderEmail(staffEmail, reminder);
        results.push({ reminderId: reminder.id, success: true, result });
      } catch (error) {
        results.push({ reminderId: reminder.id, success: false, error: error.message });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error sending bulk reminder emails:', error);
    throw error;
  }
};

// Send daily reminder summary
export const sendDailyReminderSummary = async (to, summaryData) => {
  try {
    const subject = `📊 Daily EMI Reminder Summary - ${new Date().toLocaleDateString()}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Daily EMI Reminder Summary</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; }
          .summary-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
          .stat-card { background: white; padding: 15px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .stat-number { font-size: 24px; font-weight: bold; }
          .urgent { color: #dc3545; }
          .warning { color: #ffc107; }
          .normal { color: #28a745; }
          .reminder-list { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .reminder-item { background: white; padding: 10px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #007bff; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Daily EMI Reminder Summary</h1>
            <p>${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          
          <div class="summary-stats">
            <div class="stat-card">
              <div class="stat-number urgent">${summaryData.overdue}</div>
              <div>Overdue</div>
            </div>
            <div class="stat-card">
              <div class="stat-number warning">${summaryData.urgent}</div>
              <div>Urgent (1-3 days)</div>
            </div>
            <div class="stat-card">
              <div class="stat-number normal">${summaryData.upcoming}</div>
              <div>Upcoming (4-7 days)</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">₹${summaryData.totalAmount?.toFixed(2) || '0.00'}</div>
              <div>Total Amount Due</div>
            </div>
          </div>
          
          <div class="reminder-list">
            <h3>📋 Reminders Requiring Attention</h3>
            ${summaryData.reminders.map(reminder => `
              <div class="reminder-item">
                <strong>${reminder.customerName}</strong> - ₹${reminder.amount?.toFixed(2) || '0.00'} 
                (${getDaysUntil(reminder.reminderDate)})
              </div>
            `).join('')}
          </div>
          
          <div style="text-align: center; margin: 20px 0;">
            <p><em>Please review and take necessary action on these reminders.</em></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmail(to, subject, htmlContent);
  } catch (error) {
    console.error('Error sending daily reminder summary:', error);
    throw error;
  }
};

// Helper function to get days until due
const getDaysUntil = (dateString) => {
  const today = new Date();
  const dueDate = new Date(dateString);
  const diffTime = dueDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays} days`;
};

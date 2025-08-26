import { reminderService } from '../models/Reminder.js';
import { sendEmail, sendReminderEmail } from '../utils/emailService.js';

export const createReminder = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      reminderDate, 
      customerName, 
      customerId, 
      billId, 
      billType, 
      amount, 
      company, 
      createdBy 
    } = req.body;

    // Validate required fields
    if (!title || !reminderDate || !customerName || !company || !createdBy) {
      return res.status(400).json({ 
        message: 'Missing required fields: title, reminderDate, customerName, company, createdBy' 
      });
    }

    const reminderData = {
      title,
      description: description || '',
      reminderDate: new Date(reminderDate),
      customerName,
      customerId: customerId || '',
      billId: billId || '',
      billType: billType || '',
      amount: amount || 0,
      company,
      createdBy,
      isSent: false,
      isActive: true
    };

    const reminder = await reminderService.createReminder(reminderData);
    res.status(201).json(reminder);
  } catch (error) {
    console.error('createReminder Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getReminders = async (req, res) => {
  try {
    const { company } = req.query;
    
    if (!company) {
      return res.status(400).json({ message: 'Company parameter is required' });
    }

    const reminders = await reminderService.getRemindersByCompany(company);
    res.status(200).json(reminders);
  } catch (error) {
    console.error('getReminders Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getUpcomingReminders = async (req, res) => {
  try {
    const { company } = req.query;
    
    if (!company) {
      return res.status(400).json({ message: 'Company parameter is required' });
    }

    const reminders = await reminderService.getUpcomingReminders(company);
    res.status(200).json(reminders);
  } catch (error) {
    console.error('getUpcomingReminders Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getOverdueReminders = async (req, res) => {
  try {
    const { company } = req.query;
    
    if (!company) {
      return res.status(400).json({ message: 'Company parameter is required' });
    }

    const reminders = await reminderService.getOverdueReminders(company);
    res.status(200).json(reminders);
  } catch (error) {
    console.error('getOverdueReminders Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const reminder = await reminderService.updateReminder(id, updateData);
    res.status(200).json(reminder);
  } catch (error) {
    console.error('updateReminder Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteReminder = async (req, res) => {
  try {
    const { id } = req.params;
    
    await reminderService.deleteReminder(id);
    res.status(200).json({ message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('deleteReminder Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const markReminderSent = async (req, res) => {
  try {
    const { id } = req.params;
    
    await reminderService.markReminderSent(id);
    res.status(200).json({ message: 'Reminder marked as sent' });
  } catch (error) {
    console.error('markReminderSent Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const sendReminderNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { staffEmail, staffName, includeSuperAdmin = true } = req.body;

    // Get reminder details
    const reminders = await reminderService.getAllReminders();
    const reminder = reminders.find(r => r.id === id);
    
    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    const notificationResults = [];

    // Send email notification to staff
    try {
      await sendReminderEmail(staffEmail, reminder);
      notificationResults.push({ 
        recipient: 'staff', 
        email: staffEmail, 
        success: true 
      });
    } catch (error) {
      notificationResults.push({ 
        recipient: 'staff', 
        email: staffEmail, 
        success: false, 
        error: error.message 
      });
    }

    // Send notification to super admin if requested
    if (includeSuperAdmin) {
      try {
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@wyenfos.com';
        await sendReminderEmail(superAdminEmail, reminder);
        notificationResults.push({ 
          recipient: 'super_admin', 
          email: superAdminEmail, 
          success: true 
        });
      } catch (error) {
        notificationResults.push({ 
          recipient: 'super_admin', 
          email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@wyenfos.com', 
          success: false, 
          error: error.message 
        });
      }
    }
    
    // Mark reminder as sent
    await reminderService.markReminderSent(id);
    
    res.status(200).json({ 
      message: 'Reminder notifications sent successfully',
      reminder: reminder,
      notifications: notificationResults
    });
  } catch (error) {
    console.error('sendReminderNotification Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const createEMIReminder = async (req, res) => {
  try {
    const { 
      customerName, 
      customerId, 
      billId, 
      billType, 
      emiAmount, 
      emiDate, 
      company, 
      createdBy,
      totalEmis,
      currentEmiNumber
    } = req.body;

    // Validate required fields
    if (!customerName || !emiDate || !company || !createdBy || !emiAmount) {
      return res.status(400).json({ 
        message: 'Missing required fields: customerName, emiDate, company, createdBy, emiAmount' 
      });
    }

    const reminderData = {
      title: `EMI Payment - ${customerName}`,
      description: `EMI ${currentEmiNumber || 1} of ${totalEmis || 'N/A'} - ${billType} (${billId})`,
      reminderDate: new Date(emiDate),
      customerName,
      customerId: customerId || '',
      billId: billId || '',
      billType: billType || '',
      amount: emiAmount,
      company,
      createdBy,
      isSent: false,
      isActive: true,
      reminderType: 'EMI',
      totalEmis: totalEmis || 1,
      currentEmiNumber: currentEmiNumber || 1
    };

    const reminder = await reminderService.createReminder(reminderData);
    res.status(201).json(reminder);
  } catch (error) {
    console.error('createEMIReminder Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Send notification to super admin only
export const sendSuperAdminNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { superAdminEmail } = req.body;

    // Get reminder details
    const reminders = await reminderService.getAllReminders();
    const reminder = reminders.find(r => r.id === id);
    
    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    const emailToUse = superAdminEmail || process.env.SUPER_ADMIN_EMAIL || 'superadmin@wyenfos.com';

    // Send email notification to super admin
    await sendReminderEmail(emailToUse, reminder);
    
    res.status(200).json({ 
      message: 'Super admin notification sent successfully',
      reminder: reminder,
      sentTo: emailToUse
    });
  } catch (error) {
    console.error('sendSuperAdminNotification Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Send bulk notifications to super admin
export const sendBulkSuperAdminNotifications = async (req, res) => {
  try {
    const { company, superAdminEmail } = req.body;
    
    if (!company) {
      return res.status(400).json({ message: 'Company parameter is required' });
    }

    const emailToUse = superAdminEmail || process.env.SUPER_ADMIN_EMAIL || 'superadmin@wyenfos.com';

    // Get all active reminders for the company
    const reminders = await reminderService.getRemindersByCompany(company);
    
    const results = [];
    
    for (const reminder of reminders) {
      try {
        await sendReminderEmail(emailToUse, reminder);
        results.push({ 
          reminderId: reminder.id, 
          success: true, 
          customerName: reminder.customerName 
        });
      } catch (error) {
        results.push({ 
          reminderId: reminder.id, 
          success: false, 
          error: error.message,
          customerName: reminder.customerName 
        });
      }
    }
    
    res.status(200).json({ 
      message: 'Bulk super admin notifications sent',
      totalReminders: reminders.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results,
      sentTo: emailToUse
    });
  } catch (error) {
    console.error('sendBulkSuperAdminNotifications Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Test function to create a sample reminder
export const createTestReminder = async (req, res) => {
  try {
    const { company, staffEmail, includeSuperAdmin = true } = req.body;
    
    if (!company || !staffEmail) {
      return res.status(400).json({ 
        message: 'Missing required fields: company, staffEmail' 
      });
    }

    // Create a test reminder for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const testReminderData = {
      title: 'Test EMI Payment - John Doe',
      description: 'EMI 1 of 12 - CreditBill (TEST-001)',
      reminderDate: tomorrow,
      customerName: 'John Doe',
      customerId: 'CUST-TEST-001',
      billId: 'TEST-001',
      billType: 'CreditBill',
      amount: 5000.00,
      company,
      createdBy: staffEmail,
      isSent: false,
      isActive: true,
      reminderType: 'EMI',
      totalEmis: 12,
      currentEmiNumber: 1
    };

    const reminder = await reminderService.createReminder(testReminderData);
    
    const notificationResults = [];

    // Send test email to staff
    try {
      await sendReminderEmail(staffEmail, reminder);
      notificationResults.push({ 
        recipient: 'staff', 
        email: staffEmail, 
        success: true 
      });
    } catch (error) {
      notificationResults.push({ 
        recipient: 'staff', 
        email: staffEmail, 
        success: false, 
        error: error.message 
      });
    }

    // Send test email to super admin if requested
    if (includeSuperAdmin) {
      try {
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@wyenfos.com';
        await sendReminderEmail(superAdminEmail, reminder);
        notificationResults.push({ 
          recipient: 'super_admin', 
          email: superAdminEmail, 
          success: true 
        });
      } catch (error) {
        notificationResults.push({ 
          recipient: 'super_admin', 
          email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@wyenfos.com', 
          success: false, 
          error: error.message 
        });
      }
    }
    
    res.status(201).json({ 
      message: 'Test reminder created and notifications sent successfully',
      reminder: reminder,
      notifications: notificationResults
    });
  } catch (error) {
    console.error('createTestReminder Error:', error);
    res.status(500).json({ message: error.message });
  }
};

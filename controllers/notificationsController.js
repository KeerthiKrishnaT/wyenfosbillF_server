import { 
  firebaseService, 
  billService 
} from '../services/firebaseService.js';
import { sendNotificationEmail } from '../services/emailService.js';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'Wyenfos014@gmail.com',
    pass: 'tkgj nnno fhru zcvb',
  },
  tls: { ciphers: 'SSLv3' },
  family: 4,
});

export const requestEdit = async (req, res) => {
  try {
    const { type, billType, billId, billData, requestedBy, requestedByRole, reason, status } = req.body;
    const userEmail = req.user.email;

    console.log('Permission request received:', {
      type,
      billType,
      billId,
      requestedBy,
      requestedByRole,
      reason,
      status
    });

    // Create notification data
    const notificationData = {
      type: type || 'edit_request',
      billType: billType || 'creditbill',
      billId: billId,
      billData: billData,
      userEmail: requestedBy || userEmail,
      userRole: requestedByRole || req.user.role,
      reason: reason || 'Permission request',
      status: status || 'pending',
      requestedAt: new Date(),
      createdAt: new Date()
    };

    console.log('Creating notification with data:', notificationData);

    const notification = await firebaseService.create('notifications', notificationData);

    // Send email notification to admin
    try {
      await sendNotificationEmail({
        type: type || 'edit_request',
        billType: billType || 'creditbill',
        invoiceNo: billData?.invoiceNo || 'N/A',
        recipient: process.env.ADMIN_EMAIL || 'admin@wyenfos.com',
        requester: requestedBy || userEmail,
        notificationId: notification.id,
        reason: reason
      });
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({ 
      success: true,
      message: `${type === 'delete_request' ? 'Delete' : 'Edit'} request sent to admin`,
      requestId: notification.id
    });
  } catch (error) {
    console.error('Error sending permission request:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send permission request', 
      error: error.message 
    });
  }
};

export const requestDelete = async (req, res) => {
  try {
    const { invoiceNo } = req.body;
    const userEmail = req.user.email;

    const cashBills = await billService.getCashBills();
    const bill = cashBills.find(bill => bill.invoiceNumber === invoiceNo);
    
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    if (bill.createdBy !== userEmail && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Unauthorized to delete this bill' });
    }

    const notificationData = {
      type: 'delete_request',
      invoiceNo,
      userEmail,
      billId: bill.id,
      requestedAt: new Date(),
      status: 'pending',
      createdAt: new Date()
    };

    const notification = await firebaseService.create('notifications', notificationData);

    await sendNotificationEmail({
      type: 'delete_request',
      invoiceNo,
      requester: userEmail,
      notificationId: notification.id
    });

    res.status(201).json({ 
      message: 'Delete request sent to admin',
      requestId: notification.id
    });
  } catch (error) {
    console.error('Error sending delete request:', error);
    res.status(500).json({ message: 'Failed to send delete request', error: error.message });
  }
};

export const getPendingRequests = async (req, res) => {
  try {
    const requests = await firebaseService.getWhere('notifications', 'status', '==', 'pending');
    
    // Sort by creation date (newest first)
    requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ message: 'Failed to fetch requests', error: error.message });
  }
};

export const processRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, reason } = req.body;
    const adminEmail = req.user.email;

    const notification = await firebaseService.getById('notifications', requestId);
    if (!notification) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (notification.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    // Update notification status
    const updateData = {
      status: action === 'approve' ? 'approved' : 'rejected',
      processedBy: adminEmail,
      processedAt: new Date(),
      reason: reason || '',
      updatedAt: new Date()
    };
    
    await firebaseService.update('notifications', requestId, updateData);

    if (action === 'approve') {
      if (notification.type === 'edit_request') {
        // Apply the edit
        const updatedBill = await billService.updateBill(notification.billId, notification.updatedBillData);
        await sendNotificationEmail({
          type: 'edit_approved',
          invoiceNo: notification.invoiceNo,
          recipient: notification.userEmail
        });
        return res.json({ message: 'Edit applied successfully', bill: updatedBill });
      } else {
        // Delete the bill
        await billService.deleteBill(notification.billId);
        await sendNotificationEmail({
          type: 'delete_approved',
          invoiceNo: notification.invoiceNo,
          recipient: notification.userEmail
        });
        return res.json({ message: 'Bill deleted successfully' });
      }
    } else {
      await sendNotificationEmail({
        type: 'request_rejected',
        invoiceNo: notification.invoiceNo,
        recipient: notification.userEmail,
        reason
      });
      return res.json({ message: 'Request rejected' });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ message: 'Failed to process request', error: error.message });
  }
};

export const checkRequestStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const notification = await firebaseService.getById('notifications', requestId);
    
    if (!notification) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Verify user owns this request
    if (notification.userEmail !== req.user.email && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Unauthorized to view this request' });
    }

    res.status(200).json({
      status: notification.status,
      processedAt: notification.processedAt,
      processedBy: notification.processedBy,
      reason: notification.reason
    });
  } catch (error) {
    console.error('Error checking request status:', error);
    res.status(500).json({ message: 'Failed to check status', error: error.message });
  }
};

// New notification endpoints for direct email notifications
export const sendEditRequest = async (req, res) => {
  try {
    const { billId, billNumber, customerName, requestedBy, requestedByRole, billType } = req.body;

    if (!billId || !billNumber || !requestedBy) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // Email to admin
    const adminEmail = 'admin@wyenfos.com'; // Replace with actual admin email
    const mailOptions = {
      from: 'Wyenfos014@gmail.com',
      to: adminEmail,
      subject: `Edit Request - ${billType.toUpperCase()} ${billNumber}`,
      html: `
        <h2>Edit Request Notification</h2>
        <p><strong>Bill Type:</strong> ${billType.toUpperCase()}</p>
        <p><strong>Bill Number:</strong> ${billNumber}</p>
        <p><strong>Customer:</strong> ${customerName}</p>
        <p><strong>Requested By:</strong> ${requestedBy} (${requestedByRole})</p>
        <p><strong>Request Time:</strong> ${new Date().toLocaleString('en-IN')}</p>
        <br>
        <p>Please review and approve/reject this edit request.</p>
        <br>
        <p><strong>Approve:</strong> <a href="http://localhost:3000/admin/approve-edit/${billId}">Click here to approve</a></p>
        <p><strong>Reject:</strong> <a href="http://localhost:3000/admin/reject-edit/${billId}">Click here to reject</a></p>
      `
    };

    await transporter.sendMail(mailOptions);

    // Email to staff (confirmation)
    const staffMailOptions = {
      from: 'Wyenfos014@gmail.com',
      to: requestedBy,
      subject: `Edit Request Sent - ${billType.toUpperCase()} ${billNumber}`,
      html: `
        <h2>Edit Request Confirmation</h2>
        <p>Your edit request has been sent to the admin for approval.</p>
        <p><strong>Bill Type:</strong> ${billType.toUpperCase()}</p>
        <p><strong>Bill Number:</strong> ${billNumber}</p>
        <p><strong>Customer:</strong> ${customerName}</p>
        <p><strong>Request Time:</strong> ${new Date().toLocaleString('en-IN')}</p>
        <br>
        <p>You will be notified once the admin approves or rejects your request.</p>
      `
    };

    await transporter.sendMail(staffMailOptions);

    res.json({ 
      success: true, 
      message: 'Edit request notification sent successfully' 
    });

  } catch (error) {
    console.error('sendEditRequest Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send edit request notification',
      error: error.message 
    });
  }
};

export const sendDeleteRequest = async (req, res) => {
  try {
    const { billId, billNumber, customerName, requestedBy, requestedByRole, billType } = req.body;

    if (!billId || !billNumber || !requestedBy) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // Email to admin
    const adminEmail = 'admin@wyenfos.com'; // Replace with actual admin email
    const mailOptions = {
      from: 'Wyenfos014@gmail.com',
      to: adminEmail,
      subject: `Delete Request - ${billType.toUpperCase()} ${billNumber}`,
      html: `
        <h2>Delete Request Notification</h2>
        <p><strong>Bill Type:</strong> ${billType.toUpperCase()}</p>
        <p><strong>Bill Number:</strong> ${billNumber}</p>
        <p><strong>Customer:</strong> ${customerName}</p>
        <p><strong>Requested By:</strong> ${requestedBy} (${requestedByRole})</p>
        <p><strong>Request Time:</strong> ${new Date().toLocaleString('en-IN')}</p>
        <br>
        <p>Please review and approve/reject this delete request.</p>
        <br>
        <p><strong>Approve:</strong> <a href="http://localhost:3000/admin/approve-delete/${billId}">Click here to approve</a></p>
        <p><strong>Reject:</strong> <a href="http://localhost:3000/admin/reject-delete/${billId}">Click here to reject</a></p>
      `
    };

    await transporter.sendMail(mailOptions);

    // Email to staff (confirmation)
    const staffMailOptions = {
      from: 'Wyenfos014@gmail.com',
      to: requestedBy,
      subject: `Delete Request Sent - ${billType.toUpperCase()} ${billNumber}`,
      html: `
        <h2>Delete Request Confirmation</h2>
        <p>Your delete request has been sent to the admin for approval.</p>
        <p><strong>Bill Type:</strong> ${billType.toUpperCase()}</p>
        <p><strong>Bill Number:</strong> ${billNumber}</p>
        <p><strong>Customer:</strong> ${customerName}</p>
        <p><strong>Request Time:</strong> ${new Date().toLocaleString('en-IN')}</p>
        <br>
        <p>You will be notified once the admin approves or rejects your request.</p>
      `
    };

    await transporter.sendMail(staffMailOptions);

    res.json({ 
      success: true, 
      message: 'Delete request notification sent successfully' 
    });

  } catch (error) {
    console.error('sendDeleteRequest Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send delete request notification',
      error: error.message 
    });
  }
};
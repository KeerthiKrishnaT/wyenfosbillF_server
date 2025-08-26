import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { 
  firebaseService, 
  customerService, 
  billService 
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

export const getPaymentReceipts = async (req, res) => {
  try {
    const receipts = await firebaseService.getAll('paymentReceipts');
    // Sort by creation date (newest first)
    receipts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(receipts);
  } catch (error) {
    console.error('Error fetching payment receipts:', error);
    res.status(500).json({ error: 'Failed to fetch payment receipts' });
  }
};

// Get a single payment receipt by ID
export const getPaymentReceiptById = async (req, res) => {
  try {
    const receipt = await firebaseService.getById('paymentReceipts', req.params.id);

    if (!receipt) {
      return res.status(404).json({ message: 'Payment receipt not found' });
    }

    // Populate customer and credit bill data
    const customer = receipt.customerId ? await customerService.getCustomerById(receipt.customerId) : null;
    const creditBill = receipt.creditBillId ? await billService.getCreditBillById(receipt.creditBillId) : null;

    const populatedReceipt = {
      ...receipt,
      customer: customer ? {
        name: customer.customerName,
        customerId: customer.customerId,
        phone: customer.customerContact?.phone,
        email: customer.customerContact?.email,
        address: customer.customerAddress,
        gstin: customer.gstin
      } : null,
      creditBill: creditBill ? {
        creditBillNo: creditBill.invoiceNumber,
        date: creditBill.createdAt,
        totalAmount: creditBill.totalAmount
      } : null
    };

    res.status(200).json({
      message: 'Payment receipt fetched successfully',
      data: populatedReceipt
    });

  } catch (error) {
    console.error('Error fetching payment receipt:', error);
    res.status(500).json({ 
      message: 'Failed to fetch payment receipt',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Generate PDF for a payment receipt
export const generatePaymentReceiptPDF = async (req, res) => {
  try {
    const receipt = await firebaseService.getById('paymentReceipts', req.params.id);

    if (!receipt) {
      return res.status(404).json({ message: 'Payment receipt not found' });
    }

    // Populate customer and credit bill data
    const customer = receipt.customerId ? await customerService.getCustomerById(receipt.customerId) : null;
    const creditBill = receipt.creditBillId ? await billService.getCreditBillById(receipt.creditBillId) : null;

    // In a real implementation, you would generate the PDF here
    // For example using pdfkit or jspdf
    const pdfBuffer = await generatePDF(receipt, customer, creditBill);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=PaymentReceipt_${receipt.receiptNo}.pdf`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ 
      message: 'Failed to generate PDF',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const sendReceiptEmail = async (req, res) => {
  try {
    const { emailTo, subject, body } = req.body;
    const receiptId = req.params.id; // Get receiptId from URL params
    const userEmail = req.user?.email;

    // 1. Validate input
    if (!receiptId || !emailTo) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['receiptId', 'emailTo']
      });
    }

    // 2. Get receipt data
    const receipt = await firebaseService.getById('paymentReceipts', receiptId);
    if (!receipt) {
      return res.status(404).json({ message: 'Payment receipt not found' });
    }

    // Populate customer and credit bill data
    const customer = receipt.customerId ? await customerService.getCustomerById(receipt.customerId) : null;
    const creditBill = receipt.creditBillId ? await billService.getCreditBillById(receipt.creditBillId) : null;

    // 3. Generate PDF
    const tempDir = path.join(__dirname, '..', 'temp');
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const pdfPath = path.join(tempDir, `receipt_${receipt.id}.pdf`);
    await generateReceiptPDF(receipt, customer, creditBill, pdfPath);

    // 4. Configure email transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    // 5. Send email
    const mailOptions = {
      from: `"Wyenfos Bills" <${process.env.MAIL_USER}>`,
      to: emailTo,
      subject: subject || `Payment Receipt ${receipt.receiptNo}`,
      text: body || `Dear ${customer?.customerName || 'Customer'},\n\nPlease find attached your payment receipt.`,
      attachments: [{
        filename: `Payment_Receipt_${receipt.receiptNo}.pdf`,
        path: pdfPath
      }]
    };

    await transporter.sendMail(mailOptions);

    // 6. Clean up temporary file
    fs.unlinkSync(pdfPath);

    res.status(200).json({
      message: 'Email sent successfully',
      data: {
        sentTo: emailTo,
        receiptId: receipt.id
      }
    });

  } catch (error) {
    console.error('Error sending receipt email:', error);
    res.status(500).json({ 
      message: 'Failed to send email',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Send email for temporary receipt (new receipt not yet saved)
export const sendTempReceiptEmail = async (req, res) => {
  try {
    const { emailTo, subject, body, receiptData } = req.body;
    const userEmail = req.user?.email;

    // 1. Validate input
    if (!emailTo || !receiptData) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['emailTo', 'receiptData']
      });
    }

    // 2. Configure email transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    // 3. Generate PDF for temporary receipt
    const tempDir = path.join(__dirname, '..', 'temp');
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const pdfPath = path.join(tempDir, `temp_receipt_${Date.now()}.pdf`);
    await generateReceiptPDF(receiptData, null, null, pdfPath);

    // 4. Send email
    const mailOptions = {
      from: `"Wyenfos Bills" <${process.env.MAIL_USER}>`,
      to: emailTo,
      subject: subject || `Payment Receipt ${receiptData.receiptNo}`,
      text: body || `Dear ${receiptData.customerName || 'Customer'},\n\nPlease find attached your payment receipt.`,
      attachments: [{
        filename: `Payment_Receipt_${receiptData.receiptNo}.pdf`,
        path: pdfPath
      }]
    };

    await transporter.sendMail(mailOptions);

    // 5. Clean up temporary file
    fs.unlinkSync(pdfPath);

    res.status(200).json({
      message: 'Email sent successfully',
      data: {
        sentTo: emailTo,
        receiptNumber: receiptData.receiptNo
      }
    });

  } catch (error) {
    console.error('Error sending temporary receipt email:', error);
    res.status(500).json({ 
      message: 'Failed to send email',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Send email with PDF generated on frontend (ensures same format as download/print)
export const sendEmailWithPDF = async (req, res) => {
  try {
    const { emailTo, subject, body, pdfBase64, receiptData, receiptId } = req.body;
    const userEmail = req.user?.email;

    // 1. Validate input
    if (!emailTo || !pdfBase64) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['emailTo', 'pdfBase64']
      });
    }

    // 2. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTo)) {
      return res.status(400).json({ 
        message: 'Invalid email format'
      });
    }

    // 3. Configure email transporter with timeout
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,   // 10 seconds
      socketTimeout: 30000      // 30 seconds
    });

    // 4. Convert base64 PDF to buffer (with size validation)
    if (pdfBase64.length > 25 * 1024 * 1024) { // Increased to 25MB limit
      return res.status(400).json({ 
        message: 'PDF file too large (max 25MB). Please try generating a smaller PDF or contact support.',
        fileSize: `${(pdfBase64.length / (1024 * 1024)).toFixed(2)}MB`
      });
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // 5. Send email with PDF attachment
    const mailOptions = {
      from: `"Wyenfos Bills" <${process.env.MAIL_USER}>`,
      to: emailTo,
      subject: subject || `Payment Receipt ${receiptData?.receiptNo || receiptId || 'Unknown'}`,
      text: body || `Dear Customer,\n\nPlease find attached your payment receipt.`,
      attachments: [{
        filename: `Payment_Receipt_${receiptData?.receiptNo || receiptId || 'Unknown'}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    };

    // Send email with timeout
    const sendMailPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email sending timed out')), 25000)
    );

    await Promise.race([sendMailPromise, timeoutPromise]);

    res.status(200).json({
      message: 'Email sent successfully',
      data: {
        sentTo: emailTo,
        receiptNumber: receiptData?.receiptNo || receiptId || 'Unknown'
      }
    });

  } catch (error) {
    console.error('Error sending email with PDF:', error);
    
    if (error.message.includes('timed out')) {
      res.status(408).json({ 
        message: 'Email sending timed out. Please try again.',
        error: error.message
      });
    } else if (error.code === 'EAUTH') {
      res.status(500).json({ 
        message: 'Email authentication failed. Please check email configuration.',
        error: 'Authentication error'
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to send email',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
};

// Send email without PDF attachment (for large files)
export const sendEmailWithoutPDF = async (req, res) => {
  try {
    const { emailTo, subject, body, receiptData, receiptId } = req.body;
    const userEmail = req.user?.email;

    // 1. Validate input
    if (!emailTo) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['emailTo']
      });
    }

    // 2. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTo)) {
      return res.status(400).json({ 
        message: 'Invalid email format'
      });
    }

    // 3. Configure email transporter with timeout
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,   // 10 seconds
      socketTimeout: 30000      // 30 seconds
    });

    // 4. Send email without PDF attachment
    const mailOptions = {
      from: `"Wyenfos Bills" <${process.env.MAIL_USER}>`,
      to: emailTo,
      subject: subject || `Payment Receipt ${receiptData?.receiptNo || receiptId || 'Unknown'}`,
      text: body || `Dear Customer,\n\nYour payment receipt has been generated.\n\nDue to file size limitations, the PDF attachment could not be included in this email.\n\nPlease download your receipt from the application or contact us for assistance.\n\nThank you for your business!`
    };

    // Send email with timeout
    const sendMailPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email sending timed out')), 25000)
    );

    await Promise.race([sendMailPromise, timeoutPromise]);

    res.status(200).json({
      message: 'Email sent successfully (without PDF attachment)',
      data: {
        sentTo: emailTo,
        receiptNumber: receiptData?.receiptNo || receiptId || 'Unknown'
      }
    });

  } catch (error) {
    console.error('Error sending email without PDF:', error);
    
    if (error.message.includes('timed out')) {
      res.status(408).json({ 
        message: 'Email sending timed out. Please try again.',
        error: error.message
      });
    } else if (error.code === 'EAUTH') {
      res.status(500).json({ 
        message: 'Email authentication failed. Please check email configuration.',
        error: 'Authentication error'
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to send email',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
};

// Helper function to generate PDF
async function generateReceiptPDF(receipt, customer, creditBill, outputPath) {
  const doc = new jsPDF();
  
  // Add your PDF generation logic here
  doc.text(`Payment Receipt: ${receipt.receiptNo}`, 10, 10);
  doc.text(`Customer: ${customer?.customerName || receipt.customerName || 'N/A'}`, 10, 20);
  doc.text(`Amount: ₹${receipt.amount.toFixed(2)}`, 10, 30);
  doc.text(`Date: ${new Date(receipt.date).toLocaleDateString('en-IN')}`, 10, 40);
  
  // Add more receipt details if available
  if (receipt.metadata?.remarks) {
    doc.text(`Remarks: ${receipt.metadata.remarks}`, 10, 50);
  }
  
  if (receipt.metadata?.totalProductAmount) {
    doc.text(`Total Product Amount: ₹${receipt.metadata.totalProductAmount.toFixed(2)}`, 10, 60);
  }
  
  if (receipt.metadata?.totalPaidAmount) {
    doc.text(`Total Paid Amount: ₹${receipt.metadata.totalPaidAmount.toFixed(2)}`, 10, 70);
  }

  // Save to file
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(outputPath, pdfBuffer);
}

// Helper function for PDF generation
async function generatePDF(receipt, customer, creditBill) {
  // Implement your PDF generation logic here
  // This is just a placeholder
  return Buffer.from(`PDF content for receipt ${receipt.receiptNo}`);
}

export const updatePaymentReceipt = async (req, res) => {
  try {
    // Verify admin permission
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Permission denied. Only admins can update payment receipts.',
        action: 'request_change'
      });
    }

    const { id } = req.params;
    const updateData = {
      ...req.body,
      lastUpdatedBy: req.user.email,
      lastUpdatedAt: new Date()
    };

    const receipt = await firebaseService.update('paymentReceipts', id, updateData);

    if (!receipt) {
      return res.status(404).json({ message: 'Payment receipt not found' });
    }

    // Create notification
    await firebaseService.create('notifications', {
      type: 'receipt_updated',
      receiptId: receipt.id,
      userId: req.user.id,
      details: {
        changes: updateData,
        previousValues: receipt
      },
      timestamp: new Date(),
      createdAt: new Date()
    });

    res.status(200).json({
      message: 'Payment receipt updated successfully',
      data: receipt
    });

  } catch (error) {
    console.error('Error updating payment receipt:', error);
    res.status(500).json({ 
      message: 'Failed to update payment receipt',
      error: error.message
    });
  }
};

export const deletePaymentReceipt = async (req, res) => {
  try {
    // Verify admin permission
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Permission denied. Only admins can delete payment receipts.',
        action: 'request_change'
      });
    }

    const receipt = await firebaseService.delete('paymentReceipts', req.params.id);

    if (!receipt) {
      return res.status(404).json({ message: 'Payment receipt not found' });
    }

    // Create notification
    await firebaseService.create('notifications', {
      type: 'receipt_deleted',
      receiptId: req.params.id,
      userId: req.user.id,
      details: {
        receiptDetails: receipt
      },
      timestamp: new Date(),
      createdAt: new Date()
    });

    res.status(200).json({
      message: 'Payment receipt deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting payment receipt:', error);
    res.status(500).json({ 
      message: 'Failed to delete payment receipt',
      error: error.message
    });
  }
};

export const requestChange = async (req, res) => {
  try {
    const { receiptId, changes, reason } = req.body;

    if (!receiptId || !changes) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['receiptId', 'changes']
      });
    }

    // Verify receipt exists
    const receipt = await firebaseService.getById('paymentReceipts', receiptId);
    if (!receipt) {
      return res.status(404).json({ message: 'Payment receipt not found' });
    }

    // Create change request notification
    await firebaseService.create('notifications', {
      type: 'change_request',
      receiptId,
      userId: req.user.id,
      details: {
        requestedChanges: changes,
        reason,
        status: 'pending'
      },
      timestamp: new Date(),
      createdAt: new Date()
    });

    res.status(201).json({
      message: 'Change request submitted successfully',
      data: {
        receiptId,
        requestedBy: req.user.email
      }
    });

  } catch (error) {
    console.error('Error submitting change request:', error);
    res.status(500).json({ 
      message: 'Failed to submit change request',
      error: error.message
    });
  }
};

export const getLastReceipt = async (req, res) => {
  try {
    const receipts = await firebaseService.getAll('paymentReceipts');
    const lastReceipt = receipts.sort((a, b) => 
      parseInt(b.receiptNumber.split('-')[1]) - parseInt(a.receiptNumber.split('-')[1])
    )[0];
    res.json(lastReceipt || {});
  } catch (error) {
    console.error('Error fetching last receipt:', error);
    res.status(500).json({ error: 'Failed to fetch last receipt' });
  }
};

export const createPaymentReceipt = async (req, res) => {
  try {
    // Get the last receipt number first
    const receipts = await firebaseService.getAll('paymentReceipts');
    const lastReceipt = receipts.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    )[0];
    
    let receiptNumber = 'PR-1'; // Default if no receipts exist
    
    if (lastReceipt) {
      const lastNumber = parseInt(lastReceipt.receiptNumber.split('-')[1]);
      receiptNumber = `PR-${lastNumber + 1}`;
    }

    const receiptData = {
      ...req.body,
      receiptNumber,
      createdBy: req.user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const savedReceipt = await firebaseService.create('paymentReceipts', receiptData);

    // Send email if email delivery is requested
    if (receiptData.metadata?.receiptDelivery?.email) {
      try {
        await sendReceiptEmailAutomatically(savedReceipt, receiptData.metadata.receiptDelivery.email);
        console.log(`Email sent successfully to ${receiptData.metadata.receiptDelivery.email}`);
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Don't fail the receipt creation if email fails
      }
    }

    res.status(201).json(savedReceipt);
  } catch (error) {
    console.error('Error creating payment receipt:', error);
    res.status(400).json({ error: 'Failed to create payment receipt' });
  }
};

// Helper function to automatically send receipt email
async function sendReceiptEmailAutomatically(receipt, emailTo) {
  try {
    console.log('📧 Starting email send process...');
    console.log('📧 Email configuration check:');
    console.log('   MAIL_USER:', process.env.MAIL_USER ? 'Set' : 'Not set');
    console.log('   MAIL_PASS:', process.env.MAIL_PASS ? 'Set (length: ' + process.env.MAIL_PASS.length + ')' : 'Not set');
    console.log('📧 Sending to:', emailTo);
    console.log('📧 Receipt data:', {
      receiptNumber: receipt.receiptNumber,
      amount: receipt.amount,
      customerId: receipt.customerId
    });
    
    // Get customer data
    const customer = receipt.customerId ? await customerService.getCustomerById(receipt.customerId) : null;
    console.log('📧 Customer data:', customer ? 'Found' : 'Not found');
    
    // Configure email transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });
    
    console.log('📧 Transporter configured successfully');

    // Create email content
    const mailOptions = {
      from: `"Wyenfos Bills" <${process.env.MAIL_USER}>`,
      to: emailTo,
      subject: `Payment Receipt ${receipt.receiptNumber} - ${customer?.customerName || 'Customer'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #997a8d;">Payment Receipt</h2>
          <p>Dear ${customer?.customerName || 'Customer'},</p>
          <p>Thank you for your payment. Please find the details below:</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Receipt Number:</strong> ${receipt.receiptNumber}</p>
            <p><strong>Date:</strong> ${new Date(receipt.date).toLocaleDateString('en-IN')}</p>
            <p><strong>Amount Paid:</strong> ₹${receipt.amount.toFixed(2)}</p>
            <p><strong>Customer ID:</strong> ${customer?.customerId || 'N/A'}</p>
          </div>
          
          <p>This is an automated email. Please contact us if you have any questions.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 12px;">
              Wyenfos Bills<br>
              This is an automated message, please do not reply.
            </p>
          </div>
        </div>
      `
    };

    console.log('📧 Sending email...');
    await transporter.sendMail(mailOptions);
    console.log(`✅ Payment receipt email sent successfully to ${emailTo}`);
    
  } catch (error) {
    console.error('❌ Error in sendReceiptEmailAutomatically:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      command: error.command
    });
    throw error;
  }
}

export const getNextReceiptNumber = async (req, res) => {
  try {
    const receipts = await firebaseService.getAll('paymentReceipts');
    const lastReceipt = receipts.sort((a, b) => 
      parseInt(b.receiptNumber.split('-')[1]) - parseInt(a.receiptNumber.split('-')[1])
    )[0];
    
    let nextNumber = 1;
    
    if (lastReceipt) {
      const lastNumber = parseInt(lastReceipt.receiptNumber.split('-')[1]);
      nextNumber = lastNumber + 1;
    }
    
    res.json({ nextNumber });
  } catch (error) {
    console.error('Error getting next receipt number:', error);
    res.status(500).json({ error: 'Failed to get next receipt number' });
  }
};
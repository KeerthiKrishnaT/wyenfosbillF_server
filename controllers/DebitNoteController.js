import { 
  userService, 
  customerService, 
  billService, 
  firebaseService 
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import QRCode from 'qrcode';

dotenv.config();
if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
  console.error('Email configuration missing: MAIL_USER and MAIL_PASS must be set in .env');
  throw new Error('Email configuration missing');
}
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Helper function to get company logo path
const getCompanyLogoPath = (companyName) => {
  const logoMap = {
    'WYENFOS INFOTECH': 'wyenfos_infotech.png',
    'WYENFOS GOLD AND DIAMONDS': 'wyenfos_gold.png',
    'WYENFOS GOLD & DIAMONDS': 'wyenfos_gold.png',
    'WYENFOS ADS': 'wyenfos_ads.png',
    'WYENFOS CASH VAPASE': 'wyenfos_cash.png',
    'AYUR FOR HERBALS INDIA': 'Ayur4life_logo.png',
    'WYENFOS': 'wyenfos.png',
    'WYENFOS PURE DROPS': 'wyenfos pure drops.png'
  };
  return logoMap[companyName] || 'wyenfos.png';
};

const withRetry = async (operation, retries = 3, backoff = 300) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw new Error(`Operation failed after ${retries} attempts: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, backoff * Math.pow(2, i)));
    }
  }
};

const checkPermission = async (req, res) => {
  try {
    const { userId, resourceId, action } = req.body;
    if (!userId || !resourceId || !action) return res.status(400).json({ message: 'Missing required fields' });

    const user = await withRetry(() => userService.getUserById(userId));
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'admin' || user.role === 'super_admin') return res.status(200).json({ hasPermission: true });

    const requests = await firebaseService.getWhere('requests', 'userId', '==', userId);
    const request = requests.find(req => 
      req.resourceId === resourceId && 
      req.action === action && 
      req.status === 'approved' && 
      new Date(req.expiresAt) > new Date()
    );
    
    res.status(200).json({ hasPermission: !!request });
  } catch (error) {
    console.error('checkPermission Error:', error);
    res.status(500).json({ message: 'Error checking permission', error: error.message });
  }
};

const requestPermission = async (req, res) => {
  try {
    const { userId, resourceId, action, reason } = req.body;
    if (!userId || !resourceId || !action || !reason) return res.status(400).json({ message: 'Missing required fields' });

    const user = await withRetry(() => userService.getUserById(userId));
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'admin' || user.role === 'super_admin') return res.status(200).json({ message: 'Permission not required' });

    const resourceLink = `/debitnotes/${resourceId}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const formattedDate = new Date().toISOString().split('T')[0];

    const requestData = {
      resourceId,
      resourceType: 'DebitNote',
      resourceLink,
      userId,
      action,
      reason,
      formattedDate,
      expiresAt,
      status: 'pending',
      createdAt: new Date()
    };

    await withRetry(() => firebaseService.create('requests', requestData));
    res.status(201).json({ message: 'Permission request created successfully' });
  } catch (error) {
    console.error('requestPermission Error:', error);
    res.status(500).json({ message: 'Error requesting permission', error: error.message });
  }
};

const getCustomerByName = async (req, res) => {
  try {
    const { query, company } = req.query;
    if (!query || query.length < 4) return res.status(400).json({ message: 'Customer name query must be at least 4 characters' });

    const customers = await customerService.getAllCustomers();
    const filteredCustomers = customers.filter(customer => {
      const customerCompanies = Array.isArray(customer.company) ? customer.company : [customer.company].filter(Boolean);
      return customer.name.toLowerCase().includes(query.toLowerCase()) &&
        (!company || customerCompanies.includes(company));
    });

    res.json(filteredCustomers);
  } catch (error) {
    console.error('getCustomerByName Error:', error);
    res.status(500).json({ message: 'Error fetching customer', error: error.message });
  }
};

const createCustomer = async (req, res) => {
  try {
    const { name, address, phone, email, company } = req.body;
    if (!name || !phone) return res.status(400).json({ message: 'Name and phone are required' });

    const customerData = {
      customerId: `CUST${generateUniqueId()}`,
      customerName: name,
      customerContact: {
        address: address || '',
        phone: phone,
        email: email || '',
        gstin: ''
      },
      company: [company || 'WYENFOS'],
      createdBy: req.user?.id || 'system',
      lastUpdatedBy: req.user?.id || 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newCustomer = await customerService.createCustomer(customerData);
    res.status(201).json(newCustomer);
  } catch (error) {
    console.error('createCustomer Error:', error);
    res.status(500).json({ message: 'Error creating customer', error: error.message });
  }
};

const createCreditBill = async (req, res) => {
  try {
    const billData = req.body;
    billData.billType = 'credit';
    billData.createdAt = new Date();
    billData.updatedAt = new Date();

    const newBill = await billService.createBill(billData);
    res.status(201).json(newBill);
  } catch (error) {
    console.error('createCreditBill Error:', error);
    res.status(500).json({ message: 'Error creating credit bill', error: error.message });
  }
};

const getCreditBills = async (req, res) => {
  try {
    const { search, company } = req.query;
    const bills = await billService.getCreditBills();
    
    // Debug: Log unique companies in credit bills
    const uniqueCompanies = [...new Set(bills.map(bill => bill.company?.name).filter(Boolean))];
    console.log('Available companies in credit bills:', uniqueCompanies);
    console.log('Total credit bills:', bills.length);
    
    let filteredBills = bills;
    
    // Filter by company if provided
    if (company) {
      console.log('Filtering credit bills by company:', company);
      filteredBills = bills.filter(bill => {
        // Check if bill has company field and matches the requested company
        return bill.company && bill.company.name === company;
      });
      console.log('Bills after company filtering:', filteredBills.length);
    }
    
    // If search parameter is provided, filter bills
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredBills = filteredBills.filter(bill => {
        // Search by invoice number, customer name, or customer ID
        return (
          (bill.invoiceNo && bill.invoiceNo.toLowerCase().includes(searchTerm)) ||
          (bill.customerName && bill.customerName.toLowerCase().includes(searchTerm)) ||
          (bill.customerId && bill.customerId.toLowerCase().includes(searchTerm))
        );
      });
    }
    
    // Return in the expected format
    res.json({ data: filteredBills });
  } catch (error) {
    console.error('getCreditBills Error:', error);
    res.status(500).json({ message: 'Error fetching credit bills', error: error.message });
  }
};

const getCreditBillById = async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await billService.getBillById(id);
    if (!bill) return res.status(404).json({ message: 'Credit bill not found' });
    res.json(bill);
  } catch (error) {
    console.error('getCreditBillById Error:', error);
    res.status(500).json({ message: 'Error fetching credit bill', error: error.message });
  }
};

const getCreditBillByName = async (req, res) => {
  try {
    const { name } = req.params;
    const bills = await billService.getCreditBills();
    const bill = bills.find(b => b.customerName === name);
    if (!bill) return res.status(404).json({ message: 'Credit bill not found' });
    res.json(bill);
  } catch (error) {
    console.error('getCreditBillByName Error:', error);
    res.status(500).json({ message: 'Error fetching credit bill', error: error.message });
  }
};

const createDebitNote = async (req, res) => {
  try {
    const debitNoteData = req.body;
    
    // Generate invoice number if not provided
    if (!debitNoteData.invoiceNumber) {
      const { company } = debitNoteData;
      if (!company?.name) {
        return res.status(400).json({ message: 'Company name is required' });
      }
      
      const companyPrefixes = {
        'WYENFOS INFOTECH': 'WIT',
        'WYENFOS GOLD AND DIAMONDS': 'WGD',
        'WYENFOS GOLD & DIAMONDS': 'WGD',
        'WYENFOS ADS': 'WAD',
        'WYENFOS CASH VAPASE': 'WCV',
        'AYUR FOR HERBALS INDIA': 'ALH',
        'WYENFOS': 'WNF',
        'WYENFOS PURE DROPS': 'WPD',
      };
      
      const prefix = companyPrefixes[company.name] || company.name.substring(0, 3).toUpperCase();
      
      // For AYUR FOR HERBALS INDIA, always start from 1 for Debit Notes
      if (company.name === 'AYUR FOR HERBALS INDIA') {
        debitNoteData.invoiceNumber = `${prefix}-1`;
      } else {
        // For other companies, use normal incrementing logic
        const debitNotes = await firebaseService.getAll('debitnotes');
        const companyDebitNotes = debitNotes.filter(note => note.company?.name === company.name);
        
        let latestNumber = 0;
        
        companyDebitNotes.forEach(note => {
          if (note.invoiceNumber && note.invoiceNumber.startsWith(prefix + '-')) {
            const numberPart = parseInt(note.invoiceNumber.split('-')[1], 10);
            if (!isNaN(numberPart) && numberPart > latestNumber) {
              latestNumber = numberPart;
            }
          }
        });
        
        const nextNumber = latestNumber + 1;
        debitNoteData.invoiceNumber = `${prefix}-${nextNumber}`;
      }
    }
    
    debitNoteData.createdAt = new Date();
    debitNoteData.updatedAt = new Date();

    const newDebitNote = await firebaseService.create('debitnotes', debitNoteData);
    res.status(201).json(newDebitNote);
  } catch (error) {
    console.error('createDebitNote Error:', error);
    res.status(500).json({ message: 'Error creating debit note', error: error.message });
  }
};

const getDebitNotes = async (req, res) => {
  try {
    const { company } = req.query;
    let debitNotes = await firebaseService.getAll('debitnotes', 'createdAt', 'desc');
    
    if (company) {
      debitNotes = debitNotes.filter(note => note.company === company);
    }
    
    res.json(debitNotes);
  } catch (error) {
    console.error('getDebitNotes Error:', error);
    res.status(500).json({ message: 'Error fetching debit notes', error: error.message });
  }
};

const getDebitNoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const debitNote = await firebaseService.getById('debitnotes', id);
    if (!debitNote) return res.status(404).json({ message: 'Debit note not found' });
    res.json(debitNote);
  } catch (error) {
    console.error('getDebitNoteById Error:', error);
    res.status(500).json({ message: 'Error fetching debit note', error: error.message });
  }
};

const updateDebitNote = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    updateData.updatedAt = new Date();

    const updatedDebitNote = await firebaseService.update('debitnotes', id, updateData);
    if (!updatedDebitNote) return res.status(404).json({ message: 'Debit note not found' });
    
    res.json(updatedDebitNote);
  } catch (error) {
    console.error('updateDebitNote Error:', error);
    res.status(500).json({ message: 'Error updating debit note', error: error.message });
  }
};

const deleteDebitNote = async (req, res) => {
  try {
    const { id } = req.params;
    
    const existingDebitNote = await firebaseService.getById('debitnotes', id);
    if (!existingDebitNote) return res.status(404).json({ message: 'Debit note not found' });

    await firebaseService.delete('debitnotes', id);
    res.json({ message: 'Debit note deleted successfully' });
  } catch (error) {
    console.error('deleteDebitNote Error:', error);
    res.status(500).json({ message: 'Error deleting debit note', error: error.message });
  }
};

const createPaymentReceipt = async (req, res) => {
  try {
    const receiptData = req.body;
    receiptData.createdAt = new Date();
    receiptData.updatedAt = new Date();

    const newReceipt = await firebaseService.create('paymentReceipts', receiptData);
    res.status(201).json(newReceipt);
  } catch (error) {
    console.error('createPaymentReceipt Error:', error);
    res.status(500).json({ message: 'Error creating payment receipt', error: error.message });
  }
};

const getPaymentReceipts = async (req, res) => {
  try {
    const receipts = await firebaseService.getAll('paymentReceipts', 'createdAt', 'desc');
    res.json(receipts);
  } catch (error) {
    console.error('getPaymentReceipts Error:', error);
    res.status(500).json({ message: 'Error fetching payment receipts', error: error.message });
  }
};

const getLatestInvoiceNumber = async (req, res) => {
  try {
    const { company } = req.query;
    if (!company) {
      return res.status(400).json({ message: 'Company is required' });
    }
    
    const companyPrefixes = {
      'WYENFOS INFOTECH': 'WIT',
      'WYENFOS GOLD AND DIAMONDS': 'WGD',
      'WYENFOS GOLD & DIAMONDS': 'WGD',
      'WYENFOS ADS': 'WAD',
      'WYENFOS CASH VAPASE': 'WCV',
      'AYUR FOR HERBALS INDIA': 'ALH',
      'WYENFOS': 'WNF',
      'WYENFOS PURE DROPS': 'WPD',
    };
    
    const prefix = companyPrefixes[company] || company.substring(0, 3).toUpperCase();
    
    // Get all debit notes for this company
    const debitNotes = await firebaseService.getAll('debitnotes');
    const companyDebitNotes = debitNotes.filter(note => note.company?.name === company);
    
    let latestNumber = 0;
    
    // Find the highest number for this company's debit notes
    companyDebitNotes.forEach(note => {
      if (note.invoiceNumber && note.invoiceNumber.startsWith(prefix + '-')) {
        const numberPart = parseInt(note.invoiceNumber.split('-')[1], 10);
        if (!isNaN(numberPart) && numberPart > latestNumber) {
          latestNumber = numberPart;
        }
      }
    });
    
    const nextNumber = latestNumber + 1;
    const invoiceNumber = `${prefix}-${nextNumber}`;
    
    res.json({ invoiceNumber });
  } catch (error) {
    console.error('getLatestInvoiceNumber Error:', error);
    res.status(500).json({ message: 'Error generating invoice number', error: error.message });
  }
};

const sendEmail = async (req, res) => {
  try {
    const { to, subject, html, message, attachments } = req.body;
    
    // Use html if provided, otherwise use message
    const emailContent = html || message;
    
    if (!emailContent) {
      return res.status(400).json({ 
        message: 'Email content is required. Please provide either "html" or "message" field.' 
      });
    }
    
    // Process attachments if provided
    let processedAttachments = [];
    if (attachments && Array.isArray(attachments)) {
      processedAttachments = attachments.map(attachment => {
        if (attachment.content && attachment.filename) {
          return {
            filename: attachment.filename,
            content: Buffer.from(attachment.content, 'base64'),
            contentType: attachment.contentType || 'application/octet-stream'
          };
        }
        return attachment;
      });
    }
    
    const mailOptions = {
      from: process.env.MAIL_USER,
      to,
      subject,
      html: emailContent,
      attachments: processedAttachments
    };

    console.log('Sending email with options:', {
      to,
      subject,
      contentLength: emailContent.length,
      hasAttachments: processedAttachments.length > 0,
      attachmentCount: processedAttachments.length
    });

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('sendEmail Error:', error);
    res.status(500).json({ message: 'Error sending email', error: error.message });
  }
};

const getCompanyPrefix = (company) => {
  const prefixes = {
    'WYENFOS INFOTECH': 'WIT',
    'WYENFOS GOLD AND DIAMONDS': 'WGD',
    'WYENFOS GOLD & DIAMONDS': 'WGD',
    'WYENFOS ADS': 'WAD',
    'WYENFOS CASH VAPASE': 'WCV',
    'AYUR FOR HERBALS INDIA': 'ALH',
    'WYENFOS': 'WNF',
    'WYENFOS PURE DROPS': 'WPD'
  };
  return prefixes[company] || 'WB';
};

// PDF Generation from unsaved data
const generatePDFFromUnsaved = async (req, res) => {
  try {
    const { debitNoteData } = req.body;
    
    if (!debitNoteData) {
      return res.status(400).json({ message: 'Debit note data is required' });
    }

    // Dynamic import for jsPDF with error handling
    let jsPDF;
    try {
      const jsPDFModule = await import('jspdf');
      
      // Try different ways to get the constructor
      if (jsPDFModule.default && typeof jsPDFModule.default === 'function') {
        jsPDF = jsPDFModule.default;
      } else if (jsPDFModule.jsPDF && typeof jsPDFModule.jsPDF === 'function') {
        jsPDF = jsPDFModule.jsPDF;
      } else if (typeof jsPDFModule === 'function') {
        jsPDF = jsPDFModule;
      } else {
        console.error('jsPDF module structure:', jsPDFModule);
        throw new Error('jsPDF constructor not found in module');
      }
      
    } catch (importError) {
      console.error('Error importing jsPDF:', importError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to import PDF library', 
        error: importError.message 
      });
    }
    
    if (typeof jsPDF !== 'function') {
      console.error('jsPDF is not a constructor:', typeof jsPDF);
      return res.status(500).json({ 
        success: false, 
        message: 'PDF library not properly loaded', 
        error: 'jsPDF is not a constructor' 
      });
    }
    
    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    // Set PDF properties
    doc.setProperties({
      title: `Debit Note - ${debitNoteData.invoiceNumber}`,
      subject: 'Debit Note',
      author: 'WYENFOS',
      creator: 'WYENFOS Billing System'
    });

    // Company Logo and Details
    
    // Company Logo (dynamic based on company name)
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Get the correct logo based on company name
      const companyName = debitNoteData.company?.name || 'WYENFOS BILLS';
      const logoFileName = getCompanyLogoPath(companyName);
      const logoPath = path.join(process.cwd(), 'uploads', logoFileName);
      
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        
        // Add the logo image to PDF
        doc.addImage(logoBuffer, 'PNG', margin, y, 30, 30);
      } else {
        // Fallback to placeholder if logo not found
        doc.setDrawColor(0, 0, 0);
        doc.setFillColor(100, 100, 100);
        doc.circle(margin + 15, y + 15, 15, 'F');
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.circle(margin + 15, y + 15, 15, 'S');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('LOGO', margin + 15, y + 15, { align: 'center' });
      }
    } catch (logoError) {
      console.error('Error loading logo:', logoError);
      // Fallback to placeholder
      doc.setDrawColor(0, 0, 0);
      doc.setFillColor(100, 100, 100);
      doc.circle(margin + 15, y + 15, 15, 'F');
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.circle(margin + 15, y + 15, 15, 'S');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('LOGO', margin + 15, y + 15, { align: 'center' });
    }

    // Company Details (Right side of logo)
    const logoRightX = margin + 40;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(debitNoteData.company?.name || 'WYENFOS INFOTECH PRIVATE LIMITED', logoRightX, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const companyDetails = [
      debitNoteData.company?.address || 'Thekkekara Arcade, Chelakottukara, Thrissur, Kerala, 680001',
      `Phone: ${debitNoteData.company?.mobile || '8547014116'}`,
      `Email: ${debitNoteData.company?.email || 'wyenfos@gmail.com'}`,
      `Website: ${debitNoteData.company?.website || 'www.wyenfos.com'}`,
      `GSTIN: ${debitNoteData.company?.gstin || 'WYENFOS-GST123456789'}`,
      `State: ${debitNoteData.company?.state || 'Kerala (Code: KL)'}`
    ];

    companyDetails.forEach(detail => {
      doc.text(detail, logoRightX, y);
      y += 5;
    });
    
    y += 5;

    // Debit Note Information (Right side)
    const noteInfoX = pageWidth - margin - 40;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Note No:', noteInfoX, 20);
    doc.setFont('helvetica', 'normal');
    doc.text(debitNoteData.invoiceNumber || 'N/A', noteInfoX + 25, 20);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', noteInfoX, 25);
    doc.setFont('helvetica', 'normal');
    doc.text(debitNoteData.date ? new Date(debitNoteData.date).toLocaleDateString('en-IN') : 'N/A', noteInfoX + 25, 25);

    // DEBIT NOTE Title
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('DEBIT NOTE', pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Customer Information
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Customer Information:', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    // Left side customer details
    const leftCustomerDetails = [
      { label: 'Customer ID:', value: debitNoteData.customerId || 'N/A' },
      { label: 'Name:', value: debitNoteData.customerName || 'N/A' },
      { label: 'Address:', value: debitNoteData.customerAddress || 'N/A' },
      { label: 'Reason:', value: debitNoteData.reason || 'N/A' }
    ];

    // Right side customer details
    const rightCustomerDetails = [
      { label: 'Phone:', value: debitNoteData.customerPhone || 'N/A' },
      { label: 'Email:', value: debitNoteData.customerEmail || 'N/A' },
      { label: 'Payment Mode:', value: debitNoteData.paymentMode || 'Credit' }
    ];

    const rightCustomerX = pageWidth - margin - 80;
    let leftY = y;
    let rightY = y;

    // Draw left side details
    leftCustomerDetails.forEach(detail => {
      doc.setFont('helvetica', 'bold');
      doc.text(detail.label, margin, leftY);
      doc.setFont('helvetica', 'normal');
      doc.text(detail.value, margin + 50, leftY);
      leftY += 6;
    });

    // Draw right side details
    rightCustomerDetails.forEach(detail => {
      doc.setFont('helvetica', 'bold');
      doc.text(detail.label, rightCustomerX, rightY);
      doc.setFont('helvetica', 'normal');
      doc.text(detail.value, rightCustomerX + 30, rightY);
      rightY += 6;
    });

    y = Math.max(leftY, rightY) + 10;

    // Items Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Items:', margin, y);
    y += 8;

    // Table headers with background color
    const headers = ['SI No', 'Item Code', 'Item Name', 'HSN/SAC', 'Qty', 'Rate', 'Total'];
    const colWidths = [15, 25, 50, 25, 15, 25, 25];
    let x = margin;

    // Draw background for headers
    doc.setFillColor(240, 240, 240);
    doc.rect(x, y - 5, colWidths.reduce((a, b) => a + b, 0), 8, 'F');

    headers.forEach((header, index) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(header, x, y);
      x += colWidths[index];
    });

    y += 8;

    // Table data
    if (debitNoteData.items && debitNoteData.items.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      debitNoteData.items.forEach((item, index) => {
        if (item.description || item.itemCode) {
          x = margin;
          doc.text(String(index + 1), x, y);
          x += colWidths[0];
          doc.text(String(item.itemCode || ''), x, y);
          x += colWidths[1];
          doc.text(String(item.description || ''), x, y);
          x += colWidths[2];
          doc.text(String(item.hsnSac || ''), x, y);
          x += colWidths[3];
          doc.text(String(item.quantity || ''), x, y);
          x += colWidths[4];
          doc.text(String(item.rate || ''), x, y);
          x += colWidths[5];
          // Calculate and display the correct item total
          const itemTotal = parseFloat(item.rate || 0) * parseFloat(item.quantity || 0);
          doc.text(String(itemTotal.toFixed(2)), x, y);
          y += 6;
        }
      });
    }

    y += 10;

    // Check if we need a new page for totals section
    const totalsSectionHeight = 8 + (6 * 6) + 20; // Header + 6 total lines + spacing
    const pageHeight = 297; // A4 height in mm
    const currentY = y;
    
    // Check if totals section will fit on current page
    if (currentY + totalsSectionHeight > pageHeight - 30) {
      doc.addPage();
      y = 20; // Reset Y position for new page
    }

    // Totals Section (Right side)
    const totalsX = pageWidth - margin - 100;
    const totals = debitNoteData.totals || {};
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Amount Summary:', margin, y);
    y += 8;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Taxable Amount:', totalsX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(`₹${(totals.taxableAmount || 0).toFixed(2)}`), totalsX + 50, y);
    y += 6;

    // CGST and SGST or IGST
    if (debitNoteData.isOtherState) {
      doc.setFont('helvetica', 'bold');
      doc.text('IGST (18%):', totalsX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(`₹${(totals.igstTotal || 0).toFixed(2)}`), totalsX + 50, y);
      y += 6;
    } else {
      doc.setFont('helvetica', 'bold');
      doc.text('CGST (9%):', totalsX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(`₹${(totals.cgstTotal || 0).toFixed(2)}`), totalsX + 50, y);
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.text('SGST (9%):', totalsX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(`₹${(totals.sgstTotal || 0).toFixed(2)}`), totalsX + 50, y);
      y += 6;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Round Off:', totalsX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(`₹${(totals.roundOff || 0).toFixed(2)}`), totalsX + 50, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Total Amount:', totalsX, y);
    doc.text(String(`₹${(totals.totalAmount || 0).toFixed(2)}`), totalsX + 50, y);

    y += 20;

    // Payment Status Section
    const remainingAmount = totals.remainingAmountToPay || 0;
    const isFullyPaid = remainingAmount <= 0;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Payment Status:', margin, y);
    y += 8;
    
    // Payment status box with background
    const statusText = isFullyPaid ? '✅ Fully Paid' : '🔄 Payment Pending';
    const statusColor = isFullyPaid ? [40, 167, 69] : [255, 193, 7]; // Green for paid, Yellow for pending
    
    // Draw background rectangle
    doc.setFillColor(...statusColor);
    doc.rect(margin, y - 2, 60, 8, 'F');
    
    // Draw border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(margin, y - 2, 60, 8, 'S');
    
    // Add status text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(statusText, margin + 2, y + 3);
    
    y += 15;

    // Remarks
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Remarks:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(debitNoteData.reason || 'N/A', margin + 25, y);

    y += 20;

    // Check remaining space for terms and bank details
    const termsHeight = 8 + (6 * 3) + 15; // Header + 3 terms + spacing
    const bankDetailsHeight = 8 + (6 * 6) + 50; // Header + 6 bank details + QR + signature
    const remainingSpace = pageHeight - y;
    
    // If not enough space, add new page
    if (remainingSpace < termsHeight + bankDetailsHeight + 20) {
      doc.addPage();
      y = 20; // Reset Y position for new page
    }

    // Terms & Conditions
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Terms & Conditions:', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const terms = [
      '1. This debit note is issued as per agreed terms.',
      '2. Payment should be processed within the specified due date.',
      '3. Contact us for any discrepancies.'
    ];

    terms.forEach((term, index) => {
      doc.text(term, margin, y);
      y += 6;
    });

    y += 15;

    // Bank Details Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Bank Details:', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const bankDetails = [
      { label: 'Company name:', value: (debitNoteData.company && debitNoteData.company.name) ? debitNoteData.company.name : 'WYENFOS INFOTECH PRIVATE LIMITED' },
      { label: 'Account number:', value: '10192468394' },
      { label: 'IFSC:', value: 'IDFB0080732' },
      { label: 'SWIFT code:', value: 'IDFBINBBMUM' },
      { label: 'Bank name:', value: 'IDFC FIRST' },
      { label: 'Branch:', value: 'THRISSUR - EAST FORT THRISSUR BRANCH' }
    ];

    // QR Code and Signature (Right side of bank details)
    const qrSize = 40;
    const qrX = pageWidth - margin - qrSize;
    const qrY = y - 8; // Start QR code at the same level as bank details header

    // QR Code (use existing QR code or generate new one)
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Try to use existing QR code file
      const qrCodePath = path.join(process.cwd(), 'uploads', 'bank-qr-codes', 'WYENFOS_QR_1755336487474.png');
      
      if (fs.existsSync(qrCodePath)) {
        const qrBuffer = fs.readFileSync(qrCodePath);
        const qrBase64 = qrBuffer.toString('base64');
        
        // Add existing QR code to PDF
        doc.addImage(`data:image/png;base64,${qrBase64}`, 'PNG', qrX, qrY, qrSize, qrSize);
      } else {
        // Generate new QR code if file doesn't exist
        
        // Generate QR code data (bank details for payment)
        const qrData = {
          company: (debitNoteData.company && debitNoteData.company.name) ? debitNoteData.company.name : 'WYENFOS',
          accountNumber: '10192468394',
          ifsc: 'IDFB0080732',
          bankName: 'IDFC FIRST',
          branch: 'THRISSUR - EAST FORT THRISSUR BRANCH',
          amount: totals.totalAmount || '0',
          noteNumber: debitNoteData.invoiceNumber || 'N/A'
        };
        
        const qrString = JSON.stringify(qrData);
        const qrBase64 = await QRCode.toDataURL(qrString, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          quality: 0.92,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        doc.addImage(qrBase64, 'PNG', qrX, qrY, qrSize, qrSize);
      }
      
    } catch (qrError) {
      console.error('Error with QR code:', qrError);
      // Fallback to placeholder
      doc.setDrawColor(0, 0, 0);
      doc.setFillColor(150, 150, 150);
      doc.rect(qrX, qrY, qrSize, qrSize, 'F');
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(qrX, qrY, qrSize, qrSize, 'S');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text('QR CODE', qrX + qrSize/2, qrY + qrSize/2, { align: 'center' });
    }

    // Add QR code label
    doc.setFontSize(8);
    doc.text('SCAN TO PAY', qrX + qrSize/2, qrY + qrSize + 5, { align: 'center' });

    // Bank details (left side)
    bankDetails.forEach(detail => {
      doc.setFont('helvetica', 'bold');
      doc.text(detail.label, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(detail.value, margin + 50, y);
      y += 6;
    });

    // Signature (right side, same level as bank details)
    const signatureY = qrY + qrSize + 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Authorized Signatory', qrX, signatureY);
    doc.setFont('helvetica', 'normal');
    doc.text(debitNoteData.company?.name || 'WYENFOS', qrX, signatureY + 6);

    // Convert PDF to base64
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    
    res.json({
      success: true,
      message: 'PDF generated successfully',
      data: { pdf: pdfBase64 }
    });
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate PDF', 
      error: error.message 
    });
  }
};

export {
  checkPermission,
  requestPermission,
  getCustomerByName,
  createCustomer,
  createCreditBill,
  getCreditBills,
  getCreditBillById,
  getCreditBillByName,
  createDebitNote,
  getDebitNotes,
  getDebitNoteById,
  updateDebitNote,
  deleteDebitNote,
  createPaymentReceipt,
  getPaymentReceipts,
  getLatestInvoiceNumber,
  sendEmail,
  generatePDFFromUnsaved
};
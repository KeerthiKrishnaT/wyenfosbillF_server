import { billService, customerService, companyService, userService, inventoryService } from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

// Function to generate sequential customer ID (copied from CustomerController)
const generateSequentialCustomerId = async () => {
  try {
    const customers = await customerService.getAllCustomers();
    console.log('Total customers found:', customers.length);
    
    // Find the highest customer ID number
    let maxNumber = 0;
    customers.forEach(customer => {
      console.log('Checking customer:', customer.customerId);
      if (customer.customerId && customer.customerId.startsWith('CUST-')) {
        const number = parseInt(customer.customerId.replace('CUST-', ''));
        console.log('Parsed number:', number);
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
    });
    
    console.log('Max number found:', maxNumber);
    const nextId = `CUST-${maxNumber + 1}`;
    console.log('Generated ID:', nextId);
    
    // Generate next sequential ID
    return nextId;
  } catch (error) {
    console.error('Error generating sequential customer ID:', error);
    // Fallback to timestamp-based ID
    return `CUST-${Date.now()}`;
  }
};
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

console.log('SMTP:', process.env.SMTP_HOST, process.env.MAIL_USER);

const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log('Email server is ready');
  } catch (error) {
    console.error('Email server verification failed:', error);
    throw new Error('Email service is not configured properly');
  }
};

const generateInvoiceNumber = async (companyName = 'WYENFOS') => {
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
  
  const prefix = companyPrefixes[companyName] || companyName.substring(0, 3).toUpperCase();
  
  // Get all cash bills for the company (CASH BILLS ONLY)
  const bills = await billService.getCashBills();
  const companyBills = bills.filter(bill => bill.company?.name === companyName);
  
  // Find the latest invoice number for this company (CASH BILLS ONLY)
  let latestNumber = 0;
  
  // Extract numbers from existing CASH BILL invoice numbers only
  companyBills.forEach(bill => {
    if (bill.invoiceNumber && bill.invoiceNumber.startsWith(prefix + '-')) {
      const numberPart = parseInt(bill.invoiceNumber.split('-')[1], 10);
      if (!isNaN(numberPart) && numberPart > latestNumber) {
        latestNumber = numberPart;
      }
    }
  });
  
  // Generate next invoice number (start from 1 if no bills exist)
  const nextNumber = latestNumber + 1;
  return `${prefix}-${nextNumber}`;
};

export const saveBill = async (req, res) => {
  const billData = req.body;
  try {
    if (!billData.invoiceNumber) {
      billData.invoiceNumber = await generateInvoiceNumber(billData.company?.name || 'WYENFOS');
    }

    // Get company details
    if (!billData.company?.mobile || !billData.company?.email || !billData.company?.GSTIN) {
      const companies = await companyService.getAllCompanies();
      const fullCompany = companies.find(company => company.name === billData.company?.name);
      
      if (fullCompany) {
        billData.company = {
          ...fullCompany,
          logo: fullCompany.logoUrl,
        };
        console.log('Fetched full company details:', billData.company.name);
      } else {
        console.warn('Company not found in DB for name:', billData.company?.name);
      }
    }

    if (!billData.customerName) {
      console.error('saveBill: Missing customerName', { billData });
      return res.status(400).json({ message: 'Customer name is required' });
    }

    // Handle customer
    let customer = null;
    if (billData.customerId) {
      const customers = await customerService.getAllCustomers();
      customer = customers.find(c => c.customerId === billData.customerId);
      
      if (!customer) {
        console.error('saveBill: Invalid customerId provided', { customerId: billData.customerId });
        return res.status(400).json({ message: 'Invalid customer ID' });
      }
      
      // Update existing customer with new contact details if provided
      if (billData.customerContact && (
        billData.customerContact.address || 
        billData.customerContact.phone || 
        billData.customerContact.email || 
        billData.customerContact.gstin
      )) {
        console.log('saveBill: Updating existing customer with new contact details:', billData.customerId);
        const updatedCustomerData = {
          customerContact: {
            address: billData.customerContact.address || customer.customerContact?.address || '',
            phone: billData.customerContact.phone || customer.customerContact?.phone || '',
            email: billData.customerContact.email || customer.customerContact?.email || '',
            gstin: billData.customerContact.gstin || customer.customerContact?.gstin || '',
          },
          lastUpdatedBy: req.user?.email || billData.lastUpdatedBy || 'unknown',
          updatedAt: new Date()
        };
        
        customer = await customerService.updateCustomer(customer.id, updatedCustomerData);
        console.log('saveBill: Updated customer contact details:', customer.customerId);
        
        // Validate that customer still has customerId after update
        if (!customer.customerId) {
          console.error('saveBill: Customer lost customerId after update:', customer);
          return res.status(400).json({ message: 'Customer update failed - missing customer ID' });
        }
      }
    } else {
      // Search for existing customer
      const customers = await customerService.getAllCustomers();
      customer = customers.find(c => 
        c.customerName === billData.customerName ||
        c.customerContact?.email === billData.customerContact?.email ||
        c.customerContact?.phone === billData.customerContact?.phone
      );

      if (!customer) {
        console.log('saveBill: No customer found, creating new customer:', billData.customerName);
        const customerId = await generateSequentialCustomerId();
        const customerData = {
          customerId: customerId,
          customerName: billData.customerName,
          customerContact: billData.customerContact || {
            address: '',
            phone: '',
            email: '',
            gstin: '',
          },
          company: [billData.company?.name || 'WYENFOS'],
          createdBy: req.user?.email || billData.createdBy || 'unknown',
          lastUpdatedBy: req.user?.email || billData.lastUpdatedBy || 'unknown',
        };
        customer = await customerService.createCustomer(customerData);
        console.log('saveBill: Created new customer:', customer.customerId);
      } else {
        // Update existing customer with new contact details if provided
        if (billData.customerContact && (
          billData.customerContact.address || 
          billData.customerContact.phone || 
          billData.customerContact.email || 
          billData.customerContact.gstin
        )) {
          console.log('saveBill: Updating existing customer with new contact details:', customer.customerId);
          const updatedCustomerData = {
            customerContact: {
              address: billData.customerContact.address || customer.customerContact?.address || '',
              phone: billData.customerContact.phone || customer.customerContact?.phone || '',
              email: billData.customerContact.email || customer.customerContact?.email || '',
              gstin: billData.customerContact.gstin || customer.customerContact?.gstin || '',
            },
            lastUpdatedBy: req.user?.email || billData.lastUpdatedBy || 'unknown',
            updatedAt: new Date()
          };
          
          customer = await customerService.updateCustomer(customer.id, updatedCustomerData);
          console.log('saveBill: Updated customer contact details:', customer.customerId);
          
          // Validate that customer still has customerId after update
          if (!customer.customerId) {
            console.error('saveBill: Customer lost customerId after update:', customer);
            return res.status(400).json({ message: 'Customer update failed - missing customer ID' });
          }
        }
      }
    }

    // Update customer companies if needed
    const customerCompanies = Array.isArray(customer.company) ? customer.company : [customer.company].filter(Boolean);
    if (!customerCompanies.includes(billData.company?.name)) {
      const updatedCompanies = [...customerCompanies, billData.company?.name];
      await customerService.updateCustomer(customer.id, {
        company: updatedCompanies,
        lastUpdatedBy: req.user?.email || billData.createdBy || 'unknown',
        updatedAt: new Date()
      });
      console.log('Updated customer companies:', customer.customerId, updatedCompanies);
    }

    // Validate customer has a valid ID
    if (!customer.customerId) {
      console.error('saveBill: Customer has no customerId after processing:', customer);
      return res.status(400).json({ message: 'Invalid customer data - missing customer ID' });
    }

    console.log('saveBill: Creating bill with customerId:', customer.customerId);

    // Create bill data
    const bill = {
      ...billData,
      customerId: customer.customerId,
      customerName: customer.customerName,
      customerContact: customer.customerContact,
      billType: 'cash',
      createdBy: req.user?.id || billData.createdBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const createdBill = await billService.createBill(bill);
    
    // Update inventory when bill is created
    if (bill.items && bill.items.length > 0) {
      try {
        await inventoryService.updateInventoryFromBill(bill.items, 'cash', createdBill.id);
        console.log('Inventory updated for cash bill:', createdBill.id);
      } catch (inventoryError) {
        console.error('Failed to update inventory for cash bill:', inventoryError);
        // Don't fail the bill creation if inventory update fails
      }
    }
    
    res.status(201).json({
      message: 'Bill saved successfully',
      bill: createdBill
    });

  } catch (error) {
    console.error('saveBill Error:', error);
    res.status(500).json({ 
      message: 'Error saving bill',
      error: error.message 
    });
  }
};

export const updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if bill exists
    const existingBill = await billService.getBillById(id, 'cash');
    if (!existingBill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Update bill
    const updatedBill = await billService.updateBill(id, {
      ...updateData,
      updatedAt: new Date()
    }, 'cash');

    res.json({
      message: 'Bill updated successfully',
      bill: updatedBill
    });

  } catch (error) {
    console.error('updateBill Error:', error);
    res.status(500).json({ 
      message: 'Error updating bill',
      error: error.message 
    });
  }
};

export const deleteBill = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if bill exists
    const existingBill = await billService.getBillById(id, 'cash');
    if (!existingBill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Delete bill
    await billService.deleteBill(id, 'cash');
    
    res.json({ message: 'Bill deleted successfully' });

  } catch (error) {
    console.error('deleteBill Error:', error);
    res.status(500).json({ 
      message: 'Error deleting bill',
      error: error.message 
    });
  }
};

export const getBillByCustomerId = async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const bills = await billService.getWhere('bills', 'customerId', '==', customerId);
    
    res.json(bills);
  } catch (error) {
    console.error('getBillByCustomerId Error:', error);
    res.status(500).json({ 
      message: 'Error fetching bills',
      error: error.message 
    });
  }
};

export const getBillById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const bill = await billService.getBillById(id, 'cash');
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }
    
    res.json(bill);
  } catch (error) {
    console.error('getBillById Error:', error);
    res.status(500).json({ 
      message: 'Error fetching bill',
      error: error.message 
    });
  }
};

export const getAllBills = async (req, res) => {
  try {
    const { company } = req.query;
    const bills = await billService.getCashBills();
    
    // Filter bills by company if company parameter is provided
    let filteredBills = bills || [];
    if (company) {
      filteredBills = bills.filter(bill => bill.company?.name === company);
    }
    
    res.json(filteredBills);
  } catch (error) {
    console.error('getAllBills Error:', error);
    // Return empty array instead of error
    res.json([]);
  }
};

export const getLatestInvoice = async (req, res) => {
  try {
    const { company, prefix } = req.query;
    
    if (!company) {
      return res.status(400).json({ message: 'Company name is required' });
    }

    // Get all cash bills for the specific company
    const bills = await billService.getCashBills();
    const companyBills = bills.filter(bill => bill.company?.name === company);
    
    if (companyBills.length === 0) {
      // No bills found for this company, return the first invoice number
      const firstInvoiceNumber = `${prefix || company.substring(0, 3).toUpperCase()}-1`;
      return res.json({ invoiceNumber: firstInvoiceNumber });
    }
    
    // Find the latest bill for this company
    const latestBill = companyBills[0];
    
    if (!latestBill.invoiceNumber) {
      const firstInvoiceNumber = `${prefix || company.substring(0, 3).toUpperCase()}-1`;
      return res.json({ invoiceNumber: firstInvoiceNumber });
    }
    
    // Extract the number from the latest invoice number
    const invoiceNumberPattern = /^(.+)-(\d+)$/;
    const match = latestBill.invoiceNumber.match(invoiceNumberPattern);
    
    if (!match) {
      // If the invoice number doesn't match the expected pattern, start from 1
      const firstInvoiceNumber = `${prefix || company.substring(0, 3).toUpperCase()}-1`;
      return res.json({ invoiceNumber: firstInvoiceNumber });
    }
    
    const [, invoicePrefix, currentNumber] = match;
    const nextNumber = parseInt(currentNumber, 10) + 1;
    const nextInvoiceNumber = `${invoicePrefix}-${nextNumber}`;
    
    res.json({ invoiceNumber: nextInvoiceNumber });
  } catch (error) {
    console.error('getLatestInvoice Error:', error);
    res.status(500).json({ 
      message: 'Error fetching latest invoice',
      error: error.message 
    });
  }
};

export const sendBillEmail = async (req, res) => {
  try {
    console.log('Email request received:', { 
      hasBillId: !!req.body.billId, 
      hasBillData: !!req.body.billData, 
      email: req.body.email 
    });
    
    const { billId, billData, email, emailTo, subject, body, pdfBase64 } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    let bill = null;
    
    // If billId is provided, try to get bill from database
    if (billId) {
      console.log('Looking up bill by ID:', billId);
      bill = await billService.getBillById(billId, 'cash');
      if (!bill) {
        return res.status(404).json({ message: 'Bill not found' });
      }
    }
    // If billData is provided, use it directly (for emails sent before saving)
    else if (billData) {
      console.log('Using provided bill data');
      bill = billData;
    }
    else {
      return res.status(400).json({ message: 'Either billId or billData is required' });
    }

    console.log('Preparing email for:', bill.invoiceNumber);

    // Email configuration
    const mailOptions = {
      from: 'Wyenfos014@gmail.com',
      to: emailTo || email,
      subject: subject || `Cash Bill ${bill.invoiceNumber} from ${bill.company?.name || 'WYENFOS'}`,
      html: body || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #b39eb5; border-bottom: 2px solid #b39eb5; padding-bottom: 10px;">
            Cash Bill from ${bill.company?.name || 'WYENFOS'}
          </h2>
          
          <p>Dear ${bill.customerName},</p>
          
          <p>Please find attached your cash bill for the purchased items.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Bill Details:</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li><strong>Bill Number:</strong> ${bill.invoiceNumber}</li>
              <li><strong>Customer ID:</strong> ${bill.customerId}</li>
              <li><strong>Date:</strong> ${bill.createdAt ? new Date(bill.createdAt).toLocaleDateString() : bill.date}</li>
              <li><strong>Payment Method:</strong> ${bill.paymentDetails?.mode || bill.paymentTerms || 'Cash'}</li>
              <li><strong>Grand Total:</strong> ₹${bill.totals?.grandTotal || bill.totals?.rounded || bill.total || 0}</li>
              <li><strong>Status:</strong> ${bill.isCancelled ? 'Cancelled' : 'Active'}</li>
            </ul>
          </div>
          
          <p><strong>Payment Information:</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Payment has been received as per the bill</li>
            <li>Please keep this bill for your records</li>
            <li>For any discrepancies, please contact us within 7 days</li>
          </ul>
          
          <p>Thank you for your business!</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="margin: 0;"><strong>Best regards,</strong><br>
            ${bill.company?.name || 'WYENFOS'}<br>
            Thekkekara Arcade, Chelakottukara, Thrissur, Kerala, 680001<br>
            Mobile: 8547014116 | Email: wyenfos@gmail.com<br>
            Website: www.wyenfos.com</p>
          </div>
        </div>
      `,
      attachments: []
    };

    // Add PDF attachment if provided
    if (pdfBase64) {
      console.log('Adding PDF attachment');
      mailOptions.attachments.push({
        filename: `CashBill_${bill.invoiceNumber}.pdf`,
        content: pdfBase64,
        encoding: 'base64',
        contentType: 'application/pdf'
      });
    }

    console.log('Sending email...');
    
    // Add timeout for email sending
    const emailPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email sending timed out')), 20000); // 20 second timeout
    });
    
    await Promise.race([emailPromise, timeoutPromise]);
    
    console.log('Email sent successfully');
    res.json({ message: 'Email sent successfully' });

  } catch (error) {
    console.error('sendBillEmail Error:', error);
    res.status(500).json({ 
      message: 'Error sending email',
      error: error.message 
    });
  }
};

export const fetchCustomerByContact = async (req, res) => {
  try {
    const { phone, email } = req.query;
    
    if (!phone && !email) {
      return res.status(400).json({ message: 'Phone or email is required' });
    }

    const customers = await customerService.getAllCustomers();
    const customer = customers.find(c => 
      c.customerContact?.phone === phone ||
      c.customerContact?.email === email
    );

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    console.error('fetchCustomerByContact Error:', error);
    res.status(500).json({ 
      message: 'Error fetching customer',
      error: error.message 
    });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const customer = await customerService.getCustomerById(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error) {
    console.error('getCustomerById Error:', error);
    res.status(500).json({ 
      message: 'Error fetching customer',
      error: error.message 
    });
  }
};

export const getWeeklyTotalCashBill = async (req, res) => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const bills = await billService.getCashBills();
    const weeklyBills = bills.filter(bill => 
      new Date(bill.createdAt) >= oneWeekAgo
    );

    const total = weeklyBills.reduce((sum, bill) => sum + (bill.total || 0), 0);
    
    res.json({ 
      total,
      count: weeklyBills.length,
      bills: weeklyBills
    });
  } catch (error) {
    console.error('getWeeklyTotalCashBill Error:', error);
    res.status(500).json({ 
      message: 'Error fetching weekly total',
      error: error.message 
    });
  }
};

export const getWeeklyCashBills = async (req, res) => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const bills = await billService.getCashBills();
    const weeklyBills = bills.filter(bill => 
      new Date(bill.createdAt) >= oneWeekAgo
    );
    
    res.json(weeklyBills);
  } catch (error) {
    console.error('getWeeklyCashBills Error:', error);
    res.status(500).json({ 
      message: 'Error fetching weekly cash bills',
      error: error.message 
    });
  }
};

export const getTodayBills = async (req, res) => {
  try {
    console.log('🔍 Starting today\'s cash bills fetch...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('📅 Today\'s date for filtering:', today);

    let bills = [];
    try {
      console.log('🔍 Fetching cash bills...');
      bills = await billService.getCashBills();
      console.log(`✅ Cash bills fetched: ${bills.length} found`);
    } catch (error) {
      console.error('❌ Error fetching cash bills:', error.message);
      bills = [];
    }

    const todayBills = bills.filter(bill => {
      const billDate = new Date(bill.createdAt);
      return billDate >= today;
    });

    const total = todayBills.reduce((sum, bill) => sum + (bill.total || bill.totalAmount || 0), 0);
    
    console.log('📊 Today\'s cash bills calculated:', { total, count: todayBills.length });
    
    res.json({ 
      total,
      count: todayBills.length,
      bills: todayBills
    });
  } catch (error) {
    console.error('❌ getTodayBills Error:', error);
    res.status(500).json({ 
      message: 'Error fetching today\'s bills',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// PDF Generation for CashBill
export const generatePDF = async (req, res) => {
  try {
    const { billId } = req.params;
    console.log('CashBill generatePDF - billId:', billId);

    // Get bill data from database
    const bill = await billService.getBillById(billId, 'cash');
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    console.log('CashBill generatePDF - bill found:', bill.invoiceNumber);

    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20;

    // Company Logo and Details
    console.log('Adding company logo and details...');
    
    // Company Logo (dynamic based on company name)
    try {
      console.log('Loading company logo...');
      const fs = await import('fs');
      const path = await import('path');
      
      // Get the correct logo based on company name
      const companyName = bill.company?.name || 'WYENFOS BILLS';
      const logoFileName = getCompanyLogoPath(companyName);
      const logoPath = path.join(process.cwd(), 'uploads', logoFileName);
      
      console.log('Company name:', companyName);
      console.log('Logo file name:', logoFileName);
      console.log('Logo path:', logoPath);
      
      if (fs.existsSync(logoPath)) {
        console.log('Logo file exists, reading...');
        const logoBuffer = fs.readFileSync(logoPath);
        console.log('Logo file size:', logoBuffer.length, 'bytes');
        
        // Add the logo image to PDF
        doc.addImage(logoBuffer, 'PNG', margin, y, 30, 30);
        console.log('Real WYENFOS logo added successfully');
      } else {
        // Fallback to placeholder if logo not found
        console.log('Logo file not found at:', logoPath);
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
    doc.text(bill.company?.name || 'WYENFOS INFOTECH PRIVATE LIMITED', logoRightX, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const companyDetails = [
      bill.company?.address || 'Thekkekara Arcade, Chelakottukara, Thrissur, Kerala, 680001',
      `Phone: ${bill.company?.mobile || '8547014116'}`,
      `Email: ${bill.company?.email || 'wyenfos@gmail.com'}`,
      `Website: ${bill.company?.website || 'www.wyenfos.com'}`,
      `GSTIN: ${bill.company?.gstin || 'WYENFOS-GST123456789'}`,
      `State: ${bill.company?.state || 'Kerala (Code: KL)'}`
    ];

    companyDetails.forEach(detail => {
      doc.text(detail, logoRightX, y);
      y += 5;
    });
    
    y += 5;

    // Bill Information (Right side)
    const billInfoX = pageWidth - margin - 60;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Bill No:', billInfoX, 20);
    doc.setFont('helvetica', 'normal');
    doc.text(bill.invoiceNumber || 'N/A', billInfoX + 25, 20);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', billInfoX, 25);
    doc.setFont('helvetica', 'normal');
    doc.text(bill.date ? new Date(bill.date).toLocaleDateString('en-IN') : 'N/A', billInfoX + 25, 25);

    // CASH BILL Title
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('CASH BILL', pageWidth / 2, y, { align: 'center' });
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
      { label: 'Customer ID:', value: bill.customerId || 'N/A' },
      { label: 'Name:', value: bill.customerName || 'N/A' },
      { label: 'Address:', value: bill.customerContact?.address || 'N/A' },
      { label: 'Payment Method:', value: bill.paymentTerms || 'Cash' }
    ];

    // Right side customer details
    const rightCustomerDetails = [
      { label: 'Phone:', value: bill.customerContact?.phone || 'N/A' },
      { label: 'Email:', value: bill.customerContact?.email || 'N/A' },
      { label: 'GSTIN:', value: bill.customerContact?.gstin || 'N/A' }
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

    // Product Details Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Product Details:', margin, y);
    y += 8;

    // Table headers with background color
    const headers = ['SI No', 'Item Code', 'Item Name', 'HSN/SAC', 'Qty', 'Rate', 'Total', 'Tax %'];
    const colWidths = [15, 25, 60, 25, 15, 20, 25, 15];
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
    if (bill.items && bill.items.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      bill.items.forEach((item, index) => {
        if (item.itemname || item.code) {
          x = margin;
          doc.text((index + 1).toString(), x, y);
          x += colWidths[0];
          doc.text(item.code || '', x, y);
          x += colWidths[1];
          doc.text(item.itemname || '', x, y);
          x += colWidths[2];
          doc.text(item.hsnSac || '', x, y);
          x += colWidths[3];
          doc.text(item.quantity || '', x, y);
          x += colWidths[4];
          doc.text(item.rate || '', x, y);
          x += colWidths[5];
          // Calculate and display the correct item total
          const itemTotal = parseFloat(item.rate || 0) * parseFloat(item.quantity || 0);
          doc.text(itemTotal.toFixed(2), x, y);
          x += colWidths[6];
          doc.text(item.taxRate || '', x, y);
          y += 6;
        }
      });
    }

    y += 10;

    // Totals Section (Right side)
    const totalsX = pageWidth - margin - 80;
    const totals = bill.totals || {};
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Taxable Amount:', totalsX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`₹${(totals.taxableAmount || 0).toFixed(2)}`, totalsX + 50, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('CGST:', totalsX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`₹${(totals.cgstTotal || 0).toFixed(2)}`, totalsX + 50, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('SGST:', totalsX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`₹${(totals.sgstTotal || 0).toFixed(2)}`, totalsX + 50, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Round Off:', totalsX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`₹${(totals.roundOff || 0).toFixed(2)}`, totalsX + 50, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Grand Total:', totalsX, y);
    doc.text(`₹${(totals.grandTotal || 0).toFixed(2)}`, totalsX + 50, y);

    y += 20;

    // Remarks
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Remarks:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(bill.remarks || 'N/A', margin + 25, y);

    y += 20;

    // Terms & Conditions
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Terms & Conditions:', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const terms = [
      '1. This cash bill is issued as per agreed terms.',
      '2. Contact us within 7 days for discrepancies.',
      '3. Amount credited can be adjusted against future invoices.'
    ];

    terms.forEach(term => {
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
      { label: 'Company name:', value: bill.company?.name || 'WYENFOS INFOTECH PRIVATE LIMITED' },
      { label: 'Account number:', value: '10192468394' },
      { label: 'IFSC:', value: 'IDFB0080732' },
      { label: 'SWIFT code:', value: 'IDFBINBBMUM' },
      { label: 'Bank name:', value: 'IDFC FIRST' },
      { label: 'Branch:', value: 'THRISSUR - EAST FORT THRISSUR BRANCH' }
    ];

    // QR Code (use existing QR code or generate new one)
    console.log('Loading QR code...');
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Try to use existing QR code file
      const qrCodePath = path.join(process.cwd(), 'uploads', 'bank-qr-codes', 'WYENFOS_QR_1755336487474.png');
      
      if (fs.existsSync(qrCodePath)) {
        const qrBuffer = fs.readFileSync(qrCodePath);
        const qrBase64 = qrBuffer.toString('base64');
        
        // Add existing QR code to PDF
        const qrSize = 40;
        const qrX = pageWidth - margin - qrSize;
        const qrY = y - 8;
        doc.addImage(`data:image/png;base64,${qrBase64}`, 'PNG', qrX, qrY, qrSize, qrSize);
        console.log('Existing QR code loaded successfully');
      } else {
        // Generate new QR code if file doesn't exist
        console.log('QR code file not found, generating new one...');
        const qrData = {
          company: bill.company?.name || 'WYENFOS',
          accountNumber: '10192468394',
          ifsc: 'IDFB0080732',
          bankName: 'IDFC FIRST',
          branch: 'THRISSUR - EAST FORT THRISSUR BRANCH',
          amount: totals.grandTotal || '0',
          billNumber: bill.invoiceNumber || 'N/A'
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
        
        const qrSize = 40;
        const qrX = pageWidth - margin - qrSize;
        const qrY = y - 8;
        doc.addImage(qrBase64, 'PNG', qrX, qrY, qrSize, qrSize);
        console.log('New QR code generated and added successfully');
      }
      
    } catch (qrError) {
      console.error('Error with QR code:', qrError);
      // Fallback to placeholder
      const qrSize = 40;
      const qrX = pageWidth - margin - qrSize;
      const qrY = y - 8;
      doc.setDrawColor(0, 0, 0);
      doc.setFillColor(150, 150, 150);
      doc.rect(qrX, qrY, qrSize, qrSize, 'F');
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(qrX, qrY, qrSize, qrSize, 'S');
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('QR CODE', qrX + qrSize/2, qrY + qrSize/2, { align: 'center' });
    }

    // QR Code label
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const qrSize = 40;
    const qrX = pageWidth - margin - qrSize;
    const qrY = y - 8;
    doc.text('SCAN TO PAY', qrX + qrSize/2, qrY + qrSize + 5, { align: 'center' });

    // Signature section (Right side, below QR code)
    const signatureY = qrY + qrSize + 15;
    
    // Signature line
    doc.setDrawColor(0);
    doc.line(qrX, signatureY + 8, qrX + 60, signatureY + 8);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Authorized Signatory', qrX, signatureY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(bill.company?.name || 'WYENFOS', qrX, signatureY + 6);

    // Bank Details (Left side)
    bankDetails.forEach(detail => {
      doc.setFont('helvetica', 'bold');
      doc.text(detail.label, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(detail.value, margin + 50, y);
      y += 6;
    });

    // Convert to base64
    let pdfBuffer, base64;
    try {
      console.log('Converting PDF to base64...');
      pdfBuffer = doc.output('arraybuffer');
      base64 = Buffer.from(pdfBuffer).toString('base64');
      console.log('PDF converted to base64 successfully, length:', base64.length);
    } catch (outputError) {
      console.error('Error converting PDF to base64:', outputError);
      return res.status(500).json({ message: 'Error converting PDF to base64', error: outputError.message });
    }

    console.log('CashBill generatePDF - PDF generated successfully');
    res.json({ 
      message: 'PDF generated successfully',
      data: { pdf: base64 }
    });

  } catch (error) {
    console.error('CashBill generatePDF Error:', error);
    res.status(500).json({ 
      message: 'Error generating PDF',
      error: error.message 
    });
  }
};
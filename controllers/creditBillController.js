import { 
  billService, 
  customerService, 
  companyService, 
  userService,
  inventoryService
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';

// Helper function to get the correct logo path based on company name
const getCompanyLogoPath = (companyName) => {
  const logoMapping = {
    'WYENFOS INFOTECH': 'wyenfos_infotech.png',
    'WYENFOS GOLD AND DIAMONDS': 'wyenfos_gold.png',
    'WYENFOS GOLD & DIAMONDS': 'wyenfos_gold.png',
    'WYENFOS ADS': 'wyenfos_ads.png',
    'WYENFOS CASH VAPASE': 'wyenfos_cash.png',
    'AYUR FOR HERBALS INDIA': 'Ayur4life_logo.png',
    'WYENFOS': 'wyenfos.png',
    'WYENFOS PURE DROPS': 'wyenfos pure drops.png',
    'WYENFOS BILLS': 'Wyenfosbills_logo.png'
  };
  
  return logoMapping[companyName] || 'Wyenfosbills_logo.png'; // Default fallback
};



const transporter = nodemailer.createTransport({
  service: 'Gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: { ciphers: 'SSLv3' },
  family: 4,
});

const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log('Email server is ready');
  } catch (error) {
    console.error('Email server verification failed:', error);
    throw new Error('Email service is not configured properly');
  }
};

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0.00';
  return `₹${Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

const generateCustomerId = async (companyName = 'WYENFOS') => {
  const prefix = companyName.substring(0, 3).toUpperCase();
  const timestamp = Date.now();
  return `${prefix}-${timestamp}`;
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
  
  // Get all credit bills
  const bills = await billService.getCreditBills();
  
  // Look for bills with the same prefix, regardless of company name
  const prefixBills = bills.filter(bill => 
    bill.invoiceNo && bill.invoiceNo.startsWith(prefix + '-')
  );
  
  let latestNumber = 0;
  
  // Find the highest number for this prefix
  prefixBills.forEach(bill => {
    if (bill.invoiceNo && bill.invoiceNo.startsWith(prefix + '-')) {
      const numberPart = parseInt(bill.invoiceNo.split('-')[1], 10);
      if (!isNaN(numberPart) && numberPart > latestNumber) {
        latestNumber = numberPart;
      }
    }
  });
  
  // Increment from the latest number found
  const nextNumber = latestNumber + 1;
  const result = `${prefix}-${nextNumber}`;
  
  return result;
};

const updateCustomerTransaction = async (customerId, transaction) => {
  try {
    const customer = await customerService.getCustomerById(customerId);
    if (!customer) throw new Error('Customer not found');
    
    const updatedTransactions = [...(customer.transactions || []), {
      type: transaction.type,
      refId: transaction.refId,
      date: transaction.date,
      amount: transaction.amount,
    }];
    
    await customerService.updateCustomer(customerId, {
      transactions: updatedTransactions
    });
    
    console.log('Customer transaction updated:', { customerId, transaction });
  } catch (error) {
    console.error('Error updating customer transaction:', error);
    throw error;
  }
};

export const generateCustomerIdEndpoint = async (req, res) => {
  try {
    const { company } = req.query;
    if (!company) {
      return res.status(400).json({ message: 'Company is required' });
    }
    const customerId = await generateCustomerId(company);
    res.status(200).json({ customerId });
  } catch (error) {
    console.error('Error generating customer ID:', error);
    res.status(500).json({ message: 'Failed to generate customer ID', error: error.message });
  }
};

export const getLatestInvoice = async (req, res) => {
  const { company } = req.query;
  try {
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
    
    // Get all credit bills
    const bills = await billService.getCreditBills();
    
    // Look for bills with the same prefix, regardless of company name
    const prefixBills = bills.filter(bill => 
      bill.invoiceNo && bill.invoiceNo.startsWith(prefix + '-')
    );
    
    let latestNumber = 0;
    
    // Find the highest number for this prefix
    prefixBills.forEach(bill => {
      if (bill.invoiceNo && bill.invoiceNo.startsWith(prefix + '-')) {
        const numberPart = parseInt(bill.invoiceNo.split('-')[1], 10);
        if (!isNaN(numberPart) && numberPart > latestNumber) {
          latestNumber = numberPart;
        }
      }
    });
    
    // Increment from the latest number found
    const nextNumber = latestNumber + 1;
    const invoiceNo = `${prefix}-${nextNumber}`;
    
    res.status(200).json({ data: { invoiceNo } });
  } catch (error) {
    console.error('getLatestInvoice Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getAllBills = async (req, res) => {
  try {
    const { company } = req.query;
    console.log('getAllBills - Requested company:', company);

    // Get all credit bills
    const bills = await billService.getCreditBills();
    console.log('getAllBills - Total bills found:', bills?.length || 0);

    // Enhanced filtering with multiple company name variations
    const filteredBills = company 
      ? bills.filter(bill => {
          // Handle multiple possible company name formats
          const billCompanyName = bill.company?.name || bill.companyName || bill.selectedCompany;
          
          // Check for exact match first
          if (billCompanyName === company) return true;
          
          // Handle "CASH VAPASE" variations
          if (company.includes('CASH VAPASE') || company === 'CASH VAPASE') {
            return billCompanyName === 'WYENFOS CASH VAPASE' || 
                   billCompanyName === 'CASH VAPASE' ||
                   billCompanyName?.includes('CASH VAPASE');
          }
          
          // Handle other company variations
          if (company.includes('WYENFOS') && billCompanyName?.includes('WYENFOS')) {
            return billCompanyName.includes(company.replace('WYENFOS ', ''));
          }
          
          return billCompanyName === company;
        })
      : bills;

    console.log('getAllBills - Filtered bills count:', filteredBills?.length || 0);
    
    if (company && filteredBills.length === 0) {
      console.log('getAllBills - No bills found for company. Sample bill company names:', 
        bills.slice(0, 3).map(b => b.company?.name || b.companyName || b.selectedCompany));
    }

    res.status(200).json({ data: filteredBills || [] });
  } catch (error) {
    console.error('getAllBills Error:', error);
    // Return empty array instead of error
    res.status(200).json({ data: [] });
  }
};

export const getCreditBill = async (req, res) => {
  try {
    const { id } = req.params;
    
    const bill = await billService.getBillById(id, 'credit');
    if (!bill) {
      return res.status(404).json({ message: 'Credit bill not found' });
    }

    res.status(200).json({ data: bill });
  } catch (error) {
    console.error('getCreditBill Error:', error);
    res.status(500).json({
      message: 'Failed to fetch credit bill',
      error: error.message
    });
  }
};

export const saveCreditBill = async (req, res) => {
  try {
    const billData = req.body;

    // Generate invoice number if not provided
    if (!billData.invoiceNo && !billData.invoiceNumber) {
      const generatedInvoiceNo = await generateInvoiceNumber(billData.company?.name || 'WYENFOS');
      billData.invoiceNo = generatedInvoiceNo;
      billData.invoiceNumber = generatedInvoiceNo; // Keep both for compatibility
    } else if (billData.invoiceNo && !billData.invoiceNumber) {
      billData.invoiceNumber = billData.invoiceNo;
    } else if (billData.invoiceNumber && !billData.invoiceNo) {
      billData.invoiceNo = billData.invoiceNumber;
    }

    // Get company details if needed
    if (!billData.company?.mobile || !billData.company?.email || !billData.company?.GSTIN) {
      const companies = await companyService.getAllCompanies();
      const fullCompany = companies.find(company => company.name === billData.company?.name);
      
      if (fullCompany) {
        billData.company = {
          ...fullCompany,
          logo: fullCompany.logoUrl,
        };
      } else {
        console.warn('Company not found in DB for name:', billData.company?.name);
      }
    }

    if (!billData.customerName) {
      console.error('saveCreditBill: Missing customerName', { billData });
      return res.status(400).json({ message: 'Customer name is required' });
    }

    // Handle customer
    let customer = null;
    if (billData.customerId) {
      const customers = await customerService.getAllCustomers();
      customer = customers.find(c => c.customerId === billData.customerId);
      
      if (!customer) {
        console.error('saveCreditBill: Invalid customerId provided', { customerId: billData.customerId });
        return res.status(400).json({ message: 'Invalid customer ID' });
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
        console.log('saveCreditBill: No customer found, creating new customer:', billData.customerName);
        const customerData = {
          customerId: `CUST${generateUniqueId()}`,
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
        console.log('saveCreditBill: Created new customer:', customer.customerId);
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

    // Create bill data
    const bill = {
      ...billData,
      customerId: customer.customerId,
      customerName: customer.customerName,
      customerContact: customer.customerContact,
      billType: 'credit',
      createdBy: req.user?.id || billData.createdBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const createdBill = await billService.createBill(bill);
    console.log('Credit bill created with invoice number:', createdBill.invoiceNo || createdBill.invoiceNumber);
    
    // Update inventory when credit bill is created
    if (bill.items && bill.items.length > 0) {
      try {
        await inventoryService.updateInventoryFromBill(bill.items, 'credit', createdBill.id);
        console.log('Inventory updated for credit bill:', createdBill.id);
      } catch (inventoryError) {
        console.error('Failed to update inventory for credit bill:', inventoryError);
        // Don't fail the bill creation if inventory update fails
      }
    }
    
    res.status(201).json({
      message: 'Credit bill saved successfully',
      bill: createdBill
    });

  } catch (error) {
    console.error('saveCreditBill Error:', error);
    res.status(500).json({ 
      message: 'Error saving credit bill',
      error: error.message 
    });
  }
};

export const updateCreditBill = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if bill exists
    const existingBill = await billService.getBillById(id, 'credit');
    if (!existingBill) {
      return res.status(404).json({ message: 'Credit bill not found' });
    }

    // Update bill
    const updatedBill = await billService.updateBill(id, {
      ...updateData,
      updatedAt: new Date()
    }, 'credit');

    res.json({
      message: 'Credit bill updated successfully',
      bill: updatedBill
    });

  } catch (error) {
    console.error('updateCreditBill Error:', error);
    res.status(500).json({ 
      message: 'Error updating credit bill',
      error: error.message 
    });
  }
};

export const deleteCreditBill = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if bill exists
    const existingBill = await billService.getBillById(id, 'credit');
    if (!existingBill) {
      return res.status(404).json({ message: 'Credit bill not found' });
    }

    // Delete bill
    await billService.deleteBill(id, 'credit');
    
    res.json({ message: 'Credit bill deleted successfully' });

  } catch (error) {
    console.error('deleteCreditBill Error:', error);
    res.status(500).json({ 
      message: 'Error deleting credit bill',
      error: error.message 
    });
  }
};

export const generatePDF = async (req, res) => {
  try {
    const { billId } = req.params;
    
    // Search for bill by invoice number instead of database ID
    const bills = await billService.getCreditBills();
    const bill = bills.find(b => b.invoiceNo === billId || b.invoiceNumber === billId);
    
    if (!bill) {
      return res.status(404).json({ message: `Credit bill with invoice number ${billId} not found` });
    }

    // Create PDF with A4 size
    let doc;
    try {
      doc = new jsPDF('p', 'mm', 'a4');
    } catch (pdfError) {
      console.error('Error creating jsPDF instance:', pdfError);
      return res.status(500).json({ message: 'Error creating PDF document', error: pdfError.message });
    }
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let y = margin;

    // Set initial font
    doc.setFontSize(10);

    // Company Header - Left side with logo placeholder
    const logoWidth = 35;
    const logoHeight = 35;
    const logoY = y;
    let textX = margin + logoWidth + 8;
    let textY = y;

    // Add logo placeholder (circle)
    doc.setDrawColor(0);
    doc.setFillColor(200, 200, 200);
    doc.circle(margin + logoWidth/2, logoY + logoHeight/2, logoWidth/2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('LOGO', margin + logoWidth/2, logoY + logoHeight/2, { align: 'center' });
    
    // Try to load actual logo if available
    if (bill.company && bill.company.logo) {
      try {
        const logoUrl = bill.company.logo;
        const logoResponse = await fetch(logoUrl);
        const logoBlob = await logoResponse.blob();
        const logoArrayBuffer = await logoBlob.arrayBuffer();
        const logoBase64 = Buffer.from(logoArrayBuffer).toString('base64');
        
        doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', margin, logoY, logoWidth, logoHeight);
      } catch (logoError) {
        console.log('Could not load logo, using placeholder:', logoError.message);
      }
    }

    // Company details - Left side
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text((bill.company && bill.company.name) ? bill.company.name : 'WYENFOS', textX, textY);
    textY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Address: ${(bill.company && bill.company.address) ? bill.company.address : 'N/A'}`, textX, textY);
    textY += 6;
    doc.text(`Mobile: ${(bill.company && bill.company.mobile) ? bill.company.mobile : 'N/A'}`, textX, textY);
    textY += 6;
    doc.text(`Email: ${(bill.company && bill.company.email) ? bill.company.email : 'N/A'}`, textX, textY);
    textY += 6;
    doc.text(`Website: ${(bill.company && bill.company.website) ? bill.company.website : 'N/A'}`, textX, textY);
    textY += 6;
    doc.text(`GSTIN: ${(bill.company && bill.company.GSTIN) ? bill.company.GSTIN : 'N/A'}`, textX, textY);
    textY += 6;
    doc.text(`State: ${(bill.company && bill.company.state) ? bill.company.state : 'N/A'} (Code: ${(bill.company && bill.company.stateCode) ? bill.company.stateCode : 'N/A'})`, textX, textY);

    // Invoice details - Right side
    const rightX = pageWidth - margin - 10;
    const rightY = y;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Bill No: ${(bill.invoiceNo || bill.invoiceNumber) ? (bill.invoiceNo || bill.invoiceNumber) : 'Pending'}`, rightX, rightY);
    doc.text(`Date: ${new Date(bill.date || bill.createdAt || Date.now()).toLocaleDateString('en-IN')}`, rightX, rightY + 6);

    y += logoHeight + 15;

    // CREDIT BILL Title - Centered
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('CREDIT BILL', pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Customer Information Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Customer Information:', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const customerData = [
      { label: 'Customer ID:', value: bill.customerId ? bill.customerId : 'N/A' },
      { label: 'Name:', value: bill.customerName ? bill.customerName : 'N/A' },
      { label: 'Address:', value: bill.customerAddress ? bill.customerAddress : 'N/A' },
      { label: 'Payment Method:', value: bill.paymentTerms ? bill.paymentTerms : 'Credit' },
      { label: 'Phone:', value: bill.customerPhone ? bill.customerPhone : 'N/A' },
      { label: 'Email:', value: bill.customerEmail ? bill.customerEmail : 'N/A' },
      { label: 'GSTIN:', value: bill.customerGSTIN ? bill.customerGSTIN : 'N/A' }
    ];

    // Two-column layout for customer data
    const colWidth = (pageWidth - 2 * margin) / 2;
    customerData.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = margin + (col * colWidth);
      const currentY = y + (row * 6);
      
      doc.setFont('helvetica', 'bold');
      doc.text(item.label, x, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(item.value, x + 35, currentY);
    });

    y += (Math.ceil(customerData.length / 2) * 6) + 10;

    // Due Dates Section (Credit Bill specific)
    if (bill.dueDates && Array.isArray(bill.dueDates) && bill.dueDates.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Payment Due Dates:', margin, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      bill.dueDates.forEach((due, index) => {
        const dueDate = due && due.date ? new Date(due.date).toLocaleDateString('en-IN') : 'N/A';
        doc.text(`Due Date ${index + 1}: ${dueDate}`, margin, y);
        y += 6;
      });
      y += 5;
    }

    // Items Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Product Details:', margin, y);
    y += 8;

    if (bill.items && Array.isArray(bill.items) && bill.items.length > 0) {
      // Table headers with background color
      const tableHeaders = ['SI No', 'Item Code', 'Item Name', 'HSN/SAC', 'Qty', 'Rate', 'Total', 'Tax %'];
      const columnWidths = [15, 25, 50, 25, 15, 20, 20, 15];
      const startX = margin;
      const headerY = y;
      
      // Draw table header background
      let totalWidth = 0;
      columnWidths.forEach(width => totalWidth += width);
      
      doc.setFillColor(153, 122, 141); // #997a8d - Purple background like CreditNote
      doc.rect(startX, headerY - 3, totalWidth, 8, 'F');
      
      // Draw table headers
      let currentX = startX;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      tableHeaders.forEach((header, index) => {
        doc.text(header, currentX, y);
        currentX += columnWidths[index];
      });
      y += 6;

      // Draw table rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      bill.items.forEach((item, index) => {
        if (y > pageHeight - 80) {
          doc.addPage();
          y = margin;
        }
        
        currentX = startX;
        const rowData = [
          (index + 1).toString(),
          item.code ? item.code : 'N/A',
          (item.description || item.itemname) ? (item.description || item.itemname) : 'N/A',
          item.hsnSac ? item.hsnSac : 'N/A',
          item.quantity ? item.quantity : 'N/A',
          formatCurrency(item.rate ? item.rate : 0),
          formatCurrency(item.total ? item.total : 0),
          `${item.gstRate ? item.gstRate : 0}%`
        ];

        rowData.forEach((cell, cellIndex) => {
          doc.text(cell, currentX, y);
          currentX += columnWidths[cellIndex];
        });
        y += 5;
      });
    }

    y += 10;

    // Totals Section - Right side
    const totalsX = pageWidth - margin - 60; // Right side position
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Totals:', totalsX, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const totals = bill.totals || {};
    const totalData = [
      { label: 'Taxable Amount:', value: formatCurrency((totals.totalTaxableValue || totals.subtotal) ? (totals.totalTaxableValue || totals.subtotal) : 0) },
      { label: 'CGST:', value: formatCurrency(totals.totalCGST ? totals.totalCGST : 0) },
      { label: 'SGST:', value: formatCurrency(totals.totalSGST ? totals.totalSGST : 0) },
      { label: 'IGST:', value: formatCurrency(totals.totalIGST ? totals.totalIGST : 0) },
      { label: 'Round Off:', value: formatCurrency(totals.roundOff ? totals.roundOff : 0) },
      { label: 'Grand Total:', value: formatCurrency((totals.grandTotal || bill.total) ? (totals.grandTotal || bill.total) : 0) }
    ];

    totalData.forEach(item => {
      doc.setFont('helvetica', 'bold');
      doc.text(item.label, totalsX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(item.value, totalsX + 50, y);
      y += 6;
    });

    y += 10;

    // Remarks Section
    if (bill.remarks) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Remarks:', margin, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(bill.remarks, margin, y);
      y += 15;
    }

    // Terms & Conditions
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Terms & Conditions:', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const terms = [
      '1. This credit bill is issued as per agreed terms.',
      '2. Contact us within 7 days for discrepancies.',
      '3. Payment must be made by the due dates mentioned above.'
    ];

    terms.forEach(term => {
      doc.text(term, margin, y);
      y += 6;
    });

    y += 10;

    // Bank Details Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Bank Details:', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const bankDetails = [
      { label: 'Company name:', value: (bill.company && bill.company.name) ? bill.company.name : 'WYENFOS' },
      { label: 'Account number:', value: (bill.company && bill.company.bankDetails && bill.company.bankDetails.accountNumber) ? bill.company.bankDetails.accountNumber : '10192468394' },
      { label: 'IFSC:', value: (bill.company && bill.company.bankDetails && bill.company.bankDetails.ifsc) ? bill.company.bankDetails.ifsc : 'KKBK0007348' },
      { label: 'SWIFT code:', value: (bill.company && bill.company.bankDetails && bill.company.bankDetails.swiftCode) ? bill.company.bankDetails.swiftCode : 'KKBKINBB' },
      { label: 'Bank name:', value: (bill.company && bill.company.bankDetails && bill.company.bankDetails.bankName) ? bill.company.bankDetails.bankName : 'Kotak Mahindra Bank' },
      { label: 'Branch:', value: (bill.company && bill.company.bankDetails && bill.company.bankDetails.branch) ? bill.company.bankDetails.branch : 'Thrissur Branch' }
    ];

    bankDetails.forEach(detail => {
      doc.setFont('helvetica', 'bold');
      doc.text(detail.label, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(detail.value, margin + 50, y);
      y += 6;
    });

    y += 10;

    // QR Code and Signature
    const qrSize = 30;
    const qrX = pageWidth - margin - qrSize;
    const qrY = y;

    // Generate QR Code
    try {
      const QRCode = await import('qrcode');
      const qrData = `${bill.invoiceNo || bill.invoiceNumber || 'Credit Bill'}\nAmount: ${formatCurrency((totals.grandTotal || bill.total) ? (totals.grandTotal || bill.total) : 0)}\nCompany: ${(bill.company && bill.company.name) ? bill.company.name : 'WYENFOS'}`;
      const qrCodeDataURL = await QRCode.default.toDataURL(qrData, {
        width: qrSize * 3,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      // Extract base64 data from data URL
      const qrBase64 = qrCodeDataURL.split(',')[1];
      doc.addImage(`data:image/png;base64,${qrBase64}`, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch (qrError) {
      console.log('Could not generate QR code, using placeholder:', qrError.message);
      // QR Code placeholder (square)
      doc.setDrawColor(0);
      doc.setFillColor(200, 200, 200);
      doc.rect(qrX, qrY, qrSize, qrSize, 'F');
      doc.setFontSize(6);
      doc.setTextColor(100, 100, 100);
      doc.text('QR', qrX + qrSize/2, qrY + qrSize/2, { align: 'center' });
    }

    // QR Code label
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('SCAN TO PAY', qrX + qrSize/2, qrY + qrSize + 5, { align: 'center' });

    // Signature section
    const signatureY = qrY + qrSize + 20;
    
    // Signature line
    doc.setDrawColor(0);
    doc.line(margin, signatureY + 8, margin + 60, signatureY + 8);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Authorized Signatory', margin, signatureY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text((bill.company && bill.company.name) ? bill.company.name : 'WYENFOS', margin, signatureY + 6);

    // Convert to base64
    let pdfBuffer, base64;
    try {
      pdfBuffer = doc.output('arraybuffer');
      base64 = Buffer.from(pdfBuffer).toString('base64');
    } catch (outputError) {
      console.error('Error converting PDF to base64:', outputError);
      return res.status(500).json({ message: 'Error converting PDF to base64', error: outputError.message });
    }

    res.json({ 
      message: 'PDF generated successfully',
      data: { pdf: base64 }
    });

  } catch (error) {
    console.error('generatePDF Error:', error);
    res.status(500).json({ 
      message: 'Error generating PDF',
      error: error.message 
    });
  }
};

export const generatePDFFromUnsaved = async (req, res) => {
  try {
    
    const { billData } = req.body;
    
    if (!billData) {
      return res.status(400).json({ message: 'Bill data is required' });
    }

    // Use the same PDF generation logic as generatePDF but with billData
    const { jsPDF } = await import('jspdf');
    
    // Create PDF document in color mode
    let doc;
    try {
      doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      // Enable color mode and set properties
      doc.setProperties({
        title: 'Credit Bill',
        subject: 'Credit Bill PDF',
        author: 'WYENFOS',
        creator: 'WYENFOS Bill System'
      });
      
      // Set PDF rendering options for better visibility
      doc.setFont('helvetica');
      doc.setDrawColor(0, 0, 0);
      doc.setFillColor(0, 0, 0);
      doc.setTextColor(0, 0, 0); // Ensure all text is black by default
      
    } catch (pdfError) {
      console.error('Error creating PDF document:', pdfError);
      return res.status(500).json({ message: 'Error creating PDF document', error: pdfError.message });
    }

    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20; // Start from top

    // Company Logo and Details (Logo on left, details on right - matching CashBill)
    
    // Company Logo (dynamic based on company name)
    try {
      
      // Get the correct logo based on company name
      const companyName = billData.company?.name || 'WYENFOS BILLS';
      const logoFileName = getCompanyLogoPath(companyName);
      const logoPath = path.join(process.cwd(), 'uploads', logoFileName);
      
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        
        // Try different methods to add the image
        try {
          // Method 1: Direct buffer
          doc.addImage(logoBuffer, 'PNG', margin, y, 30, 30);
        } catch (method1Error) {
          try {
            // Method 2: Base64 with data URL
            const logoBase64 = logoBuffer.toString('base64');
            doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', margin, y, 30, 30);
          } catch (method2Error) {
            try {
              // Method 3: Base64 without data URL
              const logoBase64 = logoBuffer.toString('base64');
              doc.addImage(logoBase64, 'PNG', margin, y, 30, 30);
            } catch (method3Error) {
              console.log('All methods failed, using placeholder');
              throw method3Error;
            }
          }
        }
      } else {
        // Fallback to placeholder if logo not found
        doc.setDrawColor(0, 0, 0);
        doc.setFillColor(100, 100, 100);
        doc.circle(margin + 15, y + 15, 15, 'F');
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.circle(margin + 15, y + 15, 15, 'S');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0); // Black text instead of white
        doc.text('LOGO', margin + 15, y + 15, { align: 'center' });
      }
    } catch (logoError) {
      console.error('Error loading logo:', logoError);
      console.error('Error details:', logoError.message);
      // Fallback to placeholder
      doc.setDrawColor(0, 0, 0);
      doc.setFillColor(100, 100, 100);
      doc.circle(margin + 15, y + 15, 15, 'F');
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.circle(margin + 15, y + 15, 15, 'S');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0); // Black text instead of white
      doc.text('LOGO', margin + 15, y + 15, { align: 'center' });
    }

    // Center logo for dual-logo companies (WYENFOS ADS and WYENFOS CASH VAPASE)
    const isDualLogoCompany = companyName === 'WYENFOS ADS' || companyName === 'WYENFOS CASH VAPASE';
    if (isDualLogoCompany) {
      try {
        const centerLogoFileName = companyName === 'WYENFOS ADS' ? 'wyenfos_ads.png' : 'wyenfos_cash.png';
        const centerLogoPath = path.join(process.cwd(), 'uploads', centerLogoFileName);
        
        if (fs.existsSync(centerLogoPath)) {
          const centerLogoBuffer = fs.readFileSync(centerLogoPath);
          // Position center logo in the middle of the header
          const centerX = pageWidth / 2 - 15; // Center position minus half logo width
          doc.addImage(centerLogoBuffer, 'PNG', centerX, y, 30, 30);
        }
      } catch (centerLogoError) {
        console.error('Error loading center logo:', centerLogoError);
      }
    }

    // Company Details (Right side of logo - same line as logo)
    const logoRightX = margin + 40; // Start company details to the right of logo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text((billData.company && billData.company.name) ? billData.company.name : 'WYENFOS INFOTECH PRIVATE LIMITED', logoRightX, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const companyDetails = [
      (billData.company && billData.company.address) ? billData.company.address : 'Thekkekara Arcade, Chelakottukara, Thrissur, Kerala, 680001',
      (billData.company && billData.company.phone) ? `Phone: ${billData.company.phone}` : 'Phone: 8547014116',
      (billData.company && billData.company.email) ? `Email: ${billData.company.email}` : 'Email: wyenfos@gmail.com',
      (billData.company && billData.company.website) ? `Website: ${billData.company.website}` : 'Website: www.wyenfos.com',
      (billData.company && billData.company.gstin) ? `GSTIN: ${billData.company.gstin}` : 'GSTIN: WYENFOS-GST123456789',
      (billData.company && billData.company.state) ? `State: ${billData.company.state}` : 'State: Kerala (Code: KL)'
    ];

    companyDetails.forEach(detail => {
      doc.text(detail, logoRightX, y);
      y += 5;
    });
    
    y += 5; // Add some space after company details

    // Bill Information (Right side) - Moved further right to avoid overlap
    const billInfoX = pageWidth - margin - 40;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Bill No:', billInfoX, 20);
    doc.setFont('helvetica', 'normal');
    doc.text(billData.invoiceNo || billData.invoiceNumber || 'N/A', billInfoX + 25, 20);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', billInfoX, 25);
    doc.setFont('helvetica', 'normal');
    doc.text(billData.date ? new Date(billData.date).toLocaleDateString('en-IN') : 'N/A', billInfoX + 25, 25);

    // CREDIT BILL Title
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('CREDIT BILL', pageWidth / 2, y, { align: 'center' });
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
      { label: 'Customer ID:', value: billData.customerId || 'N/A' },
      { label: 'Name:', value: billData.customerName || 'N/A' },
      { label: 'Address:', value: billData.customerAddress || 'N/A' },
      { label: 'Payment Method:', value: billData.paymentTerms || 'Credit' }
    ];

    // Right side customer details
    const rightCustomerDetails = [
      { label: 'Phone:', value: billData.customerPhone || 'N/A' },
      { label: 'Email:', value: billData.customerEmail || 'N/A' },
      { label: 'GSTIN:', value: billData.customerGSTIN || 'N/A' }
    ];

    const rightCustomerX = pageWidth / 2 + 20; // Align with red line position like CreditNote
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

    // Due Dates Section
    if (billData.dueDates && billData.dueDates.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Due Dates:', margin, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      billData.dueDates.forEach((dueDate, index) => {
        if (dueDate.date) {
          doc.text(`Due Date ${index + 1}: ${new Date(dueDate.date).toLocaleDateString('en-IN')}`, margin, y);
          y += 6;
        }
      });
      y += 5;
    }

    y += 10;

    // Product Details Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Product Details:', margin, y);
    y += 8;

    // Table headers with background color
    const headers = ['SI No', 'Item Code', 'Item Name', 'HSN/SAC', 'Qty', 'Rate', 'Total', 'Tax %'];
    const colWidths = [15, 25, 40, 25, 15, 20, 25, 15]; // Reduced Item Name width from 60 to 40
    let x = margin;

    // Draw background for headers
    doc.setFillColor(153, 122, 141); // #997a8d - Purple background like CreditNote
    doc.rect(x, y - 5, colWidths.reduce((a, b) => a + b, 0), 8, 'F');

    headers.forEach((header, index) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(header, x, y);
      x += colWidths[index];
    });

    y += 8;

    // Table data
    if (billData.items && billData.items.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      billData.items.forEach((item, index) => {
        if (item.description || item.code) {
          x = margin;
          doc.text((index + 1).toString(), x, y);
          x += colWidths[0];
          doc.text(item.code || '', x, y);
          x += colWidths[1];
          doc.text(item.description || '', x, y);
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
          doc.text(item.gstRate || '', x, y);
          y += 6;
        }
      });
    }

    y += 10;

    // Totals Section (Right side) - Added more margin
    const totalsX = pageWidth - margin - 100;
    const totals = billData.totals || {};
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Taxable Amount:', totalsX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`₹${(totals.totalTaxableValue || 0).toFixed(2)}`, totalsX + 50, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('CGST:', totalsX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`₹${(totals.totalCGST || 0).toFixed(2)}`, totalsX + 50, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('SGST:', totalsX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`₹${(totals.totalSGST || 0).toFixed(2)}`, totalsX + 50, y);
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
    doc.text(billData.remarks || 'N/A', margin + 25, y);

    y += 20;

    // Check if we need a new page for terms and conditions
    const termsHeight = 8 + (6 * 3) + 15; // Header + 3 terms + spacing
    const bankDetailsHeight = 8 + (6 * 6) + 50; // Header + 6 bank details + QR + signature
    const pageHeight = 297; // A4 height in mm
    const currentY = y;
    
    // Check if terms + bank details will fit on current page
    if (currentY + termsHeight + bankDetailsHeight > pageHeight - 20) {
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
      '1. This credit bill is issued as per agreed terms.',
      '2. Contact us within 7 days for discrepancies.',
      '3. Amount credited can be adjusted against future invoices.'
    ];

    terms.forEach((term, index) => {
      doc.text(term, margin, y);
      y += 6;
    });

    y += 15;

    // Check if we need a new page for bank details
    const remainingSpace = pageHeight - y;
    
    if (remainingSpace < bankDetailsHeight + 20) {
      doc.addPage();
      y = 20; // Reset Y position for new page
    }

    // Bank Details Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Bank Details:', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const bankDetails = [
      { label: 'Company name:', value: (billData.company && billData.company.name) ? billData.company.name : 'WYENFOS' },
      { label: 'Account number:', value: (billData.company && billData.company.bankDetails && billData.company.bankDetails.accountNumber) ? billData.company.bankDetails.accountNumber : '10192468394' },
      { label: 'IFSC:', value: (billData.company && billData.company.bankDetails && billData.company.bankDetails.ifsc) ? billData.company.bankDetails.ifsc : 'KKBK0007348' },
      { label: 'SWIFT code:', value: (billData.company && billData.company.bankDetails && billData.company.bankDetails.swiftCode) ? billData.company.bankDetails.swiftCode : 'KKBKINBB' },
      { label: 'Bank name:', value: (billData.company && billData.company.bankDetails && billData.company.bankDetails.bankName) ? billData.company.bankDetails.bankName : 'Kotak Mahindra Bank' },
      { label: 'Branch:', value: (billData.company && billData.company.bankDetails && billData.company.bankDetails.branch) ? billData.company.bankDetails.branch : 'Thrissur Branch' }
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
      const qrCodePath = path.join(process.cwd(), 'server', 'uploads', 'bank-qr-codes', 'WYENFOS_QR_1755336487474.png');
      
      if (fs.existsSync(qrCodePath)) {
        const qrBuffer = fs.readFileSync(qrCodePath);
        const qrBase64 = qrBuffer.toString('base64');
        
        // Add existing QR code to PDF
        doc.addImage(`data:image/png;base64,${qrBase64}`, 'PNG', qrX, qrY, qrSize, qrSize);
      } else {
        // Generate new QR code if file doesn't exist
        const QRCode = await import('qrcode');
        
        // Generate QR code data (bank details for payment)
        const qrData = {
          company: (billData.company && billData.company.name) ? billData.company.name : 'WYENFOS',
          accountNumber: (billData.company && billData.company.bankDetails && billData.company.bankDetails.accountNumber) ? billData.company.bankDetails.accountNumber : '10192468394',
          ifsc: (billData.company && billData.company.bankDetails && billData.company.bankDetails.ifsc) ? billData.company.bankDetails.ifsc : 'KKBK0007348',
          bankName: (billData.company && billData.company.bankDetails && billData.company.bankDetails.bankName) ? billData.company.bankDetails.bankName : 'Kotak Mahindra Bank',
          branch: (billData.company && billData.company.bankDetails && billData.company.bankDetails.branch) ? billData.company.bankDetails.branch : 'Thrissur Branch',
          amount: (billData.totals && billData.totals.grandTotal) ? billData.totals.grandTotal : '0',
          billNumber: billData.invoiceNo || billData.invoiceNumber || 'N/A'
        };
        
        // Convert to JSON string for QR code
        const qrString = JSON.stringify(qrData);
        
        // Generate QR code as base64
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
        
        // Add QR code to PDF
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
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0); // Black text instead of white
      doc.text('QR CODE', qrX + qrSize/2, qrY + qrSize/2, { align: 'center' });
    }

    // QR Code label
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
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
    doc.text((billData.company && billData.company.name) ? billData.company.name : 'WYENFOS', qrX, signatureY + 6);

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
      pdfBuffer = doc.output('arraybuffer');
      base64 = Buffer.from(pdfBuffer).toString('base64');
    } catch (outputError) {
      console.error('Error converting PDF to base64:', outputError);
      console.error('Output Error details:', outputError);
      return res.status(500).json({ message: 'Error converting PDF to base64', error: outputError.message });
    }

    res.json({ 
      message: 'PDF generated successfully',
      data: { pdf: base64 }
    });

  } catch (error) {
    console.error('generatePDFFromUnsaved Error:', error);
    res.status(500).json({ 
      message: 'Error generating PDF from unsaved data',
      error: error.message 
    });
  }
};

export const sendEmail = async (req, res) => {
  try {
    
    const { email, emailTo, subject, body, pdfBase64 } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Email configuration
    const mailOptions = {
      from: process.env.MAIL_USER || 'Wyenfos014@gmail.com',
      to: emailTo || email,
      subject: subject || `Credit Bill from WYENFOS`,
      html: body || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #b39eb5; border-bottom: 2px solid #b39eb5; padding-bottom: 10px;">
            Credit Bill from WYENFOS
          </h2>
          
          <p>Please find attached your credit bill for the purchased items.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Bill Details:</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li><strong>Payment Terms:</strong> Credit</li>
              <li><strong>Status:</strong> Active</li>
            </ul>
          </div>
          
          <p><strong>Payment Instructions:</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Please make payment by the due dates mentioned in the attached bill</li>
            <li>Payment can be made through bank transfer or other agreed methods</li>
            <li>For any queries regarding payment, please contact us immediately</li>
          </ul>
          
          <p>If you have any questions, please don't hesitate to contact us.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="margin: 0;"><strong>Best regards,</strong><br>
            WYENFOS<br>
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
      mailOptions.attachments.push({
        filename: `CreditBill.pdf`,
        content: pdfBase64,
        encoding: 'base64',
        contentType: 'application/pdf'
      });
    }

    // Add timeout for email sending
    const emailPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email sending timed out')), 20000); // 20 second timeout
    });
    
    await Promise.race([emailPromise, timeoutPromise]);
    
    res.json({ message: 'Email sent successfully' });

  } catch (error) {
    console.error('sendEmail Error:', error);
    res.status(500).json({ 
      message: 'Error sending email',
      error: error.message 
    });
  }
};

export const getWeeklyTotalCreditBill = async (req, res) => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const bills = await billService.getCreditBills();
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
    console.error('getWeeklyTotalCreditBill Error:', error);
    res.status(500).json({ 
      message: 'Error fetching weekly total',
      error: error.message 
    });
  }
};

export const getTodayCreditBills = async (req, res) => {
  try {
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let bills = [];
    try {
      bills = await billService.getCreditBills();
    } catch (error) {
      console.error('❌ Error fetching credit bills:', error.message);
      bills = [];
    }

    const todayBills = bills.filter(bill => {
      const billDate = new Date(bill.createdAt);
      return billDate >= today;
    });

    const total = todayBills.reduce((sum, bill) => sum + (bill.total || bill.totalAmount || 0), 0);
    
    res.json({ 
      total,
      count: todayBills.length,
      bills: todayBills
    });
  } catch (error) {
    console.error('❌ getTodayCreditBills Error:', error);
    res.status(500).json({ 
      message: 'Error fetching today\'s credit bills',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
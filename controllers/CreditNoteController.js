import { 
  firebaseService, 
  billService, 
  productService, 
  inventoryService 
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
import { withRetry } from '../services/retryLogic.js';
import { jsPDF } from 'jspdf';
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

const verifyTransporter = async () => {
  return withRetry(async () => {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });
    return new Promise((resolve, reject) => {
      transporter.verify((error, success) => {
        if (error) {
          console.error('Transporter verification failed:', error);
          reject(error);
        } else {
          resolve(transporter);
        }
      });
    });
  }, 3, 300);
};

const checkAdminPermission = (user) => {
  const allowedRoles = ['Accounts Admin', 'Super Admin'];
  return user && allowedRoles.includes(user.role);
};

const getLatestCreditNote = async (req, res) => {
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
    
    // Use normal incrementing logic for all companies
    const creditNotes = await firebaseService.getAll('creditnotes');
    
    const companyCreditNotes = creditNotes.filter(note => {
      const noteCompanyName = note.company?.name;
      return noteCompanyName === company;
    });
    
    let latestNumber = 0;
    
    companyCreditNotes.forEach(note => {
      if (note.invoiceNumber && note.invoiceNumber.startsWith(prefix + '-')) {
        const numberPart = parseInt(note.invoiceNumber.split('-')[1], 10);
        if (!isNaN(numberPart) && numberPart > latestNumber) {
          latestNumber = numberPart;
        }
      }
    });
    
    const nextNumber = latestNumber + 1;
    const invoiceNumber = `${prefix}-${nextNumber}`;
    
    // Ensure we start from 1 if no credit notes exist
    if (companyCreditNotes.length === 0) {
      const firstInvoiceNumber = `${prefix}-1`;
      res.json({ invoiceNumber: firstInvoiceNumber });
      return;
    }
    
    res.json({ invoiceNumber });
  } catch (error) {
    console.error('Error fetching latest credit note:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const createCreditNote = async (req, res) => {
  try {
    const { company, sourceBill } = req.body;
    if (!company?.name) {
      return res.status(400).json({ message: 'Company is required' });
    }

    // Validate source bill if provided
    if (sourceBill?.invoiceNumber) {
      const cashBills = await billService.getCashBills();
      const creditBills = await billService.getCreditBills();
      
      const cashBill = cashBills.find(bill => bill.invoiceNumber === sourceBill.invoiceNumber);
      const creditBill = creditBills.find(bill => bill.invoiceNumber === sourceBill.invoiceNumber);
      
      if (!cashBill && !creditBill) {
        return res.status(400).json({ message: 'Invalid source bill invoice number' });
      }
      sourceBill.billType = cashBill ? 'CashBill' : 'CreditBill';
      sourceBill.billId = (cashBill || creditBill).id;
    }

    // Generate invoice number using the same logic as getLatestCreditNote
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
    
    // Use normal incrementing logic for all companies
    const creditNotes = await firebaseService.getAll('creditnotes');
    
    const companyCreditNotes = creditNotes.filter(note => {
      const noteCompanyName = note.company?.name;
      return noteCompanyName === company.name;
    });
    
    let latestNumber = 0;
    
    companyCreditNotes.forEach(note => {
      if (note.invoiceNumber && note.invoiceNumber.startsWith(prefix + '-')) {
        const numberPart = parseInt(note.invoiceNumber.split('-')[1], 10);
        if (!isNaN(numberPart) && numberPart > latestNumber) {
          latestNumber = numberPart;
        }
      }
    });
    
    const nextNumber = latestNumber + 1;
    const invoiceNumber = `${prefix}-${nextNumber}`;
    
    // Ensure we start from 1 if no credit notes exist
    if (companyCreditNotes.length === 0) {
      const firstInvoiceNumber = `${prefix}-1`;
      const noteData = {
        ...req.body,
        invoiceNumber: firstInvoiceNumber,
        createdBy: req.user?.email || 'unknown',
        lastUpdatedBy: req.user?.email || 'unknown',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const savedNote = await firebaseService.create('creditnotes', noteData);
      res.status(201).json({ 
        success: true, 
        message: 'Credit note created successfully', 
        data: savedNote 
      });
      return;
    }
    
    const noteData = {
      ...req.body,
      invoiceNumber,
      createdBy: req.user?.email || 'unknown',
      lastUpdatedBy: req.user?.email || 'unknown',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const savedNote = await firebaseService.create('creditnotes', noteData);

    // Update products and inventory when credit note is created (product returns)
    
    await Promise.all(
      savedNote.items.map(async (item) => {
        try {
          
          // Update inventory first
          const inventoryItems = await inventoryService.getAllInventoryItems();
          const existingInventory = inventoryItems.find(inv => inv.itemCode === item.itemCode);

          if (existingInventory) {
            // Update existing inventory - increase quantity for returned items
            const oldQuantity = existingInventory.quantity || 0;
            const newQuantity = oldQuantity + item.qty;
            
            existingInventory.quantity = newQuantity;
            existingInventory.lastUpdated = new Date();
            existingInventory.lastReturnDate = new Date();
            existingInventory.totalReturns = (existingInventory.totalReturns || 0) + item.qty;
            
            await inventoryService.updateInventoryItem(existingInventory.id, existingInventory);
          } else {
            // Create new inventory item for returned product
            const newInventoryData = {
              itemCode: item.itemCode,
              itemName: item.name || item.itemName,
              unitPrice: item.rate || item.unitPrice || 0,
              gst: item.gst || 0,
              quantity: item.qty,
              lastUpdated: new Date(),
              lastReturnDate: new Date(),
              totalReturns: item.qty,
              createdAt: new Date(),
              createdBy: 'credit-note-system'
            };
            
            await inventoryService.createInventoryItem(newInventoryData);
          }

          // Update products list
          const products = await productService.getAllProducts();
          let product = products.find(p => p.itemCode === item.itemCode);

          if (product) {
            const oldProductQuantity = product.quantity || 0;
            const newProductQuantity = oldProductQuantity + item.qty;
            
            product.quantity = newProductQuantity;
            product.lastUpdated = new Date();
            
            await productService.updateProduct(product.id, product);
          } else {
            // Create new product entry for returned item
            const newProductData = {
              itemCode: item.itemCode,
              itemName: item.name || item.itemName,
              hsn: item.hsnCode || item.hsn || '',
              unitPrice: item.rate || item.unitPrice || 0,
              gst: item.gst || 0,
              quantity: item.qty,
              createdBy: req.user?.id || req.user?.uid || null,
              createdAt: new Date(),
              lastUpdated: new Date()
            };
            
            await productService.createProduct(newProductData);
          }

          // Record the return transaction
          const returnData = {
            itemCode: item.itemCode,
            itemName: item.name || item.itemName,
            quantity: item.qty,
            unitPrice: item.rate || item.unitPrice || 0,
            gst: item.gst || 0,
            returnType: 'credit-note',
            creditNoteId: savedNote.id,
            creditNoteNumber: savedNote.invoiceNumber,
            returnDate: new Date(),
            reason: item.reason || 'Customer return via credit note',
            processedBy: req.user?.email || req.user?.name || 'unknown',
            createdAt: new Date()
          };
          
          await firebaseService.create('productReturns', returnData);
          
        } catch (itemError) {
          console.error(`Error processing return item ${item.itemCode}:`, itemError);
          // Continue processing other items even if one fails
        }
      })
    );

    res.status(201).json(savedNote);
  } catch (error) {
    console.error('Error creating credit note:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getAllCreditNotes = async (req, res) => {
  try {
    const notes = await firebaseService.getAll('creditnotes');
    res.json(notes);
  } catch (error) {
    console.error('Error fetching all credit notes:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getCreditNoteById = async (req, res) => {
  try {
    const note = await firebaseService.getById('creditnotes', req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Credit note not found' });
    }
    res.json(note);
  } catch (error) {
    console.error('Error fetching credit note by ID:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getBillDetails = async (req, res) => {
  try {
    const { invoiceNumber } = req.query;
    if (!invoiceNumber) {
      return res.status(400).json({ message: 'Invoice number is required' });
    }
    
    const cashBills = await billService.getCashBills();
    const creditBills = await billService.getCreditBills();
    
    const cashBill = cashBills.find(bill => bill.invoiceNumber === invoiceNumber);
    const creditBill = creditBills.find(bill => bill.invoiceNumber === invoiceNumber);
    
    if (!cashBill && !creditBill) {
      return res.status(404).json({ message: 'Bill not found' });
    }
    
    const bill = cashBill || creditBill;
    res.json({
      items: bill.items,
      taxType: bill.isOtherState ? 'igst' : 'cgst_sgst'
    });
  } catch (error) {
    console.error('Error fetching bill details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateCreditNote = async (req, res) => {
  try {
    if (!checkAdminPermission(req.user)) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    const note = await firebaseService.getById('creditnotes', req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Credit note not found' });
    }
    
    const updateData = {
      ...req.body,
      lastUpdatedBy: req.user?.email || 'unknown',
      updatedAt: new Date()
    };
    
    const updatedNote = await firebaseService.update('creditnotes', req.params.id, updateData);
    res.json(updatedNote);
  } catch (error) {
    console.error('Error updating credit note:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteCreditNote = async (req, res) => {
  try {
    if (!checkAdminPermission(req.user)) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    const note = await firebaseService.delete('creditnotes', req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Credit note not found' });
    }
    res.json({ message: 'Credit note deleted successfully' });
  } catch (error) {
    console.error('Error deleting credit note:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



const sendEmail = async (req, res) => {
  try {
    const note = await firebaseService.getById('creditNotes', req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Credit note not found' });
    }
    
    const transporter = await verifyTransporter();
    const doc = new PDFDocument();
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', async () => {
      const pdfData = Buffer.concat(buffers);
      const mailOptions = {
        from: process.env.MAIL_USER,
        to: note.customer?.email || req.body.emailTo,
        subject: `Credit Note #${note.invoiceNumber} - ${note.company.name}`,
        html: `
          <p>Dear ${note.customer?.name || 'Customer'},</p>
          <p>Please find attached the credit note from ${note.company.name}.</p>
          <p><strong>Credit Note Details:</strong></p>
          <ul>
            <li>Note Number: ${note.invoiceNumber}</li>
            <li>Date: ${new Date(note.createdAt).toLocaleDateString('en-IN')}</li>
            ${note.sourceBill?.invoiceNumber ? `<li>Source Bill: ${note.sourceBill.invoiceNumber}</li>` : ''}
          </ul>
          <p>Thank you for your business!</p>
          <p>Best regards,<br>${note.company.name}</p>
        `,
        attachments: [
          {
            filename: `Credit_Note_${note.invoiceNumber}.pdf`,
            content: pdfData,
            contentType: 'application/pdf'
          }
        ]
      };
      await transporter.sendMail(mailOptions);
      res.json({ message: 'Email sent successfully' });
    });
    
    // Generate PDF content
    doc.fontSize(14).text(note.company.name || 'WYENFOS', 50, 50);
    doc.fontSize(10).text(`Address: ${note.company.address || 'Thekkekara Arcade, Chelakottukara, Thrissur, Kerala, 680001'}`, 50, 70);
    doc.text(`GSTIN: ${note.company.GSTIN || '32AAECW1234B1Z0'}`, 50, 85);
    doc.text(`Mobile: ${note.company.mobile || ''}`, 50, 100);
    doc.text(`Email: ${note.company.email || ''}`, 50, 115);
    doc.text(`Credit Note No: ${note.invoiceNumber}`, 50, 130);
    doc.text(`Date: ${new Date(note.createdAt).toLocaleDateString('en-IN')}`, 50, 145);
    if (note.sourceBill?.invoiceNumber) {
      doc.text(`Source Bill: ${note.sourceBill.invoiceNumber} (${note.sourceBill.billType})`, 50, 160);
    }
    doc.fontSize(12).text('Items', 50, 180);
    let y = 200;
    note.items.forEach((item, index) => {
      doc.fontSize(10).text(`${index + 1}. ${item.name} (${item.itemCode})`, 50, y);
      doc.text(`HSN: ${item.hsnCode}, Qty: ${item.qty}, Rate: Rs.${item.rate.toFixed(2)}`, 70, y + 15);
      y += 40;
    });
    doc.text(`Tax Type: ${note.taxType}`, 50, y);
    y += 15;
    doc.text(`Taxable Amount: Rs.${note.totals.taxableAmount.toFixed(2)}`, 50, y);
    y += 15;
    
    // Handle returned amount instead of tax fields
    if (note.totals.returnedAmount) {
      doc.text(`Returned Amount: Rs.${note.totals.returnedAmount.toFixed(2)}`, 50, y);
      y += 15;
    }
    
    doc.text(`Round Off: Rs.${note.totals.roundOff.toFixed(2)}`, 50, y);
    y += 15;
    doc.text(`Grand Total: Rs.${note.totals.rounded.toFixed(2)}`, 50, y);
    y += 15;
    doc.text(`Notes: ${note.notes || 'N/A'}`, 50, y);
    if (note.isCancelled) {
      doc.fontSize(20).fillColor('red').text('CANCELLED', 200, 400, { align: 'center' });
    }
    doc.end();
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const sendEmailUnsaved = async (req, res) => {
  try {
    const { emailTo, subject, body, pdfBase64 } = req.body;
    
    if (!emailTo || !subject || !body || !pdfBase64) {
      return res.status(400).json({ message: 'Missing required fields: emailTo, subject, body, pdfBase64' });
    }
    
    const transporter = await verifyTransporter();
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    
    const mailOptions = {
      from: process.env.MAIL_USER,
      to: emailTo,
      subject: subject,
      html: body,
      attachments: [
        {
          filename: `Credit_Note_Draft.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };
    
    await transporter.sendMail(mailOptions);
    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PDF Generation for CreditNote
const generatePDF = async (req, res) => {
  try {
    const { creditNoteId } = req.params;
    
    // Fetch credit note data
    const creditNote = await firebaseService.getById('creditnotes', creditNoteId);
    if (!creditNote) {
      return res.status(404).json({ message: 'Credit note not found' });
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
      title: `Credit Note - ${creditNote.invoiceNumber}`,
      subject: 'Credit Note',
      author: 'WYENFOS',
      creator: 'WYENFOS Billing System'
    });

    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20; // Start from top

    // Company Logo and Details (Logo on left, details on right - matching CreditBill)
    
    // Company Logo (dynamic based on company name)
    try {
      
      // Get the correct logo based on company name
      const companyName = creditNote.company?.name || 'WYENFOS BILLS';
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
    doc.text(creditNote.company?.name || 'WYENFOS INFOTECH PRIVATE LIMITED', logoRightX, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const companyDetails = [
      creditNote.company?.address || 'Thekkekara Arcade, Chelakottukara, Thrissur, Kerala, 680001',
      `Phone: ${creditNote.company?.mobile || '8547014116'}`,
      `Email: ${creditNote.company?.email || 'wyenfos@gmail.com'}`,
      `Website: ${creditNote.company?.website || 'www.wyenfos.com'}`,
      `GSTIN: ${creditNote.company?.gstin || 'WYENFOS-GST123456789'}`,
      `State: ${creditNote.company?.state || 'Kerala (Code: KL)'}`
    ];

    companyDetails.forEach(detail => {
      doc.text(detail, logoRightX, y);
      y += 5;
    });
    
    y += 5;

    // Credit Note Information (Right side) - Moved further right to avoid overlap
    const noteInfoX = pageWidth - margin - 40;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Note No:', noteInfoX, 20);
    doc.setFont('helvetica', 'normal');
    doc.text(creditNote.invoiceNumber || 'N/A', noteInfoX + 25, 20);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', noteInfoX, 25);
    doc.setFont('helvetica', 'normal');
    doc.text(creditNote.date ? new Date(creditNote.date).toLocaleDateString('en-IN') : 'N/A', noteInfoX + 25, 25);

    // CREDIT NOTE Title
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('CREDIT NOTE', pageWidth / 2, y, { align: 'center' });
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
      { label: 'Customer ID:', value: creditNote.customerId || 'N/A' },
      { label: 'Name:', value: creditNote.customerName || 'N/A' },
      { label: 'Address:', value: creditNote.customerAddress || 'N/A' },
      { label: 'Reason:', value: creditNote.reason || 'N/A' }
    ];

    // Right side customer details
    const rightCustomerDetails = [
      { label: 'Phone:', value: creditNote.customerPhone || 'N/A' },
      { label: 'Email:', value: creditNote.customerEmail || 'N/A' },
      { label: 'Payment Mode:', value: creditNote.paymentMode || 'Credit' }
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
    const headers = ['SI No', 'Item Code', 'Item Name', 'HSN/SAC', 'Qty', 'Rate', 'Total', 'Return Qty'];
    const colWidths = [15, 25, 40, 25, 15, 20, 25, 20]; // Reduced Item Name width
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
    if (creditNote.items && creditNote.items.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      creditNote.items.forEach((item, index) => {
        if (item.name || item.itemCode) {
          x = margin;
          doc.text((index + 1).toString(), x, y);
          x += colWidths[0];
          doc.text(item.itemCode || '', x, y);
          x += colWidths[1];
          doc.text(item.name || '', x, y);
          x += colWidths[2];
          doc.text(item.hsnCode || '', x, y);
          x += colWidths[3];
          doc.text(item.quantity || '', x, y);
          x += colWidths[4];
          doc.text(item.rate || '', x, y);
          x += colWidths[5];
          // Calculate and display the correct item total
          const itemTotal = parseFloat(item.rate || 0) * parseFloat(item.quantity || 0);
          doc.text(itemTotal.toFixed(2), x, y);
          x += colWidths[6];
          doc.text(item.returnQty || '', x, y);
          y += 6;
        }
      });
    }

    y += 10;

    // Totals Section (Right side) - Added more margin
    const totalsX = pageWidth - margin - 100;
    const totals = creditNote.totals || {};
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Taxable Amount:', totalsX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(`₹${(totals.subtotal || 0).toFixed(2)}`), totalsX + 50, y);
    y += 6;

    // Handle returned amount instead of tax fields
    if (totals.returnedAmount) {
      doc.setFont('helvetica', 'bold');
      doc.text('Returned Amount:', totalsX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(`₹${(totals.returnedAmount || 0).toFixed(2)}`), totalsX + 50, y);
      y += 6;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Round Off:', totalsX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(`₹${(totals.roundOff || 0).toFixed(2)}`), totalsX + 50, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Grand Total:', totalsX, y);
    doc.text(String(`₹${(totals.grandTotal || 0).toFixed(2)}`), totalsX + 50, y);

    y += 20;

    // Remarks
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Remarks:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(creditNote.notes || 'N/A', margin + 25, y);

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
      '1. This credit note is issued as per agreed terms.',
      '2. Refund or adjustment to be processed within 7 days.',
      '3. Contact us for any discrepancies.'
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
      { label: 'Company name:', value: (creditNote.company && creditNote.company.name) ? creditNote.company.name : 'WYENFOS INFOTECH PRIVATE LIMITED' },
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
          company: (creditNote.company && creditNote.company.name) ? creditNote.company.name : 'WYENFOS',
          accountNumber: '10192468394',
          ifsc: 'IDFB0080732',
          bankName: 'IDFC FIRST',
          branch: 'THRISSUR - EAST FORT THRISSUR BRANCH',
          amount: totals.grandTotal || '0',
          noteNumber: creditNote.invoiceNumber || 'N/A'
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
    doc.text(creditNote.company?.name || 'WYENFOS', qrX, signatureY + 6);

    
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

// PDF Generation from unsaved data
const generatePDFFromUnsaved = async (req, res) => {
  try {
    const { creditNoteData } = req.body;
    
    if (!creditNoteData) {
      return res.status(400).json({ message: 'Credit note data is required' });
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
      title: `Credit Note - ${creditNoteData.invoiceNumber}`,
      subject: 'Credit Note',
      author: 'WYENFOS',
      creator: 'WYENFOS Billing System'
    });

    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20; // Start from top

    // Company Logo and Details (Logo on left, details on right - matching CreditBill)
    
    // Company Logo (dynamic based on company name)
    try {
      
      // Get the correct logo based on company name
      const companyName = creditNoteData.company?.name || 'WYENFOS BILLS';
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
    doc.text(creditNoteData.company?.name || 'WYENFOS INFOTECH PRIVATE LIMITED', logoRightX, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const companyDetails = [
      creditNoteData.company?.address || 'Thekkekara Arcade, Chelakottukara, Thrissur, Kerala, 680001',
      `Phone: ${creditNoteData.company?.mobile || '8547014116'}`,
      `Email: ${creditNoteData.company?.email || 'wyenfos@gmail.com'}`,
      `Website: ${creditNoteData.company?.website || 'www.wyenfos.com'}`,
      `GSTIN: ${creditNoteData.company?.gstin || 'WYENFOS-GST123456789'}`,
      `State: ${creditNoteData.company?.state || 'Kerala (Code: KL)'}`
    ];

    companyDetails.forEach(detail => {
      doc.text(detail, logoRightX, y);
      y += 5;
    });
    
    y += 5;

    // Credit Note Information (Right side) - Moved further right to avoid overlap
    const noteInfoX = pageWidth - margin - 40;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Note No:', noteInfoX, 20);
    doc.setFont('helvetica', 'normal');
    doc.text(creditNoteData.invoiceNumber || 'N/A', noteInfoX + 25, 20);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', noteInfoX, 25);
    doc.setFont('helvetica', 'normal');
    doc.text(creditNoteData.date ? new Date(creditNoteData.date).toLocaleDateString('en-IN') : 'N/A', noteInfoX + 25, 25);

    // CREDIT NOTE Title
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('CREDIT NOTE', pageWidth / 2, y, { align: 'center' });
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
      { label: 'Customer ID:', value: creditNoteData.customerId || 'N/A' },
      { label: 'Name:', value: creditNoteData.customerName || 'N/A' },
      { label: 'Address:', value: creditNoteData.customerAddress || 'N/A' },
      { label: 'Reason:', value: creditNoteData.reason || 'N/A' }
    ];

    // Right side customer details
    const rightCustomerDetails = [
      { label: 'Phone:', value: creditNoteData.customerPhone || 'N/A' },
      { label: 'Email:', value: creditNoteData.customerEmail || 'N/A' },
      { label: 'Payment Mode:', value: creditNoteData.paymentMode || 'Credit' }
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
    const headers = ['SI No', 'Item Code', 'Item Name', 'HSN/SAC', 'Qty', 'Rate', 'Total', 'Return Qty'];
    const colWidths = [15, 25, 40, 25, 15, 20, 25, 20]; // Reduced Item Name width
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
    if (creditNoteData.items && creditNoteData.items.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      creditNoteData.items.forEach((item, index) => {
        if (item.name || item.itemCode) {
          x = margin;
          doc.text(String(index + 1), x, y);
          x += colWidths[0];
          doc.text(String(item.itemCode || ''), x, y);
          x += colWidths[1];
          doc.text(String(item.name || ''), x, y);
          x += colWidths[2];
          doc.text(String(item.hsnCode || ''), x, y);
          x += colWidths[3];
          doc.text(String(item.quantity || ''), x, y);
          x += colWidths[4];
          doc.text(String(item.rate || ''), x, y);
          x += colWidths[5];
          // Calculate and display the correct item total
          const itemTotal = parseFloat(item.rate || 0) * parseFloat(item.quantity || 0);
          doc.text(String(itemTotal.toFixed(2)), x, y);
          x += colWidths[6];
          doc.text(String(item.returnQty || ''), x, y);
          y += 6;
        }
      });
    }

    y += 10;

    // Totals Section (Right side) - Added more margin
    const totalsX = pageWidth - margin - 100;
    const totals = creditNoteData.totals || {};
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Taxable Amount:', totalsX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(`₹${(totals.subtotal || 0).toFixed(2)}`), totalsX + 50, y);
    y += 6;

    // Handle returned amount instead of tax fields
    if (totals.returnedAmount) {
      doc.setFont('helvetica', 'bold');
      doc.text('Returned Amount:', totalsX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(`₹${(totals.returnedAmount || 0).toFixed(2)}`), totalsX + 50, y);
      y += 6;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Round Off:', totalsX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(`₹${(totals.roundOff || 0).toFixed(2)}`), totalsX + 50, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Grand Total:', totalsX, y);
    doc.text(String(`₹${(totals.grandTotal || 0).toFixed(2)}`), totalsX + 50, y);

    y += 20;

    // Remarks
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Remarks:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(creditNoteData.notes || 'N/A', margin + 25, y);

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
      '1. This credit note is issued as per agreed terms.',
      '2. Refund or adjustment to be processed within 7 days.',
      '3. Contact us for any discrepancies.'
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
      { label: 'Company name:', value: (creditNoteData.company && creditNoteData.company.name) ? creditNoteData.company.name : 'WYENFOS INFOTECH PRIVATE LIMITED' },
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
          company: (creditNoteData.company && creditNoteData.company.name) ? creditNoteData.company.name : 'WYENFOS',
          accountNumber: '10192468394',
          ifsc: 'IDFB0080732',
          bankName: 'IDFC FIRST',
          branch: 'THRISSUR - EAST FORT THRISSUR BRANCH',
          amount: totals.grandTotal || '0',
          noteNumber: creditNoteData.invoiceNumber || 'N/A'
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
    doc.text(creditNoteData.company?.name || 'WYENFOS', qrX, signatureY + 6);

    
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

// Function to find bill by bill number (for both cash and credit bills)
const findBillByNumber = async (req, res) => {
  try {
    const { billNumber } = req.params;
    const { billType } = req.query; // 'cashbill' or 'creditbill'
    
    if (!billNumber) {
      return res.status(400).json({ message: 'Bill number is required' });
    }
    
    let bill = null;
    
    if (billType === 'cashbill') {
      const cashBills = await firebaseService.getAll('cashbills');
      bill = cashBills.find(b => b.invoiceNumber === billNumber);
    } else if (billType === 'creditbill') {
      const creditBills = await firebaseService.getAll('creditbills');
      bill = creditBills.find(b => b.invoiceNumber === billNumber);
    } else {
      // Search in both if bill type not specified
      const cashBills = await firebaseService.getAll('cashbills');
      const creditBills = await firebaseService.getAll('creditbills');
      
      bill = cashBills.find(b => b.invoiceNumber === billNumber) || 
             creditBills.find(b => b.invoiceNumber === billNumber);
    }
    
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }
    
    // Determine bill type if not specified
    if (!billType) {
      const cashBills = await firebaseService.getAll('cashbills');
      bill.billType = cashBills.find(b => b.invoiceNumber === billNumber) ? 'cashbill' : 'creditbill';
    } else {
      bill.billType = billType;
    }
    
    res.json({
      success: true,
      data: bill
    });
    
  } catch (error) {
    console.error('Error finding bill by number:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to find bill', 
      error: error.message 
    });
  }
};

export {
  getLatestCreditNote,
  getAllCreditNotes,
  getCreditNoteById,
  getBillDetails,
  createCreditNote,
  updateCreditNote,
  deleteCreditNote,
  sendEmail,
  sendEmailUnsaved,
  generatePDF,
  generatePDFFromUnsaved,
  findBillByNumber
};
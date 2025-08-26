import { 
  firebaseService 
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to generate sequential quotation ID
const generateQuotationId = async () => {
  try {
    // Get all existing quotations
    const allQuotations = await firebaseService.getAll('quotations');
    
    // Find the highest QUT number
    let maxNumber = 0;
    allQuotations.forEach(quotation => {
      if (quotation.quotationId && quotation.quotationId.startsWith('QUT-')) {
        const number = parseInt(quotation.quotationId.replace('QUT-', ''));
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
    });
    
    // Generate next number
    const nextNumber = maxNumber + 1;
    const quotationId = `QUT-${nextNumber}`;
    
    return quotationId;
  } catch (error) {
    // Fallback to unique ID if there's an error
    return `QUT-${Date.now()}`;
  }
};

const createQuotation = async (req, res) => {
  const { refNo, date, to, from, attn, subject, items, dieCost, notes, contactName, contactMobile, contactEmail, isCancelled, total, selectedCompany, createdBy } = req.body;
  try {
    // Generate sequential quotation ID
    const quotationId = await generateQuotationId();
    
    const quotationData = {
      quotationId: quotationId, // Add the sequential ID
      refNo,
      date,
      to,
      from,
      attn,
      subject,
      items,
      dieCost,
      notes,
      contactName,
      contactMobile,
      contactEmail,
      isCancelled,
      total,
      selectedCompany,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const savedQuotation = await firebaseService.create('quotations', quotationData);
    res.status(201).json(savedQuotation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getQuotations = async (req, res) => {
  try {
    const quotations = await firebaseService.getAll('quotations');
    
    // Populate createdBy data
    const populatedQuotations = await Promise.all(
      quotations.map(async (quotation) => {
        const creator = quotation.createdBy ? await firebaseService.getById('users', quotation.createdBy) : null;
        return {
          ...quotation,
          creator: creator ? { name: creator.name, email: creator.email } : null
        };
      })
    );
    
    res.json(populatedQuotations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getQuotationById = async (req, res) => {
  try {
    // First, try direct lookup
    let quotation = await firebaseService.getById('quotations', req.params.id);
    
    // If not found, search by quotationId or other fields
    if (!quotation) {
      const allQuotations = await firebaseService.getAll('quotations');
      
      quotation = allQuotations.find(q => 
        q.id === req.params.id || 
        q._id === req.params.id || 
        q.quotationId === req.params.id ||
        q.refNo === req.params.id
      );
    }
    
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    // Populate createdBy data
    const creator = quotation.createdBy ? await firebaseService.getById('users', quotation.createdBy) : null;
    const populatedQuotation = {
      ...quotation,
      creator: creator ? { name: creator.name, email: creator.email } : null
    };
    
    res.json(populatedQuotation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateQuotation = async (req, res) => {
  try {
    
    // Extract all fields from request body, excluding id and _id
    const { 
      id, _id, // Exclude these fields from update
      refNo, date, to, from, attn, subject, items, dieCost, notes, 
      contactName, contactMobile, contactEmail, isCancelled, total, 
      selectedCompany, createdBy 
    } = req.body;
    
    const updateData = {
      refNo,
      date,
      to,
      from,
      attn,
      subject,
      items,
      dieCost,
      notes,
      contactName,
      contactMobile,
      contactEmail,
      isCancelled,
      total,
      selectedCompany,
      createdBy,
      updatedAt: new Date()
    };
    
    // Validate required fields
    const requiredFields = ['refNo', 'date', 'to', 'from', 'subject'];
    const missingFields = requiredFields.filter(field => !updateData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    
    // First, try to find the quotation using the same approach as getQuotationById
    let targetQuotation = await firebaseService.getById('quotations', req.params.id);
    
    // If not found, search by quotationId or other fields
    if (!targetQuotation) {
      const allQuotations = await firebaseService.getAll('quotations');
      
      targetQuotation = allQuotations.find(q => 
        q.id === req.params.id || 
        q._id === req.params.id || 
        q.quotationId === req.params.id ||
        q.refNo === req.params.id
      );
    }
    
    // If still not found, try direct Firestore access to find the document
    if (!targetQuotation) {
      console.log('⚠️ Still not found, trying direct Firestore access...');
      const { adminFirestore } = await import('../config/firebase-admin.js');
      
      try {
        const querySnapshot = await adminFirestore.collection('quotations').get();
        const firestoreDocs = querySnapshot.docs.map(doc => ({
          firestoreId: doc.id,
          ...doc.data()
        }));
        
        targetQuotation = firestoreDocs.find(q => 
          q.id === req.params.id || 
          q._id === req.params.id || 
          q.quotationId === req.params.id ||
          q.refNo === req.params.id
        );
      } catch (firestoreError) {
        // Continue with normal flow
      }
    }
    
    if (!targetQuotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    // Now update using the correct ID
    // The targetQuotation object might have the Firestore document ID in different fields
    let correctId;
    if (targetQuotation.firestoreId) {
      // If we found it via direct Firestore access
      correctId = targetQuotation.firestoreId;
    } else {
      // If we found it via firebaseService.getAll()
      correctId = targetQuotation.id;
    }
    
    // Now perform the update
    let quotation;
    try {
      quotation = await firebaseService.update('quotations', correctId, updateData);
      res.json(quotation);
    } catch (updateError) {
      throw updateError;
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteQuotation = async (req, res) => {
  try {
    // First, try to find the quotation using the same approach as getQuotationById
    let targetQuotation = await firebaseService.getById('quotations', req.params.id);
    
    // If not found, search by quotationId or other fields
    if (!targetQuotation) {
      const allQuotations = await firebaseService.getAll('quotations');
      
      targetQuotation = allQuotations.find(q => 
        q.id === req.params.id || 
        q._id === req.params.id || 
        q.quotationId === req.params.id ||
        q.refNo === req.params.id
      );
    }
    
    // If still not found, try direct Firestore access to find the document
    if (!targetQuotation) {
      const { adminFirestore } = await import('../config/firebase-admin.js');
      
      try {
        const querySnapshot = await adminFirestore.collection('quotations').get();
        const firestoreDocs = querySnapshot.docs.map(doc => ({
          firestoreId: doc.id,
          ...doc.data()
        }));
        
        targetQuotation = firestoreDocs.find(q => 
          q.id === req.params.id || 
          q._id === req.params.id || 
          q.quotationId === req.params.id ||
          q.refNo === req.params.id
        );
      } catch (firestoreError) {
        // Continue with normal flow
      }
    }
    
    if (!targetQuotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    // Now delete using the correct ID
    let correctId;
    if (targetQuotation.firestoreId) {
      // If we found it via direct Firestore access
      correctId = targetQuotation.firestoreId;
    } else {
      // If we found it via firebaseService.getAll()
      correctId = targetQuotation.id;
    }
    
    await firebaseService.delete('quotations', correctId);
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const generatePDF = async (req, res) => {
  try {
    const { quotationData } = req.body;
    
    if (!quotationData) {
      return res.status(400).json({
        success: false,
        message: 'Quotation data is required'
      });
    }

    // Validate required fields
    const requiredFields = ['refNo', 'date', 'to', 'from', 'subject'];
    const missingFields = requiredFields.filter(field => !quotationData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Helper function to safely convert values to strings
    const safeString = (value) => {
      if (value === null || value === undefined) return 'N/A';
      if (typeof value === 'string') return value;
      if (typeof value === 'number') return value.toString();
      if (typeof value === 'object') {
        if (value.name) return value.name;
        if (value.title) return value.title;
        if (value.text) return value.text;
        return JSON.stringify(value);
      }
      return String(value);
    };

    // Import jsPDF with better error handling
    let jsPDF;
    try {
      const jsPDFModule = await import('jspdf');
      
      // Handle different export formats
      if (jsPDFModule.default && typeof jsPDFModule.default === 'function') {
        jsPDF = jsPDFModule.default;
      } else if (jsPDFModule.jsPDF && typeof jsPDFModule.jsPDF === 'function') {
        jsPDF = jsPDFModule.jsPDF;
      } else if (typeof jsPDFModule === 'function') {
        jsPDF = jsPDFModule;
      } else {
        // Try to find the constructor in the module
        const possibleConstructors = Object.values(jsPDFModule).filter(val => typeof val === 'function');
        if (possibleConstructors.length > 0) {
          jsPDF = possibleConstructors[0];
        } else {
          throw new Error(`No valid jsPDF constructor found in module`);
        }
      }
      
      if (typeof jsPDF !== 'function') {
        throw new Error(`jsPDF is not a constructor (type: ${typeof jsPDF})`);
      }
      
      console.log('jsPDF constructor ready:', typeof jsPDF);
    } catch (importError) {
      console.error('Error importing jsPDF:', importError);
      return res.status(500).json({
        success: false,
        message: 'Failed to import PDF library',
        error: importError.message
      });
    }

    // Import QRCode (optional)
    let QRCode;
    try {
      const qrModule = await import('qrcode');
      QRCode = qrModule.default || qrModule;
      console.log('QRCode imported successfully');
    } catch (qrError) {
      console.log('⚠️ QRCode import failed, continuing without QR:', qrError.message);
      QRCode = null;
    }

    // Create PDF document
    console.log('📄 Creating PDF document...');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const rightMargin = 40; // Increased right margin to prevent text cutoff
    let y = 20;




    // Header Layout: Logo + Company Name on left, QUOTATION + Details on right
    const headerY = y;
    
    // Left side: Logo and Company Name
    const leftX = margin;
    
    // Add Company Logo based on selected company
    try {
      console.log('🖼️ Adding logo to left side of header...');
      
      // Get logo filename based on selected company
      let logoFileName = 'Wyenfosbills_logo.png'; // Default WYENFOS logo
      
      if (quotationData.selectedCompany === 'AYUR FOR HERBALS INDIA' || 
          (quotationData.selectedCompany && quotationData.selectedCompany.name === 'AYUR FOR HERBALS INDIA')) {
        logoFileName = 'Ayur4life_logo.png';
        console.log('🏢 Using AYUR FOR HERBALS INDIA logo:', logoFileName);
      } else {
        console.log('🏢 Using WYENFOS BILLS logo:', logoFileName);
      }
      
      const logoPath = path.join(__dirname, '..', 'uploads', logoFileName);
      if (fs.existsSync(logoPath)) {
        try {
          const logoBuffer = fs.readFileSync(logoPath);
          const logoBase64 = logoBuffer.toString('base64');
          // Position logo on the left side
          doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', leftX, headerY, 30, 20);
        } catch (imageError) {
          // Continue without logo
        }
      }
    } catch (logoError) {
      console.error('❌ Error in logo handling:', logoError.message);
    }
    
    // Company name next to logo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    
    // Use the selected company name directly
    let companyName = 'WYENFOS BILLS'; // Default fallback
    
    if (quotationData.selectedCompany) {
      if (typeof quotationData.selectedCompany === 'string') {
        companyName = quotationData.selectedCompany;
      } else if (quotationData.selectedCompany.name) {
        companyName = quotationData.selectedCompany.name;
      }
    }
    
    console.log('🏢 Selected company for PDF:', companyName);
    
    console.log('🏢 Company name for PDF:', companyName);
    // Position company name to the right of the logo
    doc.text(companyName, leftX + 35, headerY + 12);
    
    // Right side: QUOTATION title and details - completely right aligned
    const rightX = pageWidth - rightMargin; // Full right margin
    
    // QUOTATION title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('QUOTATION', rightX, headerY + 8, { align: 'right' });
    
    // Quotation details below the title
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    // Generate quotation ID if not present
    let displayQuotationId = quotationData.quotationId;
    if (!displayQuotationId) {
      try {
        displayQuotationId = await generateQuotationId();
      } catch (error) {
        displayQuotationId = 'N/A';
      }
    }
    
    doc.text(`QUOTATION No: ${safeString(displayQuotationId)}`, rightX, headerY + 20, { align: 'right' });
    doc.text(`Date: ${safeString(quotationData.date)}`, rightX, headerY + 28, { align: 'right' });
    doc.text(`Ref: ${safeString(quotationData.refNo)}`, rightX, headerY + 36, { align: 'right' });
    
    // Move to next section
    y = headerY + 50;

    // Quotation details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Quotation Details:', margin, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    
    // Quotation details section (moved from header)
    doc.text(`Quotation ID: ${safeString(displayQuotationId)}`, margin, y);
    doc.text(`Ref. No: ${safeString(quotationData.refNo)}`, margin, y + 8);
    doc.text(`Date: ${safeString(quotationData.date)}`, pageWidth - rightMargin - 50, y);
    y += 20;

    // To and From
    doc.setFont('helvetica', 'bold');
    doc.text('To:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(safeString(quotationData.to), margin + 20, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('From:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(safeString(quotationData.from), margin + 20, y);
    y += 15;

    // Subject
    if (quotationData.subject) {
      doc.setFont('helvetica', 'bold');
      doc.text('Subject:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(safeString(quotationData.subject), margin + 20, y);
      y += 15;
    }

    // Greeting
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('Dear Sir,', margin, y);
    y += 10;
    
    // Split long text to prevent cutoff
    const greetingText = 'With reference to the above-mentioned subject, we are hereby pleased to quote you our best prices as follows:';
    const maxWidth = pageWidth - margin - rightMargin;
    const lines = doc.splitTextToSize(greetingText, maxWidth);
    doc.text(lines, margin, y);
    y += (lines.length * 5) + 15;

    // Items table with proper structure, background color, and borders
    if (quotationData.items && quotationData.items.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Items:', margin, y);
      y += 10;

      // Table configuration
      const headers = ['Sr. No.', 'Description', 'Quantity', 'Rate', 'Amount'];
      const colWidths = [25, 70, 25, 25, 30];
      const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
      const tableX = margin;
      const headerY = y;
      const rowHeight = 12;
      const cellPadding = 2;

      // Draw table border
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(tableX, headerY - 5, tableWidth, rowHeight + 10);

      // Table header with background color
      doc.setFillColor(240, 240, 240); // Light gray background
      doc.rect(tableX, headerY - 5, tableWidth, rowHeight, 'F');
      
      // Header text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      let x = tableX + cellPadding;
      headers.forEach((header, index) => {
        doc.text(header, x, headerY + 2);
        x += colWidths[index];
      });

      // Table data rows with borders
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setFillColor(255, 255, 255); // White background for data rows
      
      quotationData.items.forEach((item, index) => {
        if (y > 250) {
          doc.addPage();
          y = 20;
          headerY = y;
        }

        const rowY = headerY + rowHeight + (index * rowHeight);
        
        // Draw row border
        doc.rect(tableX, rowY - 2, tableWidth, rowHeight, 'S');
        
        // Fill row background
        doc.rect(tableX, rowY - 2, tableWidth, rowHeight, 'F');
        
        // Row data
        x = tableX + cellPadding;
        doc.text(safeString(item.srNo || (index + 1)), x, rowY + 2);
        x += colWidths[0];
        doc.text(safeString(item.description), x, rowY + 2);
        x += colWidths[1];
        doc.text(safeString(item.quantity), x, rowY + 2);
        x += colWidths[2];
        doc.text(safeString(item.rate), x, rowY + 2);
        x += colWidths[3];
        doc.text(`Rs. ${safeString(item.amount)}`, x, rowY + 2);
        
        y = rowY + rowHeight + 5;
      });

      // Draw column borders
      let borderX = tableX;
      headers.forEach((header, index) => {
        borderX += colWidths[index];
        if (index < headers.length - 1) {
          doc.line(borderX, headerY - 5, borderX, y - 5);
        }
      });
    }

    y += 15;

    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Total: Rs. ${safeString(quotationData.total)}`, pageWidth - rightMargin - 50, y);
    y += 20;

    // Notes
    if (quotationData.notes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Notes:', margin, y);
      y += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const notesLines = doc.splitTextToSize(safeString(quotationData.notes), maxWidth);
      doc.text(notesLines, margin, y);
      y += (notesLines.length * 5) + 10;
    }

    // Terms and conditions
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Terms & Conditions:', margin, y);
    y += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const terms = [
      'Extra GST 18% + Transportation',
      'Payment: 50% in advance once we confirm the order.',
      'Delivery: 15 to 20 days from the confirmation.',
      'This quotation is valid for 30 DAYS from the date of issue.'
    ];
    
    terms.forEach(term => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.text(`• ${term}`, margin, y);
      y += 6;
    });

    // Contact information
    y += 10;
    if (quotationData.contactName || quotationData.contactMobile || quotationData.contactEmail) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Contact Information:', margin, y);
      y += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      if (quotationData.contactName) {
        doc.text(`Name: ${safeString(quotationData.contactName)}`, margin, y);
        y += 5;
      }
      if (quotationData.contactMobile) {
        doc.text(`Mobile: ${safeString(quotationData.contactMobile)}`, margin, y);
        y += 5;
      }
      if (quotationData.contactEmail) {
        doc.text(`Email: ${safeString(quotationData.contactEmail)}`, margin, y);
        y += 5;
      }
    }

    // Closing section - arranged like screenshot with text input area and closing statement
    y += 15;
    
    // Text input area (represented as a bordered rectangle)
    const inputAreaHeight = 60;
    const inputAreaWidth = maxWidth;
    
    // Draw text input area border
    doc.setDrawColor(200, 200, 200); // Light gray border
    doc.setLineWidth(0.5);
    doc.rect(margin, y, inputAreaWidth, inputAreaHeight, 'S');
    
    // Add placeholder text inside the input area
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150); // Light gray text for placeholder
    doc.text('Enter additional notes or comments here...', margin + 5, y + 10);
    
    y += inputAreaHeight + 15;
    
    // Closing statement below the input area
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0); // Black text for closing statement
    
    const closingText = 'We hope the above quotation is in line with your requirement. If you have any further queries, please feel free to contact the undersigned.';
    const closingLines = doc.splitTextToSize(closingText, maxWidth);
    doc.text(closingLines, margin, y);
    y += (closingLines.length * 5) + 15;
    
    // "Thanks" positioned on the right side
    doc.text('Thanks', pageWidth - rightMargin, y, { align: 'right' });
    y += 8;
    
    // "Best regards" positioned on the right side below thanks
    doc.text('Best regards,', pageWidth - rightMargin, y, { align: 'right' });
    
    y += 15;

    // Generate PDF as base64
    console.log('🔄 Generating PDF as base64...');
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
  

      res.json({
        success: true,
        message: 'PDF generated successfully',
        data: {
          pdf: pdfBase64
        }
      });
    } catch (outputError) {
      console.error('❌ Error generating PDF output:', outputError);
      res.status(500).json({
        success: false,
        message: 'Failed to generate PDF output',
        error: outputError.message
      });
    }

  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    console.error('📋 Error stack:', error.stack);
    
    // Try to provide a more helpful error message
    let errorMessage = 'Failed to generate PDF';
    if (error.message.includes('jsPDF')) {
      errorMessage = 'PDF library error - please try again';
    } else if (error.message.includes('fs')) {
      errorMessage = 'File system error - please check server configuration';
    } else if (error.message.includes('import')) {
      errorMessage = 'Module import error - please restart server';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

export { createQuotation, getQuotations, getQuotationById, updateQuotation, deleteQuotation, generatePDF };
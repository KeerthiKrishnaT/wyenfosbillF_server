import { 
  firebaseService 
} from '../services/firebaseService.js';
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
    console.log('🔍 Fetching quotations from database...');
    console.log('🔍 Firebase service available:', !!firebaseService);
    console.log('🔍 Firebase service getAll method:', typeof firebaseService.getAll);
    
    let quotations = [];
    try {
      quotations = await firebaseService.getAll('quotations');
      console.log('📋 Raw quotations from database:', quotations.length, 'quotations found');
      console.log('📋 Raw quotations data:', quotations);
      console.log('📋 Raw quotations data type:', typeof quotations);
      console.log('📋 Raw quotations is array:', Array.isArray(quotations));
    } catch (firebaseError) {
      console.error('❌ Firebase service error:', firebaseError);
      console.error('❌ Firebase error message:', firebaseError.message);
      console.error('❌ Firebase error code:', firebaseError.code);
      // Return empty array if Firebase fails
      quotations = [];
    }
    
    // If no quotations found, try alternative collection names
    if (quotations.length === 0) {
      console.log('🔄 No quotations found in "quotations" collection, trying alternative names...');
      try {
        const altQuotations = await firebaseService.getAll('quotation');
        console.log('📋 Alternative quotations from "quotation" collection:', altQuotations.length, 'found');
        if (altQuotations.length > 0) {
          quotations.push(...altQuotations);
        }
      } catch (altError) {
        console.log('📋 Alternative collection "quotation" not found or empty');
      }
      
      // Try other possible collection names
      const possibleCollections = ['quotation', 'quotes', 'quote'];
      for (const collectionName of possibleCollections) {
        try {
          const altQuotations = await firebaseService.getAll(collectionName);
          console.log(`📋 Alternative quotations from "${collectionName}" collection:`, altQuotations.length, 'found');
          if (altQuotations.length > 0) {
            quotations.push(...altQuotations);
            break; // Stop after finding the first non-empty collection
          }
        } catch (altError) {
          console.log(`📋 Alternative collection "${collectionName}" not found or empty`);
        }
      }
    }
    
    // Populate createdBy data
    let populatedQuotations = [];
    try {
      populatedQuotations = await Promise.all(
        quotations.map(async (quotation) => {
          const creator = quotation.createdBy ? await firebaseService.getById('users', quotation.createdBy) : null;
          return {
            ...quotation,
            creator: creator ? { name: creator.name, email: creator.email } : null
          };
        })
      );
    } catch (populateError) {
      console.error('❌ Error populating quotations:', populateError);
      // If population fails, return quotations without creator data
      populatedQuotations = quotations.map(quotation => ({
        ...quotation,
        creator: null
      }));
    }
    
    console.log('✅ Populated quotations:', populatedQuotations.length, 'quotations ready to send');
    console.log('✅ Sending response with status 200');
    res.json(populatedQuotations);
  } catch (error) {
    console.error('❌ Error fetching quotations:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    res.status(500).json({ message: error.message });
  }
};

const getQuotationById = async (req, res) => {
  try {
    console.log('🔍 Fetching quotation by ID:', req.params.id);
    console.log('🔍 Request params:', req.params);
    
    // First, try direct lookup
    let quotation = await firebaseService.getById('quotations', req.params.id);
    console.log('📋 Direct lookup result:', quotation ? 'Found' : 'Not found');
    
    // If not found, search by quotationId or other fields
    if (!quotation) {
      console.log('🔄 Searching in all quotations...');
      const allQuotations = await firebaseService.getAll('quotations');
      console.log('📋 Total quotations available:', allQuotations.length);
      
      quotation = allQuotations.find(q => 
        q.id === req.params.id || 
        q._id === req.params.id || 
        q.quotationId === req.params.id ||
        q.refNo === req.params.id
      );
      console.log('📋 Search result:', quotation ? 'Found' : 'Not found');
    }
    
    if (!quotation) {
      console.log('❌ Quotation not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    // Populate createdBy data
    const creator = quotation.createdBy ? await firebaseService.getById('users', quotation.createdBy) : null;
    const populatedQuotation = {
      ...quotation,
      creator: creator ? { name: creator.name, email: creator.email } : null
    };
    
    console.log('✅ Quotation found and populated:', populatedQuotation);
    res.json(populatedQuotation);
  } catch (error) {
    console.error('❌ Error fetching quotation by ID:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
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
    console.log('🔍 PDF generation request received');
    console.log('📋 Request body:', req.body);
    
    const { quotationData } = req.body;
    if (!quotationData) {
      console.log('❌ No quotation data provided');
      return res.status(400).json({ success: false, message: "Quotation data is required" });
    }
    
    console.log('📋 Quotation data:', quotationData);

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

    console.log('📄 Importing jsPDF...');
    const jsPDFModule = await import('jspdf');
    console.log('📄 jsPDF module imported:', !!jsPDFModule);
    
    const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;
    console.log('📄 jsPDF constructor:', typeof jsPDF);
    
    const doc = new jsPDF('p', 'mm', 'a4');
    console.log('📄 PDF document created');

    // Margins & layout
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let y = margin;

    // === HEADER ===
    const logoX = margin;
    const logoSize = 30;
    
    // Get company-specific logo based on selected company
    const getCompanyLogoPath = (companyName) => {
      const logoMap = {
        'WYENFOS INFOTECH': 'wyenfos_infotech.png',
        'WYENFOS GOLD AND DIAMONDS': 'wyenfos_gold.png',
        'WYENFOS ADS': 'wyenfos_ads.png',
        'WYENFOS CASH VAPASE': 'wyenfos_cash.png',
        'AYUR4LIFE HERBALS INDIA': 'Ayur4life_logo.png',
        'WYENFOS': 'wyenfos.png',
        'WYENFOS PURE DROPS': 'wyenfos pure drops.png'
      };
      return logoMap[companyName] || 'wyenfos.png';
    };
    
    try {
      const logoFileName = getCompanyLogoPath(safeString(quotationData.selectedCompany));
      const logoPath = path.join(__dirname, '..', 'uploads', logoFileName);
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        const logoBase64 = logoBuffer.toString('base64');
        doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', logoX, y, logoSize, logoSize);
      }
    } catch {}

    // Company name and QUOTATION heading on the same line
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(safeString(quotationData.selectedCompany) || 'WYENFOS INFOTECH', logoX + logoSize + 5, y + 12);
    doc.text('QUOTATION', pageWidth - margin, y + 12, { align: 'right' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`QUOTATION No: ${safeString(quotationData.quotationId) || 'QUT-1'}`, pageWidth - margin, y + 20, { align: 'right' });
    doc.text(`Date: ${safeString(quotationData.date) || '2025-08-26'}`, pageWidth - margin, y + 28, { align: 'right' });

    y += 45;

    // === QUOTATION DETAILS ===
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Quotation Details:', margin, y);
    y += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('To:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(safeString(quotationData.to) || 'N/A', margin + 20, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('From:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(safeString(quotationData.from) || 'N/A', margin + 20, y);
    y += 15;

    doc.setFont('helvetica', 'bold');
    doc.text('Subject:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(safeString(quotationData.subject) || 'N/A', margin + 25, y);
    y += 20;

    doc.text('Dear Sir,', margin, y);
    y += 8;

    const intro = "With reference to the above-mentioned subject, we are hereby pleased to quote you our best prices as follows:";
    const introLines = doc.splitTextToSize(intro, contentWidth);
    doc.text(introLines, margin, y);
    y += introLines.length * 6 + 10;

    // === ITEMS TABLE ===
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Items:', margin, y);
    y += 10;

    const headers = ['Sr. No.', 'Description', 'Quantity', 'Rate', 'Amount'];
    const colWidths = [20, 80, 25, 25, 30];
    const tableStartY = y;

    // Header background
    doc.setFillColor(153, 122, 141);
    doc.rect(margin, tableStartY, contentWidth, 10, 'F');

    // Header text
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    let x = margin;
    headers.forEach((header, i) => {
      const align = i === 1 ? 'left' : i === 4 || i === 3 ? 'right' : 'center';
      doc.text(header, x + (colWidths[i] / 2), tableStartY + 7, { align });
      x += colWidths[i];
    });

    // Reset for table rows
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    y += 12;

    quotationData.items?.forEach((item, idx) => {
      let rowX = margin;
      const rowY = y + idx * 8;
      if (rowY > 250) { doc.addPage(); y = margin; }

      const rowData = [
        `${idx + 1}`,
        safeString(item.description) || '',
        safeString(item.quantity) || '',
        safeString(item.rate) || '',
        `Rs. ${safeString(item.amount) || ''}`
      ];

      rowData.forEach((text, i) => {
        const align = i === 1 ? 'left' : i === 4 || i === 3 ? 'right' : 'center';
        doc.text(safeString(text), rowX + (colWidths[i] / 2), rowY + 5, { align });
        rowX += colWidths[i];
      });

      // Row border
      doc.rect(margin, rowY, contentWidth, 8);
    });

    y += (quotationData.items?.length || 1) * 8 + 15;

    // === TOTAL ===
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Total: Rs. ${safeString(quotationData.total) || '0.00'}`, pageWidth - margin, y, { align: 'right' });
    y += 20;

    // === TERMS & CONDITIONS ===
    const terms = [
      "Extra GST 18% + Transportation",
      "Payment: 50% in advance once we confirm the order.",
      "Delivery: 15 to 20 days from the confirmation.",
      "This quotation is valid for 30 DAYS from the date of issue."
    ];

    if (y + terms.length * 6 > 270) { doc.addPage(); y = margin; }

    doc.setFontSize(12);
    doc.text("Terms & Conditions:", margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    terms.forEach(term => {
      doc.text(`• ${term}`, margin + 5, y);
      y += 6;
    });

    // === NOTES SECTION ===
    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Notes:', margin, y);
    y += 8;
    
    doc.setFont('helvetica', 'normal');
    const notesText = quotationData.notes && quotationData.notes.trim() ? safeString(quotationData.notes) : 'No additional notes provided.';
    const notesLines = doc.splitTextToSize(notesText, contentWidth);
    doc.text(notesLines, margin, y);
    y += notesLines.length * 6 + 10;

    // === FOOTER ===
    y += 20;
    
    // Check if there's enough space for footer, if not add new page
    if (y > 200) {
      doc.addPage();
      y = margin;
    }
    
    // Split the text to fit within content width with right padding
    const footerText = 'We hope the above quotation meets your requirements. If you have any further queries, please feel free to contact us.';
    const footerLines = doc.splitTextToSize(footerText, contentWidth - 20); // Add 20px right padding
    doc.text(footerLines, margin, y);
    y += footerLines.length * 6 + 10;

    doc.text('Thanks', pageWidth - margin, y, { align: 'right' });
    y += 8;
    doc.text('Best regards,', pageWidth - margin, y, { align: 'right' });
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text(safeString(quotationData.selectedCompany) || 'WYENFOS INFOTECH', pageWidth - margin, y, { align: 'right' });
    
    // === SIGNATURE SECTION ===
    y += 20;
    
    // Check if there's enough space for signature section, if not add new page
    if (y > 250) {
      doc.addPage();
      y = margin;
    }
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Authorized Signature:', margin, y);
    y += 15;
    
    // Draw signature line
    doc.line(margin, y, margin + 80, y);
    doc.text('_________________________', margin, y + 5);
    
    // Add date line on the right
    doc.text('Date: _________________', pageWidth - margin - 60, y + 5);

    // === RETURN BASE64 PDF ===
    console.log('📄 Generating PDF base64...');
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    console.log('📄 PDF base64 length:', pdfBase64.length);
    console.log('✅ PDF generation successful');
    
    return res.json({ success: true, pdf: pdfBase64 });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'PDF generation failed', error: err.message });
  }
};

export { createQuotation, getQuotations, getQuotationById, updateQuotation, deleteQuotation, generatePDF };
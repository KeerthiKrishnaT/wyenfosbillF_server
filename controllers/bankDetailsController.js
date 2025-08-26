import { 
  firebaseService, 
  fileUploadService 
} from '../services/firebaseService.js';
import { qrCodeService } from '../services/qrCodeService.js';
import { localFileService } from '../services/localFileService.js';

export const getBankDetails = async (req, res) => {
  try {
    const { companyName } = req.query;
    
    if (companyName) {
      // Use getWhere without ordering to avoid index issues
      const bankDetails = await firebaseService.getWhere('bankDetails', 'companyName', '==', companyName, null, null);
      res.status(200).json(bankDetails);
    } else {
      const bankDetails = await firebaseService.getAll('bankDetails');
      res.status(200).json(bankDetails);
    }
  } catch (err) {
    console.error('Error in getBankDetails:', err.message);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

export const getBankDetailById = async (req, res) => {
  try {
    const { id } = req.params;
    const bankDetail = await firebaseService.getById('bankDetails', id);
    
    if (!bankDetail) {
      return res.status(404).json({ success: false, message: 'Bank detail not found' });
    }
    
    res.status(200).json(bankDetail);
  } catch (err) {
    console.error('Error in getBankDetailById:', err.message);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

export const saveBankDetails = async (req, res) => {
  try {
    const { companyName, bankName, accountNumber, accountName, branch, ifscCode, upiId, generateQR = 'combined' } = req.body;
    
    console.log('🔧 saveBankDetails received data:', {
      companyName, bankName, accountNumber, accountName, branch, ifscCode, upiId, generateQR,
      hasFile: !!req.file
    });
    
    let qrCodeUrl = '';
    let qrCodeInfo = null;

    // Handle manual QR code upload
    if (req.file) {
      // Create a clean filename based on company name and timestamp
      const timestamp = Date.now();
      const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${cleanCompanyName}_QR_${timestamp}.png`;
      const destinationPath = `bank-qr-codes/${filename}`;
      qrCodeUrl = await localFileService.saveFile(req.file, destinationPath);
      qrCodeInfo = { type: 'manual', filename: filename };
    }
    // Generate QR code automatically if no manual upload
    else if (generateQR !== 'none') {
      try {
        let qrResult;
        
        switch (generateQR) {
          case 'upi':
            if (!upiId) {
              console.error('❌ UPI ID is required for UPI QR code generation');
              break;
            }
            qrResult = await qrCodeService.generateUPIQR(upiId, companyName);
            break;
          case 'bank':
            if (!accountNumber || !ifscCode) {
              console.error('❌ Account number and IFSC code are required for bank QR code generation');
              break;
            }
            qrResult = await qrCodeService.generateBankAccountQR({
              accountNumber, ifscCode, accountName, bankName
            });
            break;
          case 'combined':
          default:
            if (!upiId) {
              console.error('❌ UPI ID is required for combined QR code generation');
              break;
            }
            qrResult = await qrCodeService.generateCombinedQR({
              upiId, accountNumber, ifscCode, accountName, bankName, companyName
            });
            break;
        }
        
        if (qrResult) {
          qrCodeUrl = qrResult.url;
          qrCodeInfo = { 
            type: generateQR, 
            filename: qrResult.filename,
            data: qrResult
          };
          console.log(`✅ Generated ${generateQR} QR code for ${companyName}: ${qrResult.filename}`);
        } else {
          console.log(`⚠️ QR code generation skipped for ${companyName}: Missing required data`);
        }
      } catch (qrError) {
        console.error('❌ Error generating QR code:', qrError);
        // Continue without QR code if generation fails
      }
    }

    // Check if bank details already exist
    const existingBankDetails = await firebaseService.getWhere('bankDetails', 'companyName', '==', companyName, null, null);
    
    let bankDetails;

    if (existingBankDetails.length > 0) {
      const existingDoc = existingBankDetails[0];
      const existingQrCodeUrl = existingDoc.qrCodeUrl || '';
      
      const updateData = {
        companyName,
        bankName,
        accountNumber,
        accountName,
        branch,
        ifscCode,
        upiId,
        qrCodeUrl: qrCodeUrl || existingQrCodeUrl,
        updatedAt: new Date(),
      };
      
      await firebaseService.update('bankDetails', existingDoc.id, updateData);
      
      if (qrCodeUrl && existingQrCodeUrl) {
        await localFileService.deleteFile(existingQrCodeUrl);
      }
      
      bankDetails = { id: existingDoc.id, ...updateData };
    } else {
      const bankDetailsData = {
        companyName,
        bankName,
        accountNumber,
        accountName,
        branch,
        ifscCode,
        upiId,
        qrCodeUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const newBankDetails = await firebaseService.create('bankDetails', bankDetailsData);
      bankDetails = newBankDetails;
    }

    res.status(200).json({
      success: true,
      message: bankDetails.id ? 'Bank details updated' : 'Bank details created',
      data: bankDetails,
      qrCodeInfo
    });
  } catch (err) {
    console.error('Error in saveBankDetails:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

export const updateBankDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const existingBankDetail = await firebaseService.getById('bankDetails', id);
    
    if (!existingBankDetail) {
      return res.status(404).json({ success: false, message: 'Bank detail not found' });
    }

    const {
      companyName,
      bankName,
      accountNumber,
      accountName,
      branch,
      ifscCode,
      upiId,
      generateQR = 'combined'
    } = req.body;

    let qrCodeUrl = existingBankDetail.qrCodeUrl || '';
    let qrCodeInfo = null;

    // Handle manual QR code upload
    if (req.file) {
      // Create a clean filename based on company name and timestamp
      const timestamp = Date.now();
      const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${cleanCompanyName}_QR_${timestamp}.png`;
      const destinationPath = `bank-qr-codes/${filename}`;
      qrCodeUrl = await localFileService.saveFile(req.file, destinationPath);
      qrCodeInfo = { type: 'manual', filename: filename };
      
      // Delete old QR code if it exists
      if (existingBankDetail.qrCodeUrl) {
        await localFileService.deleteFile(existingBankDetail.qrCodeUrl);
      }
    }
    // Generate QR code automatically if no manual upload
    else if (generateQR !== 'none') {
      try {
        // Delete old QR code if it exists
        if (existingBankDetail.qrCodeUrl) {
          await localFileService.deleteFile(existingBankDetail.qrCodeUrl);
        }

        let qrResult;
        
        switch (generateQR) {
          case 'upi':
            if (!upiId) {
              console.error('❌ UPI ID is required for UPI QR code generation');
              break;
            }
            qrResult = await qrCodeService.generateUPIQR(upiId, companyName);
            break;
          case 'bank':
            if (!accountNumber || !ifscCode) {
              console.error('❌ Account number and IFSC code are required for bank QR code generation');
              break;
            }
            qrResult = await qrCodeService.generateBankAccountQR({
              accountNumber, ifscCode, accountName, bankName
            });
            break;
          case 'combined':
          default:
            if (!upiId) {
              console.error('❌ UPI ID is required for combined QR code generation');
              break;
            }
            qrResult = await qrCodeService.generateCombinedQR({
              upiId, accountNumber, ifscCode, accountName, bankName, companyName
            });
            break;
        }
        
        if (qrResult) {
          qrCodeUrl = qrResult.url;
          qrCodeInfo = { 
            type: generateQR, 
            filename: qrResult.filename,
            data: qrResult
          };
          console.log(`✅ Generated ${generateQR} QR code for ${companyName}: ${qrResult.filename}`);
        } else {
          console.log(`⚠️ QR code generation skipped for ${companyName}: Missing required data`);
        }
      } catch (qrError) {
        console.error('❌ Error generating QR code:', qrError);
        // Continue without QR code if generation fails
      }
    }

    const updateData = {
      companyName,
      bankName,
      accountNumber,
      accountName,
      branch,
      ifscCode,
      upiId,
      qrCodeUrl,
      updatedAt: new Date(),
    };

    await firebaseService.update('bankDetails', id, updateData);
    res.status(200).json({ 
      success: true, 
      message: 'Bank details updated', 
      data: { id, ...updateData },
      qrCodeInfo
    });
  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteBankDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const bankDetail = await firebaseService.getById('bankDetails', id);
    
    if (!bankDetail) {
      return res.status(404).json({ success: false, message: 'Bank detail not found' });
    }

    if (bankDetail.qrCodeUrl) {
      await localFileService.deleteFile(bankDetail.qrCodeUrl);
    }

    await firebaseService.delete('bankDetails', id);
    res.status(200).json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Generate QR code for existing bank details
export const generateQRCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'combined' } = req.body;
    
    const bankDetail = await firebaseService.getById('bankDetails', id);
    
    if (!bankDetail) {
      return res.status(404).json({ success: false, message: 'Bank detail not found' });
    }

    // Delete existing QR code if it exists
    if (bankDetail.qrCodeUrl) {
      await localFileService.deleteFile(bankDetail.qrCodeUrl);
    }

    let qrResult;
    let qrCodeUrl = '';
    let qrCodeInfo = null;

    try {
      switch (type) {
        case 'upi':
          if (!bankDetail.upiId) {
            return res.status(400).json({ success: false, message: 'UPI ID is required for UPI QR code' });
          }
          qrResult = await qrCodeService.generateUPIQR(bankDetail.upiId, bankDetail.companyName);
          break;
        case 'bank':
          if (!bankDetail.accountNumber || !bankDetail.ifscCode) {
            return res.status(400).json({ success: false, message: 'Account number and IFSC code are required for bank QR code' });
          }
          qrResult = await qrCodeService.generateBankAccountQR({
            accountNumber: bankDetail.accountNumber,
            ifscCode: bankDetail.ifscCode,
            accountName: bankDetail.accountName,
            bankName: bankDetail.bankName
          });
          break;
        case 'combined':
        default:
          if (!bankDetail.upiId) {
            return res.status(400).json({ success: false, message: 'UPI ID is required for combined QR code' });
          }
          qrResult = await qrCodeService.generateCombinedQR({
            upiId: bankDetail.upiId,
            accountNumber: bankDetail.accountNumber,
            ifscCode: bankDetail.ifscCode,
            accountName: bankDetail.accountName,
            bankName: bankDetail.bankName,
            companyName: bankDetail.companyName
          });
          break;
      }
      
      qrCodeUrl = qrResult.url;
      qrCodeInfo = { 
        type, 
        filename: qrResult.filename,
        data: qrResult
      };

      // Update bank details with new QR code URL
      await firebaseService.update('bankDetails', id, { qrCodeUrl });

      res.status(200).json({
        success: true,
        message: `${type.toUpperCase()} QR code generated successfully`,
        data: { qrCodeUrl, qrCodeInfo }
      });

    } catch (qrError) {
      console.error('❌ Error generating QR code:', qrError);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to generate QR code',
        error: qrError.message 
      });
    }

  } catch (err) {
    console.error('Generate QR code error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
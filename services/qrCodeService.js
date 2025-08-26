import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class QRCodeService {
  constructor() {
    this.qrCodesDir = join(__dirname, '../uploads/bank-qr-codes');
    this.ensureDirectoryExists();
  }

  ensureDirectoryExists() {
    if (!fs.existsSync(this.qrCodesDir)) {
      fs.mkdirSync(this.qrCodesDir, { recursive: true });
    }
  }

  // Generate UPI QR Code
  async generateUPIQR(upiId, payeeName, amount = '') {
    try {
      // Validate required fields
      if (!upiId) {
        throw new Error('UPI ID is required for UPI QR code generation');
      }
      
      console.log('🔧 Generating UPI QR code with data:', { upiId, payeeName, amount });
      
      const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName || 'Payee')}&am=${amount}&cu=INR`;
      const filename = `UPI_${upiId.replace('@', '_')}_${Date.now()}.png`;
      const filepath = join(this.qrCodesDir, filename);
      
      console.log('🔧 Saving UPI QR code to:', filepath);
      
      await QRCode.toFile(filepath, upiUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 300
      });

      console.log('✅ UPI QR code generated successfully:', filename);

      return {
        filename,
        url: `/uploads/bank-qr-codes/${filename}`,
        upiUrl
      };
    } catch (error) {
      console.error('❌ Error generating UPI QR code:', error);
      throw error;
    }
  }

  // Generate Bank Account QR Code (for NEFT/RTGS)
  async generateBankAccountQR(bankDetails) {
    try {
      const { accountNumber, ifscCode, accountName, bankName } = bankDetails;
      
      // Validate required fields
      if (!accountNumber || !ifscCode) {
        throw new Error('Account number and IFSC code are required for bank QR code generation');
      }
      
      console.log('🔧 Generating bank QR code with data:', { accountNumber, ifscCode, accountName, bankName });
      
      const bankData = {
        account: accountNumber,
        ifsc: ifscCode,
        name: accountName || 'Account Holder',
        bank: bankName || 'Bank'
      };

      const filename = `BANK_${accountNumber}_${Date.now()}.png`;
      const filepath = join(this.qrCodesDir, filename);
      
      console.log('🔧 Saving bank QR code to:', filepath);
      
      await QRCode.toFile(filepath, JSON.stringify(bankData), {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 300
      });

      console.log('✅ Bank QR code generated successfully:', filename);

      return {
        filename,
        url: `/uploads/bank-qr-codes/${filename}`,
        bankData
      };
    } catch (error) {
      console.error('❌ Error generating bank account QR code:', error);
      throw error;
    }
  }

  // Generate combined QR code (UPI + Bank details)
  async generateCombinedQR(bankDetails) {
    try {
      const { upiId, accountNumber, ifscCode, accountName, bankName, companyName } = bankDetails;
      
      // Validate required fields
      if (!upiId) {
        throw new Error('UPI ID is required for combined QR code generation');
      }
      
      console.log('🔧 Generating combined QR code with data:', { upiId, accountNumber, ifscCode, accountName, bankName, companyName });
      
      const combinedData = {
        upi: {
          id: upiId,
          payee: companyName || 'Company'
        },
        bank: {
          account: accountNumber || '',
          ifsc: ifscCode || '',
          name: accountName || 'Account Holder',
          bank: bankName || 'Bank'
        },
        company: companyName || 'Company',
        timestamp: new Date().toISOString()
      };

      const filename = `COMBINED_${(companyName || 'COMPANY').replace(/\s+/g, '_')}_${Date.now()}.png`;
      const filepath = join(this.qrCodesDir, filename);
      
      console.log('🔧 Saving combined QR code to:', filepath);
      
      await QRCode.toFile(filepath, JSON.stringify(combinedData), {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 350
      });

      console.log('✅ Combined QR code generated successfully:', filename);

      return {
        filename,
        url: `/uploads/bank-qr-codes/${filename}`,
        combinedData
      };
    } catch (error) {
      console.error('❌ Error generating combined QR code:', error);
      throw error;
    }
  }

  // Delete QR code file
  async deleteQRCode(filename) {
    try {
      const filepath = join(this.qrCodesDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log(`Deleted QR code file: ${filename}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting QR code file:', error);
      return false;
    }
  }

  // Get QR code file info
  getQRCodeInfo(filename) {
    try {
      const filepath = join(this.qrCodesDir, filename);
      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath);
        return {
          exists: true,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      }
      return { exists: false };
    } catch (error) {
      console.error('Error getting QR code info:', error);
      return { exists: false, error: error.message };
    }
  }

  // List all QR codes
  listQRCodes() {
    try {
      const files = fs.readdirSync(this.qrCodesDir);
      return files.filter(file => file.endsWith('.png')).map(file => ({
        filename: file,
        url: `/uploads/bank-qr-codes/${file}`,
        ...this.getQRCodeInfo(file)
      }));
    } catch (error) {
      console.error('Error listing QR codes:', error);
      return [];
    }
  }
}

export const qrCodeService = new QRCodeService();

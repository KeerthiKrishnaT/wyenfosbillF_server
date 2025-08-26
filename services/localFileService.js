import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class FileService {
  constructor() {
    this.uploadsDir = join(__dirname, '../uploads');
    this.qrCodesDir = join(__dirname, '../uploads/bank-qr-codes');
    this.ensureDirectoriesExist();
  }

  ensureDirectoriesExist() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(this.qrCodesDir)) {
      fs.mkdirSync(this.qrCodesDir, { recursive: true });
    }
  }

  // Save a file locally
  async saveFile(file, destinationPath) {
    try {
      console.log('localFileService.saveFile: File object:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        encoding: file.encoding,
        mimetype: file.mimetype,
        size: file.size,
        destination: file.destination,
        filename: file.filename,
        path: file.path,
        buffer: file.buffer ? 'Buffer exists' : 'No buffer'
      });

      const fullPath = join(this.uploadsDir, destinationPath);
      const dir = path.dirname(fullPath);
      
      // Ensure directory exists
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Handle different file storage types
      if (file.buffer) {
        // File is in memory (buffer storage)
        console.log('localFileService.saveFile: Using buffer storage');
        fs.writeFileSync(fullPath, file.buffer);
      } else if (file.path) {
        // File is on disk (disk storage) - copy from temp location
        console.log('localFileService.saveFile: Using disk storage, copying from:', file.path);
        fs.copyFileSync(file.path, fullPath);
        // Optionally remove the temp file
        try {
          fs.unlinkSync(file.path);
          console.log('localFileService.saveFile: Removed temp file:', file.path);
        } catch (e) {
          console.log('localFileService.saveFile: Could not remove temp file:', e.message);
        }
      } else {
        throw new Error('File object has neither buffer nor path property');
      }
      
      console.log('localFileService.saveFile: File saved successfully to:', fullPath);
      
      // Return the URL path (not full URL)
      return `/${destinationPath}`;
    } catch (error) {
      console.error('Error saving file locally:', error);
      throw error;
    }
  }

  // Save QR code file (uses local storage)
  async saveQRCode(file, destinationPath) {
    return await this.saveFile(file, destinationPath);
  }

  // Delete a file locally
  async deleteFile(filePath) {
    try {
      // Remove leading slash if present
      const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      const fullPath = join(this.uploadsDir, cleanPath);
      
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`Deleted local file: ${fullPath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting local file:', error);
      return false;
    }
  }

  // Check if file exists
  fileExists(filePath) {
    try {
      const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      const fullPath = join(this.uploadsDir, cleanPath);
      return fs.existsSync(fullPath);
    } catch (error) {
      console.error('Error checking file existence:', error);
      return false;
    }
  }

  // Get file info
  getFileInfo(filePath) {
    try {
      const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      const fullPath = join(this.uploadsDir, cleanPath);
      
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        return {
          exists: true,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          path: fullPath
        };
      }
      return { exists: false };
    } catch (error) {
      console.error('Error getting file info:', error);
      return { exists: false, error: error.message };
    }
  }

  // List files in a directory
  listFiles(directoryPath) {
    try {
      const fullPath = join(this.uploadsDir, directoryPath);
      if (!fs.existsSync(fullPath)) {
        return [];
      }
      
      const files = fs.readdirSync(fullPath);
      return files.map(file => ({
        name: file,
        path: join(directoryPath, file),
        url: `/${directoryPath}/${file}`,
        ...this.getFileInfo(join(directoryPath, file))
      }));
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  }
}

export const localFileService = new FileService();

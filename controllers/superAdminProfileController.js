import { userService } from '../services/firebaseService.js';
import { localFileService } from '../services/localFileService.js';
import path from 'path';
import fs from 'fs';

const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_PROFILE_PIC = process.env.DEFAULT_PROFILE_PIC || 'https://via.placeholder.com/150x150?text=Avatar';

// Function to convert image to base64
const imageToBase64 = (filePath) => {
  try {
    const imageBuffer = fs.readFileSync(filePath);
    const base64String = imageBuffer.toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';
    return `data:${mimeType};base64,${base64String}`;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
};

// Upload profile picture
const uploadProfilePic = async (req, res) => {
  try {
    console.log('uploadProfilePic: Starting profile picture upload');
    console.log('uploadProfilePic: req.user:', req.user);
    
    const userId = req.user.uid || req.user.id;
    console.log('uploadProfilePic: userId:', userId);
    
    if (!req.file) {
      console.log('uploadProfilePic: No file uploaded');
      return res.status(400).json({ error: "No file uploaded." });
    }
    
    console.log('uploadProfilePic: File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
    
    if (!ALLOWED_FILE_TYPES.includes(req.file.mimetype)) {
      console.log('uploadProfilePic: Invalid file type:', req.file.mimetype);
      return res.status(400).json({ error: "Invalid file type. Only JPEG, PNG, and GIF are allowed." });
    }
    
    if (req.file.size > MAX_FILE_SIZE) {
      console.log('uploadProfilePic: File too large:', req.file.size);
      return res.status(400).json({ error: "File size exceeds 5MB limit." });
    }
    
    console.log('uploadProfilePic: File validation passed, uploading to local storage');
    
    // Upload to local storage
    const timestamp = Date.now();
    const fileName = `${userId}-${timestamp}-${req.file.originalname}`;
    const destinationPath = `profile-pics/${fileName}`;
    console.log('uploadProfilePic: Local storage path:', destinationPath);
    
    const localUrl = await localFileService.saveFile(req.file, destinationPath);
    const newProfilePicUrl = `http://localhost:5000/uploads${localUrl}`;
    console.log('uploadProfilePic: File uploaded successfully to local storage, URL:', newProfilePicUrl);
    
    // Update user profile picture in Firestore
    console.log('uploadProfilePic: Fetching user from Firestore');
    const user = await userService.getUserById(userId);
    console.log('uploadProfilePic: User from Firestore:', user);
    
    if (!user) {
      console.log('uploadProfilePic: User not found in Firestore');
      return res.status(404).json({ error: "User not found." });
    }
    
    // Delete old profile picture if it exists and is not default
    if (user.profilePicPath && user.profilePic !== newProfilePicUrl) {
      // Only delete if it's not the default profile pic
      const isDefaultPic = !user.profilePic || user.profilePic === DEFAULT_PROFILE_PIC || user.profilePic.includes('placeholder');
      if (!isDefaultPic) {
        try {
          console.log('uploadProfilePic: Deleting old profile picture:', user.profilePicPath);
          await localFileService.deleteFile(user.profilePicPath);
          console.log('uploadProfilePic: Old profile picture deleted from local storage');
        } catch (e) {
          console.error('uploadProfilePic: Error deleting old profile picture:', e.message);
          // continue; not fatal
        }
      } else {
        console.log('uploadProfilePic: Skipping deletion of default profile picture');
      }
    }
    
    console.log('uploadProfilePic: Updating user in Firestore');
    const updateData = { 
      profilePic: newProfilePicUrl,
      profilePicPath: destinationPath,
      updatedAt: new Date() 
    };
    console.log('uploadProfilePic: Update data:', updateData);
    
    await userService.updateUser(userId, updateData);
    console.log('uploadProfilePic: User updated successfully in Firestore');
    
    return res.status(200).json({
      message: "Profile picture uploaded successfully.",
      profilePicUrl: newProfilePicUrl,
    });
  } catch (error) {
    console.error("uploadProfilePic: Error uploading profile picture:", error);
    console.error("uploadProfilePic: Error stack:", error.stack);
    console.error("uploadProfilePic: Error details:", {
      message: error.message,
      code: error.code,
      name: error.name,
      userId: req.user?.uid || req.user?.id,
      fileInfo: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : 'No file'
    });
    
    // Return more specific error messages
    if (error.code === 'ENOENT') {
      return res.status(500).json({ error: "File system error. Please try again." });
    } else if (error.code === 'EACCES') {
      return res.status(500).json({ error: "Permission denied. Please try again." });
    } else if (error.message && error.message.includes('Firestore')) {
      return res.status(500).json({ error: "Database error. Please try again." });
    } else {
      return res.status(500).json({ error: "Server error while uploading profile picture." });
    }
  }
};

// Edit (update) profile picture
const editProfilePic = uploadProfilePic;

// Delete profile picture
const deleteProfilePic = async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    const user = await userService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    
    // Check if user has a profile picture to delete
    const hasProfilePic = user.profilePic && user.profilePic !== DEFAULT_PROFILE_PIC && !user.profilePic.includes('placeholder');
    const hasProfilePicPath = user.profilePicPath;
    
    if (!hasProfilePic && !hasProfilePicPath) {
      return res.status(400).json({ error: "No profile picture to delete." });
    }
    
    // Delete the file if it exists
    if (hasProfilePicPath) {
      try {
        await localFileService.deleteFile(user.profilePicPath);
        console.log('deleteProfilePic: Profile picture file deleted from local storage');
      } catch (e) {
        console.error('deleteProfilePic: Error deleting file:', e.message);
        // continue; not fatal
      }
    }
    
    // Update user record
    await userService.updateUser(userId, { 
      profilePic: DEFAULT_PROFILE_PIC,
      profilePicPath: null,
      updatedAt: new Date() 
    });
    
    return res.status(200).json({ 
      message: "Profile picture deleted successfully.",
      profilePicUrl: DEFAULT_PROFILE_PIC
    });
  } catch (error) {
    console.error("Error deleting profile picture:", error.message);
    return res.status(500).json({ error: "Server error while deleting profile picture." });
  }
};

// Get profile picture as base64 (CORS-free)
const getProfilePicAsBase64 = async (req, res) => {
  try {
    // Get userId from params or from authenticated user
    const userId = req.params.userId || req.user?.uid || req.user?.id;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }
    
    console.log('getProfilePicAsBase64: Fetching profile picture for userId:', userId);
    
    const user = await userService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    
    if (!user.profilePicPath) {
      return res.status(404).json({ error: "No profile picture found." });
    }
    
    const filepath = path.join(process.cwd(), 'uploads', user.profilePicPath);
    console.log('getProfilePicAsBase64: File path:', filepath);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: "Profile picture file not found." });
    }
    
    const base64Data = imageToBase64(filepath);
    if (!base64Data) {
      return res.status(500).json({ error: "Error processing profile picture." });
    }
    
    console.log('getProfilePicAsBase64: Successfully converted to base64');
    return res.status(200).json({
      profilePicBase64: base64Data,
      message: "Profile picture retrieved successfully."
    });
  } catch (error) {
    console.error("Error getting profile picture as base64:", error);
    return res.status(500).json({ error: "Server error while retrieving profile picture." });
  }
};

export { uploadProfilePic, editProfilePic, deleteProfilePic, getProfilePicAsBase64 };
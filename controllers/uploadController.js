import { userService, fileUploadService } from '../services/firebaseService.js';

const uploadProfilePic = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    // Upload to Firebase Storage
    const destinationPath = `profile-pics/${userId}-${req.file.originalname}`;
    const newProfilePicUrl = await fileUploadService.uploadFile(req.file, destinationPath);
    // Update profilePic in Firestore
    const user = await userService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    // Delete old profile picture if it exists and is different
    if (user.profilePic && user.profilePic !== newProfilePicUrl) {
      await fileUploadService.deleteFile(user.profilePic);
    }
    await userService.updateUser(userId, { profilePic: newProfilePicUrl, updatedAt: new Date() });
    res.json({ message: 'Profile picture uploaded successfully.', profilePicUrl: newProfilePicUrl });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ error: 'Failed to upload profile picture.' });
  }
};

export default uploadProfilePic;

import express from "express";
import { uploadProfilePic, editProfilePic, deleteProfilePic, getProfilePicAsBase64 } from "../controllers/superAdminProfileController.js";
import { protect, verifySuperAdmin } from "../middleware/AuthMiddleware.js";
import upload from "../middleware/multerConfig.js";

const router = express.Router();

router.post("/superadmin/profile/upload", protect, verifySuperAdmin, upload.single("profilePic"), uploadProfilePic);
router.put("/superadmin/profile/edit", protect, verifySuperAdmin, upload.single("profilePic"), editProfilePic);
router.delete("/superadmin/profile/delete", protect, verifySuperAdmin, deleteProfilePic);
router.get("/superadmin/profile/base64", protect, verifySuperAdmin, getProfilePicAsBase64);
router.get("/superadmin/profile/base64/:userId", protect, verifySuperAdmin, getProfilePicAsBase64);

export default router;
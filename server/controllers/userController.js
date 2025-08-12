import userModel from "../models/userModel.js";
import bcrypt from "bcryptjs";
import crypto from 'crypto';
import pdf from 'pdf-parse'; 

const extractTextFromPDF = async (buffer) => {
  try {
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    const user = await userModel.findById(userId).select('-password -resetOtp -verifyOtp -resetOtpExpireAt -verifyOtpExpireAt');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user profile"
    });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { name, phoneNumber, accountType } = req.body;

    if (!name || !phoneNumber || !accountType) {
      return res.status(400).json({
        success: false,
        message: "Name, phone number, and account type are required"
      });
    }

    if (!['Fresher', 'Trainer'].includes(accountType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account type"
      });
    }

    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      {
        name,
        phoneNumber,
        accountType,
        lastActive: new Date()
      },
      { 
        new: true,
        select: '-password -resetOtp -verifyOtp -resetOtpExpireAt -verifyOtpExpireAt'
      }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile"
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long"
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    await userModel.findByIdAndUpdate(userId, {
      password: hashedNewPassword,
      lastActive: new Date()
    });

    res.json({
      success: true,
      message: "Password updated successfully"
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to change password"
    });
  }
};

export const upgradeToPremium = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      { 
        accountPlan: 'premium',
        lastActive: new Date()
      },
      { 
        new: true,
        select: '-password -resetOtp -verifyOtp -resetOtpExpireAt -verifyOtpExpireAt'
      }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "Account upgraded to Premium successfully",
      data: updatedUser
    });
  } catch (error) {
    console.error('Upgrade to premium error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to upgrade account"
    });
  }
};

export const downgradeToBasic = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      { 
        accountPlan: 'basic',
        lastActive: new Date()
      },
      { 
        new: true,
        select: '-password -resetOtp -verifyOtp -resetOtpExpireAt -verifyOtpExpireAt'
      }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "Account downgraded to Basic",
      data: updatedUser
    });
  } catch (error) {
    console.error('Downgrade to basic error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to downgrade account"
    });
  }
};

export const uploadCV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No CV file uploaded' 
      });
    }
    
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Extract text from PDF buffer
    const cvText = await extractTextFromPDF(req.file.buffer);
    
    if (!cvText || cvText.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Could not extract text from PDF' 
      });
    }

    // Create hash of CV content for change detection
    const cvHash = crypto.createHash('sha256').update(cvText).digest('hex');

    // Update user with CV data (assuming you have these methods on your user model)
    await user.updateCV(cvText, req.file.originalname, cvHash);

    res.json({
      success: true,
      message: 'CV uploaded successfully',
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        uploadedAt: user.currentCV.uploadedAt,
        hasCV: user.hasCV
      }
    });
  } catch (error) {
    console.error('Upload CV error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to upload CV' 
    });
  }
};

export const getCurrentCV = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    if (!user.hasCV) {
      return res.status(404).json({ 
        success: false, 
        message: 'No CV uploaded yet' 
      });
    }
    res.json({
      success: true,
      data: {
        fileName: user.currentCV.fileName,
        uploadedAt: user.currentCV.uploadedAt,
        fileSize: user.currentCV.fileSize,
        hasText: !!(user.currentCV.text && user.currentCV.text.trim().length > 0),
        textLength: user.currentCV.text ? user.currentCV.text.length : 0
      }
    });
  } catch (error) {
    console.error('Get CV error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve CV' 
    });
  }
};

export const deleteCV = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    if (!user.hasCV) {
      return res.status(404).json({ 
        success: false, 
        message: 'No CV to delete' 
      });
    }

    await user.clearCV();

    res.json({
      success: true,
      message: 'CV deleted successfully'
    });
  } catch (error) {
    console.error('Delete CV error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete CV' 
    });
  }
};
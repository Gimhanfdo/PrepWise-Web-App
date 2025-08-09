import userModel from "../models/userModel.js";
import bcrypt from "bcryptjs";

// Get user profile data
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    // Fetch user data without sensitive fields
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

// Update user profile
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { name, phoneNumber, accountType } = req.body;

    // Validate required fields
    if (!name || !phoneNumber || !accountType) {
      return res.status(400).json({
        success: false,
        message: "Name, phone number, and account type are required"
      });
    }

    // Validate account type
    if (!['Fresher', 'Trainer'].includes(accountType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account type"
      });
    }

    // Update user profile
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

// Change password
export const changePassword = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validate input
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

    // Get user with password
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
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

// Upgrade to premium
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

// Downgrade to basic
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
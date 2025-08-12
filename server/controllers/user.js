import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pdfParse from 'pdf-parse';
import userModel from '../models/userModel.js';
import CVAnalysis from '../models/CVAnalysisModel.js';
import { TechnologyRating } from '../models/SkillAssessorModel.js';

// Helper function to generate CV hash
const generateCVHash = (text, userId) => {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const combined = `${text.substring(0, 1000)}${userId}${timestamp}`;
  return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
};

// Helper function to extract text from PDF buffer
const extractTextFromPDF = async (buffer) => {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to extract text from PDF file');
  }
};

// GET /api/user/profile
export const getUserProfile = async (req, res) => {
  try {
    console.log('Getting profile for user:', req.user.id);
    
    const user = await userModel.findById(req.user.id).select('-password -verifyOtp -resetOtp');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    console.log('User profile found, has CV:', user.hasCV);

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// PUT /api/user/profile
export const updateUserProfile = async (req, res) => {
  try {
    const { name, phoneNumber, accountType } = req.body;
    
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Update fields if provided
    if (name !== undefined) user.name = name.trim();
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber.trim();
    if (accountType !== undefined && ['Fresher', 'Trainer'].includes(accountType)) {
      user.accountType = accountType;
    }

    await user.save();

    // Return updated user without sensitive information
    const updatedUser = await userModel.findById(req.user.id).select('-password -verifyOtp -resetOtp');
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// PUT /api/user/change-password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current and new passwords are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'New password must be at least 6 characters long' 
      });
    }

    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// PUT /api/user/upload-cv
export const uploadCV = async (req, res) => {
  try {
    console.log('=== CV UPLOAD DEBUG ===');
    console.log('User ID:', req.user.id);
    console.log('File received:', !!req.file);
    console.log('File details:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : 'No file');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No PDF file uploaded'
      });
    }

    // Validate file type
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({
        success: false,
        message: 'Only PDF files are allowed'
      });
    }

    // Validate file size (10MB limit)
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'File size must be less than 10MB'
      });
    }

    // Extract text from PDF
    let cvText;
    try {
      cvText = await extractTextFromPDF(req.file.buffer);
      console.log('Extracted text length:', cvText.length);
      
      if (!cvText || cvText.trim().length < 100) {
        return res.status(400).json({
          success: false,
          message: 'PDF file appears to be empty or contains insufficient text content'
        });
      }
    } catch (extractError) {
      console.error('Text extraction error:', extractError);
      return res.status(400).json({
        success: false,
        message: 'Failed to extract text from PDF. Please ensure the file is not corrupted or password-protected.'
      });
    }

    // Generate CV hash
    const cvHash = generateCVHash(cvText, req.user.id);
    console.log('Generated CV hash:', cvHash);

    // Find and update user
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update CV in user profile
    await user.updateCV(cvText, req.file.originalname, cvHash);
    console.log('CV updated in user profile');

    // Return success response
    res.json({
      success: true,
      message: 'CV uploaded and saved successfully',
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        uploadedAt: new Date(),
        hash: cvHash,
        textLength: cvText.length
      }
    });

  } catch (error) {
    console.error('Upload CV error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload CV',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/user/cv
export const getCurrentCV = async (req, res) => {
  try {
    console.log('=== GET CURRENT CV DEBUG ===');
    console.log('User ID:', req.user.id);

    const user = await userModel.findById(req.user.id).select('currentCV');
    
    if (!user) {
      console.log('User not found');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('User found, currentCV exists:', !!user.currentCV);
    console.log('CV has text:', !!(user.currentCV && user.currentCV.text));

    if (!user.currentCV || !user.currentCV.text || user.currentCV.text.trim().length === 0) {
      console.log('No CV found for user');
      return res.status(404).json({
        success: false,
        message: 'No CV found in user profile'
      });
    }

    const cvData = {
      fileName: user.currentCV.fileName || 'Unknown',
      uploadedAt: user.currentCV.uploadedAt,
      fileSize: user.currentCV.fileSize || 0,
      hash: user.currentCV.hash || '',
      hasText: !!(user.currentCV.text && user.currentCV.text.trim().length > 0)
    };

    console.log('Returning CV data:', cvData);

    res.json({
      success: true,
      data: cvData
    });

  } catch (error) {
    console.error('Get current CV error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve CV',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// DELETE /api/user/cv
export const deleteCV = async (req, res) => {
  try {
    console.log('=== DELETE CV DEBUG ===');
    console.log('User ID:', req.user.id);

    const user = await userModel.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.currentCV || !user.currentCV.text) {
      return res.status(404).json({
        success: false,
        message: 'No CV found to delete'
      });
    }

    // Clear CV from user profile
    await user.clearCV();
    console.log('CV cleared from user profile');

    res.json({
      success: true,
      message: 'CV deleted successfully'
    });

  } catch (error) {
    console.error('Delete CV error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete CV',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// PUT /api/user/upgrade-premium
export const upgradeToPremium = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (user.accountPlan === 'premium') {
      return res.status(400).json({ 
        success: false, 
        message: 'Already on premium plan' 
      });
    }

    // Here you would typically integrate with payment processing
    // For now, we'll just update the account plan
    user.accountPlan = 'premium';
    await user.save();

    res.json({
      success: true,
      message: 'Account upgraded to Premium successfully',
      data: { accountPlan: user.accountPlan }
    });
  } catch (error) {
    console.error('Upgrade premium error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// PUT /api/user/downgrade-basic
export const downgradeToBasic = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (user.accountPlan === 'basic') {
      return res.status(400).json({ 
        success: false, 
        message: 'Already on basic plan' 
      });
    }

    user.accountPlan = 'basic';
    await user.save();

    res.json({
      success: true,
      message: 'Account downgraded to Basic',
      data: { accountPlan: user.accountPlan }
    });
  } catch (error) {
    console.error('Downgrade basic error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
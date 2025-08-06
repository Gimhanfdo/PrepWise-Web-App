import express from 'express';
import bcrypt from 'bcryptjs';
import userModel from '../models/userModel.js';
import cvAnalysisModel from '../models/CVAnalysisModel.js';
import skillsAssessmentModel from '../models/skillsAssessmentModel.js';
import userAuth from '../middleware/userAuth.js';

const userRouter = express.Router();

// GET /api/user/profile - Get user profile
userRouter.get('/profile', userAuth, async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id).select('-password -verifyOtp -resetOtp');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/user/profile - Update user profile
userRouter.put('/profile', userAuth, async (req, res) => {
  try {
    const { name, phoneNumber, accountType } = req.body;
    
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update fields if provided
    if (name) user.name = name;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (accountType) user.accountType = accountType;

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
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/user/change-password - Change user password
userRouter.put('/change-password', userAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
    }

    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
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
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/user/saved-analyses - Get saved CV analyses
userRouter.get('/saved-analyses', userAuth, async (req, res) => {
  try {
    const analyses = await cvAnalysisModel.find({ 
      userId: req.user.id,
      isSaved: true 
    }).sort({ createdAt: -1 });

    // Transform data for frontend
    const formattedAnalyses = analyses.map(analysis => ({
      id: analysis._id,
      createdAt: analysis.createdAt,
      matchPercentage: analysis.results[0]?.matchPercentage || 0,
      jobTitle: analysis.jobDescriptions[0]?.split('\n')[0] || 'Unknown Position',
      company: 'Company Name', // You might want to extract this from job description
      results: analysis.results
    }));

    res.json({
      success: true,
      data: formattedAnalyses
    });
  } catch (error) {
    console.error('Get saved analyses error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/user/skills-assessments - Get skills assessments
userRouter.get('/skills-assessments', userAuth, async (req, res) => {
  try {
    const assessments = await skillsAssessmentModel.find({ 
      userId: req.user.id 
    }).sort({ completedAt: -1 });

    res.json({
      success: true,
      data: assessments
    });
  } catch (error) {
    console.error('Get skills assessments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/user/analysis/:id - Delete a saved CV analysis
userRouter.delete('/analysis/:id', userAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const analysis = await cvAnalysisModel.findOne({
      _id: id,
      userId: req.user.id
    });

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found' });
    }

    await cvAnalysisModel.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Analysis deleted successfully'
    });
  } catch (error) {
    console.error('Delete analysis error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/user/assessment/:id - Delete a skills assessment
userRouter.delete('/assessment/:id', userAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const assessment = await skillsAssessmentModel.findOne({
      _id: id,
      userId: req.user.id
    });

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    await skillsAssessmentModel.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Assessment deleted successfully'
    });
  } catch (error) {
    console.error('Delete assessment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/user/upgrade-premium - Upgrade to premium
userRouter.put('/upgrade-premium', userAuth, async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.accountPlan === 'premium') {
      return res.status(400).json({ success: false, message: 'Already on premium plan' });
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
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/user/downgrade-basic - Downgrade to basic
userRouter.put('/downgrade-basic', userAuth, async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.accountPlan === 'basic') {
      return res.status(400).json({ success: false, message: 'Already on basic plan' });
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
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/user/notifications - Update notification settings
userRouter.put('/notifications', userAuth, async (req, res) => {
  try {
    const { emailUpdates, cvAnalysisAlerts, skillsReminders } = req.body;

    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Add notification preferences to user model if not exists
    if (!user.notificationSettings) {
      user.notificationSettings = {};
    }

    user.notificationSettings.emailUpdates = emailUpdates;
    user.notificationSettings.cvAnalysisAlerts = cvAnalysisAlerts;
    user.notificationSettings.skillsReminders = skillsReminders;

    await user.save();

    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      data: user.notificationSettings
    });
  } catch (error) {
    console.error('Update notifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/user/save-analysis/:id - Save/unsave a CV analysis
userRouter.put('/save-analysis/:id', userAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { isSaved } = req.body;

    const analysis = await cvAnalysisModel.findOne({
      _id: id,
      userId: req.user.id
    });

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found' });
    }

    analysis.isSaved = isSaved;
    await analysis.save();

    res.json({
      success: true,
      message: isSaved ? 'Analysis saved successfully' : 'Analysis unsaved successfully',
      data: { isSaved: analysis.isSaved }
    });
  } catch (error) {
    console.error('Save analysis error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/user/account - Delete user account
userRouter.delete('/account', userAuth, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ success: false, message: 'Invalid password' });
    }

    // Delete all related data
    await cvAnalysisModel.deleteMany({ userId: req.user.id });
    await skillsAssessmentModel.deleteMany({ userId: req.user.id });
    
    // Delete user account
    await userModel.findByIdAndDelete(req.user.id);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default userRouter;
// Add this debugging to your existing userAuth middleware
// This will help us see what's in the req.user object

// If your userAuth middleware doesn't exist, here's a complete one:
import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';

const userAuth = async (req, res, next) => {
  try {
    console.log('=== AUTH MIDDLEWARE DEBUG ===');
    console.log('Cookies:', req.cookies);
    console.log('Headers:', req.headers.authorization);
    
    // Try to get token from different places
    const tokenFromCookie = req.cookies.token;
    const tokenFromHeader = req.headers.authorization?.replace('Bearer ', '');
    const token = tokenFromCookie || tokenFromHeader;
    
    console.log('Token found:', !!token);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please login.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    
    // Find user
    const user = await userModel.findById(decoded.id || decoded.userId).select('-password');
    console.log('User found:', !!user);
    console.log('User ID:', user?._id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please login again.'
      });
    }

    // Set user info in request - try different formats to be safe
    req.user = {
      userId: user._id,        // Standard format
      id: user._id,           // Alternative format
      _id: user._id,          // Mongoose format
      name: user.name,
      email: user.email,
      accountPlan: user.accountPlan
    };
    
    console.log('req.user set to:', req.user);
    console.log('=== END AUTH DEBUG ===');
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token. Please login again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export default userAuth;
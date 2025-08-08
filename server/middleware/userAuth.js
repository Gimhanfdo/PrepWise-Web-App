import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";

// Middleware to protect routes by verifying JWT token
const userAuth = async (req, res, next) => {
  try {
    let token;

    // Check for token in cookies first, then in Authorization header
    if (req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Login again.",
      });
    }

    // Verify the token using the secret key
    const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch the complete user data from database
    const user = await userModel.findById(tokenDecode.id).select('-password -resetOtp -verifyOtp -resetOtpExpireAt -verifyOtpExpireAt');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found. Please login again.",
      });
    }

    // Attach the complete user object to the request with both id and _id for compatibility
    req.user = {
      ...user.toObject(),
      id: user._id,
      _id: user._id
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid token. Please login again." 
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: "Token expired. Please login again." 
      });
    }
    return res.status(500).json({ 
      success: false, 
      message: "Authentication error." 
    });
  }
};

export default userAuth;
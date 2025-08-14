import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';

const authUser = async (req, res, next) => {
  console.log('=== AUTH MIDDLEWARE DEBUG ===');
  console.log('Request path:', req.path);
  console.log('Request method:', req.method);
  console.log('Cookies available:', Object.keys(req.cookies));
  console.log('Authorization header:', req.headers.authorization ? 'Present' : 'Not present');
  
  try {
    // Get token from cookie or header
    const tokenFromCookie = req.cookies.token;
    const tokenFromHeader = req.headers.authorization?.startsWith('Bearer ') 
      ? req.headers.authorization.slice(7) 
      : null;
    
    console.log('Token sources:');
    console.log('  - Cookie token:', tokenFromCookie ? 'Present' : 'Not present');
    console.log('  - Header token:', tokenFromHeader ? 'Present' : 'Not present');
    
    const token = tokenFromCookie || tokenFromHeader;
    console.log('  - Final token:', token ? 'Found' : 'Not found');
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ success: false, message: 'Not Authorized Login Again' });
    }

    // Verify token
    const token_decode = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verified successfully');
    console.log('Decoded payload:', {
      id: token_decode.id,
      userId: token_decode.userId,
      exp: new Date(token_decode.exp * 1000).toISOString()
    });

    // Check if token is expired
    if (Date.now() >= token_decode.exp * 1000) {
      console.log('❌ Token expired');
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }

    console.log('Looking up user with ID:', token_decode.id);
    
    // Find user with retry logic for connection issues
    let user = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries && !user) {
      try {
        user = await userModel.findById(token_decode.id);
        if (user) {
          console.log('User lookup result: Found');
          break;
        } else {
          console.log('User lookup result: Not found in database');
        }
      } catch (dbError) {
        retryCount++;
        console.log(`❌ Database error (attempt ${retryCount}/${maxRetries}):`, dbError.message);
        
        if (dbError.name === 'MongoServerSelectionError' || 
            dbError.name === 'MongoNetworkError' ||
            dbError.code === 'ENOTFOUND') {
          
          if (retryCount < maxRetries) {
            console.log(`Retrying database connection in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          } else {
            console.log('❌ Max retries reached. Database connection failed.');
            return res.status(503).json({ 
              success: false, 
              message: 'Database connection error. Please try again later.',
              error: 'SERVICE_UNAVAILABLE'
            });
          }
        } else {
          // For other database errors, don't retry
          throw dbError;
        }
      }
    }

    if (!user) {
      console.log('❌ User not found after all attempts');
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    console.log('✅ Authentication successful');
    console.log('User set in req.user:', {
      userId: user._id,
      name: user.name,
      email: user.email
    });

    req.user = user;
    console.log('=== END AUTH DEBUG ===');
    next();

  } catch (error) {
    console.log('❌ Auth middleware unexpected error:', error.name, error.message);
    console.error('Error stack:', error.stack);
    
    // Handle JWT errors specifically
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token format' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }
    
    // Handle database connection errors
    if (error.name === 'MongoServerSelectionError' || 
        error.name === 'MongoNetworkError' ||
        error.code === 'ENOTFOUND') {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection error. Please try again later.',
        error: 'DATABASE_CONNECTION_FAILED'
      });
    }
    
    // Generic error response
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication service error',
      error: error.name
    });
  }
};

export default authUser;
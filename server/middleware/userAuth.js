import jwt from "jsonwebtoken";

// Middleware to protect routes by verifying JWT token
const userAuth = async (req, res, next) => {
  // Extract token from the cookies
  const { token } = req.cookies;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized. Login again.",
    });
  }

  try {
    // Verify the token using the secret key
    const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach the decoded user ID to the request object
    req.user = {id: tokenDecode.id};
    next();
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export default userAuth;

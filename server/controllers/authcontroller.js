import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import transporter from "../config/nodemailer.js";
import { EMAIL_VERIFY_TEMPLATE, PASSWORD_RESET_TEMPLATE } from "../config/emailTemplates.js";

//Register functionality - MODIFIED TO AUTO-SEND OTP
export const registerUser = async (req, res) => {
  const { name, email, password, phoneNumber, accountType } = req.body;

  if (!name || !email || !password || !phoneNumber || !accountType) {
    return res.json({ success: false, message: "Missing Details" });
  }

  if (!["Trainer", "Fresher"].includes(accountType)) {
    return res.json({ success: false, message: "Invalid account type" });
  }

  if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/.test(password)) {
    return res.json({
      success: false,
      message: "Password must be at least 6 characters long, include one uppercase letter, one number, and one special character",
    });
  }
  
  if (!/^\d{10}$/.test(phoneNumber)) {
    return res.json({
      success: false,
      message: "Phone number must be exactly 10 digits",
    });
  }

  try {
    // Check if user already exists
    const existingUser = await userModel.findOne({ email });

    if (existingUser) {
      return res.json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Create and save new user with OTP
    const user = new userModel({
      name,
      email,
      password: hashedPassword,
      phoneNumber,
      accountType,
      verifyOtp: otp,
      verifyOtpExpireAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });
    await user.save();

    // Generate JWT token for the new user
    const token = jwt.sign(
      { id: user._id, accountType: user.accountType },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // Set token as cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Send verification OTP email
    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: "Welcome to PrepWise - Verify Your Email",
      html: EMAIL_VERIFY_TEMPLATE.replace("{{otp}}", otp).replace("{{email}}", email)
    };

    await transporter.sendMail(mailOptions);

    return res.json({ 
      success: true, 
      message: "Registration successful! Please check your email for verification OTP.",
      needsVerification: true 
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

//Login functionality - MODIFIED TO CHECK VERIFICATION STATUS
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.json({
      success: false,
      message: "Email and password are required to login.",
    });
  }

  try {
    // Find user by email
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password. Please try again",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password. Please try again",
      });
    }

    // Generate JWT and set cookie
    const token = jwt.sign(
      { id: user._id, accountType: user.accountType },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Include verification status in response
    return res.json({ 
      success: true, 
      accountType: user.accountType,
      isAccountVerified: user.isAccountVerified,
      needsVerification: !user.isAccountVerified
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

//Logout functionality
export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    });

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

//Send verification OTP
export const sendVerifyOtp = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);

    // If already verified, do not send OTP
    if (user.isAccountVerified) {
      return res.json({
        success: false,
        message: "Account is already verified",
      });
    }

    // Generate 6 digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Store OTP and expiry
    user.verifyOtp = otp;
    user.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000;

    await user.save();

    // Prepare email
    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "OTP to Verify Account",
      html: EMAIL_VERIFY_TEMPLATE.replace("{{otp}}", otp).replace("{{email}}", user.email)
    };
    

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Verification OTP sent" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

//Email verification using OTP
export const verifyEmail = async (req, res) => {
  const { otp } = req.body;
  const userId = req.user.id;

  if (!userId || !otp) {
    return res.json({ success: false, message: "Missing details" });
  }

  try {
    const user = await userModel.findById(userId);

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if (user.verifyOtp === "" || user.verifyOtp !== otp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    if (user.verifyOtpExpireAt < Date.now()) {
      return res.json({ success: false, message: "OTP expired" });
    }

    user.isAccountVerified = true;
    user.verifyOtp = "";
    user.verifyOtpExpireAt = 0;

    await user.save();
    return res.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

//Check if user is authenticated - FIXED TO RETURN USER DATA
export const isAuthenticated = async (req, res) => {
  try {
    // req.user is already populated by the userAuth middleware with complete user data
    // Just need to return it in the expected format
    const userData = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      accountPlan: req.user.accountPlan,
      accountType: req.user.accountType,
      isAccountVerified: req.user.isAccountVerified,
      phoneNumber: req.user.phoneNumber,
      lastActive: req.user.lastActive,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt
    };

    return res.json({ 
      success: true, 
      user: userData 
    });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

//Send password reset OTP
export const sendResetOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.json({ success: false, message: "Email is required" });
  }

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    user.resetOtp = otp;
    user.resetOtpExpireAt = Date.now() + 15 * 60 * 1000;

    await user.save();

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "OTP to Reset Password",
      html: PASSWORD_RESET_TEMPLATE.replace("{{otp}}", otp).replace("{{email}}", user.email)
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Reset OTP sent" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

//Reset user password
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.json({
      success: false,
      message: "Email, OTP and the new password are required",
    });
  }

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if (user.resetOtp === "" || user.resetOtp !== otp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    if (user.resetOtpExpireAt < Date.now()) {
      return res.json({ success: false, message: "OTP expired" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetOtp = "";
    user.resetOtpExpireAt = 0;

    await user.save();

    return res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};




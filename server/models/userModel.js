// userModel.js - Fix duplicate index warning

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true, // Keep unique constraint
    // REMOVE: index: true, // Remove this line - duplicate index
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  phoneNumber: {
    type: String,
    trim: true,
    match: [/^\d{10,15}$/, 'Please enter a valid phone number']
  },
  accountType: {
    type: String,
    enum: ['Fresher', 'Trainer'],
    default: 'Fresher'
  },
  accountPlan: {
    type: String,
    enum: ['basic', 'premium'],
    default: 'basic'
  },
  isAccountVerified: {
    type: Boolean,
    default: false
  },
  verifyOtp: {
    type: String,
    default: ''
  },
  verifyOtpExpireAt: {
    type: Number,
    default: 0
  },
  resetOtp: {
    type: String,
    default: ''
  },
  resetOtpExpireAt: {
    type: Number,
    default: 0
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'users'
});

// Define indexes separately (this is where the duplicate might be)
// ONLY define indexes here, not in field definitions
userSchema.index({ email: 1 }, { unique: true, name: 'email_unique' });
userSchema.index({ isAccountVerified: 1 }, { name: 'account_verified' });
userSchema.index({ accountPlan: 1 }, { name: 'account_plan' });
userSchema.index({ lastActive: -1 }, { name: 'last_active' });

// Pre-save middleware
userSchema.pre('save', function(next) {
  if (!this.isNew) {
    this.lastActive = new Date();
  }
  next();
});

// Instance methods
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.verifyOtp;
  delete userObject.resetOtp;
  delete userObject.verifyOtpExpireAt;
  delete userObject.resetOtpExpireAt;
  return userObject;
};

const userModel = mongoose.model('User', userSchema);

export default userModel;
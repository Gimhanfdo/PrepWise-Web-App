// userModel.js - Fix duplicate index warnings
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true // Remove any additional .index(true) calls
  },
  password: { 
    type: String, 
    required: true 
  },
  phoneNumber: { 
    type: String, 
    required: true 
  },
  accountType: { 
    type: String, 
    enum: ['Fresher', 'Trainer'], 
    required: true 
  },
  accountPlan: { 
    type: String, 
    enum: ['basic', 'premium'], 
    default: 'basic' 
  },
  isAccountVerified: { 
    type: Boolean, 
    default: false 
    // Remove any .index(true) if present
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
  usageStats: {
    cvAnalysesCount: { type: Number, default: 0 },
    skillsAssessmentsCount: { type: Number, default: 0 }
  },
  lastActive: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  timestamps: true 
});

userSchema.index({ email: 1 }); 
userSchema.index({ isAccountVerified: 1 });

// Add methods if they don't exist
userSchema.methods.updateLastActive = function() {
  this.lastActive = new Date();
  return this.save();
};

const userModel = mongoose.models.user || mongoose.model('user', userSchema);
export default userModel;
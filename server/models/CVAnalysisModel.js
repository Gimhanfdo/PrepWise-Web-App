import mongoose from 'mongoose';

const cvAnalysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  resumeText: {
    type: String,
    required: true,
  },
  resumeHash: {
    type: String,
    required: true,
    index: true, // Add index for faster queries
  },
  jobDescriptions: {
    type: [String],
    required: true,
  },
  results: [
    {
      matchPercentage: {
        type: Number,
        required: true,
      },
      isNonTechRole: {
        type: Boolean,
        default: false,
      },
      strengths: [String],
      contentWeaknesses: [String],
      structureWeaknesses: [String],
      contentRecommendations: [String],
      structureRecommendations: [String],
      message: String,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create compound index for efficient lookups by user and resume hash
cvAnalysisSchema.index({ userId: 1, resumeHash: 1 }, { unique: true });

// Update the updatedAt field on save
cvAnalysisSchema.pre('save', function(next) {
  if (!this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

export default mongoose.model('CVAnalysis', cvAnalysisSchema);
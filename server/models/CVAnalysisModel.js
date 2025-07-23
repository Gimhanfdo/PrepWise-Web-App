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
  jobDescriptions: {
    type: [String],
    required: true,
  },
  results: [
    {
      matchPercentage: Number,
      suggestions: String,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('CVAnalysis', cvAnalysisSchema);

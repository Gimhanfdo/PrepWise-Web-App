// models/interviewModel.js
import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['behavioral', 'technical', 'system_design', 'coding']
  },
  question: { type: String, required: true },
  category: { type: String, required: true },
  difficulty: { 
    type: String, 
    required: true, 
    enum: ['easy', 'medium', 'hard'] 
  },
  expectedDuration: { type: Number, default: 120 }, // in seconds
  followUpQuestions: [{ type: String }]
});

const responseSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  question: { type: String, required: true },
  audioUrl: { type: String }, // Path to stored audio file
  transcription: { type: String },
  responseTime: { type: Number }, // time taken to respond in seconds
  recordingDuration: { type: Number }, // length of recording in seconds
  submittedAt: { type: Date, default: Date.now },
  feedback: {
    score: { type: Number, min: 0, max: 100 },
    strengths: [{ type: String }],
    improvements: [{ type: String }],
    detailedAnalysis: { type: String },
    keywordMatches: [{ type: String }],
    communicationClarity: { type: Number, min: 0, max: 10 },
    technicalAccuracy: { type: Number, min: 0, max: 10 },
    structuredResponse: { type: Number, min: 0, max: 10 }
  }
});

const interviewSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'user', 
    required: true 
  },
  jobTitle: { type: String, required: true },
  jobDescription: { type: String, required: true },
  resumeText: { type: String, required: true },
  
  // Interview configuration
  questions: [questionSchema],
  totalQuestions: { type: Number, default: 5 },
  currentQuestionIndex: { type: Number, default: 0 },
  
  // Interview session data
  status: { 
    type: String, 
    enum: ['created', 'in_progress', 'completed', 'cancelled'], 
    default: 'created' 
  },
  
  // Interview timing
  startedAt: { type: Date },
  completedAt: { type: Date },
  totalDuration: { type: Number }, // in seconds
  
  // Responses
  responses: [responseSchema],
  
  // Overall feedback and scoring
  overallFeedback: {
    score: { type: Number, min: 0, max: 100 },
    technicalSkills: {
      score: { type: Number, min: 0, max: 100 },
      feedback: { type: String }
    },
    communicationSkills: {
      score: { type: Number, min: 0, max: 100 },
      feedback: { type: String }
    },
    problemSolving: {
      score: { type: Number, min: 0, max: 100 },
      feedback: { type: String }
    },
    recommendations: [{ type: String }],
    strengths: [{ type: String }],
    areasForImprovement: [{ type: String }]
  },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
interviewSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for better query performance
interviewSchema.index({ userId: 1, createdAt: -1 });
interviewSchema.index({ status: 1 });

const interviewModel = mongoose.models.interview || mongoose.model('interview', interviewSchema);

export default interviewModel;
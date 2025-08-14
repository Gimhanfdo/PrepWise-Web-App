import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['behavioral', 'technical', 'system_design', 'coding', 'problem-solving'] 
  },
  question: { type: String, required: true },
  category: { type: String, required: true },
  difficulty: { 
    type: String, 
    required: true, 
    enum: ['easy', 'medium', 'hard'] 
  },
  expectedDuration: { type: Number, default: 120 }, 
  followUpQuestions: [{ type: String }],
  starterCode: {
    type: mongoose.Schema.Types.Mixed, // Allow flexible structure for different languages
    default: null
  }
});

const responseSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  question: { type: String, required: true },
  audioUrl: { type: String }, 
  transcription: { type: String },
  responseTime: { type: Number }, 
  recordingDuration: { type: Number }, 
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
  
  questions: [questionSchema],
  totalQuestions: { type: Number, default: 5 },
  currentQuestionIndex: { type: Number, default: 0 },
  
  status: { 
    type: String, 
    enum: ['created', 'in_progress', 'completed', 'cancelled'], 
    default: 'created' 
  },

  usedProfileCV: {
    type: Boolean,
    default: false
  },
  
  cvSource: {
    type: String,
    enum: ['profile', 'manual', 'upload'],
    default: 'manual'
  },
  
  startedAt: { type: Date },
  completedAt: { type: Date },
  totalDuration: { type: Number }, 
  
  responses: [responseSchema],

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

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save middleware to update the updatedAt field
interviewSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Pre-save validation to ensure question types are valid
interviewSchema.pre('save', function(next) {
  const validTypes = ['behavioral', 'technical', 'system_design', 'coding', 'problem-solving'];
  
  for (let question of this.questions) {
    if (!validTypes.includes(question.type)) {
      console.warn(`Invalid question type: ${question.type}, converting to 'technical'`);
      question.type = 'technical';
    }
  }
  next();
});

// Indexes for better query performance
interviewSchema.index({ userId: 1, createdAt: -1 });
interviewSchema.index({ status: 1 });
interviewSchema.index({ userId: 1, status: 1 });

// Virtual for interview duration calculation
interviewSchema.virtual('duration').get(function() {
  if (this.startedAt && this.completedAt) {
    return Math.round((this.completedAt - this.startedAt) / 1000); // in seconds
  }
  return null;
});

// Method to get current question
interviewSchema.methods.getCurrentQuestion = function() {
  const answeredCount = this.responses.length;
  return this.questions[answeredCount] || null;
};

// Method to check if interview is complete
interviewSchema.methods.isComplete = function() {
  return this.responses.length >= this.questions.length;
};

// Method to get progress percentage
interviewSchema.methods.getProgress = function() {
  if (this.questions.length === 0) return 0;
  return Math.round((this.responses.length / this.questions.length) * 100);
};

// Static method to find user interviews with pagination
interviewSchema.statics.findUserInterviewsPaginated = function(userId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .select('jobTitle status overallFeedback createdAt completedAt totalDuration');
};

// Transform function to clean up output
interviewSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    // Remove sensitive information if needed
    delete ret.__v;
    return ret;
  }
});

// Create the model
const interviewModel = mongoose.models.interview || mongoose.model('interview', interviewSchema);

export default interviewModel;
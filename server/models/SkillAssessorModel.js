// models/TechnologyRating.js - Clean MongoDB model for Technology Ratings
import mongoose from 'mongoose';

const technologyRatingSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true,
    trim: true
  },
  resumeHash: {
    type: String,
    required: [true, 'Resume hash is required'],
    index: true,
    trim: true
  },
  technologies: [{
    name: {
      type: String,
      required: [true, 'Technology name is required'],
      trim: true
    },
    category: {
      type: String,
      default: 'General',
      trim: true
    },
    confidenceLevel: {
      type: Number,
      required: [true, 'Confidence level is required'],
      min: [1, 'Confidence level must be at least 1'],
      max: [10, 'Confidence level cannot exceed 10'],
      validate: {
        validator: function(value) {
          return Number.isInteger(value) || (value % 1 !== 0 && value.toString().split('.')[1].length <= 1);
        },
        message: 'Confidence level must be an integer or have at most 1 decimal place'
      }
    }
  }],
  summary: {
    totalTechnologies: {
      type: Number,
      min: 0
    },
    averageConfidence: {
      type: Number,
      min: 0,
      max: 10
    },
    expertCount: {
      type: Number,
      min: 0
    },
    proficientCount: {
      type: Number,
      min: 0
    },
    learningCount: {
      type: Number,
      min: 0
    }
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  collection: 'technology_ratings'
});

// Compound index for efficient queries and ensuring uniqueness
technologyRatingSchema.index(
  { userId: 1, resumeHash: 1 }, 
  { unique: true, name: 'user_resume_unique' }
);

// Index for efficient time-based queries
technologyRatingSchema.index({ createdAt: -1, userId: 1 });
technologyRatingSchema.index({ updatedAt: -1, userId: 1 });

// Virtual for getting the rating age
technologyRatingSchema.virtual('age').get(function() {
  return new Date() - this.createdAt;
});

// Virtual for checking if rating is recent (within last 30 days)
technologyRatingSchema.virtual('isRecent').get(function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return this.updatedAt > thirtyDaysAgo;
});

// Ensure virtuals are included when converting to JSON
technologyRatingSchema.set('toJSON', { virtuals: true });
technologyRatingSchema.set('toObject', { virtuals: true });

// Pre-save middleware for basic data cleaning
technologyRatingSchema.pre('save', function(next) {
  // Clean up technology names
  if (this.technologies && Array.isArray(this.technologies)) {
    this.technologies.forEach(tech => {
      if (tech.name) {
        tech.name = tech.name.trim();
      }
      if (tech.category) {
        tech.category = tech.category.trim();
      }
    });
  }
  next();
});

// Static method to find ratings by user
technologyRatingSchema.statics.findByUser = function(userId) {
  return this.find({ userId }).sort({ updatedAt: -1 });
};

// Static method to find ratings by resume hash
technologyRatingSchema.statics.findByResumeHash = function(resumeHash) {
  return this.find({ resumeHash }).sort({ updatedAt: -1 });
};

// Static method to find user's rating for specific resume
technologyRatingSchema.statics.findUserRating = function(userId, resumeHash) {
  return this.findOne({ userId, resumeHash });
};

// Instance method to check if rating belongs to user
technologyRatingSchema.methods.belongsToUser = function(userId) {
  return this.userId === userId;
};

// Create and export the model
const TechnologyRating = mongoose.model('TechnologyRating', technologyRatingSchema);

export { TechnologyRating };
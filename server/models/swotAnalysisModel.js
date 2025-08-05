// SWOTRatingModel.js - MongoDB model for storing technology confidence ratings

import mongoose from 'mongoose';

const technologySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  category: {
    type: String,
    required: true,
    trim: true,
    enum: [
      'Programming Languages',
      'Frameworks',
      'Tools',
      'Databases',
      'Cloud Services',
      'Other'
    ]
  },
  confidenceLevel: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
    validate: {
      validator: function(v) {
        return Number.isInteger(v) && v >= 1 && v <= 10;
      },
      message: 'Confidence level must be an integer between 1 and 10'
    }
  }
}, { _id: false }); // Don't create _id for subdocuments

const swotRatingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  resumeHash: {
    type: String,
    required: true,
    trim: true,
    maxlength: 64, // SHA-256 hash length
    index: true
  },
  technologies: {
    type: [technologySchema],
    required: true,
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: 'At least one technology rating is required'
    }
  },
  metadata: {
    totalTechnologies: {
      type: Number,
      required: true,
      min: 1
    },
    averageConfidence: {
      type: Number,
      required: true,
      min: 1,
      max: 10
    },
    expertLevel: {
      type: Number,
      default: 0,
      min: 0
    },
    proficientLevel: {
      type: Number,
      default: 0,
      min: 0
    },
    beginnerLevel: {
      type: Number,
      default: 0,
      min: 0
    },
    categoriesCount: {
      type: Number,
      default: 1,
      min: 1
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  collection: 'swot_ratings'
});

// Compound index for efficient queries
swotRatingSchema.index({ userId: 1, resumeHash: 1 }, { unique: true });

// Index for finding ratings by user
swotRatingSchema.index({ userId: 1, updatedAt: -1 });

// Pre-save middleware to update metadata
swotRatingSchema.pre('save', function(next) {
  if (this.technologies && this.technologies.length > 0) {
    const technologies = this.technologies;
    
    // Update metadata based on technologies
    this.metadata.totalTechnologies = technologies.length;
    this.metadata.averageConfidence = technologies.reduce((sum, tech) => sum + tech.confidenceLevel, 0) / technologies.length;
    this.metadata.expertLevel = technologies.filter(tech => tech.confidenceLevel >= 8).length;
    this.metadata.proficientLevel = technologies.filter(tech => tech.confidenceLevel >= 6 && tech.confidenceLevel < 8).length;
    this.metadata.beginnerLevel = technologies.filter(tech => tech.confidenceLevel < 6).length;
    this.metadata.categoriesCount = [...new Set(technologies.map(tech => tech.category))].length;
    this.metadata.lastUpdated = new Date();
  }
  next();
});

// Virtual for getting technology distribution
swotRatingSchema.virtual('technologyDistribution').get(function() {
  if (!this.technologies || this.technologies.length === 0) return {};
  
  const distribution = {};
  this.technologies.forEach(tech => {
    if (!distribution[tech.category]) {
      distribution[tech.category] = {
        count: 0,
        averageConfidence: 0,
        technologies: []
      };
    }
    distribution[tech.category].count++;
    distribution[tech.category].technologies.push({
      name: tech.name,
      confidenceLevel: tech.confidenceLevel
    });
  });

  // Calculate average confidence for each category
  Object.keys(distribution).forEach(category => {
    const techs = distribution[category].technologies;
    distribution[category].averageConfidence = 
      techs.reduce((sum, tech) => sum + tech.confidenceLevel, 0) / techs.length;
  });

  return distribution;
});

// Virtual for getting confidence level summary
swotRatingSchema.virtual('confidenceSummary').get(function() {
  if (!this.technologies || this.technologies.length === 0) return {};
  
  const summary = {
    expert: [], // 8-10
    proficient: [], // 6-7
    intermediate: [], // 4-5
    beginner: [] // 1-3
  };

  this.technologies.forEach(tech => {
    if (tech.confidenceLevel >= 8) {
      summary.expert.push(tech);
    } else if (tech.confidenceLevel >= 6) {
      summary.proficient.push(tech);
    } else if (tech.confidenceLevel >= 4) {
      summary.intermediate.push(tech);
    } else {
      summary.beginner.push(tech);
    }
  });

  return summary;
});

// Static method to find ratings by user with pagination
swotRatingSchema.statics.findByUserPaginated = function(userId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ userId })
    .sort({ updatedAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('-userId'); // Exclude sensitive user ID
};

// Static method to find ratings by resume hash
swotRatingSchema.statics.findByResumeHash = function(userId, resumeHash) {
  return this.findOne({ userId, resumeHash })
    .select('-userId');
};

// Instance method to get technologies needing improvement
swotRatingSchema.methods.getTechnologiesNeedingImprovement = function(threshold = 5) {
  return this.technologies.filter(tech => tech.confidenceLevel < threshold);
};

// Instance method to get strongest technologies
swotRatingSchema.methods.getStrongestTechnologies = function(threshold = 7) {
  return this.technologies.filter(tech => tech.confidenceLevel >= threshold)
    .sort((a, b) => b.confidenceLevel - a.confidenceLevel);
};

// Ensure virtual fields are serialized
swotRatingSchema.set('toJSON', { virtuals: true });
swotRatingSchema.set('toObject', { virtuals: true });

const SWOTRating = mongoose.model('SWOTRating', swotRatingSchema);

export default SWOTRating;

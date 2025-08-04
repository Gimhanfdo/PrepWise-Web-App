import mongoose from "mongoose";

const technologySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  confidenceLevel: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
    validate: {
      validator: function(value) {
        return Number.isInteger(value) && value >= 1 && value <= 10;
      },
      message: 'Confidence level must be an integer between 1 and 10'
    }
  },
  category: {
    type: String,
    default: 'General',
    enum: [
      'Programming Languages',
      'Frontend Technologies', 
      'Backend Technologies',
      'Databases',
      'Cloud & DevOps',
      'Mobile Technologies',
      'Data Science & ML',
      'Testing Tools',
      'Development Tools',
      'General'
    ]
  },
  dateRated: {
    type: Date,
    default: Date.now
  }
});

const technologyRatingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  resumeHash: {
    type: String,
    required: true,
    index: true
  },
  technologies: {
    type: [technologySchema],
    required: true,
    validate: {
      validator: function(technologies) {
        return technologies && technologies.length > 0;
      },
      message: 'At least one technology must be included'
    }
  },
  resumeText: {
    type: String,
    required: true,
    maxlength: 5000 // Store limited resume text for context
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  metadata: {
    totalTechnologies: {
      type: Number,
      default: function() {
        return this.technologies ? this.technologies.length : 0;
      }
    },
    averageConfidence: {
      type: Number,
      default: function() {
        if (!this.technologies || this.technologies.length === 0) return 0;
        const sum = this.technologies.reduce((acc, tech) => acc + tech.confidenceLevel, 0);
        return Math.round((sum / this.technologies.length) * 100) / 100;
      }
    },
    expertSkills: {
      type: [String],
      default: function() {
        if (!this.technologies) return [];
        return this.technologies
          .filter(tech => tech.confidenceLevel >= 8)
          .sort((a, b) => b.confidenceLevel - a.confidenceLevel)
          .slice(0, 10)
          .map(tech => tech.name);
      }
    },
    proficientSkills: {
      type: [String],
      default: function() {
        if (!this.technologies) return [];
        return this.technologies
          .filter(tech => tech.confidenceLevel >= 6 && tech.confidenceLevel < 8)
          .sort((a, b) => b.confidenceLevel - a.confidenceLevel)
          .slice(0, 10)
          .map(tech => tech.name);
      }
    },
    learningSkills: {
      type: [String],
      default: function() {
        if (!this.technologies) return [];
        return this.technologies
          .filter(tech => tech.confidenceLevel < 6)
          .sort((a, b) => a.confidenceLevel - b.confidenceLevel)
          .slice(0, 10)
          .map(tech => tech.name);
      }
    },
    strongestCategory: {
      type: String,
      default: function() {
        if (!this.technologies || this.technologies.length === 0) return null;
        
        const categoryAverages = {};
        this.technologies.forEach(tech => {
          if (!categoryAverages[tech.category]) {
            categoryAverages[tech.category] = { sum: 0, count: 0 };
          }
          categoryAverages[tech.category].sum += tech.confidenceLevel;
          categoryAverages[tech.category].count++;
        });
        
        let strongest = null;
        let highestAverage = 0;
        
        Object.keys(categoryAverages).forEach(category => {
          const average = categoryAverages[category].sum / categoryAverages[category].count;
          if (average > highestAverage) {
            highestAverage = average;
            strongest = category;
          }
        });
        
        return strongest;
      }
    },
    weakestCategory: {
      type: String,
      default: function() {
        if (!this.technologies || this.technologies.length === 0) return null;
        
        const categoryAverages = {};
        this.technologies.forEach(tech => {
          if (!categoryAverages[tech.category]) {
            categoryAverages[tech.category] = { sum: 0, count: 0 };
          }
          categoryAverages[tech.category].sum += tech.confidenceLevel;
          categoryAverages[tech.category].count++;
        });
        
        let weakest = null;
        let lowestAverage = 11; // Higher than max possible average
        
        Object.keys(categoryAverages).forEach(category => {
          const average = categoryAverages[category].sum / categoryAverages[category].count;
          if (average < lowestAverage) {
            lowestAverage = average;
            weakest = category;
          }
        });
        
        return weakest;
      }
    }
  }
}, {
  timestamps: true,
  collection: 'technologyratings'
});

// Indexes for better query performance
technologyRatingSchema.index({ userId: 1, resumeHash: 1 }, { unique: true }); // Compound unique index
technologyRatingSchema.index({ userId: 1 });
technologyRatingSchema.index({ resumeHash: 1 });
technologyRatingSchema.index({ lastUpdated: -1 });
technologyRatingSchema.index({ 'technologies.name': 1 });
technologyRatingSchema.index({ 'technologies.category': 1 });
technologyRatingSchema.index({ 'technologies.confidenceLevel': -1 });

// Pre-save middleware to calculate metadata
technologyRatingSchema.pre('save', function(next) {
  if (this.technologies && this.technologies.length > 0) {
    // Calculate total technologies
    this.metadata.totalTechnologies = this.technologies.length;
    
    // Calculate average confidence
    const sum = this.technologies.reduce((acc, tech) => acc + tech.confidenceLevel, 0);
    this.metadata.averageConfidence = Math.round((sum / this.technologies.length) * 100) / 100;
    
    // Calculate expert skills (confidence >= 8)
    this.metadata.expertSkills = this.technologies
      .filter(tech => tech.confidenceLevel >= 8)
      .sort((a, b) => b.confidenceLevel - a.confidenceLevel)
      .slice(0, 10)
      .map(tech => tech.name);
    
    // Calculate proficient skills (confidence 6-7)
    this.metadata.proficientSkills = this.technologies
      .filter(tech => tech.confidenceLevel >= 6 && tech.confidenceLevel < 8)
      .sort((a, b) => b.confidenceLevel - a.confidenceLevel)
      .slice(0, 10)
      .map(tech => tech.name);
    
    // Calculate learning skills (confidence < 6)
    this.metadata.learningSkills = this.technologies
      .filter(tech => tech.confidenceLevel < 6)
      .sort((a, b) => a.confidenceLevel - b.confidenceLevel)
      .slice(0, 10)
      .map(tech => tech.name);
    
    // Calculate strongest and weakest categories
    const categoryAverages = {};
    this.technologies.forEach(tech => {
      if (!categoryAverages[tech.category]) {
        categoryAverages[tech.category] = { sum: 0, count: 0 };
      }
      categoryAverages[tech.category].sum += tech.confidenceLevel;
      categoryAverages[tech.category].count++;
    });
    
    let strongestCategory = null;
    let weakestCategory = null;
    let highestAverage = 0;
    let lowestAverage = 11;
    
    Object.keys(categoryAverages).forEach(category => {
      const average = categoryAverages[category].sum / categoryAverages[category].count;
      if (average > highestAverage) {
        highestAverage = average;
        strongestCategory = category;
      }
      if (average < lowestAverage) {
        lowestAverage = average;
        weakestCategory = category;
      }
    });
    
    this.metadata.strongestCategory = strongestCategory;
    this.metadata.weakestCategory = weakestCategory;
  }
  
  // Update lastUpdated timestamp
  this.lastUpdated = new Date();
  
  next();
});

// Instance methods
technologyRatingSchema.methods.getSummary = function() {
  return {
    id: this._id,
    userId: this.userId,
    resumeHash: this.resumeHash,
    totalTechnologies: this.metadata.totalTechnologies,
    averageConfidence: this.metadata.averageConfidence,
    expertSkills: this.metadata.expertSkills,
    proficientSkills: this.metadata.proficientSkills,
    learningSkills: this.metadata.learningSkills,
    strongestCategory: this.metadata.strongestCategory,
    weakestCategory: this.metadata.weakestCategory,
    lastUpdated: this.lastUpdated,
    createdAt: this.createdAt
  };
};

technologyRatingSchema.methods.getTechnologiesByCategory = function() {
  const categories = {};
  
  this.technologies.forEach(tech => {
    if (!categories[tech.category]) {
      categories[tech.category] = [];
    }
    categories[tech.category].push({
      name: tech.name,
      confidenceLevel: tech.confidenceLevel,
      dateRated: tech.dateRated
    });
  });
  
  // Sort technologies within each category by confidence level (descending)
  Object.keys(categories).forEach(category => {
    categories[category].sort((a, b) => b.confidenceLevel - a.confidenceLevel);
  });
  
  return categories;
};

technologyRatingSchema.methods.getConfidenceLevelDistribution = function() {
  const distribution = {
    expert: { range: '8-10', count: 0, technologies: [] },
    proficient: { range: '6-7', count: 0, technologies: [] },
    intermediate: { range: '4-5', count: 0, technologies: [] },
    beginner: { range: '1-3', count: 0, technologies: [] }
  };

  this.technologies.forEach(tech => {
    const techData = {
      name: tech.name,
      confidenceLevel: tech.confidenceLevel,
      category: tech.category
    };

    if (tech.confidenceLevel >= 8) {
      distribution.expert.count++;
      distribution.expert.technologies.push(techData);
    } else if (tech.confidenceLevel >= 6) {
      distribution.proficient.count++;
      distribution.proficient.technologies.push(techData);
    } else if (tech.confidenceLevel >= 4) {
      distribution.intermediate.count++;
      distribution.intermediate.technologies.push(techData);
    } else {
      distribution.beginner.count++;
      distribution.beginner.technologies.push(techData);
    }
  });

  // Sort technologies within each level by confidence
  Object.keys(distribution).forEach(level => {
    distribution[level].technologies.sort((a, b) => b.confidenceLevel - a.confidenceLevel);
  });

  return distribution;
};

technologyRatingSchema.methods.getCategoryAnalysis = function() {
  const analysis = {};
  
  this.technologies.forEach(tech => {
    if (!analysis[tech.category]) {
      analysis[tech.category] = {
        technologies: [],
        totalCount: 0,
        averageConfidence: 0,
        expertCount: 0,
        proficientCount: 0,
        learningCount: 0
      };
    }
    
    analysis[tech.category].technologies.push({
      name: tech.name,
      confidenceLevel: tech.confidenceLevel,
      dateRated: tech.dateRated
    });
    analysis[tech.category].totalCount++;
    
    // Count by skill level
    if (tech.confidenceLevel >= 8) {
      analysis[tech.category].expertCount++;
    } else if (tech.confidenceLevel >= 6) {
      analysis[tech.category].proficientCount++;
    } else {
      analysis[tech.category].learningCount++;
    }
  });
  
  // Calculate averages and sort
  Object.keys(analysis).forEach(category => {
    const techs = analysis[category].technologies;
    const sum = techs.reduce((acc, tech) => acc + tech.confidenceLevel, 0);
    analysis[category].averageConfidence = Math.round((sum / techs.length) * 100) / 100;
    
    // Sort technologies by confidence level
    analysis[category].technologies.sort((a, b) => b.confidenceLevel - a.confidenceLevel);
  });
  
  return analysis;
};

technologyRatingSchema.methods.getRecommendations = function() {
  const recommendations = [];
  const categoryAnalysis = this.getCategoryAnalysis();
  
  // Find categories that need improvement
  Object.keys(categoryAnalysis).forEach(category => {
    const analysis = categoryAnalysis[category];
    
    if (analysis.averageConfidence < 5) {
      recommendations.push({
        type: 'improvement',
        category: category,
        message: `Focus on improving ${category} skills. Average confidence: ${analysis.averageConfidence}/10`,
        technologies: analysis.technologies.filter(tech => tech.confidenceLevel < 6).slice(0, 3)
      });
    }
    
    if (analysis.expertCount > 0 && analysis.learningCount > 0) {
      recommendations.push({
        type: 'balance',
        category: category,
        message: `Good foundation in ${category}. Consider deepening expertise in weaker areas`,
        strongSkills: analysis.technologies.filter(tech => tech.confidenceLevel >= 8).slice(0, 2),
        skillsToImprove: analysis.technologies.filter(tech => tech.confidenceLevel < 6).slice(0, 2)
      });
    }
  });
  
  // General recommendations based on overall profile
  const overallAverage = this.metadata.averageConfidence;
  
  if (overallAverage < 5) {
    recommendations.push({
      type: 'general',
      message: 'Focus on building foundational skills through structured learning and practice projects',
      priority: 'high'
    });
  } else if (overallAverage >= 7) {
    recommendations.push({
      type: 'general',
      message: 'Strong technical profile! Consider specializing in emerging technologies or leadership roles',
      priority: 'medium'
    });
  } else {
    recommendations.push({
      type: 'general',
      message: 'Good technical foundation. Focus on deepening expertise in your strongest areas',
      priority: 'medium'
    });
  }
  
  return recommendations.slice(0, 5); // Limit to top 5 recommendations
};

// Static methods
technologyRatingSchema.statics.findByUserIdAndResumeHash = function(userId, resumeHash) {
  return this.findOne({ userId, resumeHash }).select('-resumeText'); // Exclude resume text for privacy
};

technologyRatingSchema.statics.findByUserId = function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ lastUpdated: -1 })
    .limit(limit)
    .select('-resumeText'); // Exclude resume text for list views
};

technologyRatingSchema.statics.getTechnologyTrends = function() {
  return this.aggregate([
    { $unwind: '$technologies' },
    {
      $group: {
        _id: '$technologies.name',
        averageConfidence: { $avg: '$technologies.confidenceLevel' },
        userCount: { $sum: 1 },
        category: { $first: '$technologies.category' }
      }
    },
    { $sort: { userCount: -1, averageConfidence: -1 } },
    { $limit: 20 }
  ]);
};

technologyRatingSchema.statics.getCategoryInsights = function() {
  return this.aggregate([
    { $unwind: '$technologies' },
    {
      $group: {
        _id: '$technologies.category',
        averageConfidence: { $avg: '$technologies.confidenceLevel' },
        technologyCount: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' }
      }
    },
    {
      $project: {
        _id: 1,
        averageConfidence: { $round: ['$averageConfidence', 2] },
        technologyCount: 1,
        userCount: { $size: '$uniqueUsers' }
      }
    },
    { $sort: { averageConfidence: -1 } }
  ]);
};

technologyRatingSchema.statics.getUserSkillLevel = function(userId) {
  return this.findOne({ userId }).then(rating => {
    if (!rating) return null;
    
    const expertCount = rating.metadata.expertSkills.length;
    const proficientCount = rating.metadata.proficientSkills.length;
    const learningCount = rating.metadata.learningSkills.length;
    const averageConfidence = rating.metadata.averageConfidence;
    
    let skillLevel;
    if (averageConfidence >= 8) {
      skillLevel = 'Expert';
    } else if (averageConfidence >= 6.5) {
      skillLevel = 'Senior';
    } else if (averageConfidence >= 5) {
      skillLevel = 'Mid-Level';
    } else if (averageConfidence >= 3.5) {
      skillLevel = 'Junior';
    } else {
      skillLevel = 'Beginner';
    }
    
    return {
      userId,
      skillLevel,
      averageConfidence,
      expertCount,
      proficientCount,
      learningCount,
      totalTechnologies: rating.metadata.totalTechnologies,
      strongestCategory: rating.metadata.strongestCategory,
      weakestCategory: rating.metadata.weakestCategory
    };
  });
};

// Virtual for formatted last updated date
technologyRatingSchema.virtual('formattedLastUpdated').get(function() {
  return this.lastUpdated.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for skill level assessment
technologyRatingSchema.virtual('skillLevelAssessment').get(function() {
  const averageConfidence = this.metadata.averageConfidence;
  
  if (averageConfidence >= 8) {
    return {
      level: 'Expert',
      description: 'Highly skilled with deep expertise across multiple technologies',
      color: '#10B981' // green
    };
  } else if (averageConfidence >= 6.5) {
    return {
      level: 'Senior',
      description: 'Strong technical skills with good proficiency in most areas',
      color: '#3B82F6' // blue
    };
  } else if (averageConfidence >= 5) {
    return {
      level: 'Mid-Level',
      description: 'Solid foundation with room for growth in several areas',
      color: '#8B5CF6' // purple
    };
  } else if (averageConfidence >= 3.5) {
    return {
      level: 'Junior',
      description: 'Good basic understanding, actively learning and improving',
      color: '#F59E0B' // yellow
    };
  } else {
    return {
      level: 'Beginner',
      description: 'Starting journey, focus on building foundational skills',
      color: '#EF4444' // red
    };
  }
});

// Ensure virtual fields are serialized
technologyRatingSchema.set('toJSON', { virtuals: true });
technologyRatingSchema.set('toObject', { virtuals: true });

const TechnologyRating = mongoose.model('TechnologyRating', technologyRatingSchema);

export default TechnologyRating;
import mongoose from 'mongoose';

// Technology Rating Schema - stores user's confidence ratings for technologies
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
    technologies: [{
        name: {
            type: String,
            required: true,
            trim: true
        },
        category: {
            type: String,
            required: true,
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
            ],
            default: 'General'
        },
        confidenceLevel: {
            type: Number,
            required: true,
            min: 1,
            max: 10
        },
        dateRated: {
            type: Date,
            default: Date.now
        }
    }],
    resumeText: {
        type: String,
        maxlength: 5000 // Store truncated resume text for reference
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index for efficient querying
technologyRatingSchema.index({ userId: 1, resumeHash: 1 }, { unique: true });

// Virtual for calculating average confidence
technologyRatingSchema.virtual('averageConfidence').get(function() {
    if (this.technologies.length === 0) return 0;
    const total = this.technologies.reduce((sum, tech) => sum + tech.confidenceLevel, 0);
    return Math.round((total / this.technologies.length) * 100) / 100;
});

// Virtual for getting expert level technologies
technologyRatingSchema.virtual('expertTechnologies').get(function() {
    return this.technologies.filter(tech => tech.confidenceLevel >= 8);
});

// Virtual for getting technologies that need improvement
technologyRatingSchema.virtual('improvementTechnologies').get(function() {
    return this.technologies.filter(tech => tech.confidenceLevel < 6);
});

// Method to get technologies grouped by category
technologyRatingSchema.methods.getTechnologiesByCategory = function() {
    const grouped = {};
    this.technologies.forEach(tech => {
        if (!grouped[tech.category]) {
            grouped[tech.category] = [];
        }
        grouped[tech.category].push(tech);
    });
    
    // Sort each category by confidence level (highest first)
    Object.keys(grouped).forEach(category => {
        grouped[category].sort((a, b) => b.confidenceLevel - a.confidenceLevel);
    });
    
    return grouped;
};

// Method to get confidence level distribution
technologyRatingSchema.methods.getConfidenceLevelDistribution = function() {
    const distribution = {
        expert: 0,      // 8-10
        proficient: 0,  // 6-7
        intermediate: 0, // 4-5
        beginner: 0     // 1-3
    };
    
    this.technologies.forEach(tech => {
        if (tech.confidenceLevel >= 8) distribution.expert++;
        else if (tech.confidenceLevel >= 6) distribution.proficient++;
        else if (tech.confidenceLevel >= 4) distribution.intermediate++;
        else distribution.beginner++;
    });
    
    return distribution;
};

// Method to get skill level assessment
technologyRatingSchema.virtual('skillLevelAssessment').get(function() {
    const avgConfidence = this.averageConfidence;
    const expertCount = this.expertTechnologies.length;
    const totalCount = this.technologies.length;
    
    if (avgConfidence >= 7.5 && expertCount >= totalCount * 0.4) {
        return 'Senior';
    } else if (avgConfidence >= 6 && expertCount >= totalCount * 0.2) {
        return 'Mid-level';
    } else if (avgConfidence >= 4) {
        return 'Junior';
    } else {
        return 'Entry-level';
    }
});

// Pre-save middleware to update lastUpdated
technologyRatingSchema.pre('save', function(next) {
    this.lastUpdated = new Date();
    next();
});

// Prevent model overwrite issues in development
const TechnologyRating = mongoose.models.TechnologyRating || mongoose.model('TechnologyRating', technologyRatingSchema);

export default TechnologyRating;
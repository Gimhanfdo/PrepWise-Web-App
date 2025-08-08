// controllers/swotController.js - Clean SWOT controller with MongoDB integration
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import { TechnologyRating } from '../models/SkillAssessorModel.js';


class SWOTController {
  /**
   * Calculate summary statistics for technologies array
   * @param {Array} technologies - Array of technology objects
   * @returns {Object} Summary statistics
   */
  static calculateSummary(technologies) {
    const totalTechnologies = technologies.length;
    const averageConfidence = totalTechnologies > 0 
      ? technologies.reduce((sum, tech) => sum + tech.confidenceLevel, 0) / totalTechnologies 
      : 0;
    const expertCount = technologies.filter(tech => tech.confidenceLevel >= 8).length;
    const proficientCount = technologies.filter(tech => tech.confidenceLevel >= 6 && tech.confidenceLevel < 8).length;
    const learningCount = technologies.filter(tech => tech.confidenceLevel < 6).length;

    return {
      totalTechnologies,
      averageConfidence: Math.round(averageConfidence * 10) / 10,
      expertCount,
      proficientCount,
      learningCount
    };
  }

// Updated validation function in your SWOT Controller
// Since we now default to 5 instead of 0, we no longer need to check for 0 values

/**
 * Validate technologies array
 * @param {Array} technologies - Technologies to validate
 * @returns {Object} Validation result
 */
static validateTechnologies(technologies) {
  if (!technologies || !Array.isArray(technologies) || technologies.length === 0) {
    return {
      isValid: false,
      message: 'Technologies array is required and cannot be empty'
    };
  }

  for (const tech of technologies) {
    if (!tech.name || typeof tech.confidenceLevel !== 'number') {
      return {
        isValid: false,
        message: 'Each technology must have a name and numeric confidenceLevel'
      };
    }

    // Updated: Now accepts 1-10 range (no longer checks for 0)
    if (tech.confidenceLevel < 1 || tech.confidenceLevel > 10) {
      return {
        isValid: false,
        message: 'Confidence level must be between 1 and 10'
      };
    }
  }

  return { isValid: true };
}

  /**
   * Format rating data for response
   * @param {Object} rating - Raw rating data
   * @returns {Object} Formatted rating
   */
  static formatRatingResponse(rating) {
    return {
      id: rating._id,
      userId: rating.userId,
      resumeHash: rating.resumeHash,
      technologies: rating.technologies,
      summary: rating.summary,
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt
    };
  }

  /**
   * Calculate overall user statistics
   * @param {Array} userRatings - All user ratings
   * @returns {Object} User statistics
   */
  static calculateUserStats(userRatings) {
    if (userRatings.length === 0) {
      return {
        totalRatingSets: 0,
        totalTechnologies: 0,
        overallAverageConfidence: 0,
        topTechnologies: [],
        improvementAreas: []
      };
    }

    // Flatten all technologies from all rating sets
    let allTechnologies = [];
    userRatings.forEach(rating => {
      allTechnologies = allTechnologies.concat(rating.technologies);
    });

    const totalTechnologies = allTechnologies.length;
    const overallAverageConfidence = totalTechnologies > 0 
      ? allTechnologies.reduce((sum, tech) => sum + tech.confidenceLevel, 0) / totalTechnologies
      : 0;

    // Get top technologies (confidence >= 8)
    const topTechnologies = allTechnologies
      .filter(tech => tech.confidenceLevel >= 8)
      .sort((a, b) => b.confidenceLevel - a.confidenceLevel)
      .slice(0, 10);

    // Get improvement areas (confidence < 6)
    const improvementAreas = allTechnologies
      .filter(tech => tech.confidenceLevel < 6)
      .sort((a, b) => a.confidenceLevel - b.confidenceLevel)
      .slice(0, 10);

    return {
      totalRatingSets: userRatings.length,
      totalTechnologies,
      overallAverageConfidence: Math.round(overallAverageConfidence * 10) / 10,
      topTechnologies,
      improvementAreas
    };
  }

  /**
   * Handle database errors consistently
   * @param {Object} error - Error object
   * @param {Object} res - Express response object
   */
  static handleDatabaseError(error, res) {
    console.error('Database error:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Ratings for this resume already exist. Use update instead.'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid data provided',
        details: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

export const saveRatings = asyncHandler(async (req, res) => {
  try {
    const { technologies, resumeHash } = req.body;
    const userId = req.user.id;

    // Validate request data
    if (!resumeHash) {
      return res.status(400).json({
        success: false,
        message: 'Resume hash is required'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Validate technologies using controller method
    const validation = SWOTController.validateTechnologies(technologies);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    // Calculate summary statistics using controller method
    const summary = SWOTController.calculateSummary(technologies);

    // Check if ratings already exist for this resume and user
    const existingRating = await TechnologyRating.findOne({
      userId,
      resumeHash
    });

    let savedRating;

    if (existingRating) {
      // Update existing ratings
      existingRating.technologies = technologies;
      existingRating.summary = summary;
      existingRating.updatedAt = new Date();
      savedRating = await existingRating.save();
    } else {
      // Create new ratings
      savedRating = await TechnologyRating.create({
        userId,
        resumeHash,
        technologies,
        summary
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully saved ratings for ${summary.totalTechnologies} technologies`,
      data: {
        id: savedRating._id,
        resumeHash,
        userId,
        totalTechnologies: summary.totalTechnologies,
        averageConfidence: summary.averageConfidence,
        summary: {
          expert: summary.expertCount,
          proficient: summary.proficientCount,
          learning: summary.learningCount
        },
        createdAt: savedRating.createdAt,
        updatedAt: savedRating.updatedAt,
        isUpdate: !!existingRating
      }
    });

  } catch (error) {
    return SWOTController.handleDatabaseError(error, res);
  }
});

export const getRatings = asyncHandler(async (req, res) => {
  try {
    const { resumeHash } = req.params;
    const userId = req.user.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    let query = { userId };
    if (resumeHash) {
      query.resumeHash = resumeHash;
    }

    const userRatings = await TechnologyRating.find(query)
      .sort({ updatedAt: -1 })
      .lean();

    if (userRatings.length === 0) {
      return res.status(404).json({
        success: false,
        message: resumeHash ? 'No ratings found for this resume' : 'No ratings found for user',
        data: []
      });
    }

    // Format the response data using controller method
    const formattedRatings = userRatings.map(rating => 
      SWOTController.formatRatingResponse(rating)
    );

    res.status(200).json({
      success: true,
      message: `Found ${userRatings.length} rating set(s)`,
      data: resumeHash ? formattedRatings[0] : formattedRatings
    });

  } catch (error) {
    return SWOTController.handleDatabaseError(error, res);
  }
});

export const deleteRatings = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Valid rating ID is required'
      });
    }

    // Find and delete the rating
    const deletedRating = await TechnologyRating.findOneAndDelete({
      _id: id,
      userId // Ensure user can only delete their own ratings
    });

    if (!deletedRating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found or you do not have permission to delete it'
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully deleted ratings for resume ${deletedRating.resumeHash}`,
      data: {
        id: deletedRating._id,
        resumeHash: deletedRating.resumeHash,
        technologiesCount: deletedRating.technologies.length,
        deletedAt: new Date()
      }
    });

  } catch (error) {
    return SWOTController.handleDatabaseError(error, res);
  }
});


export const getRatingsStats = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const userRatings = await TechnologyRating.find({ userId }).lean();

    // Calculate statistics using controller method
    const stats = SWOTController.calculateUserStats(userRatings);

    res.status(200).json({
      success: true,
      message: userRatings.length === 0 ? 'No ratings found for user' : 'Successfully retrieved user statistics',
      data: stats
    });

  } catch (error) {
    return SWOTController.handleDatabaseError(error, res);
  }
});


export const getTechnologyTrends = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { technology } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const userRatings = await TechnologyRating.find({ userId })
      .sort({ createdAt: 1 })
      .lean();

    if (userRatings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No ratings found for user',
        data: []
      });
    }

    let trendsData = [];

    if (technology) {
      // Get trends for specific technology
      trendsData = userRatings.map(rating => {
        const tech = rating.technologies.find(t => 
          t.name.toLowerCase() === technology.toLowerCase()
        );
        return {
          date: rating.createdAt,
          resumeHash: rating.resumeHash,
          confidenceLevel: tech ? tech.confidenceLevel : null,
          technology: technology
        };
      }).filter(item => item.confidenceLevel !== null);
    } else {
      // Get overall confidence trends
      trendsData = userRatings.map(rating => {
        const summary = SWOTController.calculateSummary(rating.technologies);
        return {
          date: rating.createdAt,
          resumeHash: rating.resumeHash,
          averageConfidence: summary.averageConfidence,
          totalTechnologies: summary.totalTechnologies,
          expertCount: summary.expertCount,
          proficientCount: summary.proficientCount,
          learningCount: summary.learningCount
        };
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully retrieved ${technology ? 'technology-specific' : 'overall'} trends`,
      data: trendsData
    });

  } catch (error) {
    return SWOTController.handleDatabaseError(error, res);
  }
});

export default SWOTController;
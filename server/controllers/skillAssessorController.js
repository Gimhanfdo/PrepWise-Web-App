// controllers/skillAssessorController.js - Enhanced controller for SWOT analysis

import SkillsAssessment from '../models/SkillAssessorModel.js';
import crypto from 'crypto';

// Helper function to calculate summary statistics
const calculateSummary = (technologies) => {
  if (!technologies || technologies.length === 0) {
    return {
      totalTechnologies: 0,
      averageConfidence: 0,
      expertCount: 0,
      proficientCount: 0,
      learningCount: 0
    };
  }

  const total = technologies.length;
  const avgConfidence = technologies.reduce((sum, tech) => sum + tech.confidenceLevel, 0) / total;
  
  const expertCount = technologies.filter(tech => tech.confidenceLevel >= 8).length;
  const proficientCount = technologies.filter(tech => tech.confidenceLevel >= 6 && tech.confidenceLevel < 8).length;
  const learningCount = technologies.filter(tech => tech.confidenceLevel < 6).length;

  return {
    totalTechnologies: total,
    averageConfidence: Math.round(avgConfidence * 10) / 10, // Round to 1 decimal
    expertCount,
    proficientCount,
    learningCount
  };
};

// Save or update technology confidence ratings
export const saveRatings = async (req, res) => {
  try {
    const { resumeHash, technologies, shouldSave = true } = req.body;
    const userId = req.user.id;

    console.log(`=== Saving Technology Ratings ===`);
    console.log(`User: ${userId}`);
    console.log(`Resume Hash: ${resumeHash}`);
    console.log(`Technologies count: ${technologies?.length || 0}`);
    console.log(`Should save: ${shouldSave}`);

    // Validation
    if (!resumeHash || typeof resumeHash !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid resume hash is required',
        required: ['resumeHash']
      });
    }

    if (!technologies || !Array.isArray(technologies) || technologies.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one technology rating is required',
        required: ['technologies'],
        format: 'Array of {name, category, confidenceLevel}'
      });
    }

    // Validate and clean technology data
    const validatedTechnologies = [];
    const errors = [];

    for (let i = 0; i < technologies.length; i++) {
      const tech = technologies[i];
      
      if (!tech.name || typeof tech.name !== 'string') {
        errors.push(`Technology ${i + 1}: name is required and must be a string`);
        continue;
      }

      if (!tech.confidenceLevel || typeof tech.confidenceLevel !== 'number') {
        errors.push(`Technology ${i + 1}: confidenceLevel is required and must be a number`);
        continue;
      }

      if (tech.confidenceLevel < 1 || tech.confidenceLevel > 10) {
        errors.push(`Technology ${i + 1}: confidenceLevel must be between 1 and 10`);
        continue;
      }

      validatedTechnologies.push({
        name: tech.name.trim(),
        category: tech.category ? tech.category.trim() : 'General',
        confidenceLevel: Math.round(tech.confidenceLevel * 10) / 10 // Round to 1 decimal
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Technology validation failed',
        errors: errors
      });
    }

    // Calculate summary statistics
    const summary = calculateSummary(validatedTechnologies);

    try {
      // Find existing rating or create new one
      let existingRating = await TechnologyRating.findOne({
        userId: userId,
        resumeHash: resumeHash
      });

      const ratingData = {
        userId: userId,
        resumeHash: resumeHash,
        saved: shouldSave,
        technologies: validatedTechnologies,
        summary: summary
      };

      let savedRating;

      if (existingRating) {
        console.log(`Updating existing technology rating: ${existingRating._id}`);
        savedRating = await TechnologyRating.findByIdAndUpdate(
          existingRating._id,
          ratingData,
          { new: true, runValidators: true }
        );
      } else {
        console.log(`Creating new technology rating`);
        savedRating = await TechnologyRating.create(ratingData);
      }

      console.log(`Successfully ${existingRating ? 'updated' : 'created'} technology rating: ${savedRating._id}`);

      // Prepare response
      const responseData = {
        success: true,
        message: shouldSave 
          ? `Technology ratings ${existingRating ? 'updated' : 'saved'} successfully`
          : `Technology ratings draft ${existingRating ? 'updated' : 'created'} successfully`,
        data: {
          id: savedRating._id,
          resumeHash: savedRating.resumeHash,
          saved: savedRating.saved,
          technologiesCount: savedRating.technologies.length,
          summary: savedRating.summary,
          createdAt: savedRating.createdAt,
          updatedAt: savedRating.updatedAt
        },
        stats: {
          totalTechnologies: summary.totalTechnologies,
          averageConfidence: summary.averageConfidence,
          distribution: {
            expert: summary.expertCount,
            proficient: summary.proficientCount,
            learning: summary.learningCount
          },
          isNewRecord: !existingRating
        }
      };

      res.status(existingRating ? 200 : 201).json(responseData);

    } catch (dbError) {
      console.error('Database error saving technology ratings:', dbError);
      
      // Handle specific MongoDB errors
      if (dbError.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Technology rating for this resume already exists',
          error: 'DUPLICATE_RATING'
        });
      }

      if (dbError.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Technology rating validation failed',
          errors: Object.values(dbError.errors).map(err => err.message)
        });
      }

      throw dbError; // Re-throw for general error handler
    }

  } catch (error) {
    console.error('Error in saveRatings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save technology ratings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get technology ratings for user
export const getRatings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { resumeHash } = req.params;
    const { includeUnsaved = 'false', limit = '20', sort = 'updatedAt' } = req.query;

    console.log(`=== Getting Technology Ratings ===`);
    console.log(`User: ${userId}`);
    console.log(`Resume Hash: ${resumeHash || 'all'}`);
    console.log(`Include Unsaved: ${includeUnsaved}`);

    // Build query filter
    const filter = { userId };
    
    if (resumeHash) {
      filter.resumeHash = resumeHash;
    }
    
    if (includeUnsaved !== 'true') {
      filter.saved = true;
    }

    // Build sort criteria
    const sortCriteria = {};
    if (sort === 'createdAt') {
      sortCriteria.createdAt = -1;
    } else if (sort === 'confidence') {
      sortCriteria['summary.averageConfidence'] = -1;
    } else {
      sortCriteria.updatedAt = -1;
    }

    const ratings = await TechnologyRating.find(filter)
      .sort(sortCriteria)
      .limit(parseInt(limit))
      .select('-userId'); // Exclude sensitive user ID

    console.log(`Found ${ratings.length} technology ratings`);

    // Enhanced ratings with additional computed fields
    const enhancedRatings = ratings.map(rating => {
      const ratingObj = rating.toObject();
      
      // Add computed fields
      ratingObj.topTechnologies = rating.technologies
        .sort((a, b) => b.confidenceLevel - a.confidenceLevel)
        .slice(0, 10);
      
      ratingObj.categorizedTechnologies = rating.technologies.reduce((acc, tech) => {
        const category = tech.category || 'General';
        if (!acc[category]) acc[category] = [];
        acc[category].push(tech);
        return acc;
      }, {});

      // Add performance metrics
      ratingObj.performanceMetrics = {
        strongAreas: rating.technologies.filter(t => t.confidenceLevel >= 8).length,
        improvementAreas: rating.technologies.filter(t => t.confidenceLevel < 6).length,
        balancedSkills: rating.technologies.filter(t => t.confidenceLevel >= 6 && t.confidenceLevel < 8).length
      };

      return ratingObj;
    });

    const responseData = {
      success: true,
      data: enhancedRatings,
      count: enhancedRatings.length,
      metadata: {
        userId: userId,
        filter: {
          resumeHash: resumeHash || null,
          savedOnly: includeUnsaved !== 'true',
          sortBy: sort
        },
        aggregateStats: enhancedRatings.length > 0 ? {
          totalAssessments: enhancedRatings.length,
          totalTechnologies: enhancedRatings.reduce((sum, r) => sum + (r.summary?.totalTechnologies || 0), 0),
          averageConfidence: enhancedRatings.length > 0 
            ? Math.round((enhancedRatings.reduce((sum, r) => sum + (r.summary?.averageConfidence || 0), 0) / enhancedRatings.length) * 10) / 10
            : 0,
          mostRecentAssessment: enhancedRatings[0]?.updatedAt,
          oldestAssessment: enhancedRatings[enhancedRatings.length - 1]?.updatedAt
        } : null
      }
    };

    res.json(responseData);

  } catch (error) {
    console.error('Error in getRatings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve technology ratings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get user statistics
export const getRatingsStats = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`=== Getting User Technology Stats ===`);
    console.log(`User: ${userId}`);

    const [allRatings, savedRatings] = await Promise.all([
      TechnologyRating.find({ userId }).select('summary technologies createdAt updatedAt saved'),
      TechnologyRating.find({ userId, saved: true }).select('summary technologies createdAt updatedAt')
    ]);

    console.log(`Found ${allRatings.length} total ratings, ${savedRatings.length} saved`);

    // Calculate comprehensive statistics
    const stats = {
      totalAssessments: allRatings.length,
      savedAssessments: savedRatings.length,
      draftAssessments: allRatings.length - savedRatings.length,
      
      // Overall technology statistics
      totalTechnologiesEvaluated: allRatings.reduce((sum, rating) => 
        sum + (rating.technologies?.length || 0), 0),
      uniqueTechnologies: new Set(
        allRatings.flatMap(rating => 
          rating.technologies?.map(tech => tech.name.toLowerCase()) || []
        )
      ).size,
      
      // Confidence level statistics
      averageConfidence: allRatings.length > 0 
        ? Math.round((allRatings.reduce((sum, rating) => 
            sum + (rating.summary?.averageConfidence || 0), 0) / allRatings.length) * 10) / 10
        : 0,
      
      expertLevelSkills: allRatings.reduce((sum, rating) => 
        sum + (rating.summary?.expertCount || 0), 0),
      proficientSkills: allRatings.reduce((sum, rating) => 
        sum + (rating.summary?.proficientCount || 0), 0),
      learningSkills: allRatings.reduce((sum, rating) => 
        sum + (rating.summary?.learningCount || 0), 0),

      // Time-based statistics
      firstAssessment: allRatings.length > 0 
        ? allRatings.reduce((earliest, rating) => 
            rating.createdAt < earliest ? rating.createdAt : earliest, allRatings[0].createdAt)
        : null,
      lastAssessment: allRatings.length > 0 
        ? allRatings.reduce((latest, rating) => 
            rating.updatedAt > latest ? rating.updatedAt : latest, allRatings[0].updatedAt)
        : null,

      // Recent activity (last 30 days)
      recentAssessments: allRatings.filter(rating => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return rating.updatedAt > thirtyDaysAgo;
      }).length,

      // Technology categories analysis
      topCategories: (() => {
        const categoryCount = {};
        allRatings.forEach(rating => {
          rating.technologies?.forEach(tech => {
            const category = tech.category || 'General';
            categoryCount[category] = (categoryCount[category] || 0) + 1;
          });
        });
        
        return Object.entries(categoryCount)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([category, count]) => ({ category, count }));
      })(),

      // Progress tracking
      improvementTrend: allRatings.length > 1 ? {
        confidenceChange: allRatings[0].summary?.averageConfidence - 
          allRatings[allRatings.length - 1].summary?.averageConfidence,
        technologiesGrowth: allRatings[0].summary?.totalTechnologies - 
          allRatings[allRatings.length - 1].summary?.totalTechnologies
      } : null
    };

    res.json({
      success: true,
      stats: stats,
      metadata: {
        userId: userId,
        calculatedAt: new Date().toISOString(),
        dataRange: {
          from: stats.firstAssessment,
          to: stats.lastAssessment
        }
      }
    });

  } catch (error) {
    console.error('Error in getRatingsStats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate user statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Delete technology ratings
export const deleteRatings = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`=== Deleting Technology Rating ===`);
    console.log(`User: ${userId}`);
    console.log(`Rating ID: ${id}`);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Rating ID is required for deletion'
      });
    }

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rating ID format',
        received: id
      });
    }

    const deletedRating = await TechnologyRating.findOneAndDelete({
      _id: id,
      userId: userId
    });

    if (!deletedRating) {
      return res.status(404).json({
        success: false,
        message: 'Technology rating not found or unauthorized',
        ratingId: id
      });
    }

    console.log(`Successfully deleted technology rating: ${id}`);

    res.json({
      success: true,
      message: 'Technology rating deleted successfully',
      deletedRating: {
        id: deletedRating._id,
        resumeHash: deletedRating.resumeHash,
        technologiesCount: deletedRating.technologies?.length || 0,
        wasSaved: deletedRating.saved,
        summary: deletedRating.summary,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in deleteRatings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete technology rating',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get detailed rating information
export const getRatingDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`=== Getting Rating Details ===`);
    console.log(`User: ${userId}`);
    console.log(`Rating ID: ${id}`);

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rating ID format'
      });
    }

    const rating = await TechnologyRating.findOne({
      _id: id,
      userId: userId
    }).select('-userId');

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'Technology rating not found'
      });
    }

    // Enhanced rating details with analysis
    const ratingDetails = rating.toObject();
    
    // Add detailed analysis
    ratingDetails.analysis = {
      strengthAreas: rating.technologies.filter(t => t.confidenceLevel >= 8),
      improvementAreas: rating.technologies.filter(t => t.confidenceLevel < 6),
      balancedAreas: rating.technologies.filter(t => t.confidenceLevel >= 6 && t.confidenceLevel < 8),
      
      categoryBreakdown: rating.technologies.reduce((acc, tech) => {
        const category = tech.category || 'General';
        if (!acc[category]) {
          acc[category] = {
            count: 0,
            avgConfidence: 0,
            technologies: []
          };
        }
        acc[category].count++;
        acc[category].technologies.push(tech);
        return acc;
      }, {}),
      
      recommendations: []
    };

    // Calculate average confidence per category
    Object.keys(ratingDetails.analysis.categoryBreakdown).forEach(category => {
      const categoryData = ratingDetails.analysis.categoryBreakdown[category];
      categoryData.avgConfidence = Math.round(
        (categoryData.technologies.reduce((sum, tech) => sum + tech.confidenceLevel, 0) / categoryData.count) * 10
      ) / 10;
    });

    // Generate recommendations
    if (ratingDetails.analysis.improvementAreas.length > 0) {
      ratingDetails.analysis.recommendations.push(
        `Focus on improving ${ratingDetails.analysis.improvementAreas.length} technologies with confidence below 6/10`
      );
    }
    
    if (ratingDetails.analysis.strengthAreas.length > 0) {
      ratingDetails.analysis.recommendations.push(
        `Leverage your expertise in ${ratingDetails.analysis.strengthAreas.map(t => t.name).slice(0, 3).join(', ')}`
      );
    }

    res.json({
      success: true,
      data: ratingDetails
    });

  } catch (error) {
    console.error('Error in getRatingDetails:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rating details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
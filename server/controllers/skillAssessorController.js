
import SkillsAssessment from '../models/SkillAssessorModel.js';
import crypto from 'crypto';

// Helper function to calculate summary statistics
const calculateSummary = (skills) => {
  if (!skills || skills.length === 0) {
    return {
      totalTechnologies: 0,
      averageConfidence: 0,
      expertCount: 0,
      proficientCount: 0,
      learningCount: 0
    };
  }

  const total = skills.length;
  // Handle both confidenceLevel and proficiencyLevel fields
  const avgConfidence = skills.reduce((sum, skill) => {
    const level = skill.proficiencyLevel || skill.confidenceLevel || 0;
    return sum + level;
  }, 0) / total;
  
  const expertCount = skills.filter(skill => {
    const level = skill.proficiencyLevel || skill.confidenceLevel || 0;
    return level >= 8;
  }).length;
  
  const proficientCount = skills.filter(skill => {
    const level = skill.proficiencyLevel || skill.confidenceLevel || 0;
    return level >= 6 && level < 8;
  }).length;
  
  const learningCount = skills.filter(skill => {
    const level = skill.proficiencyLevel || skill.confidenceLevel || 0;
    return level < 6;
  }).length;

  return {
    totalTechnologies: total,
    averageConfidence: Math.round(avgConfidence * 10) / 10,
    expertCount,
    proficientCount,
    learningCount
  };
};

// GET /api/swot/ratings - Get all ratings (enhanced version supporting both models)
export const getRatings = async (req, res) => {
  try {
    console.log('🔍 Getting skills assessments for user:', req.user.id);
    
    const { resumeHash, includeUnsaved = 'false', limit = '20', sort = 'updatedAt' } = req.query;
    const userId = req.user.id;
    
    console.log(`=== Getting Skills Assessments ===`);
    console.log(`User: ${userId}`);
    console.log(`Resume Hash: ${resumeHash || 'all'}`);
    console.log(`Include Unsaved: ${includeUnsaved}`);

    // Try to use the enhanced model first, fall back to TechnologyRating
    let skillsAssessments = [];
    let usingEnhancedModel = false;

    try {
      // Build query filter for enhanced model
      const enhancedFilter = { userId, assessmentType: 'Technical Skills' };
      
      if (resumeHash && resumeHash !== 'all') {
        enhancedFilter.resumeHash = resumeHash;
      }
      
      if (includeUnsaved !== 'true') {
        enhancedFilter.isSaved = true;
      }

      // Build sort criteria
      const sortCriteria = {};
      if (sort === 'createdAt') {
        sortCriteria.createdAt = -1;
      } else if (sort === 'confidence') {
        sortCriteria.overallScore = -1;
      } else {
        sortCriteria.updatedAt = -1;
      }

      skillsAssessments = await SkillsAssessment.find(enhancedFilter)
        .sort(sortCriteria)
        .limit(parseInt(limit))
        .select('-userId');

      usingEnhancedModel = true;
      console.log(`✅ Found ${skillsAssessments.length} skills assessments (enhanced model)`);

    } catch (enhancedError) {
      console.log('Enhanced model not available, falling back to TechnologyRating model');
      
      // Fallback to original TechnologyRating model
      let fallbackQuery = { userId };
      
      if (resumeHash && resumeHash !== 'all') {
        fallbackQuery.resumeHash = resumeHash;
      }
      
      if (includeUnsaved !== 'true') {
        fallbackQuery.saved = true;
      }

      skillsAssessments = await TechnologyRating.find(fallbackQuery)
        .sort({ updatedAt: -1 })
        .limit(parseInt(limit))
        .select('-userId');

      console.log(`✅ Found ${skillsAssessments.length} skills assessments (fallback model)`);
    }

    // Transform data to match what UserProfile.js expects
    const formattedAssessments = skillsAssessments.map(assessment => {
      let technologies, summary, avgConfidence, score;

      if (usingEnhancedModel) {
        // Enhanced model format
        technologies = assessment.skills || [];
        summary = calculateSummary(technologies);
        avgConfidence = assessment.averageProficiency || summary.averageConfidence;
        score = assessment.overallScore || Math.round(avgConfidence * 10);
      } else {
        // Original model format
        technologies = assessment.technologies || [];
        summary = assessment.summary || {};
        avgConfidence = summary.averageConfidence || 0;
        score = Math.round((avgConfidence / 10) * 100);
      }

      // Determine assessment type based on technologies
      let assessmentType = 'Technical Skills Assessment';
      const techCategories = [...new Set(technologies.map(t => t.category).filter(Boolean))];
      if (techCategories.length > 0) {
        assessmentType = techCategories.join(', ') + ' Assessment';
      }

      // Determine level based on average confidence
      let level = 'Beginner';
      if (avgConfidence >= 8) level = 'Expert';
      else if (avgConfidence >= 6) level = 'Advanced';
      else if (avgConfidence >= 4) level = 'Intermediate';

      // Check if assessment is recent (within last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const isRecent = assessment.updatedAt > thirtyDaysAgo;

      const baseResult = {
        id: assessment._id,
        assessmentType,
        level,
        score,
        totalTechnologies: summary.totalTechnologies || technologies.length,
        averageConfidence: avgConfidence,
        expertCount: summary.expertCount || technologies.filter(t => {
          const level = t.proficiencyLevel || t.confidenceLevel || 0;
          return level >= 8;
        }).length,
        proficientCount: summary.proficientCount || technologies.filter(t => {
          const level = t.proficiencyLevel || t.confidenceLevel || 0;
          return level >= 6 && level < 8;
        }).length,
        learningCount: summary.learningCount || technologies.filter(t => {
          const level = t.proficiencyLevel || t.confidenceLevel || 0;
          return level < 6;
        }).length,
        completedAt: assessment.updatedAt,
        createdAt: assessment.createdAt,
        topTechnologies: technologies
          .sort((a, b) => {
            const aLevel = b.proficiencyLevel || b.confidenceLevel || 0;
            const bLevel = a.proficiencyLevel || a.confidenceLevel || 0;
            return aLevel - bLevel;
          })
          .slice(0, 5)
          .map(t => ({ 
            name: t.name, 
            confidence: t.proficiencyLevel || t.confidenceLevel || 0,
            category: t.category 
          })),
        isRecent
      };

      // Add enhanced fields if using enhanced model
      if (usingEnhancedModel) {
        baseResult.resumeHash = assessment.resumeHash;
        baseResult.isSaved = assessment.isSaved;
        baseResult.overallScore = assessment.overallScore;
        
        // Add summary from original format for backward compatibility
        baseResult.summary = {
          totalRoles: baseResult.totalTechnologies,
          softwareRoles: baseResult.totalTechnologies, // All are technical
          nonTechRoles: 0,
          avgMatchScore: baseResult.score,
          hasHighMatches: baseResult.expertCount > 0,
          recommendationCount: 0, // Could be enhanced later
          isSaved: assessment.isSaved
        };
      }

      return baseResult;
    });

    console.log('✅ Sending formatted assessments:', formattedAssessments.length);

    res.json({
      success: true,
      data: formattedAssessments,
      count: formattedAssessments.length,
      metadata: {
        userId: userId,
        usingEnhancedModel,
        filter: {
          resumeHash: resumeHash || null,
          savedOnly: includeUnsaved !== 'true',
          sortBy: sort
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching skills assessments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch skills assessments',
      error: error.message
    });
  }
};

// POST /api/swot/save-ratings - Enhanced save with support for both models
export const saveRatings = async (req, res) => {
  try {
    console.log('🔍 Saving technology ratings...');
    
    const { resumeHash, technologies, summary, shouldSave = true } = req.body;
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
        format: 'Array of {name, category, confidenceLevel/proficiencyLevel}'
      });
    }

    // Validate and clean technology data
    const validatedSkills = [];
    const errors = [];

    for (let i = 0; i < technologies.length; i++) {
      const tech = technologies[i];
      
      if (!tech.name || typeof tech.name !== 'string') {
        errors.push(`Technology ${i + 1}: name is required and must be a string`);
        continue;
      }

      const proficiencyLevel = tech.confidenceLevel || tech.proficiencyLevel;
      if (!proficiencyLevel || typeof proficiencyLevel !== 'number') {
        errors.push(`Technology ${i + 1}: confidenceLevel/proficiencyLevel is required and must be a number`);
        continue;
      }

      if (proficiencyLevel < 1 || proficiencyLevel > 10) {
        errors.push(`Technology ${i + 1}: confidenceLevel/proficiencyLevel must be between 1 and 10`);
        continue;
      }

      // Create skill object with both field names for compatibility
      const skill = {
        name: tech.name.trim(),
        category: tech.category ? tech.category.trim() : 'General',
        confidenceLevel: Math.round(proficiencyLevel * 10) / 10,
        proficiencyLevel: Math.round(proficiencyLevel * 10) / 10,
        yearsOfExperience: tech.yearsOfExperience || 0,
        lastUsed: new Date(),
        isCoreTechnology: tech.isCore || false
      };

      validatedSkills.push(skill);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Technology validation failed',
        errors: errors
      });
    }

    // Calculate summary statistics
    const calculatedSummary = calculateSummary(validatedSkills);
    const finalSummary = summary ? { ...calculatedSummary, ...summary } : calculatedSummary;

    try {
      // Try enhanced model first
      let savedAssessment;
      let usingEnhancedModel = false;

      try {
        // Find existing assessment or create new one (enhanced model)
        let existingAssessment = await SkillsAssessment.findOne({
          userId: userId,
          resumeHash: resumeHash
        });

        const assessmentData = {
          userId: userId,
          resumeHash: resumeHash,
          assessmentType: 'Technical Skills',
          skills: validatedSkills,
          overallScore: Math.round(calculatedSummary.averageConfidence * 10),
          isSaved: shouldSave,
          completedAt: new Date()
        };

        if (existingAssessment) {
          console.log(`Updating existing skills assessment: ${existingAssessment._id}`);
          savedAssessment = await SkillsAssessment.findByIdAndUpdate(
            existingAssessment._id,
            assessmentData,
            { new: true, runValidators: true }
          );
        } else {
          console.log(`Creating new skills assessment`);
          savedAssessment = await SkillsAssessment.create(assessmentData);
        }

        usingEnhancedModel = true;
        console.log(`Successfully ${existingAssessment ? 'updated' : 'created'} skills assessment: ${savedAssessment._id}`);

      } catch (enhancedError) {
        console.log('Enhanced model not available, using fallback TechnologyRating model');
        
        // Fallback to original TechnologyRating model
        let rating = await TechnologyRating.findOne({
          userId: userId,
          resumeHash: resumeHash
        });

        if (rating) {
          // Update existing rating
          rating.technologies = validatedSkills;
          rating.summary = finalSummary;
          rating.saved = shouldSave;
          rating.updatedAt = new Date();
          await rating.save();
          savedAssessment = rating;
          console.log(`Updated existing technology rating: ${rating._id}`);
        } else {
          // Create new rating
          rating = new TechnologyRating({
            userId: userId,
            resumeHash,
            technologies: validatedSkills,
            summary: finalSummary,
            saved: shouldSave
          });
          await rating.save();
          savedAssessment = rating;
          console.log(`Created new technology rating: ${rating._id}`);
        }
      }

      // Prepare enhanced response
      const responseData = {
        success: true,
        message: shouldSave 
          ? `Skills assessment saved successfully`
          : `Skills assessment draft updated successfully`,
        data: {
          id: savedAssessment._id,
          resumeHash: savedAssessment.resumeHash,
          saved: usingEnhancedModel ? savedAssessment.isSaved : savedAssessment.saved,
          technologiesCount: usingEnhancedModel ? savedAssessment.skills?.length : savedAssessment.technologies?.length,
          summary: calculatedSummary,
          createdAt: savedAssessment.createdAt,
          updatedAt: savedAssessment.updatedAt
        },
        stats: {
          totalTechnologies: calculatedSummary.totalTechnologies,
          averageConfidence: calculatedSummary.averageConfidence,
          distribution: {
            expert: calculatedSummary.expertCount,
            proficient: calculatedSummary.proficientCount,
            learning: calculatedSummary.learningCount
          },
          usingEnhancedModel
        }
      };

      res.json(responseData);

    } catch (dbError) {
      console.error('Database error saving skills assessment:', dbError);
      
      if (dbError.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Skills assessment for this resume already exists',
          error: 'DUPLICATE_ASSESSMENT'
        });
      }

      if (dbError.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Skills assessment validation failed',
          errors: Object.values(dbError.errors).map(err => err.message)
        });
      }

      throw dbError;
    }

  } catch (error) {
    console.error('❌ Error saving technology ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save technology ratings',
      error: error.message
    });
  }
};

// DELETE /api/swot/delete/:id - Enhanced delete supporting both models
export const deleteRatings = async (req, res) => {
  try {
    console.log('🔍 Deleting skills assessment:', req.params.id);
    
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`=== Deleting Skills Assessment ===`);
    console.log(`User: ${userId}`);
    console.log(`Assessment ID: ${id}`);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Assessment ID is required for deletion'
      });
    }

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assessment ID format',
        received: id
      });
    }

    let deleted = null;
    let usingEnhancedModel = false;

    try {
      // Try enhanced model first
      deleted = await SkillsAssessment.findOneAndDelete({
        _id: id,
        userId: userId,
        assessmentType: 'Technical Skills'
      });
      
      if (deleted) {
        usingEnhancedModel = true;
        console.log(`Successfully deleted skills assessment: ${id} (enhanced model)`);
      }
    } catch (enhancedError) {
      console.log('Enhanced model not available, trying fallback model');
    }

    if (!deleted) {
      // Fallback to TechnologyRating model
      deleted = await TechnologyRating.findOneAndDelete({
        _id: id,
        userId: userId
      });
      
      if (deleted) {
        console.log(`Successfully deleted technology rating: ${id} (fallback model)`);
      }
    }

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Skills assessment not found or unauthorized',
        assessmentId: id
      });
    }

    console.log('✅ Skills assessment deleted successfully');

    res.json({
      success: true,
      message: 'Skills assessment deleted successfully',
      deletedAssessment: {
        id: deleted._id,
        resumeHash: deleted.resumeHash,
        skillsCount: usingEnhancedModel ? (deleted.skills?.length || 0) : (deleted.technologies?.length || 0),
        wasSaved: usingEnhancedModel ? deleted.isSaved : deleted.saved,
        deletedAt: new Date().toISOString(),
        usingEnhancedModel
      }
    });

  } catch (error) {
    console.error('❌ Error deleting skills assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete skills assessment',
      error: error.message
    });
  }
};

// GET /api/swot/stats - Enhanced user statistics supporting both models
export const getRatingsStats = async (req, res) => {
  try {
    console.log('🔍 Getting ratings stats for user:', req.user.id);
    const userId = req.user.id;

    console.log(`=== Getting User Skills Stats ===`);
    console.log(`User: ${userId}`);

    let stats = {
      totalAssessments: 0,
      savedAssessments: 0,
      draftAssessments: 0,
      totalTechnologies: 0,
      averageScore: 0,
      expertTechnologies: 0,
      recentAssessments: 0,
      uniqueTechnologies: 0,
      firstAssessment: null,
      lastAssessment: null
    };

    let usingEnhancedModel = false;

    try {
      // Try enhanced model first
      const [allAssessments, savedAssessments] = await Promise.all([
        SkillsAssessment.find({ userId, assessmentType: 'Technical Skills' }),
        SkillsAssessment.find({ userId, assessmentType: 'Technical Skills', isSaved: true })
      ]);

      usingEnhancedModel = true;
      console.log(`Found ${allAssessments.length} total assessments, ${savedAssessments.length} saved (enhanced model)`);

      if (allAssessments.length > 0) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        stats = {
          totalAssessments: allAssessments.length,
          savedAssessments: savedAssessments.length,
          draftAssessments: allAssessments.length - savedAssessments.length,
          
          totalTechnologies: allAssessments.reduce((sum, assessment) => 
            sum + (assessment.skills?.length || 0), 0),
          uniqueTechnologies: new Set(
            allAssessments.flatMap(assessment => 
              assessment.skills?.map(skill => skill.name.toLowerCase()) || []
            )
          ).size,
          
          averageScore: Math.round((allAssessments.reduce((sum, assessment) => 
            sum + (assessment.overallScore || 0), 0) / allAssessments.length) * 10) / 10,
          
          expertTechnologies: allAssessments.reduce((sum, assessment) => 
            sum + (assessment.expertSkills?.length || 0), 0),
          
          recentAssessments: allAssessments.filter(assessment => assessment.updatedAt > thirtyDaysAgo).length,
          
          firstAssessment: allAssessments.reduce((earliest, assessment) => 
            assessment.createdAt < earliest ? assessment.createdAt : earliest, allAssessments[0].createdAt),
          lastAssessment: allAssessments.reduce((latest, assessment) => 
            assessment.updatedAt > latest ? assessment.updatedAt : latest, allAssessments[0].updatedAt)
        };
      }

    } catch (enhancedError) {
      console.log('Enhanced model not available, using fallback TechnologyRating model');
      
      // Fallback to TechnologyRating model
      const ratings = await TechnologyRating.find({ 
        userId: userId,
        saved: true 
      });

      console.log(`Found ${ratings.length} saved ratings (fallback model)`);

      if (ratings.length > 0) {
        let totalConfidence = 0;
        let techCount = 0;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        ratings.forEach(rating => {
          if (rating.technologies) {
            techCount += rating.technologies.length;
            rating.technologies.forEach(tech => {
              totalConfidence += tech.confidenceLevel || 0;
              if (tech.confidenceLevel >= 8) {
                stats.expertTechnologies++;
              }
            });
          }
          
          if (rating.updatedAt > thirtyDaysAgo) {
            stats.recentAssessments++;
          }
        });

        stats.totalAssessments = ratings.length;
        stats.savedAssessments = ratings.length;
        stats.totalTechnologies = techCount;
        stats.averageScore = techCount > 0 ? Math.round((totalConfidence / techCount) * 10) : 0;
        stats.uniqueTechnologies = new Set(
          ratings.flatMap(rating => 
            rating.technologies?.map(tech => tech.name.toLowerCase()) || []
          )
        ).size;
        
        if (ratings.length > 0) {
          stats.firstAssessment = ratings.reduce((earliest, rating) => 
            rating.createdAt < earliest ? rating.createdAt : earliest, ratings[0].createdAt);
          stats.lastAssessment = ratings.reduce((latest, rating) => 
            rating.updatedAt > latest ? rating.updatedAt : latest, ratings[0].updatedAt);
        }
      }
    }

    res.json({
      success: true,
      data: stats,
      stats: stats, // Backward compatibility
      metadata: {
        userId: userId,
        usingEnhancedModel,
        calculatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error getting ratings stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ratings statistics',
      error: error.message
    });
  }
};

// GET /api/swot/ratings/:resumeHash or /api/swot/ratings/:id - Enhanced details supporting both patterns
export const getRatingDetails = async (req, res) => {
  try {
    const { resumeHash, id } = req.params;
    const userId = req.user.id;
    const identifier = id || resumeHash; // Support both patterns

    console.log(`=== Getting Assessment Details ===`);
    console.log(`User: ${userId}`);
    console.log(`Identifier: ${identifier}`);

    let assessment = null;
    let usingEnhancedModel = false;
    let searchByHash = false;

    // Determine if it's an ObjectId or resume hash
    if (identifier && identifier.match(/^[0-9a-fA-F]{24}$/)) {
      // It's an ObjectId - search by ID
      console.log('Searching by ID');
      
      try {
        // Try enhanced model first
        assessment = await SkillsAssessment.findOne({
          _id: identifier,
          userId: userId,
          assessmentType: 'Technical Skills'
        }).select('-userId');
        
        if (assessment) {
          usingEnhancedModel = true;
        }
      } catch (enhancedError) {
        console.log('Enhanced model not available, trying fallback');
      }

      if (!assessment) {
        // Fallback to TechnologyRating model
        assessment = await TechnologyRating.findOne({
          _id: identifier,
          userId: userId
        });
      }

    } else {
      // It's a resume hash - search by hash
      console.log('Searching by resume hash');
      searchByHash = true;

      try {
        // Try enhanced model first
        assessment = await SkillsAssessment.findOne({
          userId: userId,
          resumeHash: identifier,
          assessmentType: 'Technical Skills'
        }).select('-userId');
        
        if (assessment) {
          usingEnhancedModel = true;
        }
      } catch (enhancedError) {
        console.log('Enhanced model not available, trying fallback');
      }

      if (!assessment) {
        // Fallback to TechnologyRating model
        assessment = await TechnologyRating.findOne({
          userId: userId,
          resumeHash: identifier
        });
      }
    }

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: searchByHash ? 'Rating not found for this resume' : 'Skills assessment not found',
        identifier: identifier
      });
    }

    let assessmentDetails = assessment.toObject();
    
    // Add detailed analysis for enhanced model
    if (usingEnhancedModel && assessment.skills) {
      assessmentDetails.analysis = {
        strengthAreas: assessment.skills.filter(s => s.proficiencyLevel >= 8),
        improvementAreas: assessment.skills.filter(s => s.proficiencyLevel < 6),
        balancedAreas: assessment.skills.filter(s => s.proficiencyLevel >= 6 && s.proficiencyLevel < 8),
        
        categoryBreakdown: assessment.skills.reduce((acc, skill) => {
          const category = skill.category || 'General';
          if (!acc[category]) {
            acc[category] = {
              count: 0,
              avgConfidence: 0,
              skills: []
            };
          }
          acc[category].count++;
          acc[category].skills.push(skill);
          return acc;
        }, {}),
        
        recommendations: []
      };

      // Calculate average confidence per category
      Object.keys(assessmentDetails.analysis.categoryBreakdown).forEach(category => {
        const categoryData = assessmentDetails.analysis.categoryBreakdown[category];
        categoryData.avgConfidence = Math.round(
          (categoryData.skills.reduce((sum, skill) => sum + skill.proficiencyLevel, 0) / categoryData.count) * 10
        ) / 10;
      });

      // Generate recommendations
      if (assessmentDetails.analysis.improvementAreas.length > 0) {
        assessmentDetails.analysis.recommendations.push(
          `Focus on improving ${assessmentDetails.analysis.improvementAreas.length} skills with proficiency below 6/10`
        );
      }
      
      if (assessmentDetails.analysis.strengthAreas.length > 0) {
        assessmentDetails.analysis.recommendations.push(
          `Leverage your expertise in ${assessmentDetails.analysis.strengthAreas.map(s => s.name).slice(0, 3).join(', ')}`
        );
      }
    }

    res.json({
      success: true,
      data: assessmentDetails,
      metadata: {
        usingEnhancedModel,
        searchByHash,
        identifier
      }
    });

  } catch (error) {
    console.error('❌ Error getting rating details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rating details',
      error: error.message
    });
  }
};
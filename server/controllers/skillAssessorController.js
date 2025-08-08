// controllers/skillAssessorController.js - Enhanced controller for SWOT analysis

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
  const avgConfidence = skills.reduce((sum, skill) => sum + skill.proficiencyLevel, 0) / total;
  
  const expertCount = skills.filter(skill => skill.proficiencyLevel >= 8).length;
  const proficientCount = skills.filter(skill => skill.proficiencyLevel >= 6 && skill.proficiencyLevel < 8).length;
  const learningCount = skills.filter(skill => skill.proficiencyLevel < 6).length;

  return {
    totalTechnologies: total,
    averageConfidence: Math.round(avgConfidence * 10) / 10,
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
        format: 'Array of {name, category, proficiencyLevel}'
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
        errors.push(`Technology ${i + 1}: proficiencyLevel is required and must be a number`);
        continue;
      }

      if (proficiencyLevel < 1 || proficiencyLevel > 10) {
        errors.push(`Technology ${i + 1}: proficiencyLevel must be between 1 and 10`);
        continue;
      }

      validatedSkills.push({
        name: tech.name.trim(),
        category: tech.category ? tech.category.trim() : 'General',
        proficiencyLevel: Math.round(proficiencyLevel * 10) / 10,
        yearsOfExperience: tech.yearsOfExperience || 0,
        lastUsed: new Date(),
        isCoreTechnology: tech.isCore || false
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
    const summary = calculateSummary(validatedSkills);

    try {
      // Find existing assessment or create new one
      let existingAssessment = await SkillsAssessment.findOne({
        userId: userId,
        resumeHash: resumeHash
      });

      const assessmentData = {
        userId: userId,
        resumeHash: resumeHash,
        assessmentType: 'Technical Skills',
        skills: validatedSkills,
        overallScore: Math.round(summary.averageConfidence * 10),
        isSaved: shouldSave,
        completedAt: new Date()
      };

      let savedAssessment;

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

      console.log(`Successfully ${existingAssessment ? 'updated' : 'created'} skills assessment: ${savedAssessment._id}`);

      // Prepare response
      const responseData = {
        success: true,
        message: shouldSave 
          ? `Skills assessment ${existingAssessment ? 'updated' : 'saved'} successfully`
          : `Skills assessment draft ${existingAssessment ? 'updated' : 'created'} successfully`,
        data: {
          id: savedAssessment._id,
          resumeHash: savedAssessment.resumeHash,
          saved: savedAssessment.isSaved,
          technologiesCount: savedAssessment.skills.length,
          summary: summary,
          createdAt: savedAssessment.createdAt,
          updatedAt: savedAssessment.updatedAt
        },
        stats: {
          totalTechnologies: summary.totalTechnologies,
          averageConfidence: summary.averageConfidence,
          distribution: {
            expert: summary.expertCount,
            proficient: summary.proficientCount,
            learning: summary.learningCount
          },
          isNewRecord: !existingAssessment
        }
      };

      res.status(existingAssessment ? 200 : 201).json(responseData);

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
    console.error('Error in saveRatings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save skills assessment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get skills assessments for user
export const getRatings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { resumeHash } = req.params;
    const { includeUnsaved = 'false', limit = '20', sort = 'updatedAt' } = req.query;

    console.log(`=== Getting Skills Assessments ===`);
    console.log(`User: ${userId}`);
    console.log(`Resume Hash: ${resumeHash || 'all'}`);
    console.log(`Include Unsaved: ${includeUnsaved}`);

    // Build query filter
    const filter = { userId, assessmentType: 'Technical Skills' };
    
    if (resumeHash) {
      filter.resumeHash = resumeHash;
    }
    
    if (includeUnsaved !== 'true') {
      filter.isSaved = true;
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

    const assessments = await SkillsAssessment.find(filter)
      .sort(sortCriteria)
      .limit(parseInt(limit))
      .select('-userId');

    console.log(`Found ${assessments.length} skills assessments`);

    // Enhanced assessments with additional computed fields
    const enhancedAssessments = assessments.map(assessment => {
      const assessmentObj = assessment.toObject();
      
      // Add computed fields
      assessmentObj.topTechnologies = assessment.skills
        .sort((a, b) => b.proficiencyLevel - a.proficiencyLevel)
        .slice(0, 10)
        .map(skill => ({
          name: skill.name,
          confidence: skill.proficiencyLevel,
          category: skill.category
        }));
      
      assessmentObj.totalTechnologies = assessment.skills.length;
      assessmentObj.averageConfidence = assessment.averageProficiency;
      assessmentObj.expertCount = assessment.expertSkills.length;
      assessmentObj.proficientCount = assessment.skills.filter(s => s.proficiencyLevel >= 6 && s.proficiencyLevel < 8).length;
      assessmentObj.learningCount = assessment.beginnerSkills.length;
      assessmentObj.score = assessment.overallScore;
      assessmentObj.level = assessment.overallScore >= 90 ? 'Expert' : 
                          assessment.overallScore >= 70 ? 'Advanced' :
                          assessment.overallScore >= 50 ? 'Intermediate' : 'Beginner';

      return assessmentObj;
    });

    const responseData = {
      success: true,
      data: enhancedAssessments,
      count: enhancedAssessments.length,
      metadata: {
        userId: userId,
        filter: {
          resumeHash: resumeHash || null,
          savedOnly: includeUnsaved !== 'true',
          sortBy: sort
        }
      }
    };

    res.json(responseData);

  } catch (error) {
    console.error('Error in getRatings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve skills assessments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get user statistics
export const getRatingsStats = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`=== Getting User Skills Stats ===`);
    console.log(`User: ${userId}`);

    const [allAssessments, savedAssessments] = await Promise.all([
      SkillsAssessment.find({ userId, assessmentType: 'Technical Skills' }),
      SkillsAssessment.find({ userId, assessmentType: 'Technical Skills', isSaved: true })
    ]);

    console.log(`Found ${allAssessments.length} total assessments, ${savedAssessments.length} saved`);

    // Calculate comprehensive statistics
    const stats = {
      totalAssessments: allAssessments.length,
      savedAssessments: savedAssessments.length,
      draftAssessments: allAssessments.length - savedAssessments.length,
      
      totalTechnologiesEvaluated: allAssessments.reduce((sum, assessment) => 
        sum + (assessment.skills?.length || 0), 0),
      uniqueTechnologies: new Set(
        allAssessments.flatMap(assessment => 
          assessment.skills?.map(skill => skill.name.toLowerCase()) || []
        )
      ).size,
      
      averageScore: allAssessments.length > 0 
        ? Math.round((allAssessments.reduce((sum, assessment) => 
            sum + (assessment.overallScore || 0), 0) / allAssessments.length) * 10) / 10
        : 0,
      
      expertLevelSkills: allAssessments.reduce((sum, assessment) => 
        sum + (assessment.expertSkills?.length || 0), 0),
      
      firstAssessment: allAssessments.length > 0 
        ? allAssessments.reduce((earliest, assessment) => 
            assessment.createdAt < earliest ? assessment.createdAt : earliest, allAssessments[0].createdAt)
        : null,
      lastAssessment: allAssessments.length > 0 
        ? allAssessments.reduce((latest, assessment) => 
            assessment.updatedAt > latest ? assessment.updatedAt : latest, allAssessments[0].updatedAt)
        : null
    };

    res.json({
      success: true,
      stats: stats,
      metadata: {
        userId: userId,
        calculatedAt: new Date().toISOString()
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

// Delete skills assessment
export const deleteRatings = async (req, res) => {
  try {
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

    const deletedAssessment = await SkillsAssessment.findOneAndDelete({
      _id: id,
      userId: userId,
      assessmentType: 'Technical Skills'
    });

    if (!deletedAssessment) {
      return res.status(404).json({
        success: false,
        message: 'Skills assessment not found or unauthorized',
        assessmentId: id
      });
    }

    console.log(`Successfully deleted skills assessment: ${id}`);

    res.json({
      success: true,
      message: 'Skills assessment deleted successfully',
      deletedAssessment: {
        id: deletedAssessment._id,
        resumeHash: deletedAssessment.resumeHash,
        skillsCount: deletedAssessment.skills?.length || 0,
        wasSaved: deletedAssessment.isSaved,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in deleteRatings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete skills assessment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get detailed assessment information
export const getRatingDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`=== Getting Assessment Details ===`);
    console.log(`User: ${userId}`);
    console.log(`Assessment ID: ${id}`);

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assessment ID format'
      });
    }

    const assessment = await SkillsAssessment.findOne({
      _id: id,
      userId: userId,
      assessmentType: 'Technical Skills'
    }).select('-userId');

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Skills assessment not found'
      });
    }

    const assessmentDetails = assessment.toObject();
    
    // Add detailed analysis
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

    res.json({
      success: true,
      data: assessmentDetails
    });

  } catch (error) {
    console.error('Error in getRatingDetails:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get assessment details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
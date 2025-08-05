// SWOTController.js - Controller for SWOT Analysis Technology Ratings

import SWOTRating from "../models/swotAnalysisModel.js"; // You'll need to create this model

// Save technology ratings for SWOT analysis
export const saveRatings = async (req, res) => {
  try {
    const { technologies, resumeHash } = req.body;

    // Validation
    if (!technologies || !Array.isArray(technologies) || technologies.length === 0) {
      return res.status(400).json({
        message: "Technologies array is required and cannot be empty.",
        received: {
          technologies: typeof technologies,
          isArray: Array.isArray(technologies),
          length: technologies?.length || 0
        }
      });
    }

    if (!resumeHash) {
      return res.status(400).json({
        message: "Resume hash is required to save technology ratings.",
        hint: "Please analyze your resume first to generate a resume hash."
      });
    }

    // Validate technology objects
    const validatedTechnologies = technologies.map((tech, index) => {
      if (!tech.name || typeof tech.name !== 'string') {
        throw new Error(`Technology at index ${index} is missing a valid name.`);
      }
      
      if (!tech.category || typeof tech.category !== 'string') {
        throw new Error(`Technology "${tech.name}" is missing a valid category.`);
      }

      const confidenceLevel = parseInt(tech.confidenceLevel);
      if (isNaN(confidenceLevel) || confidenceLevel < 1 || confidenceLevel > 10) {
        throw new Error(`Technology "${tech.name}" has invalid confidence level. Must be 1-10.`);
      }

      return {
        name: tech.name.trim(),
        category: tech.category.trim(),
        confidenceLevel: confidenceLevel
      };
    });

    console.log(`Saving ${validatedTechnologies.length} technology ratings for user ${req.user.id}`);

    // Check if ratings already exist for this resume
    const existingRating = await SWOTRating.findOne({
      userId: req.user.id,
      resumeHash: resumeHash
    });

    const ratingData = {
      userId: req.user.id,
      resumeHash: resumeHash,
      technologies: validatedTechnologies,
      metadata: {
        totalTechnologies: validatedTechnologies.length,
        averageConfidence: validatedTechnologies.reduce((sum, tech) => sum + tech.confidenceLevel, 0) / validatedTechnologies.length,
        expertLevel: validatedTechnologies.filter(tech => tech.confidenceLevel >= 8).length,
        proficientLevel: validatedTechnologies.filter(tech => tech.confidenceLevel >= 6 && tech.confidenceLevel < 8).length,
        beginnerLevel: validatedTechnologies.filter(tech => tech.confidenceLevel < 6).length,
        categoriesCount: [...new Set(validatedTechnologies.map(tech => tech.category))].length,
        lastUpdated: new Date().toISOString()
      }
    };

    if (existingRating) {
      // Update existing rating
      await SWOTRating.findByIdAndUpdate(existingRating._id, {
        ...ratingData,
        updatedAt: new Date()
      });

      console.log(`Updated existing SWOT rating for resume hash ${resumeHash}`);
      
      return res.json({
        success: true,
        message: `Successfully updated technology confidence ratings for ${validatedTechnologies.length} technologies.`,
        updated: true,
        stats: ratingData.metadata
      });
    } else {
      // Create new rating
      await SWOTRating.create(ratingData);

      console.log(`Created new SWOT rating for resume hash ${resumeHash}`);
      
      return res.json({
        success: true,
        message: `Successfully saved technology confidence ratings for ${validatedTechnologies.length} technologies.`,
        updated: false,
        stats: ratingData.metadata
      });
    }

  } catch (err) {
    console.error("Error saving SWOT technology ratings:", err);
    
    // Handle validation errors specifically
    if (err.message.includes('Technology') && err.message.includes('index')) {
      return res.status(400).json({
        message: "Technology validation failed.",
        error: err.message,
        hint: "Please ensure all technologies have valid name, category, and confidence level (1-10)."
      });
    }

    res.status(500).json({
      message: "Server error while saving technology ratings.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      hint: "Please try again or contact support if the issue persists."
    });
  }
};

// Get saved technology ratings for a user
export const getRatings = async (req, res) => {
  try {
    const { resumeHash } = req.params;

    let query = { userId: req.user.id };
    if (resumeHash) {
      query.resumeHash = resumeHash;
    }

    const ratings = await SWOTRating.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(50)
      .select('-userId'); // Exclude sensitive user ID

    if (resumeHash && ratings.length === 0) {
      return res.status(404).json({
        message: "No technology ratings found for the specified resume.",
        resumeHash: resumeHash
      });
    }

    // Add summary statistics
    const ratingsWithSummary = ratings.map(rating => {
      const technologies = rating.technologies || [];
      return {
        ...rating.toObject(),
        summary: {
          totalTechnologies: technologies.length,
          averageConfidence: technologies.length > 0 
            ? Math.round((technologies.reduce((sum, tech) => sum + tech.confidenceLevel, 0) / technologies.length) * 10) / 10
            : 0,
          strongTechnologies: technologies.filter(tech => tech.confidenceLevel >= 7).length,
          needsImprovement: technologies.filter(tech => tech.confidenceLevel < 5).length,
          categories: [...new Set(technologies.map(tech => tech.category))]
        }
      };
    });

    res.json({
      ratings: ratingsWithSummary,
      count: ratingsWithSummary.length,
      metadata: {
        totalRatings: ratingsWithSummary.length,
        hasCurrentResume: resumeHash ? ratingsWithSummary.length > 0 : null
      }
    });

  } catch (err) {
    console.error("Error fetching SWOT technology ratings:", err);
    res.status(500).json({
      message: "Server error while fetching technology ratings.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Delete technology ratings
export const deleteRatings = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "Rating ID is required for deletion.",
        example: "DELETE /api/swot/delete/[rating_id]"
      });
    }

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: "Invalid rating ID format.",
        received: id
      });
    }

    const deleted = await SWOTRating.findOneAndDelete({
      _id: id,
      userId: req.user.id
    });

    if (!deleted) {
      return res.status(404).json({
        message: "Technology ratings not found or unauthorized.",
        ratingId: id
      });
    }

    console.log(`Deleted SWOT rating ${id} for user ${req.user.id}`);

    res.json({
      success: true,
      message: "Technology ratings deleted successfully.",
      deletedRating: {
        id: deleted._id,
        resumeHash: deleted.resumeHash,
        technologiesCount: deleted.technologies?.length || 0,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error("Error deleting SWOT technology ratings:", err);
    res.status(500).json({
      message: "Server error while deleting technology ratings.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
import TechnologyRating from "../models/swotAnalysisModel.js";
import CVAnalysis from "../models/CVAnalysisModel.js";

// Helper function to validate technology ratings
const validateTechnologyRatings = (technologies) => {
  if (!Array.isArray(technologies)) {
    throw new Error("Technologies must be an array");
  }

  if (technologies.length === 0) {
    throw new Error("At least one technology is required");
  }

  for (const tech of technologies) {
    if (!tech.name || typeof tech.name !== 'string' || tech.name.trim().length === 0) {
      throw new Error("Each technology must have a valid name");
    }
    if (typeof tech.confidenceLevel !== 'number' || tech.confidenceLevel < 1 || tech.confidenceLevel > 10) {
      throw new Error("Each technology confidence level must be a number between 1 and 10");
    }
  }
};

// Helper function to categorize technologies
const categorizeTechnology = (techName) => {
  const techLower = techName.toLowerCase();
  
  // Programming Languages
  if (['javascript', 'python', 'java', 'c++', 'c#', 'typescript', 'go', 'rust', 'swift', 'kotlin', 'php', 'ruby', 'scala', 'r', 'c', 'dart', 'perl', 'objective-c', 'vb.net', 'f#'].some(lang => techLower.includes(lang))) {
    return 'Programming Languages';
  }
  
  // Frontend Technologies
  if (['react', 'angular', 'vue', 'html', 'css', 'sass', 'less', 'bootstrap', 'jquery', 'next.js', 'nuxt.js', 'svelte', 'ember', 'backbone', 'tailwind'].some(web => techLower.includes(web))) {
    return 'Frontend Technologies';
  }
  
  // Backend Technologies
  if (['node.js', 'express', 'django', 'flask', 'spring', 'asp.net', 'rails', 'laravel', 'fastapi', 'koa', 'nestjs', 'gin', 'echo', 'fiber'].some(backend => techLower.includes(backend))) {
    return 'Backend Technologies';
  }
  
  // Databases
  if (['mysql', 'postgresql', 'mongodb', 'redis', 'sqlite', 'oracle', 'sql server', 'cassandra', 'dynamodb', 'firebase', 'elasticsearch', 'mariadb'].some(db => techLower.includes(db))) {
    return 'Databases';
  }
  
  // Cloud & DevOps
  if (['aws', 'azure', 'google cloud', 'gcp', 'docker', 'kubernetes', 'jenkins', 'terraform', 'ansible', 'heroku', 'vercel', 'netlify', 'gitlab', 'github actions'].some(cloud => techLower.includes(cloud))) {
    return 'Cloud & DevOps';
  }
  
  // Mobile Technologies
  if (['react native', 'flutter', 'xamarin', 'ionic', 'cordova', 'phonegap', 'native android', 'native ios'].some(mobile => techLower.includes(mobile))) {
    return 'Mobile Technologies';
  }
  
  // Data Science & ML
  if (['tensorflow', 'pytorch', 'pandas', 'numpy', 'scikit-learn', 'keras', 'opencv', 'matplotlib', 'jupyter', 'spark', 'hadoop', 'tableau'].some(ml => techLower.includes(ml))) {
    return 'Data Science & ML';
  }
  
  // Testing Tools
  if (['jest', 'mocha', 'jasmine', 'cypress', 'selenium', 'puppeteer', 'testng', 'junit', 'pytest', 'rspec'].some(test => techLower.includes(test))) {
    return 'Testing Tools';
  }
  
  // Development Tools
  if (['git', 'github', 'gitlab', 'vs code', 'intellij', 'postman', 'figma', 'adobe xd', 'jira', 'confluence'].some(tool => techLower.includes(tool))) {
    return 'Development Tools';
  }
  
  return 'General';
};

// Controller to save user's technology confidence ratings
export const saveTechnologyRatings = async (req, res) => {
  try {
    console.log("Saving technology confidence ratings for user:", req.user.id);
    
    const { technologies, resumeHash } = req.body;

    // Validate required fields
    if (!resumeHash || typeof resumeHash !== 'string') {
      return res.status(400).json({ 
        success: false,
        message: "Resume hash is required to link ratings to CV analysis." 
      });
    }

    // Validate technology ratings
    try {
      validateTechnologyRatings(technologies);
    } catch (validationError) {
      return res.status(400).json({ 
        success: false,
        message: validationError.message 
      });
    }

    // Verify that the CV analysis exists for this user and resume
    const existingAnalysis = await CVAnalysis.findOne({
      userId: req.user.id,
      resumeHash: resumeHash
    });

    if (!existingAnalysis) {
      return res.status(404).json({ 
        success: false,
        message: "Resume analysis not found. Please analyze your resume first." 
      });
    }

    console.log(`Processing confidence ratings for ${technologies.length} technologies`);

    // Process technologies with proper categorization
    const processedTechnologies = technologies.map(tech => ({
      name: tech.name.trim(),
      confidenceLevel: tech.confidenceLevel,
      category: tech.category || categorizeTechnology(tech.name),
      dateRated: new Date()
    }));

    // Check if user already has ratings for this resume
    const existingRating = await TechnologyRating.findOne({ 
      userId: req.user.id,
      resumeHash: resumeHash 
    });

    let savedRating;
    
    if (existingRating) {
      // Update existing rating
      existingRating.technologies = processedTechnologies;
      existingRating.resumeText = existingAnalysis.resumeText.substring(0, 5000);
      existingRating.lastUpdated = new Date();
      
      savedRating = await existingRating.save();
      console.log("Updated existing technology ratings:", savedRating._id);
    } else {
      // Create new rating
      savedRating = await TechnologyRating.create({
        userId: req.user.id,
        resumeHash: resumeHash,
        technologies: processedTechnologies,
        resumeText: existingAnalysis.resumeText.substring(0, 5000),
        lastUpdated: new Date()
      });
      console.log("Created new technology ratings:", savedRating._id);
    }

    // Generate summary statistics
    const totalTechnologies = processedTechnologies.length;
    const averageConfidence = processedTechnologies.reduce((sum, tech) => sum + tech.confidenceLevel, 0) / totalTechnologies;
    const expertSkills = processedTechnologies.filter(tech => tech.confidenceLevel >= 8);
    const proficientSkills = processedTechnologies.filter(tech => tech.confidenceLevel >= 6 && tech.confidenceLevel < 8);
    const improvementSkills = processedTechnologies.filter(tech => tech.confidenceLevel < 6);

    // Return success response with summary
    res.json({
      success: true,
      message: existingRating ? "Technology ratings updated successfully!" : "Technology ratings saved successfully!",
      data: {
        id: savedRating._id,
        resumeHash: resumeHash,
        totalTechnologies,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        expertSkills: expertSkills.length,
        proficientSkills: proficientSkills.length,
        improvementSkills: improvementSkills.length,
        lastUpdated: savedRating.lastUpdated
      },
      summary: {
        expertSkills: expertSkills.map(tech => ({ 
          name: tech.name, 
          confidence: tech.confidenceLevel,
          category: tech.category 
        })),
        proficientSkills: proficientSkills.map(tech => ({ 
          name: tech.name, 
          confidence: tech.confidenceLevel,
          category: tech.category 
        })),
        improvementSkills: improvementSkills.map(tech => ({ 
          name: tech.name, 
          confidence: tech.confidenceLevel,
          category: tech.category 
        }))
      }
    });

  } catch (err) {
    console.error("Critical error in saveTechnologyRatings:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to save technology ratings. Please try again.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Controller to get user's saved technology ratings
export const getTechnologyRatings = async (req, res) => {
  try {
    const { resumeHash } = req.query;

    if (!resumeHash) {
      return res.status(400).json({
        success: false,
        message: "Resume hash is required to fetch technology ratings."
      });
    }

    const savedRatings = await TechnologyRating.findOne({
      userId: req.user.id,
      resumeHash: resumeHash
    });

    if (!savedRatings) {
      return res.json({ 
        success: true,
        message: "No technology ratings found for this resume. Please rate your technologies first.",
        data: null
      });
    }

    // Generate summary statistics
    const totalTechnologies = savedRatings.technologies.length;
    const averageConfidence = savedRatings.averageConfidence;
    const expertSkills = savedRatings.expertTechnologies;
    const improvementSkills = savedRatings.improvementTechnologies;

    res.json({ 
      success: true,
      data: {
        id: savedRatings._id,
        resumeHash: savedRatings.resumeHash,
        technologies: savedRatings.technologies,
        totalTechnologies,
        averageConfidence,
        expertSkills: expertSkills.length,
        improvementSkills: improvementSkills.length,
        lastUpdated: savedRatings.lastUpdated,
        createdAt: savedRatings.createdAt
      },
      summary: {
        expertSkills: expertSkills.map(tech => ({ 
          name: tech.name, 
          confidence: tech.confidenceLevel,
          category: tech.category 
        })),
        improvementSkills: improvementSkills.map(tech => ({ 
          name: tech.name, 
          confidence: tech.confidenceLevel,
          category: tech.category 
        })),
        technologiesByCategory: savedRatings.getTechnologiesByCategory(),
        skillLevelAssessment: savedRatings.skillLevelAssessment
      }
    });

  } catch (err) {
    console.error("Error fetching technology ratings:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch technology ratings.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Controller to update individual technology rating
export const updateTechnologyRating = async (req, res) => {
  try {
    const { technologyName, confidenceLevel, resumeHash } = req.body;

    // Validate inputs
    if (!technologyName || typeof technologyName !== 'string') {
      return res.status(400).json({ 
        success: false,
        message: "Technology name is required." 
      });
    }

    if (typeof confidenceLevel !== 'number' || confidenceLevel < 1 || confidenceLevel > 10) {
      return res.status(400).json({ 
        success: false,
        message: "Confidence level must be a number between 1 and 10." 
      });
    }

    if (!resumeHash) {
      return res.status(400).json({
        success: false,
        message: "Resume hash is required."
      });
    }

    const userRatings = await TechnologyRating.findOne({
      userId: req.user.id,
      resumeHash: resumeHash
    });

    if (!userRatings) {
      return res.status(404).json({ 
        success: false,
        message: "No technology ratings found. Please create ratings first." 
      });
    }

    // Find and update the specific technology
    const techIndex = userRatings.technologies.findIndex(
      tech => tech.name.toLowerCase() === technologyName.toLowerCase()
    );

    if (techIndex === -1) {
      return res.status(404).json({ 
        success: false,
        message: "Technology not found in your ratings." 
      });
    }

    userRatings.technologies[techIndex].confidenceLevel = confidenceLevel;
    userRatings.technologies[techIndex].dateRated = new Date();
    userRatings.lastUpdated = new Date();

    await userRatings.save();

    res.json({
      success: true,
      message: `Updated confidence rating for ${technologyName}`,
      updatedTechnology: {
        name: userRatings.technologies[techIndex].name,
        confidenceLevel: userRatings.technologies[techIndex].confidenceLevel,
        category: userRatings.technologies[techIndex].category,
        dateRated: userRatings.technologies[techIndex].dateRated
      }
    });

  } catch (err) {
    console.error("Error updating technology rating:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to update technology rating.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Controller to delete technology ratings for a specific resume
export const deleteTechnologyRatings = async (req, res) => {
  try {
    const { resumeHash } = req.query;

    if (!resumeHash) {
      return res.status(400).json({
        success: false,
        message: "Resume hash is required."
      });
    }

    const deleted = await TechnologyRating.findOneAndDelete({
      userId: req.user.id,
      resumeHash: resumeHash
    });

    if (!deleted) {
      return res.status(404).json({ 
        success: false,
        message: "No technology ratings found for this resume." 
      });
    }

    res.json({ 
      success: true, 
      message: "Technology ratings deleted successfully.",
      deletedCount: deleted.technologies.length
    });

  } catch (err) {
    console.error("Delete technology ratings error:", err);
    res.status(500).json({ 
      success: false,
      message: "Server error while deleting technology ratings.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Controller to get all technology ratings for a user (across all resumes)
export const getAllUserTechnologyRatings = async (req, res) => {
  try {
    const allRatings = await TechnologyRating.find({ userId: req.user.id })
      .sort({ lastUpdated: -1 })
      .limit(10);

    res.json({
      success: true,
      data: allRatings.map(rating => ({
        id: rating._id,
        resumeHash: rating.resumeHash,
        technologiesCount: rating.technologies.length,
        averageConfidence: rating.averageConfidence,
        lastUpdated: rating.lastUpdated,
        createdAt: rating.createdAt
      })),
      total: allRatings.length
    });

  } catch (err) {
    console.error("Error fetching all user technology ratings:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch technology ratings.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
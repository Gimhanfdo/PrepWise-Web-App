import OpenAI from "openai";
import TechnologyRating from "../models/swotAnalysisModel.js";
import CVAnalysis from "../models/CVAnalysisModel.js";
import { extractTechnologies } from "./CVAnalysisAPI.js";
import mongoose from "mongoose";

// Initialize the OpenAI instance with Gemini
const AI = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

// SWOT Analysis Schema
const swotAnalysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  resumeHash: {
    type: String,
    required: true
  },
  technologyRatingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TechnologyRating',
    required: true
  },
  strengths: [String],
  weaknesses: [String],
  opportunities: [String],
  threats: [String],
  recommendations: [String],
  analysisDate: {
    type: Date,
    default: Date.now
  },
  technologiesAnalyzed: Number,
  averageConfidence: Number
}, {
  timestamps: true
});

const SWOTAnalysis = mongoose.model('SWOTAnalysis', swotAnalysisSchema);

// Helper function to validate technology ratings
const validateTechnologyRatings = (technologies) => {
  if (!Array.isArray(technologies)) {
    throw new Error("Technologies must be an array");
  }

  for (const tech of technologies) {
    if (!tech.name || typeof tech.name !== 'string') {
      throw new Error("Each technology must have a valid name");
    }
    if (typeof tech.confidenceLevel !== 'number' || tech.confidenceLevel < 1 || tech.confidenceLevel > 10) {
      throw new Error("Each technology confidence level must be a number between 1 and 10");
    }
  }
};

// Enhanced technology extraction using AI to get more accurate results
const extractTechnologiesFromCV = async (resumeText) => {
  try {
    const prompt = `You are an expert technical recruiter. Extract ALL programming languages, frameworks, libraries, databases, tools, and technologies mentioned in this resume/CV.

Resume Text:
${resumeText.substring(0, 6000)}

Extract technologies and categorize them. Include everything that's mentioned, even if briefly.

Respond with ONLY valid JSON in this exact format:

{
  "technologies": [
    {
      "name": "Technology Name",
      "category": "Category"
    }
  ]
}

Categories should be one of:
- Programming Languages
- Frontend Technologies
- Backend Technologies
- Databases
- Cloud & DevOps
- Mobile Technologies
- Data Science & ML
- Testing Tools
- Development Tools
- General

Be thorough and include all technical skills mentioned.`;

    const response = await AI.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "system",
          content: "You are a technical skills extraction expert. Respond only with valid JSON. Extract all technologies mentioned in the resume."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    const responseText = response.choices?.[0]?.message?.content?.trim();
    
    try {
      // Clean the response to extract JSON
      let cleanText = responseText.replace(/```json\s*|```\s*/g, '').trim();
      
      // Try to find JSON object in the response
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanText = jsonMatch[0];
      }
      
      const extractedData = JSON.parse(cleanText);
      
      // Validate structure and filter duplicates
      if (!Array.isArray(extractedData.technologies)) {
        throw new Error("Invalid response structure");
      }

      // Remove duplicates and format
      const uniqueTechnologies = [];
      const seen = new Set();
      
      for (const tech of extractedData.technologies) {
        const techName = tech.name.toLowerCase().trim();
        if (!seen.has(techName) && tech.name.length > 1) {
          seen.add(techName);
          uniqueTechnologies.push({
            name: tech.name.trim(),
            category: tech.category || categorizeTechnology(tech.name)
          });
        }
      }
      
      return uniqueTechnologies;
      
    } catch (parseError) {
      console.error("AI JSON parsing failed, falling back to basic extraction:", parseError.message);
      // Fallback to basic extraction
      return await extractTechnologies(resumeText);
    }

  } catch (err) {
    console.error("Error in AI technology extraction:", err.message);
    // Fallback to basic extraction
    return await extractTechnologies(resumeText);
  }
};

// Helper function to categorize technologies
const categorizeTechnology = (techName) => {
  const techLower = techName.toLowerCase();
  
  // Programming Languages
  if (['javascript', 'python', 'java', 'c++', 'c#', 'typescript', 'go', 'rust', 'swift', 'kotlin', 'php', 'ruby', 'scala', 'r', 'c', 'dart', 'perl', 'objective-c', 'vb.net', 'f#'].some(lang => techLower.includes(lang))) {
    return 'Programming Languages';
  }
  
  // Web Frontend
  if (['react', 'angular', 'vue', 'html', 'css', 'sass', 'less', 'bootstrap', 'jquery', 'next.js', 'nuxt.js', 'svelte', 'ember', 'backbone', 'tailwind'].some(web => techLower.includes(web))) {
    return 'Frontend Technologies';
  }
  
  // Backend
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
  
  // Mobile
  if (['react native', 'flutter', 'xamarin', 'ionic', 'cordova', 'phonegap', 'native android', 'native ios'].some(mobile => techLower.includes(mobile))) {
    return 'Mobile Technologies';
  }
  
  // Data Science & ML
  if (['tensorflow', 'pytorch', 'pandas', 'numpy', 'scikit-learn', 'keras', 'opencv', 'matplotlib', 'jupyter', 'spark', 'hadoop', 'tableau'].some(ml => techLower.includes(ml))) {
    return 'Data Science & ML';
  }
  
  // Testing
  if (['jest', 'mocha', 'jasmine', 'cypress', 'selenium', 'puppeteer', 'testng', 'junit', 'pytest', 'rspec'].some(test => techLower.includes(test))) {
    return 'Testing Tools';
  }
  
  // Development Tools
  if (['git', 'github', 'gitlab', 'vs code', 'intellij', 'postman', 'figma', 'adobe xd', 'jira', 'confluence'].some(tool => techLower.includes(tool))) {
    return 'Development Tools';
  }
  
  return 'General';
};

// Controller to extract technologies from CV using resumeHash
export const extractTechnologiesFromResume = async (req, res) => {
  try {
    console.log("Extracting technologies from resume using CV analysis data");
    
    const { resumeHash } = req.body;

    if (!resumeHash || typeof resumeHash !== 'string') {
      return res.status(400).json({ 
        success: false,
        message: "Resume hash is required to extract technologies." 
      });
    }

    // Find the existing CV analysis record for this user and resume
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

    const resumeText = existingAnalysis.resumeText;

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ 
        success: false,
        message: "Resume text from analysis is insufficient for technology extraction." 
      });
    }

    // Extract technologies from resume using enhanced AI method
    const extractedTechnologies = await extractTechnologiesFromCV(resumeText);

    if (extractedTechnologies.length === 0) {
      return res.json({
        success: true,
        technologies: [],
        resumeHash: resumeHash,
        message: "No specific technologies were detected in the resume. You can manually add technologies for rating."
      });
    }

    console.log(`Extracted ${extractedTechnologies.length} technologies from existing CV analysis`);

    res.json({
      success: true,
      technologies: extractedTechnologies,
      resumeHash: resumeHash,
      totalExtracted: extractedTechnologies.length,
      message: `Found ${extractedTechnologies.length} technologies in your resume. Please rate your confidence level for each technology.`
    });

  } catch (err) {
    console.error("Error extracting technologies:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to extract technologies from resume.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Controller to save user's technology confidence ratings
export const saveTechnologyRatings = async (req, res) => {
  try {
    console.log("Saving technology confidence ratings");
    
    const { technologies, resumeHash } = req.body;

    // Validate required fields
    if (!technologies || !Array.isArray(technologies) || technologies.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "Technologies array is required and must not be empty." 
      });
    }

    if (!resumeHash || typeof resumeHash !== 'string') {
      return res.status(400).json({ 
        success: false,
        message: "Resume hash is required to link ratings to CV analysis." 
      });
    }

    // Find the existing CV analysis record to get resume text
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

    // Validate technology ratings
    try {
      validateTechnologyRatings(technologies);
    } catch (validationError) {
      return res.status(400).json({ 
        success: false,
        message: validationError.message 
      });
    }

    console.log(`Saving confidence ratings for ${technologies.length} technologies`);

    // Check if user already has ratings for this resume and update or create new
    const existingRating = await TechnologyRating.findOne({ 
      userId: req.user.id,
      resumeHash: resumeHash 
    });

    let savedRating;
    
    if (existingRating) {
      // Update existing rating
      existingRating.technologies = technologies.map(tech => ({
        name: tech.name,
        confidenceLevel: tech.confidenceLevel,
        category: tech.category || categorizeTechnology(tech.name),
        dateRated: new Date()
      }));
      existingRating.resumeText = existingAnalysis.resumeText.substring(0, 5000);
      existingRating.lastUpdated = new Date();
      
      savedRating = await existingRating.save();
      console.log("Updated existing technology ratings:", savedRating._id);
    } else {
      // Create new rating
      savedRating = await TechnologyRating.create({
        userId: req.user.id,
        resumeHash: resumeHash,
        technologies: technologies.map(tech => ({
          name: tech.name,
          confidenceLevel: tech.confidenceLevel,
          category: tech.category || categorizeTechnology(tech.name),
          dateRated: new Date()
        })),
        resumeText: existingAnalysis.resumeText.substring(0, 5000),
        lastUpdated: new Date()
      });
      console.log("Created new technology ratings:", savedRating._id);
    }

    // Generate summary statistics
    const totalTechnologies = technologies.length;
    const averageConfidence = technologies.reduce((sum, tech) => sum + tech.confidenceLevel, 0) / totalTechnologies;
    const strongSkills = technologies.filter(tech => tech.confidenceLevel >= 7);
    const skillsToImprove = technologies.filter(tech => tech.confidenceLevel <= 4);

    // Return the saved data with summary
    res.json({
      success: true,
      message: existingRating ? "Technology ratings updated successfully!" : "Technology ratings saved successfully!",
      data: {
        id: savedRating._id,
        resumeHash: resumeHash,
        totalTechnologies,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        strongSkills: strongSkills.length,
        skillsToImprove: skillsToImprove.length,
        lastUpdated: savedRating.lastUpdated
      },
      summary: {
        strongSkills: strongSkills.map(tech => ({ name: tech.name, confidence: tech.confidenceLevel })),
        skillsToImprove: skillsToImprove.map(tech => ({ name: tech.name, confidence: tech.confidenceLevel }))
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

// NEW: Generate SWOT Analysis based on technology ratings
export const generateSWOTAnalysis = async (req, res) => {
  try {
    console.log("Generating SWOT analysis");
    
    const { resumeHash, jobDescriptions = [] } = req.body;

    if (!resumeHash || typeof resumeHash !== 'string') {
      return res.status(400).json({ 
        success: false,
        message: "Resume hash is required for SWOT analysis." 
      });
    }

    // Get the user's technology ratings
    const technologyRating = await TechnologyRating.findOne({
      userId: req.user.id,
      resumeHash: resumeHash
    });

    if (!technologyRating) {
      return res.status(404).json({ 
        success: false,
        message: "Technology ratings not found. Please rate your technologies first." 
      });
    }

    // Get CV analysis for additional context
    const cvAnalysis = await CVAnalysis.findOne({
      userId: req.user.id,
      resumeHash: resumeHash
    });

    if (!cvAnalysis) {
      return res.status(404).json({ 
        success: false,
        message: "CV analysis not found. Please analyze your resume first." 
      });
    }

    // Prepare data for SWOT generation
    const technologies = technologyRating.technologies.map(tech => ({
      name: tech.name,
      confidence: tech.confidenceLevel,
      category: tech.category
    }));

    const expertSkills = technologies.filter(tech => tech.confidence >= 8);
    const proficientSkills = technologies.filter(tech => tech.confidence >= 6 && tech.confidence < 8);
    const learningSkills = technologies.filter(tech => tech.confidence < 6);
    const averageConfidence = technologyRating.metadata.averageConfidence;

    // Generate SWOT analysis using AI
    const swotPrompt = `You are a career counselor and technical analyst. Generate a comprehensive SWOT analysis for a candidate based on their technology skills and confidence ratings.

CANDIDATE DATA:
- Total Technologies: ${technologies.length}
- Average Confidence: ${averageConfidence}/10
- Expert Level Skills (8-10): ${expertSkills.map(s => `${s.name} (${s.confidence})`).join(', ')}
- Proficient Skills (6-7): ${proficientSkills.map(s => `${s.name} (${s.confidence})`).join(', ')}
- Learning Skills (<6): ${learningSkills.map(s => `${s.name} (${s.confidence})`).join(', ')}

${jobDescriptions.length > 0 ? `JOB MARKET CONTEXT:\n${jobDescriptions.slice(0, 2).join('\n\n')}` : ''}

Generate a professional SWOT analysis. Respond with ONLY valid JSON in this format:

{
  "strengths": [
    "Specific strength based on high-confidence skills",
    "Another strength..."
  ],
  "weaknesses": [
    "Specific weakness based on low-confidence areas",
    "Another weakness..."
  ],
  "opportunities": [
    "Market opportunity based on skills and trends",
    "Another opportunity..."
  ],
  "threats": [
    "Potential threat or challenge",
    "Another threat..."
  ],
  "recommendations": [
    "Specific actionable recommendation",
    "Another recommendation..."
  ]
}

Make it professional, specific, and actionable. Focus on 4-5 items per section.`;

    const response = await AI.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "system",
          content: "You are a professional career counselor and technical analyst. Generate comprehensive, actionable SWOT analyses. Respond only with valid JSON."
        },
        {
          role: "user",
          content: swotPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const responseText = response.choices?.[0]?.message?.content?.trim();
    
    let swotData;
    try {
      // Clean the response to extract JSON
      let cleanText = responseText.replace(/```json\s*|```\s*/g, '').trim();
      
      // Try to find JSON object in the response
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanText = jsonMatch[0];
      }
      
      swotData = JSON.parse(cleanText);
      
      // Validate structure
      if (!swotData.strengths || !swotData.weaknesses || !swotData.opportunities || !swotData.threats) {
        throw new Error("Invalid SWOT structure");
      }
      
    } catch (parseError) {
      console.error("SWOT AI parsing failed, using fallback:", parseError.message);
      
      // Fallback SWOT analysis
      swotData = {
        strengths: [
          `Strong proficiency in ${expertSkills.slice(0, 3).map(s => s.name).join(', ')}`,
          `Diverse technology stack with ${technologies.length} different technologies`,
          `Self-aware of skill levels across technical domains`,
          `Good foundation in ${technologyRating.metadata.strongestCategory || 'multiple categories'}`
        ],
        weaknesses: [
          `Lower confidence in ${learningSkills.slice(0, 3).map(s => s.name).join(', ')}`,
          `Average skill confidence below expert level (${averageConfidence}/10)`,
          `May need more practical experience in weaker areas`,
          `Could benefit from deeper specialization`
        ],
        opportunities: [
          `High demand for professionals with your skill combination`,
          `Opportunity to specialize in your strongest technologies`,
          `Growing market for full-stack developers`,
          `Potential to mentor others in your expert skills`
        ],
        threats: [
          `Rapid technology evolution requires continuous learning`,
          `Competition from specialists in specific areas`,
          `Risk of skill obsolescence without regular practice`,
          `Market preference for deep expertise over broad knowledge`
        ],
        recommendations: [
          `Focus on strengthening ${learningSkills[0]?.name || 'weaker'} skills through practice projects`,
          `Build portfolio showcasing your strongest technologies`,
          `Consider certifications in your expert-level skills`,
          `Join tech communities to stay updated on trends`,
          `Focus on 2-3 core technologies for deep specialization`
        ]
      };
    }

    // Save SWOT analysis to database
    const savedSWOT = await SWOTAnalysis.create({
      userId: req.user.id,
      resumeHash: resumeHash,
      technologyRatingId: technologyRating._id,
      strengths: swotData.strengths,
      weaknesses: swotData.weaknesses,
      opportunities: swotData.opportunities,
      threats: swotData.threats,
      recommendations: swotData.recommendations,
      technologiesAnalyzed: technologies.length,
      averageConfidence: averageConfidence
    });

    console.log("SWOT analysis generated and saved:", savedSWOT._id);

    res.json({
      success: true,
      message: "SWOT analysis generated successfully!",
      swotAnalysis: {
        id: savedSWOT._id,
        strengths: swotData.strengths,
        weaknesses: swotData.weaknesses,
        opportunities: swotData.opportunities,
        threats: swotData.threats,
        recommendations: swotData.recommendations,
        metadata: {
          technologiesAnalyzed: technologies.length,
          averageConfidence: averageConfidence,
          expertSkills: expertSkills.length,
          proficientSkills: proficientSkills.length,
          learningSkills: learningSkills.length,
          analysisDate: savedSWOT.analysisDate
        }
      }
    });

  } catch (err) {
    console.error("Error generating SWOT analysis:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to generate SWOT analysis.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get saved SWOT analyses
export const getSavedSWOTAnalyses = async (req, res) => {
  try {
    const { resumeHash } = req.query;

    let query = { userId: req.user.id };
    
    if (resumeHash) {
      query.resumeHash = resumeHash;
    }

    const savedAnalyses = await SWOTAnalysis.find(query)
      .sort({ analysisDate: -1 })
      .limit(10);

    res.json({
      success: true,
      analyses: savedAnalyses,
      total: savedAnalyses.length
    });

  } catch (err) {
    console.error("Error fetching SWOT analyses:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch SWOT analyses.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Delete SWOT analysis
export const deleteSWOTAnalysis = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await SWOTAnalysis.findOneAndDelete({
      _id: id,
      userId: req.user.id
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "SWOT analysis not found."
      });
    }

    res.json({
      success: true,
      message: "SWOT analysis deleted successfully."
    });

  } catch (err) {
    console.error("Error deleting SWOT analysis:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete SWOT analysis.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Other existing functions remain the same...
export const getTechnologyRatings = async (req, res) => {
  try {
    const { resumeHash } = req.query;

    let query = { userId: req.user.id };
    
    // If resumeHash is provided, get ratings for specific resume
    if (resumeHash) {
      query.resumeHash = resumeHash;
    }

    const savedRatings = await TechnologyRating.findOne(query)
      .sort({ lastUpdated: -1 });

    if (!savedRatings) {
      return res.json({ 
        success: true,
        message: resumeHash 
          ? "No technology ratings found for this resume. Please rate your technologies first."
          : "No technology ratings found. Please rate your technologies first.",
        data: null
      });
    }

    // Generate summary statistics
    const totalTechnologies = savedRatings.technologies.length;
    const averageConfidence = savedRatings.technologies.reduce((sum, tech) => sum + tech.confidenceLevel, 0) / totalTechnologies;
    const strongSkills = savedRatings.technologies.filter(tech => tech.confidenceLevel >= 7);
    const skillsToImprove = savedRatings.technologies.filter(tech => tech.confidenceLevel <= 4);

    res.json({ 
      success: true,
      data: {
        id: savedRatings._id,
        resumeHash: savedRatings.resumeHash,
        technologies: savedRatings.technologies,
        totalTechnologies,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        strongSkills: strongSkills.length,
        skillsToImprove: skillsToImprove.length,
        lastUpdated: savedRatings.lastUpdated,
        createdAt: savedRatings.createdAt
      },
      summary: {
        strongSkills: strongSkills.map(tech => ({ 
          name: tech.name, 
          confidence: tech.confidenceLevel,
          category: tech.category 
        })),
        skillsToImprove: skillsToImprove.map(tech => ({ 
          name: tech.name, 
          confidence: tech.confidenceLevel,
          category: tech.category 
        })),
        technologiesByCategory: savedRatings.getTechnologiesByCategory()
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

export const updateTechnologyRating = async (req, res) => {
  try {
    const { technologyName, confidenceLevel, resumeHash } = req.body;

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

    let query = { userId: req.user.id };
    
    // If resumeHash is provided, update ratings for specific resume
    if (resumeHash) {
      query.resumeHash = resumeHash;
    }

    const userRatings = await TechnologyRating.findOne(query);

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

export const deleteTechnologyRatings = async (req, res) => {
  try {
    const { resumeHash } = req.query;

    let query = { userId: req.user.id };
    
    // If resumeHash is provided, delete ratings for specific resume
    if (resumeHash) {
      query.resumeHash = resumeHash;
    }

    const deleted = await TechnologyRating.findOneAndDelete(query);

    if (!deleted) {
      return res.status(404).json({ 
        success: false,
        message: resumeHash 
          ? "No technology ratings found for this resume." 
          : "No technology ratings found." 
      });
    }

    res.json({ 
      success: true, 
      message: resumeHash 
        ? "Technology ratings for this resume deleted successfully." 
        : "Technology ratings deleted successfully." 
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

export const getTechnologyAnalytics = async (req, res) => {
  try {
    const { resumeHash } = req.query;

    let query = { userId: req.user.id };
    
    // If resumeHash is provided, get analytics for specific resume
    if (resumeHash) {
      query.resumeHash = resumeHash;
    }

    const userRatings = await TechnologyRating.findOne(query);

    if (!userRatings) {
      return res.json({ 
        success: true,
        message: resumeHash 
          ? "No technology ratings found for this resume."
          : "No technology ratings found.",
        analytics: null
      });
    }

    const technologies = userRatings.technologies;
    
    // Category-wise analysis
    const categoryAnalysis = {};
    technologies.forEach(tech => {
      if (!categoryAnalysis[tech.category]) {
        categoryAnalysis[tech.category] = {
          technologies: [],
          averageConfidence: 0,
          count: 0
        };
      }
      categoryAnalysis[tech.category].technologies.push(tech);
      categoryAnalysis[tech.category].count++;
    });

    // Calculate average confidence per category
    Object.keys(categoryAnalysis).forEach(category => {
      const techs = categoryAnalysis[category].technologies;
      const avgConfidence = techs.reduce((sum, tech) => sum + tech.confidenceLevel, 0) / techs.length;
      categoryAnalysis[category].averageConfidence = Math.round(avgConfidence * 100) / 100;
      
      // Sort technologies by confidence level
      categoryAnalysis[category].technologies.sort((a, b) => b.confidenceLevel - a.confidenceLevel);
    });

    // Overall insights
    const totalTechnologies = technologies.length;
    const overallAverage = technologies.reduce((sum, tech) => sum + tech.confidenceLevel, 0) / totalTechnologies;
    const expertLevel = technologies.filter(tech => tech.confidenceLevel >= 8).length;
    const proficientLevel = technologies.filter(tech => tech.confidenceLevel >= 6 && tech.confidenceLevel < 8).length;
    const learningLevel = technologies.filter(tech => tech.confidenceLevel < 6).length;

    // Get skill level assessment
    const skillLevelAssessment = userRatings.skillLevelAssessment;

    res.json({
      success: true,
      analytics: {
        overview: {
          totalTechnologies,
          overallAverage: Math.round(overallAverage * 100) / 100,
          expertLevel,
          proficientLevel,
          learningLevel,
          skillLevel: skillLevelAssessment
        },
        categoryAnalysis,
        topSkills: technologies
          .sort((a, b) => b.confidenceLevel - a.confidenceLevel)
          .slice(0, 10),
        skillsToFocus: technologies
          .sort((a, b) => a.confidenceLevel - b.confidenceLevel)
          .slice(0, 5),
        confidenceLevelDistribution: userRatings.getConfidenceLevelDistribution(),
        recommendations: userRatings.getRecommendations(),
        lastUpdated: userRatings.lastUpdated,
        resumeHash: userRatings.resumeHash
      }
    });

  } catch (err) {
    console.error("Error generating technology analytics:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to generate technology analytics.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
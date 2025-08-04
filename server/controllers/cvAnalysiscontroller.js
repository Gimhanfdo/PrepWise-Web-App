import pdfParse from "pdf-parse";
import {
  getSimilarityScore,
  getImprovementSuggestions,
  getStructuredRecommendations,
  analyzeResumeMatch,
} from "../utils/CVAnalysisAPI.js";
import CVAnalysis from "../models/CVAnalysisModel.js";
import SavedCVAnalysis from "../models/SavedCVAnalysisModel.js";
import OpenAI from "openai";
import crypto from "crypto";

// Initialize the OpenAI instance with Gemini
const AI = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

// Function to create a hash of the resume text for comparison
function createResumeHash(resumeText) {
  return crypto.createHash('sha256').update(resumeText.trim()).digest('hex');
}

// Function to convert markdown-style formatting to basic HTML
function convertMarkdownToHTML(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

// Enhanced function to strip HTML and get clean text for analysis
function stripHTMLToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// Controller to analyze a resume against multiple job descriptions
export const analyzeResume = async (req, res) => {
  try {
    console.log("Received resume:", req.file?.originalname);
    console.log("Received job descriptions count:", JSON.parse(req.body.jobDescriptions || "[]").length);

    const resumeFile = req.file;
    const rawJobDescriptions = JSON.parse(req.body.jobDescriptions || "[]");

    if (!resumeFile || rawJobDescriptions.length === 0) {
      return res
        .status(400)
        .json({ message: "Resume file and job descriptions are required." });
    }

    // Extract text from PDF
    let resumeText;
    try {
      resumeText = (await pdfParse(resumeFile.buffer)).text;
      if (!resumeText || resumeText.trim().length < 50) {
        throw new Error("Resume text extraction failed or content too short");
      }
    } catch (parseError) {
      console.error("PDF parsing error:", parseError);
      return res.status(400).json({ 
        message: "Failed to extract text from PDF. Please ensure the file is a valid PDF with readable text." 
      });
    }

    // Create a hash of the resume text for comparison
    const resumeHash = createResumeHash(resumeText);

    const analysis = [];

    for (let i = 0; i < rawJobDescriptions.length; i++) {
      const rawJobDesc = rawJobDescriptions[i];
      
      // Convert to HTML for storage/display
      const jobDescForDisplay = convertMarkdownToHTML(rawJobDesc);
      
      // Use clean text for analysis
      const jobDescForAnalysis = stripHTMLToText(rawJobDesc);

      let similarity = 0;
      let analysisResult = null;
      let hasError = false;
      let isNonTechRole = false;

      console.log(`Analyzing job description ${i + 1}/${rawJobDescriptions.length}`);

      // Use the comprehensive analyzeResumeMatch function for structured analysis
      try {
        analysisResult = await analyzeResumeMatch(resumeText, jobDescForAnalysis);
        
        similarity = analysisResult.similarityScore;
        
        // Check if it's a non-tech role
        if (analysisResult.warning === "Non-technical role detected" || analysisResult.isNonTechRole) {
          isNonTechRole = true;
        }
        
        // Check for analysis errors
        if (analysisResult.error) {
          hasError = true;
          console.error(`Analysis error for JD ${i + 1}:`, analysisResult.error);
        }
        
        console.log(`Analysis result for JD ${i + 1}: Score=${similarity}, Match%=${analysisResult.matchPercentage}`);
        
      } catch (e) {
        console.error(`Analysis error for JD ${i + 1}:`, e.message);
        hasError = true;
        
        // Fallback to basic analysis
        try {
          similarity = await getSimilarityScore(resumeText, jobDescForAnalysis);
          
          // Create fallback structured analysis
          analysisResult = {
            similarityScore: similarity,
            matchPercentage: Math.round(similarity * 100),
            isNonTechRole: false,
            strengths: ["Basic analysis completed"],
            contentWeaknesses: ["Unable to perform detailed content analysis"],
            structureWeaknesses: ["Unable to perform detailed structure analysis"],
            contentRecommendations: ["Please try again for detailed recommendations"],
            structureRecommendations: ["Ensure document is properly formatted"]
          };
        } catch (fallbackError) {
          console.error(`Fallback analysis failed for JD ${i + 1}:`, fallbackError.message);
          analysisResult = {
            similarityScore: 0,
            matchPercentage: 0,
            isNonTechRole: false,
            strengths: ["Analysis unavailable"],
            contentWeaknesses: ["Analysis failed"],
            structureWeaknesses: ["Analysis failed"],
            contentRecommendations: ["Please verify resume and job description"],
            structureRecommendations: ["Please verify document formatting"]
          };
        }
      }

      // Calculate match percentage with improved granular scoring
      let matchPercentage;
      if (isNonTechRole || similarity === 0) {
        matchPercentage = 0;
      } else if (similarity < 0.2) {
        matchPercentage = Math.round(similarity * 50); // 0-10%
      } else if (similarity < 0.4) {
        matchPercentage = Math.round(10 + (similarity - 0.2) * 75); // 10-25%
      } else if (similarity < 0.6) {
        matchPercentage = Math.round(25 + (similarity - 0.4) * 125); // 25-50%
      } else if (similarity < 0.8) {
        matchPercentage = Math.round(50 + (similarity - 0.6) * 150); // 50-80%
      } else {
        matchPercentage = Math.round(80 + (similarity - 0.8) * 100); // 80-100%
      }

      matchPercentage = Math.max(0, Math.min(100, matchPercentage));

      // Prepare the result object with structured data
      const resultData = {
        matchPercentage,
        jobDescription: jobDescForDisplay,
        hasError,
        isNonTechRole,
        rawSimilarity: similarity
      };

      // Add structured analysis data if available
      if (analysisResult && !isNonTechRole) {
        resultData.strengths = analysisResult.strengths || [];
        resultData.contentWeaknesses = analysisResult.contentWeaknesses || [];
        resultData.structureWeaknesses = analysisResult.structureWeaknesses || [];
        resultData.contentRecommendations = analysisResult.contentRecommendations || [];
        resultData.structureRecommendations = analysisResult.structureRecommendations || [];
      } else if (isNonTechRole) {
        resultData.message = analysisResult?.message || "This appears to be a non-software engineering role.";
      }

      // Push result into analysis array
      analysis.push(resultData);
    }

    // Check if a CV with the same content already exists for this user
    try {
      const existingAnalysis = await CVAnalysis.findOne({
        userId: req.user.id,
        resumeHash: resumeHash
      });

      const analysisData = {
        userId: req.user.id,
        resumeText: resumeText.substring(0, 10000), // Limit stored text length
        resumeHash: resumeHash,
        jobDescriptions: rawJobDescriptions.map(jd => convertMarkdownToHTML(jd)),
        results: analysis.map(a => ({
          matchPercentage: a.matchPercentage,
          isNonTechRole: a.isNonTechRole || false,
          strengths: a.strengths || [],
          contentWeaknesses: a.contentWeaknesses || [],
          structureWeaknesses: a.structureWeaknesses || [],
          contentRecommendations: a.contentRecommendations || [],
          structureRecommendations: a.structureRecommendations || [],
          message: a.message || null
        })),
      };

      if (existingAnalysis) {
        // Update existing record
        console.log("Updating existing CV analysis record");
        await CVAnalysis.findByIdAndUpdate(existingAnalysis._id, {
          ...analysisData,
          updatedAt: new Date()
        });
      } else {
        // Create new record
        console.log("Creating new CV analysis record");
        await CVAnalysis.create(analysisData);
      }
    } catch (saveError) {
      console.error("Database save/update error:", saveError);
      // Continue with response even if save fails
    }

    // Return the analysis results to the frontend
    res.json({ 
      analysis: analysis.map(a => ({
        matchPercentage: a.matchPercentage,
        isNonTechRole: a.isNonTechRole || false,
        strengths: a.strengths || [],
        contentWeaknesses: a.contentWeaknesses || [],
        structureWeaknesses: a.structureWeaknesses || [],
        contentRecommendations: a.contentRecommendations || [],
        structureRecommendations: a.structureRecommendations || [],
        message: a.message || null
      })),
      resumeAnalyzed: true,
      totalJobDescriptions: rawJobDescriptions.length,
      nonTechRoleCount: analysis.filter(a => a.isNonTechRole).length,
      isExistingResume: !!await CVAnalysis.findOne({
        userId: req.user.id,
        resumeHash: resumeHash
      })
    });

  } catch (err) {
    console.error("Critical error in analyzeResume:", err);
    res.status(500).json({ 
      message: "Failed to analyze resume. Please try again with a valid PDF and job descriptions.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Controller to save a completed analysis by a user
export const saveAnalysis = async (req, res) => {
  try {
    let { resumeName, jobDescriptions, results, resumeHash } = req.body;
    
    if (!resumeName || !jobDescriptions || !results) {
      return res.status(400).json({ message: "Missing required fields for saving analysis." });
    }

    // Validate data structure
    if (!Array.isArray(jobDescriptions) || !Array.isArray(results)) {
      return res.status(400).json({ message: "Invalid data format for saving analysis." });
    }

    // Format job descriptions to HTML and ensure they're properly structured
    const formattedJobDescriptions = jobDescriptions.map(jd => 
      typeof jd === 'string' ? convertMarkdownToHTML(jd) : jd
    );

    // Validate results structure with structured data
    const validatedResults = results.map(result => ({
      matchPercentage: typeof result.matchPercentage === 'number' ? result.matchPercentage : 0,
      isNonTechRole: typeof result.isNonTechRole === 'boolean' ? result.isNonTechRole : false,
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      contentWeaknesses: Array.isArray(result.contentWeaknesses) ? result.contentWeaknesses : [],
      structureWeaknesses: Array.isArray(result.structureWeaknesses) ? result.structureWeaknesses : [],
      contentRecommendations: Array.isArray(result.contentRecommendations) ? result.contentRecommendations : [],
      structureRecommendations: Array.isArray(result.structureRecommendations) ? result.structureRecommendations : [],
      message: typeof result.message === 'string' ? result.message : null
    }));

    // Check if an analysis with the same resume hash exists
    if (resumeHash) {
      const existingAnalysis = await SavedCVAnalysis.findOne({
        userId: req.user.id,
        resumeHash: resumeHash
      });

      if (existingAnalysis) {
        // Update existing record
        await SavedCVAnalysis.findByIdAndUpdate(existingAnalysis._id, {
          resumeText: resumeName,
          jobDescriptions: formattedJobDescriptions,
          results: validatedResults,
          updatedAt: new Date()
        });

        return res.json({ 
          success: true, 
          message: "Analysis updated successfully.",
          updated: true
        });
      }
    }

    // Save new analysis in the database
    await SavedCVAnalysis.create({
      userId: req.user.id,
      resumeText: resumeName, 
      resumeHash: resumeHash,
      jobDescriptions: formattedJobDescriptions,
      results: validatedResults,
    });

    res.json({ 
      success: true, 
      message: "Analysis saved successfully.",
      updated: false
    });
  } catch (err) {
    console.error("Save analysis error:", err);
    res.status(500).json({ 
      message: "Server error while saving analysis.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Controller to fetch all saved analyses for the logged-in user
export const getSavedAnalysis = async (req, res) => {
  try {
    const savedAnalyses = await SavedCVAnalysis.find({ userId: req.user.id })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(50); // Limit to prevent large responses

    res.json({ 
      savedAnalyses,
      count: savedAnalyses.length
    });
  } catch (err) {
    console.error("Get saved analyses error:", err);
    res.status(500).json({ 
      message: "Failed to fetch saved analyses.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Controller to delete a specific saved analysis
export const deleteAnalysis = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Analysis ID is required." });
    }

    // Find and delete the analysis if it belongs to the logged-in user
    const deleted = await SavedCVAnalysis.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Analysis not found or unauthorized." });
    }

    res.json({ success: true, message: "Analysis deleted successfully." });
  } catch (err) {
    console.error("Delete analysis error:", err);
    res.status(500).json({ 
      message: "Server error while deleting analysis.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
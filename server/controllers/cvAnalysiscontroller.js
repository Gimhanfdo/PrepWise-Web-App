import pdfParse from "pdf-parse";
import {
  getSimilarityScore,
  getImprovementSuggestions,
  getStructuredRecommendations,
  analyzeResumeMatch,
  extractTechnologiesFromResume,
  createResumeHash
} from "../utils/CVAnalysisAPI.js";
import CVAnalysis from "../models/CVAnalysisModel.js";

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

// Enhanced resume text validation for software engineering context
function validateResumeContent(resumeText) {
  const text = resumeText.toLowerCase();
  const minLength = 100;
  
  if (resumeText.length < minLength) {
    throw new Error("Resume content too short. Please ensure the PDF contains readable text.");
  }

  // Check for common resume sections
  const hasBasicSections = [
    'education', 'experience', 'skills', 'projects', 'contact'
  ].some(section => text.includes(section));

  if (!hasBasicSections) {
    console.warn("Resume may be missing standard sections");
  }

  return true;
}

// Enhanced job description validation for software engineering internships
function validateJobDescription(jobDesc) {
  const text = jobDesc.toLowerCase();
  const minLength = 50;
  
  if (jobDesc.length < minLength) {
    throw new Error("Job description too short. Please provide a detailed job posting.");
  }

  // Check for software engineering internship indicators
  const internshipIndicators = [
    'intern', 'internship', 'student', 'entry level', 'junior', 'trainee'
  ];
  
  const softwareIndicators = [
    'software', 'developer', 'engineer', 'programming', 'coding', 'development',
    'python', 'java', 'javascript', 'react', 'node', 'web', 'mobile', 'app'
  ];

  const hasInternshipWords = internshipIndicators.some(word => text.includes(word));
  const hasSoftwareWords = softwareIndicators.some(word => text.includes(word));

  return {
    isInternship: hasInternshipWords,
    isSoftware: hasSoftwareWords,
    isRelevant: hasInternshipWords && hasSoftwareWords
  };
}

// Controller to analyze a resume against multiple job descriptions
export const analyzeResume = async (req, res) => {
  try {
    console.log("=== Enhanced Software Engineering Internship Analysis Started ===");
    console.log("Received resume:", req.file?.originalname);
    console.log("Received job descriptions count:", JSON.parse(req.body.jobDescriptions || "[]").length);

    const resumeFile = req.file;
    const rawJobDescriptions = JSON.parse(req.body.jobDescriptions || "[]");

    if (!resumeFile || rawJobDescriptions.length === 0) {
      return res.status(400).json({ 
        message: "Resume file and job descriptions are required for software engineering internship analysis.",
        requirements: "Please upload a PDF resume and provide detailed internship job descriptions."
      });
    }

    // Enhanced PDF text extraction with validation
    let resumeText;
    try {
      const pdfData = await pdfParse(resumeFile.buffer);
      resumeText = pdfData.text;
      
      if (!resumeText || resumeText.trim().length < 50) {
        throw new Error("Resume text extraction failed or content too short");
      }

      // Validate resume content
      validateResumeContent(resumeText);
      console.log("Resume validation successful, length:", resumeText.length);

    } catch (parseError) {
      console.error("PDF parsing error:", parseError);
      return res.status(400).json({ 
        message: "Failed to extract text from PDF. Please ensure the file is a valid PDF with readable text.",
        details: "The PDF may be scanned/image-based, corrupted, or password-protected."
      });
    }

    // Extract technologies from resume text using Gemini 2.5 Flash
    console.log("Extracting technologies from resume...");
    const extractedTechnologies = await extractTechnologiesFromResume(resumeText);
    console.log(`Extracted ${extractedTechnologies.length} technologies:`, extractedTechnologies.map(t => t.name));

    // Create a hash of the resume text for comparison
    const resumeHash = createResumeHash(resumeText);

    const analysis = [];
    let totalNonTechRoles = 0;
    let totalProcessed = 0;

    // Process each job description with enhanced validation
    for (let i = 0; i < rawJobDescriptions.length; i++) {
      const rawJobDesc = rawJobDescriptions[i];
      totalProcessed++;
      
      console.log(`\n--- Processing Job Description ${i + 1}/${rawJobDescriptions.length} ---`);
      
      // Validate job description
      try {
        const validation = validateJobDescription(rawJobDesc);
        console.log("Job validation:", validation);
        
        if (!validation.isSoftware) {
          console.log("Non-software role detected, skipping detailed analysis");
        }
      } catch (validationError) {
        console.error("Job description validation failed:", validationError.message);
        analysis.push({
          matchPercentage: 0,
          isNonTechRole: true,
          hasError: true,
          message: "Job description validation failed: " + validationError.message,
          jobDescription: convertMarkdownToHTML(rawJobDesc)
        });
        continue;
      }
      
      // Convert to HTML for storage/display
      const jobDescForDisplay = convertMarkdownToHTML(rawJobDesc);
      
      // Use clean text for analysis
      const jobDescForAnalysis = stripHTMLToText(rawJobDesc);

      let analysisResult = null;
      let hasError = false;

      console.log(`Analyzing with enhanced software engineering internship focus...`);

      // Use the comprehensive analyzeResumeMatch function with Gemini 2.5 Flash
      try {
        analysisResult = await analyzeResumeMatch(resumeText, jobDescForAnalysis);
        
        console.log(`Analysis completed - Score: ${analysisResult.similarityScore}, Match: ${analysisResult.matchPercentage}%`);
        
        // Enhanced non-tech role detection
        if (analysisResult.isNonTechRole || analysisResult.warning?.includes("Non-software")) {
          totalNonTechRoles++;
          console.log("Non-software engineering role confirmed by AI analysis");
        }
        
        // Check for analysis errors
        if (analysisResult.error) {
          hasError = true;
          console.error(`Analysis error for JD ${i + 1}:`, analysisResult.error);
        }
        
      } catch (e) {
        console.error(`Critical analysis error for JD ${i + 1}:`, e.message);
        hasError = true;
        
        // Enhanced fallback analysis
        try {
          const fallbackSimilarity = await getSimilarityScore(resumeText, jobDescForAnalysis);
          
          analysisResult = {
            similarityScore: fallbackSimilarity,
            matchPercentage: Math.round(fallbackSimilarity * 100),
            isNonTechRole: fallbackSimilarity === 0,
            strengths: ["Basic technical assessment completed"],
            contentWeaknesses: ["Unable to perform detailed content analysis - please try again"],
            structureWeaknesses: ["Unable to perform detailed structure analysis - please try again"],
            contentRecommendations: ["Ensure resume contains relevant software engineering experience and skills"],
            structureRecommendations: ["Use standard resume format with clear technical skills section"],
            timestamp: new Date().toISOString(),
            error: "Fallback analysis used due to processing error"
          };
          
          if (fallbackSimilarity === 0) {
            totalNonTechRoles++;
          }
          
        } catch (fallbackError) {
          console.error(`Fallback analysis failed for JD ${i + 1}:`, fallbackError.message);
          analysisResult = {
            similarityScore: 0,
            matchPercentage: 0,
            isNonTechRole: true,
            message: "Analysis failed - this may not be a software engineering internship role",
            strengths: ["Unable to analyze"],
            contentWeaknesses: ["Analysis failed - please verify job description is for software engineering internship"],
            structureWeaknesses: ["Analysis failed - please verify resume format and content"],
            contentRecommendations: ["Please ensure job description is for software engineering internship position"],
            structureRecommendations: ["Please verify resume is properly formatted and contains technical content"],
            timestamp: new Date().toISOString(),
            error: "Complete analysis failure"
          };
          totalNonTechRoles++;
        }
      }

      // Enhanced match percentage calculation for internships
      let matchPercentage = analysisResult.matchPercentage;
      const similarity = analysisResult.similarityScore;

      if (analysisResult.isNonTechRole || similarity === 0) {
        matchPercentage = 0;
      } else {
        // More granular scoring for internship positions
        if (similarity < 0.2) {
          matchPercentage = Math.round(similarity * 25); // 0-5%
        } else if (similarity < 0.4) {
          matchPercentage = Math.round(5 + (similarity - 0.2) * 50); // 5-15%
        } else if (similarity < 0.6) {
          matchPercentage = Math.round(15 + (similarity - 0.4) * 87.5); // 15-32%
        } else if (similarity < 0.8) {
          matchPercentage = Math.round(32 + (similarity - 0.6) * 140); // 32-60%
        } else if (similarity < 0.9) {
          matchPercentage = Math.round(60 + (similarity - 0.8) * 200); // 60-80%
        } else {
          matchPercentage = Math.round(80 + (similarity - 0.9) * 200); // 80-100%
        }
      }

      matchPercentage = Math.max(0, Math.min(100, matchPercentage));

      // Prepare the comprehensive result object
      const resultData = {
        matchPercentage,
        jobDescription: jobDescForDisplay,
        hasError,
        isNonTechRole: analysisResult.isNonTechRole || false,
        rawSimilarity: similarity,
        timestamp: analysisResult.timestamp
      };

      // Add enhanced structured analysis data
      if (analysisResult && !analysisResult.isNonTechRole) {
        resultData.strengths = analysisResult.strengths || [];
        resultData.contentWeaknesses = analysisResult.contentWeaknesses || [];
        resultData.structureWeaknesses = analysisResult.structureWeaknesses || [];
        resultData.contentRecommendations = analysisResult.contentRecommendations || [];
        resultData.structureRecommendations = analysisResult.structureRecommendations || [];
        
        // Add quality metrics
        resultData.analysisQuality = {
          strengthsCount: resultData.strengths.length,
          weaknessesCount: resultData.contentWeaknesses.length + resultData.structureWeaknesses.length,
          recommendationsCount: resultData.contentRecommendations.length + resultData.structureRecommendations.length,
          isComprehensive: (resultData.strengths.length >= 3 && 
                          resultData.contentRecommendations.length >= 5 && 
                          resultData.structureRecommendations.length >= 5)
        };
        
      } else if (analysisResult.isNonTechRole) {
        resultData.message = analysisResult.message || "This job description is not for a software engineering internship position.";
      }

      // Add error details if present
      if (analysisResult.error) {
        resultData.errorDetails = analysisResult.error;
      }

      analysis.push(resultData);
      console.log(`Completed processing JD ${i + 1} - Match: ${matchPercentage}%, NonTech: ${resultData.isNonTechRole}`);
    }

    console.log(`\n=== Analysis Summary ===`);
    console.log(`Total processed: ${totalProcessed}`);
    console.log(`Non-tech roles: ${totalNonTechRoles}`);
    console.log(`Software engineering roles: ${totalProcessed - totalNonTechRoles}`);

    // Enhanced database storage with better error handling - SAVE AS UNSAVED BY DEFAULT
    try {
      const existingAnalysis = await CVAnalysis.findOne({
        userId: req.user.id,
        resumeHash: resumeHash
      });

      const analysisData = {
        userId: req.user.id,
        resumeText: resumeText.substring(0, 15000), // Increased limit for better context
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
          message: a.message || null,
          hasError: a.hasError || false,
          timestamp: a.timestamp || new Date().toISOString(),
          analysisQuality: a.analysisQuality || null
        })),
        // Add extracted technologies to database storage
        extractedTechnologies: extractedTechnologies,
        // Always save as unsaved initially (isSaved: false)
        isSaved: false,
        analysisMetadata: {
          totalProcessed,
          nonTechRoleCount: totalNonTechRoles,
          softwareRoleCount: totalProcessed - totalNonTechRoles,
          avgMatchScore: analysis.filter(a => !a.isNonTechRole)
            .reduce((sum, a) => sum + a.matchPercentage, 0) / Math.max(1, totalProcessed - totalNonTechRoles),
          technologiesExtracted: extractedTechnologies.length,
          processingDate: new Date().toISOString(),
          geminiModel: "gemini-2.5-flash"
        }
      };

      if (existingAnalysis) {
        console.log("Updating existing CV analysis record with enhanced data");
        await CVAnalysis.findByIdAndUpdate(existingAnalysis._id, {
          ...analysisData,
          updatedAt: new Date()
        });
      } else {
        console.log("Creating new comprehensive CV analysis record");
        await CVAnalysis.create(analysisData);
      }
    } catch (saveError) {
      console.error("Enhanced database save/update error:", saveError);
      // Continue with response even if save fails
    }

    // Return comprehensive analysis results with extracted technologies
    const responseData = {
      analysis: analysis.map(a => ({
        matchPercentage: a.matchPercentage,
        isNonTechRole: a.isNonTechRole || false,
        strengths: a.strengths || [],
        contentWeaknesses: a.contentWeaknesses || [],
        structureWeaknesses: a.structureWeaknesses || [],
        contentRecommendations: a.contentRecommendations || [],
        structureRecommendations: a.structureRecommendations || [],
        message: a.message || null,
        hasError: a.hasError || false,
        timestamp: a.timestamp,
        analysisQuality: a.analysisQuality
      })),
      // Include required fields for SWOT analysis
      resumeText: resumeText, // Full resume text
      extractedTechnologies: extractedTechnologies, // Extracted technologies
      resumeHash: resumeHash, // Resume hash for SWOT
      metadata: {
        resumeAnalyzed: true,
        totalJobDescriptions: rawJobDescriptions.length,
        nonTechRoleCount: totalNonTechRoles,
        softwareEngineeringRoleCount: totalProcessed - totalNonTechRoles,
        avgMatchScore: analysis.filter(a => !a.isNonTechRole && a.matchPercentage > 0)
          .reduce((sum, a) => sum + a.matchPercentage, 0) / Math.max(1, analysis.filter(a => !a.isNonTechRole && a.matchPercentage > 0).length),
        technologiesExtracted: extractedTechnologies.length,
        isExistingResume: !!await CVAnalysis.findOne({
          userId: req.user.id,
          resumeHash: resumeHash
        }),
        processingTime: new Date().toISOString(),
        analysisVersion: "3.0-gemini-2.5-flash"
      },
      recommendations: {
        overallFeedback: totalNonTechRoles === totalProcessed 
          ? "All provided job descriptions appear to be for non-software engineering roles. Please provide software engineering internship job descriptions for accurate analysis."
          : totalNonTechRoles > 0 
            ? `${totalNonTechRoles} out of ${totalProcessed} job descriptions were identified as non-software engineering roles. Focus on software engineering internship positions for best results.`
            : "All job descriptions appear to be for software engineering roles. Analysis completed successfully.",
        nextSteps: totalNonTechRoles < totalProcessed 
          ? [
              "Review detailed recommendations for each software engineering role",
              "Prioritize implementing content recommendations (technical skills, projects)",
              "Apply structure recommendations for better ATS compatibility",
              "Consider generating a SWOT analysis for comprehensive career planning"
            ]
          : [
              "Please provide job descriptions specifically for software engineering internships",
              "Ensure job postings mention programming languages, development frameworks, or technical skills",
              "Look for internship positions at tech companies or software development roles"
            ]
      }
    };

    console.log("=== Enhanced Analysis Completed Successfully ===\n");

    res.json(responseData);

  } catch (err) {
    console.error("Critical error in enhanced analyzeResume:", err);
    res.status(500).json({ 
      message: "Failed to analyze resume for software engineering internships. Please try again with a valid PDF and detailed job descriptions.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      requirements: {
        resume: "Valid PDF with readable text content",
        jobDescriptions: "Detailed software engineering internship job postings",
        format: "Each job description should be at least 50 characters and contain technical requirements"
      }
    });
  }
};

// Get saved CV analyses with better formatting
export const getSavedAnalysis = async (req, res) => {
  try {
    console.log('🔍 Getting saved analyses for user:', req.user.id);
    
    const savedAnalyses = await CVAnalysis.find({
      userId: req.user.id,
      isSaved: true
    })
    .sort({ updatedAt: -1 })
    .limit(20)
    .select('-userId -resumeText'); // Exclude sensitive data

    console.log(`✅ Found ${savedAnalyses.length} saved analyses`);

    // Transform data to match expected format
    const formattedAnalyses = savedAnalyses.map(analysis => {
      const results = analysis.results || [];
      const softwareRoles = results.filter(r => !r.isNonTechRole);
      
      // Calculate average match percentage
      const avgMatch = softwareRoles.length > 0 
        ? Math.round(softwareRoles.reduce((sum, r) => sum + (r.matchPercentage || 0), 0) / softwareRoles.length)
        : 0;

      // Get the best matching job (highest percentage)
      const bestMatch = results.length > 0 
        ? results.reduce((best, current) => 
            (current.matchPercentage || 0) > (best.matchPercentage || 0) ? current : best, 
            { matchPercentage: 0, strengths: [], contentRecommendations: [], structureRecommendations: [] }
          )
        : { matchPercentage: 0, strengths: [], contentRecommendations: [], structureRecommendations: [] };

      // Extract job title and company from results or job descriptions
      let jobTitle = 'Software Engineering Position';
      let company = 'Company';
      
      // Try to get from first result
      if (results.length > 0 && results[0].jobTitle) {
        jobTitle = results[0].jobTitle;
      }
      if (results.length > 0 && results[0].company) {
        company = results[0].company;
      }
      
      // Fallback: try to extract from job descriptions
      if (analysis.jobDescriptions && analysis.jobDescriptions.length > 0) {
        const firstJobDesc = analysis.jobDescriptions[0];
        const titleMatch = firstJobDesc.match(/(?:position|role|title):\s*([^\n<]+)/i);
        const companyMatch = firstJobDesc.match(/(?:company|organization):\s*([^\n<]+)/i) || 
                           firstJobDesc.match(/<strong>([^<]+)<\/strong>/);
        
        if (titleMatch && !results[0]?.jobTitle) jobTitle = titleMatch[1].trim();
        if (companyMatch && !results[0]?.company) company = companyMatch[1].trim();
      }

      return {
        id: analysis._id,
        jobTitle,
        company,
        matchPercentage: avgMatch,
        totalJobs: results.length,
        softwareJobs: softwareRoles.length,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
        strengths: bestMatch.strengths || [],
        recommendations: [
          ...(bestMatch.contentRecommendations || []),
          ...(bestMatch.structureRecommendations || [])
        ].slice(0, 5), // Limit to 5 recommendations
        hasMultipleJobs: results.length > 1,
        // Additional fields
        summary: {
          totalRoles: results.length,
          softwareRoles: softwareRoles.length,
          nonTechRoles: results.filter(r => r.isNonTechRole).length,
          avgMatchScore: avgMatch,
          hasHighMatches: softwareRoles.some(r => (r.matchPercentage || 0) >= 70),
          recommendationCount: results.reduce((sum, r) => sum + (r.contentRecommendations?.length || 0) + (r.structureRecommendations?.length || 0), 0),
          isSaved: analysis.isSaved,
          extractedTechnologies: analysis.extractedTechnologies || [],
          technologiesCount: (analysis.extractedTechnologies || []).length,
          analysisVersion: analysis.analysisMetadata?.geminiModel || "legacy"
        }
      };
    });

    console.log('✅ Sending formatted analyses:', formattedAnalyses.length);

    res.json({
      success: true,
      data: formattedAnalyses,
      count: formattedAnalyses.length,
      metadata: {
        totalSoftwareAnalyses: formattedAnalyses.reduce((sum, a) => sum + a.summary.softwareRoles, 0),
        totalNonTechAnalyses: formattedAnalyses.reduce((sum, a) => sum + a.summary.nonTechRoles, 0),
        avgOverallMatch: formattedAnalyses.length > 0 
          ? Math.round(formattedAnalyses.reduce((sum, a) => sum + a.summary.avgMatchScore, 0) / formattedAnalyses.length)
          : 0,
        savedCount: formattedAnalyses.filter(a => a.summary.isSaved).length,
        unsavedCount: formattedAnalyses.filter(a => !a.summary.isSaved).length,
        totalTechnologies: formattedAnalyses.reduce((sum, a) => sum + a.summary.technologiesCount, 0),
        geminiAnalyses: formattedAnalyses.filter(a => a.summary.analysisVersion.includes("gemini")).length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching saved analyses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch saved CV analyses',
      error: error.message
    });
  }
};

// Enhanced save analysis - toggles isSaved field
export const saveAnalysis = async (req, res) => {
  try {
    console.log('🔍 Saving/Updating CV analysis...');
    
    let { resumeText, resumeHash, jobDescriptions, results, shouldSave = true } = req.body;
    
    // Handle both old and new API patterns
    if (!resumeHash && (resumeText || jobDescriptions || results)) {
      // Old pattern: saving new analysis with full data
      if (!resumeText || !jobDescriptions || !results) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields for saving analysis',
          required: ['resumeText', 'resumeHash', 'jobDescriptions', 'results']
        });
      }
      
      // Generate hash if not provided
      resumeHash = resumeHash || createResumeHash(resumeText);
    } else if (resumeHash && !resumeText && !jobDescriptions && !results) {
      // New pattern: toggling save status of existing analysis
      // (handled below)
    } else if (!resumeHash) {
      return res.status(400).json({ 
        success: false,
        message: "Resume hash is required to save/unsave analysis.",
        required: ["resumeHash"]
      });
    }

    // Find the analysis by user and resume hash
    let analysis = await CVAnalysis.findOne({
      userId: req.user.id,
      resumeHash: resumeHash
    });

    if (analysis) {
      // Update existing analysis
      if (jobDescriptions && results) {
        // Old pattern: update with new data
        analysis.jobDescriptions = jobDescriptions;
        analysis.results = results;
        if (resumeText) {
          analysis.resumeText = resumeText.substring(0, 15000);
        }
      }
      analysis.isSaved = shouldSave;
      analysis.updatedAt = new Date();
      
      await analysis.save();
      console.log(`${shouldSave ? 'Saved' : 'Updated'} existing analysis ${analysis._id}`);
    } else if (resumeText && jobDescriptions && results) {
      // Create new analysis (old pattern)
      analysis = new CVAnalysis({
        userId: req.user.id,
        resumeText: resumeText.substring(0, 15000),
        resumeHash,
        jobDescriptions,
        results,
        isSaved: shouldSave,
        analysisMetadata: {
          geminiModel: "gemini-2.5-flash",
          processingDate: new Date().toISOString()
        }
      });
      
      await analysis.save();
      console.log('✅ New analysis created and saved successfully');
    } else {
      return res.status(404).json({ 
        success: false,
        message: "CV analysis not found. Please analyze your resume first.",
        resumeHash: resumeHash
      });
    }

    // Validate results for response
    const validatedResults = (analysis.results || []).map((result, index) => {
      return {
        matchPercentage: typeof result.matchPercentage === 'number' ? Math.max(0, Math.min(100, result.matchPercentage)) : 0,
        isNonTechRole: typeof result.isNonTechRole === 'boolean' ? result.isNonTechRole : false,
        strengths: Array.isArray(result.strengths) ? result.strengths : [],
        contentWeaknesses: Array.isArray(result.contentWeaknesses) ? result.contentWeaknesses : [],
        structureWeaknesses: Array.isArray(result.structureWeaknesses) ? result.structureWeaknesses : [],
        contentRecommendations: Array.isArray(result.contentRecommendations) ? result.contentRecommendations : [],
        structureRecommendations: Array.isArray(result.structureRecommendations) ? result.structureRecommendations : [],
        message: typeof result.message === 'string' ? result.message : null,
        hasError: typeof result.hasError === 'boolean' ? result.hasError : false,
        timestamp: result.timestamp || new Date().toISOString(),
        analysisQuality: result.analysisQuality || null
      };
    });

    res.json({
      success: true,
      message: shouldSave 
        ? "CV analysis saved successfully." 
        : "CV analysis unsaved successfully.",
      saved: shouldSave,
      data: {
        id: analysis._id,
        isSaved: analysis.isSaved
      },
      analysis: {
        id: analysis._id,
        resumeText: analysis.resumeText,
        isSaved: analysis.isSaved,
        analysisCount: validatedResults.length,
        updatedAt: analysis.updatedAt,
        extractedTechnologies: analysis.extractedTechnologies || [],
        technologiesCount: (analysis.extractedTechnologies || []).length,
        analysisVersion: analysis.analysisMetadata?.geminiModel || "legacy"
      },
      stats: {
        totalAnalyses: validatedResults.length,
        softwareRoles: validatedResults.filter(r => !r.isNonTechRole).length,
        nonTechRoles: validatedResults.filter(r => r.isNonTechRole).length,
        avgMatchScore: validatedResults.filter(r => !r.isNonTechRole && r.matchPercentage > 0)
          .reduce((sum, r) => sum + r.matchPercentage, 0) / Math.max(1, validatedResults.filter(r => !r.isNonTechRole && r.matchPercentage > 0).length) || 0,
        technologiesExtracted: (analysis.extractedTechnologies || []).length
      }
    });

  } catch (error) {
    console.error('❌ Error saving analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save analysis',
      error: error.message
    });
  }
};

// Delete specific CV analysis
export const deleteAnalysis = async (req, res) => {
  try {
    console.log('🔍 Deleting analysis:', req.params.id);
    
    const { id } = req.params;

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid analysis ID format.",
        received: id
      });
    }

    const deleted = await CVAnalysis.findOneAndDelete({
      _id: id,
      userId: req.user.id
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'CV analysis not found'
      });
    }

    console.log('✅ Analysis deleted successfully');

    res.json({
      success: true,
      message: 'CV analysis deleted successfully',
              deletedAnalysis: {
        id: deleted._id,
        resumeText: deleted.resumeText,
        analysisCount: deleted.results?.length || 0,
        wasSaved: deleted.isSaved,
        technologiesCount: (deleted.extractedTechnologies || []).length,
        deletedAt: new Date().toISOString(),
        analysisVersion: deleted.analysisMetadata?.geminiModel || "legacy"
      }
    });

  } catch (error) {
    console.error('❌ Error deleting CV analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete CV analysis',
      error: error.message
    });
  }
};

// NEW: Get all analyses (saved and unsaved) for user dashboard
export const getAllAnalyses = async (req, res) => {
  try {
    console.log('🔍 Getting all analyses for user:', req.user.id);
    
    const { page = 1, limit = 10, includeUnsaved = true } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = { userId: req.user.id };
    if (!includeUnsaved) {
      filter.isSaved = true;
    }

    const [analyses, total] = await Promise.all([
      CVAnalysis.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-userId -resumeText'),
      CVAnalysis.countDocuments(filter)
    ]);

    console.log(`✅ Found ${analyses.length} analyses (${total} total)`);

    const formattedAnalyses = analyses.map(analysis => {
      const results = analysis.results || [];
      const softwareRoles = results.filter(r => !r.isNonTechRole);
      const avgMatch = softwareRoles.length > 0 
        ? Math.round(softwareRoles.reduce((sum, r) => sum + (r.matchPercentage || 0), 0) / softwareRoles.length)
        : 0;

      return {
        id: analysis._id,
        isSaved: analysis.isSaved,
        matchPercentage: avgMatch,
        totalJobs: results.length,
        softwareJobs: softwareRoles.length,
        nonTechJobs: results.filter(r => r.isNonTechRole).length,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
        extractedTechnologies: (analysis.extractedTechnologies || []).slice(0, 10), // Limit for performance
        technologiesCount: (analysis.extractedTechnologies || []).length,
        analysisVersion: analysis.analysisMetadata?.geminiModel || "legacy",
        hasHighMatches: softwareRoles.some(r => (r.matchPercentage || 0) >= 70),
        summary: {
          topMatch: Math.max(...softwareRoles.map(r => r.matchPercentage || 0), 0),
          avgMatch: avgMatch,
          hasErrors: results.some(r => r.hasError),
          isComprehensive: results.some(r => r.analysisQuality?.isComprehensive)
        }
      };
    });

    res.json({
      success: true,
      data: formattedAnalyses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
        hasNext: skip + analyses.length < total,
        hasPrev: page > 1
      },
      metadata: {
        savedCount: analyses.filter(a => a.isSaved).length,
        unsavedCount: analyses.filter(a => !a.isSaved).length,
        geminiAnalyses: analyses.filter(a => a.analysisMetadata?.geminiModel?.includes("gemini")).length,
        totalTechnologies: analyses.reduce((sum, a) => sum + (a.extractedTechnologies || []).length, 0),
        avgOverallMatch: formattedAnalyses.length > 0 
          ? Math.round(formattedAnalyses.reduce((sum, a) => sum + a.summary.avgMatch, 0) / formattedAnalyses.length)
          : 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching all analyses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch CV analyses',
      error: error.message
    });
  }
};

// NEW: Get specific analysis by ID with full details
export const getAnalysisById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid analysis ID format."
      });
    }

    const analysis = await CVAnalysis.findOne({
      _id: id,
      userId: req.user.id
    }).select('-userId');

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: 'CV analysis not found'
      });
    }

    const results = analysis.results || [];
    const softwareRoles = results.filter(r => !r.isNonTechRole);

    const responseData = {
      success: true,
      data: {
        id: analysis._id,
        resumeText: analysis.resumeText,
        resumeHash: analysis.resumeHash,
        isSaved: analysis.isSaved,
        jobDescriptions: analysis.jobDescriptions || [],
        results: results,
        extractedTechnologies: analysis.extractedTechnologies || [],
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
        analysisMetadata: analysis.analysisMetadata || {},
        summary: {
          totalJobs: results.length,
          softwareJobs: softwareRoles.length,
          nonTechJobs: results.filter(r => r.isNonTechRole).length,
          avgMatchScore: softwareRoles.length > 0 
            ? Math.round(softwareRoles.reduce((sum, r) => sum + (r.matchPercentage || 0), 0) / softwareRoles.length)
            : 0,
          topMatchScore: Math.max(...softwareRoles.map(r => r.matchPercentage || 0), 0),
          technologiesCount: (analysis.extractedTechnologies || []).length,
          hasErrors: results.some(r => r.hasError),
          isComprehensive: results.some(r => r.analysisQuality?.isComprehensive),
          analysisVersion: analysis.analysisMetadata?.geminiModel || "legacy"
        }
      }
    };

    res.json(responseData);

  } catch (error) {
    console.error('❌ Error fetching analysis by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch CV analysis',
      error: error.message
    });
  }
};

// NEW: Get technology statistics across all user's analyses
export const getTechnologyStats = async (req, res) => {
  try {
    console.log('🔍 Getting technology stats for user:', req.user.id);

    const analyses = await CVAnalysis.find({
      userId: req.user.id,
      extractedTechnologies: { $exists: true, $ne: [] }
    }).select('extractedTechnologies analysisMetadata');

    if (analyses.length === 0) {
      return res.json({
        success: true,
        data: {
          totalAnalyses: 0,
          uniqueTechnologies: 0,
          technologies: [],
          categories: [],
          recommendations: []
        }
      });
    }

    // Aggregate all technologies
    const allTechnologies = analyses.flatMap(a => a.extractedTechnologies || []);
    
    // Count technology frequency and calculate average confidence
    const techMap = new Map();
    allTechnologies.forEach(tech => {
      if (techMap.has(tech.name)) {
        const existing = techMap.get(tech.name);
        existing.count++;
        existing.totalConfidence += tech.confidenceLevel || 5;
        existing.avgConfidence = existing.totalConfidence / existing.count;
      } else {
        techMap.set(tech.name, {
          name: tech.name,
          category: tech.category,
          count: 1,
          totalConfidence: tech.confidenceLevel || 5,
          avgConfidence: tech.confidenceLevel || 5
        });
      }
    });

    const technologies = Array.from(techMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 50); // Top 50 technologies

    // Group by categories
    const categories = technologies.reduce((acc, tech) => {
      const category = tech.category || 'Other';
      if (!acc[category]) {
        acc[category] = {
          name: category,
          count: 0,
          technologies: []
        };
      }
      acc[category].count++;
      acc[category].technologies.push(tech);
      return acc;
    }, {});

    // Generate recommendations based on missing common technologies
    const commonTech = ['JavaScript', 'Python', 'Java', 'React', 'Node.js', 'Git', 'SQL', 'HTML', 'CSS'];
    const userTech = new Set(technologies.map(t => t.name.toLowerCase()));
    const recommendations = commonTech
      .filter(tech => !userTech.has(tech.toLowerCase()))
      .map(tech => `Consider learning ${tech} - commonly required for software engineering roles`);

    res.json({
      success: true,
      data: {
        totalAnalyses: analyses.length,
        uniqueTechnologies: technologies.length,
        technologies: technologies,
        categories: Object.values(categories),
        topTechnologies: technologies.slice(0, 10),
        recommendations: recommendations.slice(0, 5),
        stats: {
          avgConfidenceLevel: Math.round(
            technologies.reduce((sum, t) => sum + t.avgConfidence, 0) / Math.max(technologies.length, 1)
          ),
          mostFrequentCategory: Object.values(categories)
            .sort((a, b) => b.count - a.count)[0]?.name || 'None',
          geminiAnalyses: analyses.filter(a => a.analysisMetadata?.geminiModel?.includes('gemini')).length
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting technology stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch technology statistics',
      error: error.message
    });
  }
};
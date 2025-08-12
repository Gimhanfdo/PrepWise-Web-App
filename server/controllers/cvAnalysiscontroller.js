import pdfParse from "pdf-parse";
import crypto from 'crypto';
import {
  getSimilarityScore,
  getImprovementSuggestions,
  getStructuredRecommendations,
  analyzeResumeMatch,
  extractTechnologiesFromResume,
  createResumeHash
} from "../utils/CVAnalysisAPI.js";
import CVAnalysis from "../models/CVAnalysisModel.js";
import userModel from '../models/userModel.js';

function convertMarkdownToHTML(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

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

function validateResumeContent(resumeText) {
  const text = resumeText.toLowerCase();
  const minLength = 100;
  
  if (resumeText.length < minLength) {
    throw new Error("Resume content too short. Please ensure the PDF contains readable text.");
  }

  const hasBasicSections = [
    'education', 'experience', 'skills', 'projects', 'contact'
  ].some(section => text.includes(section));

  if (!hasBasicSections) {
    console.warn("Resume may be missing standard sections");
  }

  return true;
}

function validateJobDescription(jobDesc) {
  const text = jobDesc.toLowerCase();
  const minLength = 50;
  
  if (jobDesc.length < minLength) {
    throw new Error("Job description too short. Please provide a detailed job posting.");
  }

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

async function performCVAnalysis(cvText, jobDescriptions) {
  const analysis = [];
  let totalNonTechRoles = 0;
  let totalProcessed = 0;

  for (let i = 0; i < jobDescriptions.length; i++) {
    const rawJobDesc = jobDescriptions[i];
    totalProcessed++;
    
    try {
      const validation = validateJobDescription(rawJobDesc);
      
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
    
    const jobDescForDisplay = convertMarkdownToHTML(rawJobDesc);
    const jobDescForAnalysis = stripHTMLToText(rawJobDesc);

    let analysisResult = null;
    let hasError = false;

    try {
      analysisResult = await analyzeResumeMatch(cvText, jobDescForAnalysis);
      
      if (analysisResult.isNonTechRole || analysisResult.warning?.includes("Non-software")) {
        totalNonTechRoles++;
      }
      
      if (analysisResult.error) {
        hasError = true;
        console.error(`Analysis error for JD ${i + 1}:`, analysisResult.error);
      }
      
    } catch (e) {
      console.error(`Critical analysis error for JD ${i + 1}:`, e.message);
      hasError = true;
      
      try {
        const fallbackSimilarity = await getSimilarityScore(cvText, jobDescForAnalysis);
        
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

    let matchPercentage = analysisResult.matchPercentage;
    const similarity = analysisResult.similarityScore;

    if (analysisResult.isNonTechRole || similarity === 0) {
      matchPercentage = 0;
    } else {
      if (similarity < 0.2) {
        matchPercentage = Math.round(similarity * 25);
      } else if (similarity < 0.4) {
        matchPercentage = Math.round(5 + (similarity - 0.2) * 50);
      } else if (similarity < 0.6) {
        matchPercentage = Math.round(15 + (similarity - 0.4) * 87.5);
      } else if (similarity < 0.8) {
        matchPercentage = Math.round(32 + (similarity - 0.6) * 140);
      } else if (similarity < 0.9) {
        matchPercentage = Math.round(60 + (similarity - 0.8) * 200);
      } else {
        matchPercentage = Math.round(80 + (similarity - 0.9) * 200);
      }
    }

    matchPercentage = Math.max(0, Math.min(100, matchPercentage));

    const resultData = {
      matchPercentage,
      jobDescription: jobDescForDisplay,
      hasError,
      isNonTechRole: analysisResult.isNonTechRole || false,
      rawSimilarity: similarity,
      timestamp: analysisResult.timestamp
    };

    if (analysisResult && !analysisResult.isNonTechRole) {
      resultData.strengths = analysisResult.strengths || [];
      resultData.contentWeaknesses = analysisResult.contentWeaknesses || [];
      resultData.structureWeaknesses = analysisResult.structureWeaknesses || [];
      resultData.contentRecommendations = analysisResult.contentRecommendations || [];
      resultData.structureRecommendations = analysisResult.structureRecommendations || [];
      
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

    if (analysisResult.error) {
      resultData.errorDetails = analysisResult.error;
    }

    analysis.push(resultData);
  }

  return analysis;
}

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

    let resumeText;
    try {
      const pdfData = await pdfParse(resumeFile.buffer);
      resumeText = pdfData.text;
      
      if (!resumeText || resumeText.trim().length < 50) {
        throw new Error("Resume text extraction failed or content too short");
      }

      validateResumeContent(resumeText);
      console.log("Resume validation successful, length:", resumeText.length);

    } catch (parseError) {
      console.error("PDF parsing error:", parseError);
      return res.status(400).json({ 
        message: "Failed to extract text from PDF. Please ensure the file is a valid PDF with readable text.",
        details: "The PDF may be scanned/image-based, corrupted, or password-protected."
      });
    }

    console.log("Extracting technologies from resume...");
    const extractedTechnologies = await extractTechnologiesFromResume(resumeText);
    console.log(`Extracted ${extractedTechnologies.length} technologies:`, extractedTechnologies.map(t => t.name));

    const resumeHash = createResumeHash(resumeText);

    const analysis = [];
    let totalNonTechRoles = 0;
    let totalProcessed = 0;

    for (let i = 0; i < rawJobDescriptions.length; i++) {
      const rawJobDesc = rawJobDescriptions[i];
      totalProcessed++;
      
      console.log(`\n--- Processing Job Description ${i + 1}/${rawJobDescriptions.length} ---`);
      
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
      
      const jobDescForDisplay = convertMarkdownToHTML(rawJobDesc);
      const jobDescForAnalysis = stripHTMLToText(rawJobDesc);

      let analysisResult = null;
      let hasError = false;

      console.log(`Analyzing with enhanced software engineering internship focus...`);

      try {
        analysisResult = await analyzeResumeMatch(resumeText, jobDescForAnalysis);
        
        console.log(`Analysis completed - Score: ${analysisResult.similarityScore}, Match: ${analysisResult.matchPercentage}%`);
        
        if (analysisResult.isNonTechRole || analysisResult.warning?.includes("Non-software")) {
          totalNonTechRoles++;
          console.log("Non-software engineering role confirmed by AI analysis");
        }
        
        if (analysisResult.error) {
          hasError = true;
          console.error(`Analysis error for JD ${i + 1}:`, analysisResult.error);
        }
        
      } catch (e) {
        console.error(`Critical analysis error for JD ${i + 1}:`, e.message);
        hasError = true;
        
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

      let matchPercentage = analysisResult.matchPercentage;
      const similarity = analysisResult.similarityScore;

      if (analysisResult.isNonTechRole || similarity === 0) {
        matchPercentage = 0;
      } else {
        if (similarity < 0.2) {
          matchPercentage = Math.round(similarity * 25);
        } else if (similarity < 0.4) {
          matchPercentage = Math.round(5 + (similarity - 0.2) * 50);
        } else if (similarity < 0.6) {
          matchPercentage = Math.round(15 + (similarity - 0.4) * 87.5);
        } else if (similarity < 0.8) {
          matchPercentage = Math.round(32 + (similarity - 0.6) * 140);
        } else if (similarity < 0.9) {
          matchPercentage = Math.round(60 + (similarity - 0.8) * 200);
        } else {
          matchPercentage = Math.round(80 + (similarity - 0.9) * 200);
        }
      }

      matchPercentage = Math.max(0, Math.min(100, matchPercentage));

      const resultData = {
        matchPercentage,
        jobDescription: jobDescForDisplay,
        hasError,
        isNonTechRole: analysisResult.isNonTechRole || false,
        rawSimilarity: similarity,
        timestamp: analysisResult.timestamp
      };

      if (analysisResult && !analysisResult.isNonTechRole) {
        resultData.strengths = analysisResult.strengths || [];
        resultData.contentWeaknesses = analysisResult.contentWeaknesses || [];
        resultData.structureWeaknesses = analysisResult.structureWeaknesses || [];
        resultData.contentRecommendations = analysisResult.contentRecommendations || [];
        resultData.structureRecommendations = analysisResult.structureRecommendations || [];
        
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

    try {
      const existingAnalysis = await CVAnalysis.findOne({
        userId: req.user.id,
        resumeHash: resumeHash
      });

      const analysisData = {
        userId: req.user.id,
        resumeText: resumeText.substring(0, 15000),
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
        extractedTechnologies: extractedTechnologies,
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
    }

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
      resumeText: resumeText,
      extractedTechnologies: extractedTechnologies,
      resumeHash: resumeHash,
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

export const analyzeWithProfileCV = async (req, res) => {
  try {
    const { jobDescriptions } = req.body;
    
    if (!jobDescriptions || !Array.isArray(jobDescriptions) || jobDescriptions.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Job descriptions are required' 
      });
    }
    
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    if (!user.hasCV) {
      return res.status(400).json({ 
        success: false, 
        message: 'No CV uploaded in profile. Please upload your CV first.' 
      });
    }
    
    const cvText = user.getCVText();
    const cvHash = user.getCVHash();
    
    if (!cvText || !cvHash) {
      return res.status(400).json({ 
        success: false, 
        message: 'CV data is corrupted. Please re-upload your CV.' 
      });
    }
    
    const jobDescString = jobDescriptions.join('|||');
    const combinedHash = crypto.createHash('sha256')
      .update(cvHash + jobDescString)
      .digest('hex');
    
    let existingAnalysis = await CVAnalysis.findUserAnalysis(req.user.id, combinedHash);
    
    if (existingAnalysis) {
      return res.json({
        success: true,
        message: 'Analysis retrieved from cache',
        data: {
          analysisId: existingAnalysis._id,
          results: existingAnalysis.results,
          cached: true,
          usedProfileCV: true
        }
      });
    }
    
    const analysisResults = await performCVAnalysis(cvText, jobDescriptions);
    
    const newAnalysis = new CVAnalysis({
      userId: req.user.id,
      resumeText: '',
      resumeHash: combinedHash,
      usedProfileCV: true,
      jobDescriptions,
      results: analysisResults,
      isSaved: true
    });
    
    newAnalysis.setResumeFromProfile(cvText, cvHash);
    await newAnalysis.save();
    
    res.json({
      success: true,
      message: 'CV analysis completed using profile CV',
      data: {
        analysisId: newAnalysis._id,
        results: analysisResults,
        cached: false,
        usedProfileCV: true
      }
    });
    
  } catch (error) {
    console.error('Profile CV analysis error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to analyze CV from profile' 
    });
  }
};

export const getSavedAnalysis = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('🔍 Fetching saved analyses for user:', userId);

    const analyses = await CVAnalysis.findSavedByUser(userId, 50)
      .populate('userId', 'name email')
      .lean();

    console.log(`📊 Found ${analyses.length} saved analyses`);

    if (analyses.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No saved analyses found',
        data: []
      });
    }

    const transformedAnalyses = analyses.map(analysis => {
      console.log(`📊 Processing analysis ID: ${analysis._id}, Results: ${analysis.results?.length || 0}`);

      const results = analysis.results || [];
      const softwareRoles = results.filter(r => !r.isNonTechRole);

      const avgMatch = softwareRoles.length > 0 
        ? Math.round(softwareRoles.reduce((sum, r) => sum + (r.matchPercentage || 0), 0) / softwareRoles.length)
        : 0;

      const bestMatch = softwareRoles.length > 0 
        ? softwareRoles.reduce((best, current) => 
            (current.matchPercentage || 0) > (best.matchPercentage || 0) ? current : best
          ) 
        : { matchPercentage: 0, jobTitle: 'Position', company: 'Company' };

      return {
        _id: analysis._id,
        userId: analysis.userId,
        resumeHash: analysis.resumeHash,
        jobDescriptions: analysis.jobDescriptions || [],
        results: results,
        isSaved: analysis.isSaved,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
        
        jobTitle: bestMatch.jobTitle || 'Software Engineering Position',
        company: bestMatch.company || 'Company',
        matchPercentage: avgMatch,
        totalJobs: results.length,
        softwareJobs: softwareRoles.length,
        
        strengths: bestMatch.strengths || [],
        contentRecommendations: bestMatch.contentRecommendations || [],
        structureRecommendations: bestMatch.structureRecommendations || [],
        recommendations: [
          ...(bestMatch.contentRecommendations || []),
          ...(bestMatch.structureRecommendations || [])
        ],
        
        isRecent: analysis.isRecent,
        averageMatch: avgMatch,
        bestMatch: bestMatch
      };
    });

    console.log(`📊 Transformed ${transformedAnalyses.length} analyses successfully`);

    res.status(200).json({
      success: true,
      message: `Found ${analyses.length} saved analyses`,
      data: transformedAnalyses,
      count: transformedAnalyses.length
    });

  } catch (error) {
    console.error('❌ Error fetching saved analyses:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch saved analyses',
      error: error.message
    });
  }
};

export const saveAnalysis = async (req, res) => {
  try {
    console.log('🔍 Saving/Updating CV analysis...');
    
    let { resumeText, resumeHash, jobDescriptions, results, shouldSave = true } = req.body;
    
    if (!resumeHash && (resumeText || jobDescriptions || results)) {
      if (!resumeText || !jobDescriptions || !results) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields for saving analysis',
          required: ['resumeText', 'resumeHash', 'jobDescriptions', 'results']
        });
      }
      
      resumeHash = resumeHash || createResumeHash(resumeText);
    } else if (resumeHash && !resumeText && !jobDescriptions && !results) {
      
    } else if (!resumeHash) {
      return res.status(400).json({ 
        success: false,
        message: "Resume hash is required to save/unsave analysis.",
        required: ["resumeHash"]
      });
    }

    let analysis = await CVAnalysis.findOne({
      userId: req.user.id,
      resumeHash: resumeHash
    });

    if (analysis) {
      if (jobDescriptions && results) {
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

export const deleteAnalysis = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🗑️ Deleting analysis: ${id} for user: ${userId}`);

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid analysis ID format.",
        received: id
      });
    }

    const analysis = await CVAnalysis.findOneAndDelete({
      _id: id,
      userId: userId
    });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: 'Analysis not found or you do not have permission to delete it'
      });
    }

    console.log(`✅ Successfully deleted analysis: ${id}`);

    res.status(200).json({
      success: true,
      message: 'Analysis deleted successfully',
      deletedId: id,
      deletedAnalysis: {
        id: analysis._id,
        resumeText: analysis.resumeText,
        analysisCount: analysis.results?.length || 0,
        wasSaved: analysis.isSaved,
        technologiesCount: (analysis.extractedTechnologies || []).length,
        deletedAt: new Date().toISOString(),
        analysisVersion: analysis.analysisMetadata?.geminiModel || "legacy"
      }
    });

  } catch (error) {
    console.error('❌ Error deleting analysis:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete analysis',
      error: error.message
    });
  }
};

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
        extractedTechnologies: (analysis.extractedTechnologies || []).slice(0, 10),
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

    const allTechnologies = analyses.flatMap(a => a.extractedTechnologies || []);
    
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
      .slice(0, 50);

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
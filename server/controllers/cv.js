import pdfParse from 'pdf-parse';
import crypto from 'crypto';
import CVAnalysis from '../models/CVAnalysisModel.js';
import userModel from '../models/userModel.js';

// Helper function to generate resume hash
const generateResumeHash = (resumeText, userId) => {
  const timestamp = new Date().toISOString().split('T')[0];
  const combined = `${resumeText.substring(0, 1000)}${userId}${timestamp}`;
  return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
};

// Helper function to extract text from PDF buffer
const extractTextFromPDF = async (buffer) => {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to extract text from PDF file');
  }
};

// Mock AI analysis function - replace with your actual AI service
const analyzeResumeWithAI = async (resumeText, jobDescriptions) => {
  console.log('=== AI ANALYSIS DEBUG ===');
  console.log('Resume text length:', resumeText.length);
  console.log('Number of job descriptions:', jobDescriptions.length);

  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Extract technologies from resume text
  const commonTechnologies = [
    'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'HTML', 'CSS', 
    'SQL', 'MongoDB', 'Express', 'Git', 'Docker', 'AWS', 'TypeScript',
    'Angular', 'Vue.js', 'Spring Boot', 'Django', 'Flask', 'PostgreSQL',
    'Redis', 'Kubernetes', 'Jenkins', 'Linux', 'REST API', 'GraphQL'
  ];

  const extractedTechnologies = commonTechnologies
    .filter(tech => {
      const regex = new RegExp(`\\b${tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(resumeText);
    })
    .map(tech => ({
      name: tech,
      category: getCategoryForTechnology(tech),
      confidenceLevel: Math.floor(Math.random() * 5) + 5 // Random confidence 5-9
    }));

  // Analyze each job description
  const analysisResults = jobDescriptions.map((jobDesc, index) => {
    // Simple keyword matching for demonstration
    const jobTechnologies = commonTechnologies.filter(tech => {
      const regex = new RegExp(`\\b${tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(jobDesc);
    });

    const matchedTechnologies = extractedTechnologies
      .map(tech => tech.name)
      .filter(tech => jobTechnologies.includes(tech));

    const matchPercentage = jobTechnologies.length > 0 
      ? Math.round((matchedTechnologies.length / jobTechnologies.length) * 100)
      : 0;

    // Check if it's a non-tech role
    const isNonTechRole = !jobTechnologies.length && 
      !/software|developer|engineer|programmer|technical/i.test(jobDesc);

    if (isNonTechRole) {
      return {
        matchPercentage: 0,
        isNonTechRole: true,
        message: 'This appears to be a non-technical role. Our system is optimized for software engineering positions.',
        strengths: [],
        contentWeaknesses: [],
        structureWeaknesses: [],
        contentRecommendations: [],
        structureRecommendations: [],
        skillsMatched: [],
        skillsMissing: []
      };
    }

    return {
      matchPercentage,
      isNonTechRole: false,
      strengths: generateStrengths(matchedTechnologies),
      contentWeaknesses: generateContentWeaknesses(),
      structureWeaknesses: generateStructureWeaknesses(),
      contentRecommendations: generateContentRecommendations(),
      structureRecommendations: generateStructureRecommendations(),
      skillsMatched: matchedTechnologies,
      skillsMissing: jobTechnologies.filter(tech => !matchedTechnologies.includes(tech))
    };
  });

  return {
    analysis: analysisResults,
    extractedTechnologies
  };
};

// Helper functions for mock AI analysis
const getCategoryForTechnology = (tech) => {
  const categories = {
    'JavaScript': 'Frontend',
    'TypeScript': 'Frontend',
    'React': 'Frontend',
    'Angular': 'Frontend',
    'Vue.js': 'Frontend',
    'HTML': 'Frontend',
    'CSS': 'Frontend',
    'Python': 'Backend',
    'Java': 'Backend',
    'Node.js': 'Backend',
    'Express': 'Backend',
    'Spring Boot': 'Backend',
    'Django': 'Backend',
    'Flask': 'Backend',
    'SQL': 'Database',
    'MongoDB': 'Database',
    'PostgreSQL': 'Database',
    'Redis': 'Database',
    'AWS': 'Cloud',
    'Docker': 'DevOps',
    'Kubernetes': 'DevOps',
    'Jenkins': 'DevOps',
    'Git': 'Tools',
    'Linux': 'Tools',
    'REST API': 'API',
    'GraphQL': 'API'
  };
  return categories[tech] || 'General';
};

const generateStrengths = (matchedTech) => [
  `Strong technical foundation with ${matchedTech.length} relevant technologies`,
  'Well-structured resume with clear technical skills section',
  'Relevant experience aligns with job requirements',
  'Good balance of technical and soft skills demonstrated'
];

const generateContentWeaknesses = () => [
  'Consider adding more quantifiable achievements',
  'Project descriptions could include more technical details',
  'Missing some industry-standard keywords'
];

const generateStructureWeaknesses = () => [
  'Resume could benefit from better formatting',
  'Consider reorganizing sections for better flow',
  'Some sections appear too lengthy'
];

const generateContentRecommendations = () => [
  'Add metrics and numbers to quantify your impact',
  'Include relevant certifications if available',
  'Mention specific project outcomes and results'
];

const generateStructureRecommendations = () => [
  'Use bullet points for better readability',
  'Ensure consistent formatting throughout',
  'Keep resume to 1-2 pages maximum'
];

// POST /api/analyze/analyze-resume - Main analysis endpoint
export const analyzeResume = async (req, res) => {
  try {
    console.log('=== ANALYZE RESUME DEBUG ===');
    console.log('User ID:', req.user?.id || 'Not found');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Has file:', !!req.file);
    console.log('useProfileCV:', req.body.useProfileCV);

    // Parse job descriptions
    let jobDescriptions;
    try {
      jobDescriptions = JSON.parse(req.body.jobDescriptions || '[]');
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job descriptions format'
      });
    }

    if (!Array.isArray(jobDescriptions) || jobDescriptions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one job description is required'
      });
    }

    // Clean up job descriptions
    jobDescriptions = jobDescriptions
      .map(desc => desc.trim())
      .filter(desc => desc.length >= 50);

    if (jobDescriptions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Job descriptions must be at least 50 characters long'
      });
    }

    let resumeText = '';
    let resumeHash = '';
    let usedProfileCV = false;

    // Determine CV source
    if (req.body.useProfileCV === 'true') {
      console.log('Using profile CV');
      usedProfileCV = true;

      // Get CV from user profile
      const user = await userModel.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.currentCV || !user.currentCV.text || user.currentCV.text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No CV found in your profile. Please upload a CV first.'
        });
      }

      resumeText = user.currentCV.text;
      resumeHash = user.currentCV.hash || generateResumeHash(resumeText, req.user.id);
      
      console.log('Profile CV loaded, text length:', resumeText.length);
    } else {
      console.log('Using uploaded file');
      
      // Use uploaded file
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No resume file uploaded'
        });
      }

      // Validate file
      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({
          success: false,
          message: 'Only PDF files are allowed'
        });
      }

      if (req.file.size > 10 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'File size must be less than 10MB'
        });
      }

      // Extract text from uploaded PDF
      try {
        resumeText = await extractTextFromPDF(req.file.buffer);
        resumeHash = generateResumeHash(resumeText, req.user.id);
        
        console.log('File CV loaded, text length:', resumeText.length);
      } catch (extractError) {
        console.error('Text extraction error:', extractError);
        return res.status(400).json({
          success: false,
          message: 'Failed to extract text from PDF. Please ensure the file is readable and not password-protected.'
        });
      }
    }

    // Validate extracted text
    if (!resumeText || resumeText.trim().length < 100) {
      return res.status(400).json({
        success: false,
        message: 'Resume content is too short or empty. Please ensure your resume contains sufficient text.'
      });
    }

    console.log('Final resume text length:', resumeText.length);
    console.log('Final resume hash:', resumeHash);

    // Perform AI analysis
    let analysisResult;
    try {
      analysisResult = await analyzeResumeWithAI(resumeText, jobDescriptions);
      console.log('AI analysis completed, results:', analysisResult.analysis.length);
    } catch (aiError) {
      console.error('AI analysis error:', aiError);
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze resume content. Please try again.'
      });
    }

    // Check if user already has an analysis for this resume
    let existingAnalysis = await CVAnalysis.findOne({
      userId: req.user.id,
      resumeHash: resumeHash
    });

    if (existingAnalysis) {
      // Update existing analysis
      existingAnalysis.jobDescriptions = jobDescriptions;
      existingAnalysis.results = analysisResult.analysis;
      existingAnalysis.usedProfileCV = usedProfileCV;
      
      // Only update resume text if it's not already stored
      if (!existingAnalysis.resumeText || existingAnalysis.resumeText.trim().length === 0) {
        existingAnalysis.resumeText = resumeText;
      }
      
      await existingAnalysis.save();
      console.log('Updated existing analysis');
    } else {
      // Create new analysis record
      existingAnalysis = new CVAnalysis({
        userId: req.user.id,
        resumeText: resumeText,
        resumeHash: resumeHash,
        usedProfileCV: usedProfileCV,
        jobDescriptions: jobDescriptions,
        results: analysisResult.analysis,
        isSaved: false
      });
      
      await existingAnalysis.save();
      console.log('Created new analysis record');
    }

    // Return successful response
    res.json({
      success: true,
      message: 'Resume analysis completed successfully',
      analysis: analysisResult.analysis,
      extractedTechnologies: analysisResult.extractedTechnologies || [],
      resumeHash: resumeHash,
      resumeText: usedProfileCV ? 'Profile CV' : `Uploaded file: ${req.file?.originalname}`,
      metadata: {
        usedProfileCV,
        fileName: usedProfileCV ? 'Profile CV' : req.file?.originalname,
        analysisDate: new Date().toISOString(),
        totalJobDescriptions: jobDescriptions.length,
        totalTechnologies: (analysisResult.extractedTechnologies || []).length
      }
    });

  } catch (error) {
    console.error('Analyze resume error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze resume',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// POST /api/analyze/save - Save analysis results
export const saveAnalysis = async (req, res) => {
  try {
    console.log('=== SAVE ANALYSIS DEBUG ===');
    console.log('User ID:', req.user?.id);
    console.log('Request body keys:', Object.keys(req.body));

    const { resumeName, jobDescriptions, results, resumeHash, usedProfileCV } = req.body;

    if (!resumeHash) {
      return res.status(400).json({
        success: false,
        message: 'Resume hash is required'
      });
    }

    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Analysis results are required'
      });
    }

    // Find existing analysis
    const existingAnalysis = await CVAnalysis.findOne({
      userId: req.user.id,
      resumeHash: resumeHash
    });

    if (!existingAnalysis) {
      return res.status(404).json({
        success: false,
        message: 'Analysis not found. Please analyze your resume first.'
      });
    }

    // Mark as saved
    existingAnalysis.isSaved = true;
    existingAnalysis.results = results; // Update with potentially modified results
    
    if (jobDescriptions) {
      existingAnalysis.jobDescriptions = jobDescriptions;
    }

    await existingAnalysis.save();

    console.log('Analysis saved successfully');

    res.json({
      success: true,
      message: 'Analysis saved successfully',
      data: {
        id: existingAnalysis._id,
        savedAt: existingAnalysis.updatedAt
      }
    });

  } catch (error) {
    console.error('Save analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save analysis',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/analyze/saved - Get saved analyses
export const getSavedAnalysis = async (req, res) => {
  try {
    console.log('=== GET SAVED ANALYSIS DEBUG ===');
    console.log('User ID:', req.user?.id);

    const savedAnalyses = await CVAnalysis.find({
      userId: req.user.id,
      isSaved: true
    })
    .sort({ updatedAt: -1 })
    .limit(20)
    .select('-resumeText'); // Exclude large text field for performance

    console.log('Found saved analyses:', savedAnalyses.length);

    // Transform data for frontend
    const formattedAnalyses = savedAnalyses.map(analysis => {
      const results = analysis.results || [];
      const softwareRoles = results.filter(r => !r.isNonTechRole);
      
      // Calculate average match percentage
      const avgMatch = softwareRoles.length > 0 
        ? Math.round(softwareRoles.reduce((sum, r) => sum + (r.matchPercentage || 0), 0) / softwareRoles.length)
        : 0;

      // Get the best matching job
      const bestMatch = softwareRoles.reduce((best, current) => 
        (current.matchPercentage || 0) > (best.matchPercentage || 0) ? current : best, 
        { matchPercentage: 0, strengths: [], contentRecommendations: [], structureRecommendations: [] }
      );

      // Extract job info from descriptions
      let jobTitle = 'Software Engineering Position';
      let company = 'Company';
      
      if (analysis.jobDescriptions && analysis.jobDescriptions.length > 0) {
        const firstJobDesc = analysis.jobDescriptions[0];
        const titleMatch = firstJobDesc.match(/(?:position|role|title):\s*([^\n<]+)/i);
        const companyMatch = firstJobDesc.match(/(?:company|organization):\s*([^\n<]+)/i) || 
                           firstJobDesc.match(/<strong>([^<]+)<\/strong>/);
        
        if (titleMatch) jobTitle = titleMatch[1].trim();
        if (companyMatch) company = companyMatch[1].trim();
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
        usedProfileCV: analysis.usedProfileCV || false,
        resumeHash: analysis.resumeHash,
        strengths: bestMatch.strengths || [],
        recommendations: [
          ...(bestMatch.contentRecommendations || []),
          ...(bestMatch.structureRecommendations || [])
        ].slice(0, 5),
        hasMultipleJobs: results.length > 1
      };
    });

    res.json({
      success: true,
      data: formattedAnalyses,
      count: formattedAnalyses.length
    });

  } catch (error) {
    console.error('Get saved analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch saved analyses',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// DELETE /api/analyze/delete/:id - Delete analysis
export const deleteAnalysis = async (req, res) => {
  try {
    console.log('=== DELETE ANALYSIS DEBUG ===');
    console.log('User ID:', req.user?.id);
    console.log('Analysis ID:', req.params.id);

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Analysis ID is required'
      });
    }

    const deleted = await CVAnalysis.findOneAndDelete({
      _id: id,
      userId: req.user.id
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Analysis not found or you do not have permission to delete it'
      });
    }

    console.log('Analysis deleted successfully');

    res.json({
      success: true,
      message: 'Analysis deleted successfully'
    });

  } catch (error) {
    console.error('Delete analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete analysis',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/analyze/analysis/:id - Get specific analysis details
export const getAnalysisDetails = async (req, res) => {
  try {
    console.log('=== GET ANALYSIS DETAILS DEBUG ===');
    console.log('User ID:', req.user?.id);
    console.log('Analysis ID:', req.params.id);

    const { id } = req.params;

    const analysis = await CVAnalysis.findOne({
      _id: id,
      userId: req.user.id
    }).select('-resumeText'); // Exclude large text field

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: 'Analysis not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: analysis._id,
        resumeHash: analysis.resumeHash,
        usedProfileCV: analysis.usedProfileCV || false,
        jobDescriptions: analysis.jobDescriptions,
        results: analysis.results,
        isSaved: analysis.isSaved,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt
      }
    });

  } catch (error) {
    console.error('Get analysis details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analysis details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// NEW: POST /api/analyze/analyze-profile-cv - Dedicated endpoint for profile CV analysis
export const analyzeWithProfileCV = async (req, res) => {
  try {
    console.log('=== ANALYZE PROFILE CV DEBUG ===');
    console.log('User ID:', req.user?.id);

    const { jobDescriptions } = req.body;

    // Validate job descriptions
    if (!jobDescriptions || !Array.isArray(jobDescriptions) || jobDescriptions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one job description is required'
      });
    }

    const cleanedJobs = jobDescriptions
      .map(desc => desc.trim())
      .filter(desc => desc.length >= 50);

    if (cleanedJobs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Job descriptions must be at least 50 characters long'
      });
    }

    // Get user's profile CV
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.currentCV || !user.currentCV.text || user.currentCV.text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No CV found in your profile. Please upload a CV first.'
      });
    }

    const resumeText = user.currentCV.text;
    const resumeHash = user.currentCV.hash || generateResumeHash(resumeText, req.user.id);

    // Perform AI analysis
    const analysisResult = await analyzeResumeWithAI(resumeText, cleanedJobs);

    // Save or update analysis
    let analysis = await CVAnalysis.findOne({
      userId: req.user.id,
      resumeHash: resumeHash
    });

    if (analysis) {
      analysis.jobDescriptions = cleanedJobs;
      analysis.results = analysisResult.analysis;
      analysis.usedProfileCV = true;
      await analysis.save();
    } else {
      analysis = new CVAnalysis({
        userId: req.user.id,
        resumeText: resumeText,
        resumeHash: resumeHash,
        usedProfileCV: true,
        jobDescriptions: cleanedJobs,
        results: analysisResult.analysis,
        isSaved: false
      });
      await analysis.save();
    }

    res.json({
      success: true,
      message: 'Profile CV analysis completed successfully',
      analysis: analysisResult.analysis,
      extractedTechnologies: analysisResult.extractedTechnologies || [],
      resumeHash: resumeHash,
      resumeText: 'Profile CV',
      metadata: {
        usedProfileCV: true,
        fileName: user.currentCV.fileName || 'Profile CV',
        analysisDate: new Date().toISOString(),
        totalJobDescriptions: cleanedJobs.length,
        totalTechnologies: (analysisResult.extractedTechnologies || []).length
      }
    });

  } catch (error) {
    console.error('Analyze profile CV error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze profile CV',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
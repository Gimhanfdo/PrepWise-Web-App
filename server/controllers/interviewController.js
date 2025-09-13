import InterviewModel from '../models/InterviewModel.js';
import userModel from '../models/userModel.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import axios from 'axios';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// JDoodle Code Execution Function
export const executeCodeWithJDoodle = async (req, res) => {
  try {
    const { script, language, versionIndex, stdin } = req.body;

    if (!script || !language || !versionIndex) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: script, language, versionIndex'
      });
    }

    const JDOODLE_CLIENT_ID = process.env.JDOODLE_CLIENT_ID;
    const JDOODLE_CLIENT_SECRET = process.env.JDOODLE_CLIENT_SECRET;

    if (!JDOODLE_CLIENT_ID || !JDOODLE_CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'JDoodle API credentials not configured'
      });
    }

    const jdoodleData = {
      script: script,
      language: language,
      versionIndex: versionIndex,
      clientId: JDOODLE_CLIENT_ID,
      clientSecret: JDOODLE_CLIENT_SECRET,
      stdin: stdin || ''
    };

    const jdoodleResponse = await axios.post(
      'https://api.jdoodle.com/v1/execute',
      jdoodleData,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );

    const result = jdoodleResponse.data;

    // Log execution
    console.log('Code execution:', {
      userId: req.user.id || req.user.userId || req.user._id,
      language: language,
      success: !result.error,
      executionTime: result.cpuTime,
      memory: result.memory
    });

    res.json({
      success: true,
      output: result.output || '',
      error: result.error || '',
      executionTime: result.cpuTime || null,
      memory: result.memory || null,
      statusCode: result.statusCode || null
    });

  } catch (error) {
    console.error('Code execution error:', error.message);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        success: false,
        error: 'Code execution timeout. Please optimize your code and try again.'
      });
    }

    if (error.response) {
      return res.status(500).json({
        success: false,
        error: `JDoodle API error: ${error.response.data.error || 'Unknown error'}`
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to execute code. Please try again.'
    });
  }
};

export const getUserCV = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const cvData = {
      hasText: user.hasCV,
      textLength: user.currentCV?.text?.length || 0,
      fileName: user.currentCV?.fileName || '',
      fileSize: user.currentCV?.fileSize || 0,
      uploadedAt: user.currentCV?.uploadedAt || null
    };

    res.json({
      success: true,
      data: cvData
    });

  } catch (error) {
    console.error('Get user CV error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user CV'
    });
  }
};

const cvStorage = multer.memoryStorage();
const cvUpload = multer({
  storage: cvStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

export const processCV = async (req, res) => {
  try {
    const uploadSingle = cvUpload.single('cv');
    
    uploadSingle(req, res, async (uploadError) => {
      if (uploadError) {
        console.error('File upload error:', uploadError);
        return res.status(400).json({
          success: false,
          error: uploadError.message || 'File upload failed'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No PDF file provided'
        });
      }

      const userId = req.user?.userId || req.user?.id || req.user?._id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      try {
        console.log('Processing PDF file:', {
          filename: req.file.originalname,
          size: req.file.size
        });

        const pdfData = await pdfParse(req.file.buffer);
        const extractedText = pdfData.text;
        
        if (!extractedText || extractedText.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Could not extract text from the PDF. Please ensure the PDF contains selectable text.'
          });
        }

        if (extractedText.length < 50) {
          return res.status(400).json({
            success: false,
            error: 'CV text appears to be too short. Please ensure your CV contains sufficient information.'
          });
        }

        const cleanedText = extractedText
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]{2,}/g, ' ')
          .trim();

        console.log('PDF processed successfully. Length:', cleanedText.length);

        res.json({
          success: true,
          message: 'PDF processed successfully',
          data: {
            text: cleanedText,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            textLength: cleanedText.length,
            processedAt: new Date().toISOString()
          }
        });

      } catch (extractionError) {
        console.error('PDF extraction error:', extractionError);
        res.status(500).json({
          success: false,
          error: 'Failed to extract text from PDF. Please ensure the file is not corrupted.',
          details: process.env.NODE_ENV === 'development' ? extractionError.message : undefined
        });
      }
    });

  } catch (error) {
    console.error('Process CV error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while processing PDF',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const createInterview = async (req, res) => {
  try {
    const { jobDescription, resumeText } = req.body;
    const userId = req.user.userId || req.user.id || req.user._id;

    console.log('=== CREATE INTERVIEW ===');
    console.log('User ID:', userId);
    console.log('Job Description length:', jobDescription?.length || 0);
    console.log('Resume Text length:', resumeText?.length || 0);

    if (!jobDescription || !resumeText) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: jobDescription and resumeText are required'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated properly. Please log in again.'
      });
    }

    console.log('Generating questions...');

    let questions;
    try {
      questions = await generateInterviewQuestions(resumeText, jobDescription);
    } catch (questionError) {
      console.error('Question generation failed:', questionError);
      const cvKeywords = extractCVKeywords(resumeText);
      const jobKeywords = extractJobKeywords(jobDescription);
      questions = getInternSpecificFallbackQuestions(resumeText, jobDescription, cvKeywords, jobKeywords);
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      console.error('No questions generated');
      return res.status(500).json({
        success: false,
        error: 'Failed to generate interview questions. Please try again.'
      });
    }

    console.log('Generated questions count:', questions.length);

    const interviewData = {
      userId: userId,
      jobDescription: jobDescription.trim(),
      resumeText: resumeText.trim(),
      questions: questions,
      totalQuestions: questions.length,
      currentQuestionIndex: 0,
      status: 'created',
      responses: [],
      cvSource: 'manual',
      usedProfileCV: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const interview = new InterviewModel(interviewData);
    const savedInterview = await interview.save();

    console.log('Interview saved successfully:', savedInterview._id);

    res.status(201).json({
      success: true,
      message: 'Interview created successfully',
      interview: {
        id: savedInterview._id,
        _id: savedInterview._id,
        userId: savedInterview.userId,
        jobDescription: savedInterview.jobDescription,
        resumeText: savedInterview.resumeText,
        questions: savedInterview.questions,
        totalQuestions: savedInterview.totalQuestions,
        status: savedInterview.status,
        cvSource: savedInterview.cvSource,
        usedProfileCV: savedInterview.usedProfileCV,
        createdAt: savedInterview.createdAt
      }
    });

  } catch (error) {
    console.error('Create interview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create interview',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

export const createInterviewWithProfileCV = async (req, res) => {
  try {
    const { jobDescription } = req.body;
    const userId = req.user.userId || req.user.id || req.user._id;

    console.log('=== CREATE INTERVIEW WITH PROFILE CV ===');
    console.log('User ID:', userId);
    console.log('Job Description length:', jobDescription?.length || 0);

    if (!jobDescription) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: jobDescription is required'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated properly. Please log in again.'
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      console.error('User not found:', userId);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.hasCV) {
      console.error('User has no CV:', userId);
      return res.status(400).json({
        success: false,
        error: 'No CV found in user profile. Please upload a CV first.'
      });
    }

    let actualCVText;
    try {
      actualCVText = user.getCVText();
    } catch (cvError) {
      console.error('Error getting CV text:', cvError);
      actualCVText = user.currentCV?.text || '';
    }

    if (!actualCVText || actualCVText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'CV text is empty or corrupted. Please re-upload your CV.'
      });
    }

    console.log('CV Text length:', actualCVText.length);
    console.log('Generating questions...');

    let questions;
    try {
      questions = await generateInterviewQuestions(actualCVText, jobDescription);
    } catch (questionError) {
      console.error('Question generation failed:', questionError);
      const cvKeywords = extractCVKeywords(actualCVText);
      const jobKeywords = extractJobKeywords(jobDescription);
      questions = getInternSpecificFallbackQuestions(actualCVText, jobDescription, cvKeywords, jobKeywords);
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      console.error('No questions generated');
      return res.status(500).json({
        success: false,
        error: 'Failed to generate interview questions. Please try again.'
      });
    }

    console.log('Generated questions count:', questions.length);

    const interviewData = {
      userId: userId,
      jobDescription: jobDescription.trim(),
      resumeText: actualCVText,
      questions: questions,
      totalQuestions: questions.length,
      currentQuestionIndex: 0,
      status: 'created',
      responses: [],
      cvSource: 'profile',
      usedProfileCV: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const interview = new InterviewModel(interviewData);
    const savedInterview = await interview.save();

    console.log('Interview saved successfully:', savedInterview._id);

    res.status(201).json({
      success: true,
      message: 'Interview created successfully with profile CV',
      interview: {
        id: savedInterview._id,
        _id: savedInterview._id,
        userId: savedInterview.userId,
        jobDescription: savedInterview.jobDescription,
        resumeText: savedInterview.resumeText,
        questions: savedInterview.questions,
        totalQuestions: savedInterview.totalQuestions,
        status: savedInterview.status,
        cvSource: savedInterview.cvSource,
        usedProfileCV: savedInterview.usedProfileCV,
        createdAt: savedInterview.createdAt
      }
    });

  } catch (error) {
    console.error('Create interview with profile CV error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create interview with profile CV',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

export const startInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const interview = await InterviewModel.findOne({ _id: interviewId, userId });
    if (!interview) {
      return res.status(404).json({ 
        success: false,
        error: 'Interview not found' 
      });
    }

    if (interview.status !== 'created') {
      return res.status(400).json({ 
        success: false,
        error: 'Interview already started or completed' 
      });
    }

    if (!interview.questions || !Array.isArray(interview.questions) || interview.questions.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Interview has no questions available. Please recreate the interview.'
      });
    }

    interview.status = 'in_progress';
    interview.startedAt = new Date();
    interview.updatedAt = new Date();
    await interview.save();

    res.json({
      success: true,
      message: 'Interview started successfully',
      firstQuestion: interview.questions[0],
      totalQuestions: interview.questions.length,
      questions: interview.questions,
      interviewData: {
        id: interview._id,
        status: interview.status,
        currentQuestionIndex: 0
      }
    });
  } catch (error) {
    console.error('Start interview error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to start interview',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getNextQuestion = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const interview = await InterviewModel.findOne({ _id: interviewId, userId });
    if (!interview) {
      return res.status(404).json({ 
        success: false,
        error: 'Interview not found' 
      });
    }

    const answeredCount = interview.responses.length;

    if (answeredCount >= interview.questions.length) {
      return res.json({
        success: true,
        completed: true,
        message: 'All questions completed',
        progress: {
          current: answeredCount,
          total: interview.questions.length,
          percentage: 100
        }
      });
    }

    const nextQuestion = interview.questions[answeredCount];
    if (!nextQuestion) {
      return res.json({
        success: true,
        completed: true,
        message: 'No more questions available'
      });
    }

    res.json({
      success: true,
      question: nextQuestion,
      progress: {
        current: answeredCount + 1,
        total: interview.questions.length,
        percentage: Math.round(((answeredCount + 1) / interview.questions.length) * 100)
      }
    });
  } catch (error) {
    console.error('Get next question error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get next question',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

function validateAndSanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .substring(0, 10000);
}

function validateCodingSubmission(questionType, responseText, code, language, expectedLanguage, isSkipped = false) {
  const errors = [];

  if (isSkipped) {
    return errors;
  }

  if (questionType === 'coding') {
    if (!code || code.trim().length === 0) {
      errors.push('Code is required for coding questions');
    }

    if (!language) {
      errors.push('Programming language must be specified for coding questions');
    }

    // FIXED: More flexible language matching
    if (expectedLanguage && language) {
      const normalizedExpected = normalizeLanguage(expectedLanguage);
      const normalizedSubmitted = normalizeLanguage(language);
      
      // Allow common language aliases and variations
      const languageAliases = {
        'javascript': ['js', 'nodejs', 'node'],
        'python': ['python3', 'py'],
        'csharp': ['c#', 'cs'],
        'cpp': ['c++'],
        'typescript': ['ts']
      };
      
      let isValidLanguage = normalizedExpected === normalizedSubmitted;
      
      // Check if submitted language is an alias of expected language
      if (!isValidLanguage) {
        for (const [canonical, aliases] of Object.entries(languageAliases)) {
          if ((canonical === normalizedExpected || aliases.includes(normalizedExpected)) &&
              (canonical === normalizedSubmitted || aliases.includes(normalizedSubmitted))) {
            isValidLanguage = true;
            break;
          }
        }
      }
      
      if (!isValidLanguage) {
        errors.push(`Submitted code language (${language}) does not match expected (${expectedLanguage})`);
      }
    }

    const codeToCheck = code || responseText || '';
    const hasBasicElements = /\b(function|def|class|int|string|return|if|for|while|const|let|var|public|static|void|using|namespace)\b/i.test(codeToCheck);

    if (!hasBasicElements && codeToCheck.length > 0) {
      console.warn('Code submission may not contain valid programming syntax');
    }
  }

  return errors;
}

// Helper function to normalize language names
function normalizeLanguage(language) {
  if (!language) return '';
  return language.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function validateLanguage(language) {
  return language ? language.trim() : null;
}

export const submitAnswer = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { questionId, responseTime, answerMode, responseText, code, language, skipped, executionResults } = req.body;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const sanitizedResponseText = validateAndSanitizeInput(responseText);
    const sanitizedCode = validateAndSanitizeInput(code);
    const validatedLanguage = validateLanguage(language);

    if (!sanitizedResponseText || sanitizedResponseText.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Response text is required' 
      });
    }

    const interview = await InterviewModel.findOne({ _id: interviewId, userId });
    if (!interview) {
      return res.status(404).json({ 
        success: false,
        error: 'Interview not found' 
      });
    }

    const question = interview.questions.find(q => q.questionId === questionId);
    if (!question) {
      return res.status(400).json({ 
        success: false,
        error: 'Question not found' 
      });
    }

    if (skipped) {
      // Handle skipped questions as before...
      const analysis = await generateStrictAIFeedback(
        question.question,
        question.type,
        sanitizedResponseText,
        sanitizedCode,
        validatedLanguage,
        true
      );

      const response = {
        questionId,
        question: question.question,
        questionType: question.type,
        transcription: null,
        textResponse: sanitizedResponseText,
        code: null,
        language: null,
        responseTime: parseInt(responseTime) || 0,
        submittedAt: new Date(),
        feedback: analysis,
        skipped: true
      };

      interview.responses.push(response);
      interview.currentQuestionIndex = interview.responses.length;
      interview.updatedAt = new Date();

      if (interview.status === 'created') {
        interview.status = 'in_progress';
        interview.startedAt = new Date();
      }

      await interview.save();

      return res.json({
        success: true,
        message: 'Question skipped successfully',
        feedback: analysis,
        progress: {
          current: interview.responses.length,
          total: interview.questions.length,
          completed: interview.responses.length >= interview.questions.length
        }
      });
    }

    // FIXED: More lenient validation - only check if both code and language are provided
    if (question.type === 'coding' && code && code.trim().length > 0) {
      const validationErrors = validateCodingSubmission(
        question.type,
        sanitizedResponseText,
        sanitizedCode,
        validatedLanguage,
        question.language,
        false
      );

      // FIXED: Only fail if there are critical errors, not language mismatches
      const criticalErrors = validationErrors.filter(error => 
        !error.includes('does not match expected') || 
        (question.language && validatedLanguage && 
         normalizeLanguage(question.language) !== normalizeLanguage(validatedLanguage))
      );

      if (criticalErrors.length > 0) {
        console.warn('Validation warnings (not blocking):', validationErrors);
        // Still proceed with submission but log warnings
      }
    }

    console.log('=== ANALYZING RESPONSE ===');
    console.log('Question:', question.question);
    console.log('Question Type:', question.type);
    console.log('Response:', sanitizedResponseText);
    console.log('Code:', sanitizedCode || 'None');
    console.log('Language:', validatedLanguage);
    console.log('Expected Language:', question.language);
    console.log('Execution Results:', executionResults || 'None');

    let analysis;
    try {
      analysis = await generateStrictAIFeedback(
        question.question,
        question.type,
        sanitizedResponseText,
        sanitizedCode,
        validatedLanguage,
        false,
        executionResults
      );
      console.log('✅ AI Analysis Result:', {
        score: analysis.score,
        responseType: analysis.responseType
      });
    } catch (error) {
      console.error('❌ AI Feedback Failed:', error.message);
      analysis = generateFallbackFeedback(question.type, sanitizedResponseText, sanitizedCode);
      console.log('🔄 Using fallback feedback');
    }

    const response = {
      questionId,
      question: question.question,
      questionType: question.type,
      transcription: answerMode === 'audio' ? sanitizedResponseText : null,
      textResponse: sanitizedResponseText,
      code: sanitizedCode || null,
      language: question.type === 'coding' ? validatedLanguage : null,
      responseTime: parseInt(responseTime) || 0,
      recordingDuration: answerMode === 'audio' ? parseInt(responseTime) : null,
      submittedAt: new Date(),
      feedback: analysis,
      skipped: false,
      executionResults: executionResults || null
    };

    interview.responses.push(response);
    interview.currentQuestionIndex = interview.responses.length;
    interview.updatedAt = new Date();

    if (interview.status === 'created') {
      interview.status = 'in_progress';
      interview.startedAt = new Date();
    }

    await interview.save();

    console.log('📤 Final Response Sent:', {
      score: analysis.score,
      type: analysis.responseType
    });

    res.json({
      success: true,
      message: 'Answer submitted successfully',
      feedback: analysis,
      progress: {
        current: interview.responses.length,
        total: interview.questions.length,
        completed: interview.responses.length >= interview.questions.length
      }
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process answer',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

function extractJSONFromResponse(rawText) {
  // Remove all markdown formatting first
  let cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```javascript\s*/gi, '')
    .replace(/```\s*/gi, '')
    .replace(/^```/gm, '')
    .replace(/```$/gm, '')
    .trim();

  // Try to find JSON object boundaries
  const jsonRegex = /\{[\s\S]*\}/;
  const match = cleaned.match(jsonRegex);
  
  if (match) {
    return match[0];
  }

  // Fallback: look for first { to last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  return null;
}

async function generateStrictAIFeedback(question, questionType, responseText, code, language, isSkipped = false, executionResults = null) {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: { 
    temperature: 0.1,
    responseMimeType: "application/json", // Force JSON response
    responseSchema: {
      type: "object",
      properties: {
        score: { type: "number" },
        questionRelevance: { type: "number" },
        responseType: { type: "string" },
        // ... all other fields
      }
    }
  }
});

  if (isSkipped) {
    return {
      score: 0,
      questionRelevance: 0,
      responseType: "skipped",
      correctness: 0,
      syntax: 0,
      languageBestPractices: 0,
      efficiency: 0,
      structureAndReadability: 0,
      edgeCaseHandling: 0,
      strengths: ["None - question was skipped"],
      improvements: ["Always attempt to answer interview questions", "Prepare thoroughly for behavioral questions", "Practice coding problems regularly"],
      detailedAnalysis: "This question was skipped by the candidate, which is a critical failure in interview settings.",
      overallAssessment: "Skipping questions demonstrates lack of preparation and engagement."
    };
  }

  // Truncate inputs to prevent token limit issues
  const maxLength = 1500;
  const truncatedQuestion = question.length > maxLength ? question.substring(0, maxLength) + "..." : question;
  const truncatedResponse = responseText.length > maxLength ? responseText.substring(0, maxLength) + "..." : responseText;
  const truncatedCode = code && code.length > maxLength ? code.substring(0, maxLength) + "..." : code;

  const prompt = `You are evaluating a SOFTWARE ENGINEERING INTERN interview response. 

CRITICAL: Respond with ONLY valid JSON. No explanations, no markdown, no additional text.

QUESTION: "${truncatedQuestion}"
TYPE: ${questionType}
RESPONSE: "${truncatedResponse}"
${truncatedCode ? `CODE: "${truncatedCode}"` : ''}
${language ? `LANGUAGE: ${language}` : ''}
${executionResults ? `EXECUTION OUTPUT: "${executionResults.output || 'No output'}" ERROR: "${executionResults.error || 'None'}"` : ''}

Evaluate for INTERN LEVEL expectations. Return this exact JSON structure:

{
  "score": 75,
  "questionRelevance": 8,
  "responseType": "mostly-relevant",
  "correctness": 7,
  "syntax": 6,
  "languageBestPractices": 7,
  "efficiency": 6,
  "structureAndReadability": 7,
  "edgeCaseHandling": 6,
  "strengths": ["Shows understanding", "Good approach"],
  "improvements": ["Add error handling", "Improve explanation"],
  "detailedAnalysis": "Brief analysis of response quality and correctness",
  "overallAssessment": "Overall performance assessment for intern level",
  "communicationClarity": 7,
  "technicalAccuracy": 6
}

SCORING GUIDELINES:
- score: 0-100 overall performance
- All numeric ratings: 1-10 scale  
- responseType: "perfectly-relevant", "mostly-relevant", "partially-relevant", "mostly-irrelevant", "completely-off-topic"
- Arrays: maximum 3 items each
- Focus on INTERN-level expectations`;

  try {
    console.log('🤖 Sending AI feedback request...');
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let rawText = response.text().trim();
    
    console.log('📥 Raw AI Response preview:', rawText.substring(0, 100) + "...");

    // Check if response is completely empty or invalid
    if (!rawText || rawText.length < 10) {
      console.error('❌ AI returned empty or invalid response');
      return generateFallbackFeedback(questionType, responseText, true);
    }

    // Enhanced JSON parsing with multiple extraction strategies
    let cleanText = rawText.replace(/```json\s*|```\s*/g, '').trim();
    
    // Strategy 1: Try to find JSON object with robust matching
    let jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    } else {
      // Strategy 2: Try to extract between first { and last }
      const jsonStart = cleanText.indexOf('{');
      const jsonEnd = cleanText.lastIndexOf('}');
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        cleanText = cleanText.substring(jsonStart, jsonEnd + 1);
      } else {
        // Strategy 3: Check if it's a non-JSON error message
        if (cleanText.includes('error') || cleanText.includes('sorry') || cleanText.includes('cannot')) {
          console.error('❌ AI returned error message instead of JSON:', cleanText.substring(0, 100));
          return generateFallbackFeedback(questionType, responseText, true);
        }
        
        // Strategy 4: Try to construct JSON from text analysis
        console.warn('⚠️ No JSON structure found, attempting to analyze response content');
        return analyzeResponseContent(question, questionType, responseText);
      }
    }
    
    let aiAnalysis;
    try {
      aiAnalysis = JSON.parse(cleanText);
      console.log('✅ Successfully parsed AI feedback JSON');
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError.message);
      console.log('🔍 Failed JSON text:', cleanText.substring(0, 200));
      
      // Try multiple JSON fixing strategies
      try {
        // Fix 1: Common JSON issues
        let fixedJson = cleanText
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/'/g, '"')
          .replace(/([a-zA-Z_][a-zA-Z0-9_]*):/g, '"$1":') // Quote keys
          .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, ':"$1"') // Quote unquoted string values
          .replace(/:\s*([^"\[\]{},\s]+)(?=\s*[,\]}])/g, ':"$1"'); // Quote simple values
        
        aiAnalysis = JSON.parse(fixedJson);
        console.log('✅ Fixed and parsed JSON successfully');
      } catch (fixError) {
        console.error('❌ Could not fix JSON:', fixError.message);
        
        // Final fallback: Analyze the content directly
        return analyzeResponseContent(question, questionType, responseText);
      }
    }

    // Validate structure with fallback values
    const validatedResponse = {
      score: typeof aiAnalysis.score === 'number' ? Math.max(0, Math.min(100, aiAnalysis.score)) : 50,
      questionRelevance: typeof aiAnalysis.questionRelevance === 'number' ? Math.max(1, Math.min(10, aiAnalysis.questionRelevance)) : 5,
      responseType: typeof aiAnalysis.responseType === 'string' ? aiAnalysis.responseType : 'partially-relevant',
      correctness: typeof aiAnalysis.correctness === 'number' ? Math.max(1, Math.min(10, aiAnalysis.correctness)) : 5,
      syntax: typeof aiAnalysis.syntax === 'number' ? Math.max(1, Math.min(10, aiAnalysis.syntax)) : 5,
      languageBestPractices: typeof aiAnalysis.languageBestPractices === 'number' ? Math.max(1, Math.min(10, aiAnalysis.languageBestPractices)) : 5,
      efficiency: typeof aiAnalysis.efficiency === 'number' ? Math.max(1, Math.min(10, aiAnalysis.efficiency)) : 5,
      structureAndReadability: typeof aiAnalysis.structureAndReadability === 'number' ? Math.max(1, Math.min(10, aiAnalysis.structureAndReadability)) : 5,
      edgeCaseHandling: typeof aiAnalysis.edgeCaseHandling === 'number' ? Math.max(1, Math.min(10, aiAnalysis.edgeCaseHandling)) : 5,
      strengths: Array.isArray(aiAnalysis.strengths) ? aiAnalysis.strengths.slice(0, 3) : ['Attempted to answer the question'],
      improvements: Array.isArray(aiAnalysis.improvements) ? aiAnalysis.improvements.slice(0, 3) : ['Provide more detailed responses'],
      detailedAnalysis: typeof aiAnalysis.detailedAnalysis === 'string' ? aiAnalysis.detailedAnalysis : 'Response analysis unavailable',
      overallAssessment: typeof aiAnalysis.overallAssessment === 'string' ? aiAnalysis.overallAssessment : 'Performance assessment unavailable',
      communicationClarity: typeof aiAnalysis.communicationClarity === 'number' ? Math.max(1, Math.min(10, aiAnalysis.communicationClarity)) : 5,
      technicalAccuracy: typeof aiAnalysis.technicalAccuracy === 'number' ? Math.max(1, Math.min(10, aiAnalysis.technicalAccuracy)) : 5
    };

    console.log('✅ AI Analysis completed:', { score: validatedResponse.score, type: validatedResponse.responseType });

    return validatedResponse;

  } catch (error) {
    console.error('❌ AI Feedback Generation Failed:', error.message);
    console.log('🔄 Using fallback feedback');
    
    return generateFallbackFeedback(questionType, responseText, true);
  }
}

// New function to analyze response content when JSON parsing fails completely
function analyzeResponseContent(question, questionType, responseText) {
  console.log('🔍 Analyzing response content directly');
  
  const responseLength = responseText.length;
  const questionKeywords = question.toLowerCase();
  const responseLower = responseText.toLowerCase();
  
  // Basic content analysis
  const hasRelevantKeywords = questionKeywords.split(' ').some(keyword => 
    keyword.length > 3 && responseLower.includes(keyword)
  );
  
  const isCompleteAnswer = responseLength > 100 && 
                          (responseLower.includes('i ') || 
                           responseLower.includes('we ') || 
                           responseLower.includes('the '));
  
  const hasStructure = responseLower.includes('first') || 
                      responseLower.includes('then') || 
                      responseLower.includes('finally') ||
                      responseLower.includes('because');
  
  let score = 50;
  let responseType = "partially-relevant";
  let strengths = ["Provided a response to the question"];
  let improvements = ["Add more specific details and examples", "Structure your answer more clearly"];
  
  if (responseLength > 200 && hasRelevantKeywords && isCompleteAnswer) {
    score = 75;
    responseType = "mostly-relevant";
    strengths = ["Demonstrated relevant experience", "Provided structured response"];
    improvements = ["Include measurable outcomes", "Add more technical specifics"];
  } else if (responseLength < 50 || !hasRelevantKeywords) {
    score = 30;
    responseType = "mostly-irrelevant";
    strengths = ["Attempted to respond"];
    improvements = ["Address the specific question asked", "Provide concrete examples"];
  }
  
  return {
    score,
    questionRelevance: Math.max(1, Math.floor(score / 15)),
    responseType,
    correctness: Math.max(1, Math.floor(score / 15)),
    syntax: 0,
    languageBestPractices: 0,
    efficiency: 0,
    structureAndReadability: hasStructure ? 7 : 4,
    edgeCaseHandling: 0,
    strengths,
    improvements,
    detailedAnalysis: `Response ${responseLength < 100 ? 'was brief but' : ''} addressed ${hasRelevantKeywords ? 'some relevant aspects' : 'the topic generally'}. ${hasStructure ? 'Shows some structure in answering.' : 'Could benefit from clearer organization.'}`,
    overallAssessment: "Candidate provided a response that demonstrates some understanding of the question topic.",
    communicationClarity: Math.max(1, Math.floor(score / 15)),
    technicalAccuracy: Math.max(1, Math.floor(score / 15))
  };
}


function getDefaultAnalysis(questionType, score) {
  if (questionType === 'coding') {
    return score >= 70 ? 'Code shows good understanding but could be improved.' : 'Code needs significant improvement in logic and structure.';
  } else if (questionType === 'technical') {
    return score >= 70 ? 'Technical explanation demonstrates solid understanding.' : 'Technical answer lacks depth and accuracy.';
  } else {
    return score >= 70 ? 'Response shows good communication skills.' : 'Answer needs more detail and specific examples.';
  }
}

function getDefaultAssessment(score) {
  if (score >= 80) return 'Strong performance for intern level';
  if (score >= 70) return 'Good performance with room for improvement';
  if (score >= 60) return 'Acceptable performance but needs development';
  return 'Below expectations for intern level';
}

function validateAndSanitizeAIResponse(aiAnalysis, questionType) {
  const clamp = (value, min, max) => {
    const num = typeof value === 'number' ? value : parseInt(value) || min;
    return Math.max(min, Math.min(max, num));
  };
  
  // Ensure we have all required fields with proper defaults
  const validatedResponse = {
    score: clamp(aiAnalysis.score, 0, 100),
    questionRelevance: clamp(aiAnalysis.questionRelevance || Math.floor((aiAnalysis.score || 50) / 10), 1, 10),
    responseType: validateResponseType(aiAnalysis.responseType || 'partially-relevant'),
    correctness: clamp(aiAnalysis.correctness || Math.floor((aiAnalysis.score || 50) / 10), 1, 10),
    syntax: clamp(aiAnalysis.syntax || Math.floor((aiAnalysis.score || 50) / 10), 1, 10),
    languageBestPractices: clamp(aiAnalysis.languageBestPractices || aiAnalysis.syntax || Math.floor((aiAnalysis.score || 50) / 10), 1, 10),
    efficiency: clamp(aiAnalysis.efficiency || Math.floor((aiAnalysis.score || 50) / 10), 1, 10),
    structureAndReadability: clamp(aiAnalysis.structureAndReadability || aiAnalysis.syntax || Math.floor((aiAnalysis.score || 50) / 10), 1, 10),
    edgeCaseHandling: clamp(aiAnalysis.edgeCaseHandling || aiAnalysis.correctness || Math.floor((aiAnalysis.score || 50) / 10), 1, 10),
    
    // FIXED: Better handling of string arrays
    strengths: validateStringArray(aiAnalysis.strengths, [
      (aiAnalysis.score || 50) >= 70 ? 'Demonstrated understanding of the concept' : 'Attempted to solve the problem',
      'Provided a response to the question'
    ]),
    
    improvements: validateStringArray(aiAnalysis.improvements, [
      'Provide more detailed explanations',
      'Focus on accuracy and completeness',
      questionType === 'coding' ? 'Improve code structure and syntax' : 'Include more specific examples'
    ]),
    
    // FIXED: Use the actual field names from AI response
    detailedAnalysis: aiAnalysis.analysis || aiAnalysis.detailedAnalysis || 
      `Response scored ${aiAnalysis.score || 'unknown'}/100. ${getDefaultAnalysis(questionType, aiAnalysis.score || 50)}`,
    
    overallAssessment: aiAnalysis.assessment || aiAnalysis.overallAssessment || 
      getDefaultAssessment(aiAnalysis.score || 50),

    // Additional fields for compatibility
    communicationClarity: clamp(aiAnalysis.communicationClarity || Math.floor((aiAnalysis.score || 50) / 15), 1, 10),
    technicalAccuracy: clamp(aiAnalysis.technicalAccuracy || aiAnalysis.correctness || Math.floor((aiAnalysis.score || 50) / 10), 1, 10)
  };

  return validatedResponse;
}

function validateResponseType(type) {
  const validTypes = ['perfectly-relevant', 'mostly-relevant', 'partially-relevant', 'mostly-irrelevant', 'completely-off-topic'];
  if (typeof type !== 'string') return 'partially-relevant';
  const normalized = type.toLowerCase().trim();
  return validTypes.includes(normalized) ? normalized : 'partially-relevant';
}

function validateStringArray(arr, fallback) {
  if (Array.isArray(arr) && arr.length > 0) {
    const validStrings = arr
      .slice(0, 3) // Limit to 3 items
      .filter(item => typeof item === 'string' && item.trim().length > 0)
      .map(item => item.trim().substring(0, 100)); // Limit length
    
    return validStrings.length > 0 ? validStrings : fallback;
  }
  return fallback;
}

function generateFallbackFeedback(questionType, responseText, code) {
  const hasCode = code && code.trim().length > 0;
  const responseLength = responseText?.length || 0;
  
  let score = 45; // More reasonable base score
  let strengths = ['Provided a response to the question'];
  let improvements = ['Provide more detailed and specific information'];
  
  // More nuanced scoring based on question type and response quality
  if (questionType === 'coding') {
    if (hasCode) {
      // Check for basic programming keywords
      const hasBasicKeywords = /\b(function|def|class|if|for|while|return|const|let|var|public|static|void|int|string)\b/i.test(code);
      score = hasBasicKeywords ? 55 : 35;
      
      strengths = hasBasicKeywords ? 
        ['Provided code solution', 'Used appropriate programming constructs'] :
        ['Attempted to provide code solution'];
      
      improvements = hasBasicKeywords ?
        ['Improve code logic and structure', 'Add error handling', 'Include comments explaining approach'] :
        ['Ensure code follows proper syntax', 'Implement complete solution', 'Test the solution with examples'];
    } else {
      score = 25;
      strengths = ['Provided text response'];
      improvements = [
        'Must provide actual code for coding questions',
        'Implement the solution using proper programming syntax',
        'Test the solution with example inputs'
      ];
    }
  } else if (questionType === 'technical') {
    if (responseLength > 150) {
      score = 60;
      strengths = ['Provided detailed technical response', 'Demonstrated effort to explain concepts'];
    } else if (responseLength > 50) {
      score = 50;
      strengths = ['Attempted to answer technical question'];
      improvements.push('Provide more comprehensive technical explanations');
    } else {
      score = 35;
      improvements.push('Include specific technical details and examples');
    }
  } else if (questionType === 'behavioral') {
    if (responseLength > 200) {
      score = 65;
      strengths = ['Shared detailed response', 'Provided personal examples'];
    } else if (responseLength > 100) {
      score = 55;
      strengths = ['Provided personal experience'];
      improvements.push('Include more specific examples and details');
    } else {
      score = 40;
      improvements.push('Share specific examples and personal experiences');
    }
  }

  return {
    score: score,
    questionRelevance: Math.floor(score / 15),
    responseType: score >= 70 ? 'mostly-relevant' : score >= 50 ? 'partially-relevant' : 'mostly-irrelevant',
    correctness: Math.floor(score / 10),
    syntax: hasCode ? Math.floor(score / 12) : Math.floor(score / 10),
    languageBestPractices: hasCode ? Math.floor(score / 12) : Math.floor(score / 10),
    efficiency: Math.floor(score / 12),
    structureAndReadability: Math.floor(score / 10),
    edgeCaseHandling: Math.floor(score / 15),
    strengths: strengths,
    improvements: improvements,
    detailedAnalysis: `System analysis: Response received with ${responseLength} characters. ${hasCode ? 'Code provided but' : 'No code provided and'} ${getDefaultAnalysis(questionType, score)}`,
    overallAssessment: getDefaultAssessment(score),
    communicationClarity: Math.floor(score / 15),
    technicalAccuracy: hasCode ? Math.floor(score / 12) : Math.floor(score / 10)
  };
}

export const skipQuestion = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const interview = await InterviewModel.findOne({ _id: interviewId, userId });
    if (!interview) {
      return res.status(404).json({ 
        success: false,
        error: 'Interview not found' 
      });
    }

    const currentQuestionIndex = interview.responses.length;
    if (currentQuestionIndex >= interview.questions.length) {
      return res.status(400).json({
        success: false,
        error: 'No more questions to skip'
      });
    }

    const question = interview.questions[currentQuestionIndex];
    
    const skipResponse = {
      questionId: question.questionId,
      question: question.question,
      questionType: question.type,
      transcription: null,
      textResponse: 'Question skipped by candidate',
      code: null,
      language: null,
      responseTime: 0,
      recordingDuration: null,
      submittedAt: new Date(),
      skipped: true,
      feedback: {
        score: 0,
        questionRelevance: 0,
        responseType: 'skipped',
        strengths: ['None'],
        improvements: [
          'The candidate did not attempt to answer the question.',
          'Even if unsure, provide some attempt or explanation of your thought process.',
          'Skipping questions shows lack of engagement with the interview process.'
        ],
        detailedAnalysis: 'Question was skipped entirely by the candidate. This shows no engagement with the question content and represents a missed opportunity to demonstrate knowledge or problem-solving approach.',
        communicationClarity: 0,
        technicalAccuracy: 0,
        overallAssessment: 'No attempt made - significant concern for interview performance'
      }
    };

    interview.responses.push(skipResponse);
    interview.currentQuestionIndex = interview.responses.length;
    interview.updatedAt = new Date();

    if (interview.status === 'created') {
      interview.status = 'in_progress';
      interview.startedAt = new Date();
    }

    await interview.save();

    res.json({
      success: true,
      message: 'Question skipped',
      progress: {
        current: interview.responses.length,
        total: interview.questions.length,
        completed: interview.responses.length >= interview.questions.length
      }
    });
  } catch (error) {
    console.error('Skip question error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to skip question',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const analyzeResponse = async (req, res) => {
  try {
    const { question, questionType, responseText, code, language } = req.body;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const sanitizedResponseText = validateAndSanitizeInput(responseText);
    const sanitizedCode = validateAndSanitizeInput(code);
    const validatedLanguage = validateLanguage(language);

    if (!question || !sanitizedResponseText) {
      return res.status(400).json({
        success: false,
        error: 'Question and response text are required'
      });
    }

    let feedback;
    try {
      feedback = await generateStrictAIFeedback(
        question, 
        questionType, 
        sanitizedResponseText, 
        sanitizedCode, 
        validatedLanguage
      );
    } catch (error) {
      console.error('AI Analysis failed, using fallback:', error.message);
      feedback = generateFallbackFeedback(questionType, sanitizedResponseText, sanitizedCode);
    }

    res.json({
      success: true,
      feedback
    });

  } catch (error) {
    console.error('Analyze response error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze response',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const completeInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const interview = await InterviewModel.findOne({ _id: interviewId, userId });
    if (!interview) {
      return res.status(404).json({ 
        success: false,
        error: 'Interview not found' 
      });
    }

    if (interview.status === 'completed') {
      return res.json({
        success: true,
        message: 'Interview already completed',
        results: calculateFinalResults(interview.responses, interview.totalDuration || 0)
      });
    }

    let overallAnalysis;
    try {
      overallAnalysis = await generateOverallFeedback(
        interview.responses,
        interview.resumeText,
        interview.jobDescription
      );
    } catch (feedbackError) {
      console.error('Overall feedback generation failed:', feedbackError.message);
      overallAnalysis = generateFallbackOverallFeedback(interview.responses);
    }

    interview.status = 'completed';
    interview.completedAt = new Date();
    
    if (interview.startedAt) {
      interview.totalDuration = Math.round((interview.completedAt - interview.startedAt) / 1000);
    } else {
      interview.totalDuration = 1800;
    }
    
    const finalResults = calculateFinalResults(interview.responses, interview.totalDuration);
    
    interview.overallFeedback = {
      ...overallAnalysis.feedback,
      ...finalResults
    };
    
    interview.updatedAt = new Date();
    await interview.save();

    res.json({
      success: true,
      message: 'Interview completed successfully',
      results: {
        ...finalResults,
        feedback: interview.overallFeedback,
        questionsAnswered: interview.responses.length,
        totalQuestions: interview.questions.length
      }
    });
  } catch (error) {
    console.error('Complete interview error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to complete interview',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getInterviewFeedback = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const interview = await InterviewModel.findOne({ _id: interviewId, userId });

    if (!interview) {
      return res.status(404).json({ 
        success: false,
        error: 'Interview not found' 
      });
    }

    const finalResults = calculateFinalResults(interview.responses, interview.totalDuration || 0);

    res.json({
      success: true,
      feedback: {
        ...finalResults,
        feedback: interview.overallFeedback,
        responses: interview.responses,
        recommendations: interview.overallFeedback?.recommendations || []
      }
    });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get feedback' 
    });
  }
};

export const getUserInterviews = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    const { page = 1, limit = 10 } = req.query;

    const interviews = await InterviewModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('status overallFeedback createdAt completedAt totalDuration');

    const total = await InterviewModel.countDocuments({ userId });

    res.json({
      success: true,
      interviews,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        count: interviews.length,
        totalRecords: total
      }
    });
  } catch (error) {
    console.error('Get user interviews error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get interview history' 
    });
  }
};

export const getInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const interview = await InterviewModel.findOne({ _id: interviewId, userId });

    if (!interview) {
      return res.status(404).json({ 
        success: false,
        error: 'Interview not found' 
      });
    }

    res.json({
      success: true,
      interview
    });
  } catch (error) {
    console.error('Get interview error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get interview details' 
    });
  }
};

function extractCVKeywords(resumeText) {
  const text = resumeText.toLowerCase();
  const keywords = {
    languages: [],
    frameworks: [],
    databases: [],
    tools: [],
    experience: [],
    projects: [],
    education: [],
    skills: [],
    certifications: [],
    internships: []
  };
  
  const languages = [
    'javascript', 'python', 'java', 'typescript', 'html', 'css', 'sql', 'c++', 'c#', 
    'php', 'ruby', 'go', 'swift', 'kotlin', 'dart', 'rust', 'scala', 'perl', 'r', 'c',
    'matlab', 'shell', 'bash', 'powershell', 'lua', 'haskell', 'clojure', 'f#', 'vb.net'
  ];
  languages.forEach(lang => {
    if (text.includes(lang)) keywords.languages.push(lang);
  });
  
  const frameworks = [
    'react', 'angular', 'vue', 'nodejs', 'node.js', 'express', 'django', 'flask', 
    'spring', 'laravel', 'bootstrap', 'jquery', 'next.js', 'nuxt.js', 'svelte',
    'ember.js', 'backbone.js', 'meteor', 'electron', 'react native', 'flutter',
    '.net', 'tailwind', 'fastapi', 'nestjs', 'gatsby', 'redux', 'vuex'
  ];
  frameworks.forEach(fw => {
    if (text.includes(fw.toLowerCase())) keywords.frameworks.push(fw);
  });
  
  const databases = [
    'mysql', 'postgresql', 'mongodb', 'sqlite', 'redis', 'firebase', 'dynamodb',
    'cassandra', 'elasticsearch', 'oracle', 'sql server', 'mariadb', 'couchdb',
    'influxdb', 'neo4j', 'supabase'
  ];
  databases.forEach(db => {
    if (text.includes(db.toLowerCase())) keywords.databases.push(db);
  });

  const tools = [
    'git', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'jenkins', 'webpack',
    'babel', 'eslint', 'prettier', 'jest', 'cypress', 'selenium', 'postman', 'figma',
    'visual studio', 'vscode', 'github', 'gitlab', 'bitbucket', 'jira', 'slack',
    'linux', 'ubuntu', 'windows', 'macos', 'vim', 'emacs'
  ];
  tools.forEach(tool => {
    if (text.includes(tool.toLowerCase())) keywords.tools.push(tool);
  });

  const experienceIndicators = [
    'intern', 'internship', 'freelance', 'tutor', 'project', 'developed', 'built', 
    'created', 'implemented', 'designed', 'worked', 'experience'
  ];
  experienceIndicators.forEach(exp => {
    if (text.includes(exp)) keywords.experience.push(exp);
  });

  if (text.includes('certif') || text.includes('course')) {
    keywords.certifications.push('has certifications');
  }

  if (text.includes('university') || text.includes('college') || text.includes('degree')) {
    keywords.education.push('university student');
  }
  
  return keywords;
}

function extractJobKeywords(jobDescription) {
  const text = jobDescription.toLowerCase();
  const keywords = {
    skills: [],
    focus: [],
    level: 'intern'
  };
  
  if (text.includes('frontend') || text.includes('front-end')) keywords.focus.push('frontend');
  if (text.includes('backend') || text.includes('back-end')) keywords.focus.push('backend');
  if (text.includes('fullstack') || text.includes('full-stack')) keywords.focus.push('fullstack');
  if (text.includes('mobile')) keywords.focus.push('mobile');
  if (text.includes('web')) keywords.focus.push('web');
  if (text.includes('intern')) keywords.level = 'intern';
  
  return keywords;
}

async function generateInterviewQuestions(resumeText, jobDescription) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const cvKeywords = extractCVKeywords(resumeText);
    const jobKeywords = extractJobKeywords(jobDescription);
    
    const prompt = `You are interviewing a SOFTWARE ENGINEERING INTERN candidate. Generate exactly 10 interview questions based on their actual CV content and the Software Engineering Intern job requirements.

CRITICAL REQUIREMENTS:
1. This is for a SOFTWARE ENGINEERING INTERN position - adjust difficulty accordingly
2. Questions must be based on specific technologies/experiences from the candidate's CV
3. Questions must relate to Software Engineering intern-level expectations
4. Distribution: 3 behavioral + 4 technical + 3 coding questions
5. All questions should be appropriate for someone seeking an INTERNSHIP

CANDIDATE'S ACTUAL CV:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

BASED ON CV ANALYSIS:
- Languages mentioned: ${cvKeywords.languages.join(', ') || 'Basic programming'}
- Frameworks mentioned: ${cvKeywords.frameworks.join(', ') || 'Learning frameworks'}
- Experience level: ${cvKeywords.experience.length > 0 ? 'Some experience' : 'Academic/beginner'}
- Has certifications: ${cvKeywords.certifications.length > 0 ? 'Yes' : 'No'}

BEHAVIORAL QUESTIONS (3) - Intern Level:
- Ask about learning experiences, challenges in projects they mention
- Focus on growth mindset, problem-solving approach
- Reference specific projects/experiences from their CV

TECHNICAL QUESTIONS (4) - Intern Level:
- Basic concepts in technologies they mention
- Simple comparisons (not advanced architecture)
- Foundational knowledge appropriate for interns

CODING QUESTIONS (3) - Intern Level:
- Simple algorithms and data structures
- Basic programming problems
- Use languages they actually know from CV

RETURN ONLY VALID JSON:
[
  {
    "questionId": "q1",
    "type": "behavioral",
    "question": "Based on your CV showing [specific project/experience], tell me about...",
    "category": "relevant category",
    "difficulty": "easy" or "medium",
    "expectedDuration": 180,
    "followUpQuestions": [],
    "starterCode": null,
    "language": null
  }
]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let questionsText = response.text().trim();
    
    questionsText = cleanAndExtractJSON(questionsText);
    
    let questions;
    try {
      questions = JSON.parse(questionsText);
    } catch (parseError) {
      return getInternSpecificFallbackQuestions(resumeText, jobDescription, cvKeywords, jobKeywords);
    }

    if (!Array.isArray(questions) || questions.length !== 10) {
      return getInternSpecificFallbackQuestions(resumeText, jobDescription, cvKeywords, jobKeywords);
    }

    const validatedQuestions = questions.map((q, index) => {
      const questionId = q.questionId || `q${index + 1}`;
      const normalizedType = normalizeQuestionType(q.type);
      
      let starterCode = q.starterCode;
      if (normalizedType === 'coding' && !starterCode) {
        starterCode = generateInternLevelStarterCode(q.question, cvKeywords.languages);
      }
      
      return {
        questionId,
        type: normalizedType,
        question: q.question || `Intern-level question ${index + 1}`,
        category: q.category || 'general',
        difficulty: q.difficulty === 'hard' ? 'medium' : q.difficulty || 'easy',
        expectedDuration: normalizedType === 'coding' ? 300 : 180,
        followUpQuestions: q.followUpQuestions || [],
        starterCode: starterCode,
        language: normalizedType === 'coding' ? (cvKeywords.languages[0] || 'javascript') : null
      };
    });

    return validatedQuestions;

  } catch (error) {
    console.error('AI question generation failed:', error);
    const cvKeywords = extractCVKeywords(resumeText);
    const jobKeywords = extractJobKeywords(jobDescription);
    return getInternSpecificFallbackQuestions(resumeText, jobDescription, cvKeywords, jobKeywords);
  }
}

function getInternSpecificFallbackQuestions(resumeText, jobDescription, cvKeywords, jobKeywords) {
  const primaryLang = cvKeywords.languages[0] || 'javascript';
  const hasProjects = resumeText.toLowerCase().includes('project');
  const hasInternship = resumeText.toLowerCase().includes('intern');
  const hasCertifications = cvKeywords.certifications.length > 0;

  const questions = [
    {
      questionId: "q1",
      type: "behavioral",
      question: hasProjects 
        ? `I see from your CV that you've worked on projects using ${cvKeywords.languages.join(' and ')}. Tell me about one project you're most proud of. What challenges did you face as a beginner and how did you overcome them?`
        : `As someone starting their software engineering journey, tell me about a programming challenge you faced during your studies or personal learning. How did you approach solving it?`,
      category: "learning_experience",
      difficulty: "easy",
      expectedDuration: 180,
      followUpQuestions: [
        "What would you do differently if you started this project again?",
        "What did you learn from this experience that you'll apply to future projects?"
      ],
      starterCode: null,
      language: null
    },
    {
      questionId: "q2",
      type: "behavioral",
      question: hasCertifications
        ? `Your CV shows you've completed certifications in ${cvKeywords.languages.join(', ')}. What motivated you to pursue these certifications, and how do you approach learning new technologies?`
        : `Tell me about a time when you had to learn a new programming concept or technology quickly. What resources did you use and what was your learning process?`,
      category: "learning_approach",
      difficulty: "easy",
      expectedDuration: 180,
      followUpQuestions: [
        "How do you stay motivated when learning difficult concepts?",
        "What's the most challenging technical concept you've learned so far?"
      ],
      starterCode: null,
      language: null
    },
    {
      questionId: "q3",
      type: "behavioral",
      question: hasInternship
        ? `I notice you have internship experience. Tell me about a situation where you had to ask for help or guidance. How did you approach it and what did you learn?`
        : `As an intern, you'll be working with senior developers. Describe a situation where you had to collaborate with others on a technical project or seek guidance from more experienced people.`,
      category: "collaboration",
      difficulty: "easy",
      expectedDuration: 180,
      followUpQuestions: [
        "How comfortable are you with asking questions when you're stuck?",
        "What would you do if you disagreed with a senior developer's approach?"
      ],
      starterCode: null,
      language: null
    },
    {
      questionId: "q4",
      type: "technical",
      question: primaryLang === 'javascript'
        ? `Since you know JavaScript, explain the difference between var, let, and const. When would you use each one in your code?`
        : primaryLang === 'python'
        ? `I see you know Python. Explain what Python lists and dictionaries are, and give me an example of when you'd use each one.`
        : `Based on your experience with ${primaryLang}, explain some basic concepts of this language that every intern should know.`,
      category: "fundamentals",
      difficulty: "easy",
      expectedDuration: 150,
      followUpQuestions: [],
      starterCode: null,
      language: null
    },
    {
      questionId: "q5",
      type: "technical",
      question: cvKeywords.databases.length > 0
        ? `Your CV mentions ${cvKeywords.databases[0]}. As an intern, explain the difference between storing data in a database versus storing it in regular variables. Why would we use a database?`
        : `As a software engineering intern, you'll likely work with databases. Can you explain in simple terms what a database is and why we use them instead of just storing data in files?`,
      category: "databases",
      difficulty: "easy",
      expectedDuration: 150,
      followUpQuestions: [],
      starterCode: null,
      language: null
    },
    {
      questionId: "q6",
      type: "technical",
      question: cvKeywords.frameworks.includes('react')
        ? `I see you have React experience. For an intern role, explain what React components are and why they're useful in web development.`
        : jobKeywords.focus.includes('web')
        ? `This internship involves web development. Explain the difference between frontend and backend development in simple terms.`
        : `Explain what object-oriented programming means to you and why it's useful in software development.`,
      category: "development_concepts",
      difficulty: "easy",
      expectedDuration: 150,
      followUpQuestions: [],
      starterCode: null,
      language: null
    },
    {
      questionId: "q7",
      type: "technical",
      question: cvKeywords.tools.includes('git') || resumeText.toLowerCase().includes('github')
        ? `I see you have Git/GitHub experience. Explain what version control is and why it's important for software development, especially when working in teams.`
        : `As an intern, you'll use version control systems like Git. Based on any experience or research you've done, what do you understand about version control and why it's important?`,
      category: "tools",
      difficulty: "easy",
      expectedDuration: 150,
      followUpQuestions: [],
      starterCode: null,
      language: null
    },
    {
      questionId: "q8",
      type: "coding",
      question: `Write a simple ${primaryLang} function that takes an array of numbers and returns the largest number. This is a basic problem that tests your understanding of loops and comparison logic.`,
      category: "arrays",
      difficulty: "easy",
      expectedDuration: 300,
      followUpQuestions: [],
      starterCode: generateInternLevelStarterCode("find max in array", [primaryLang]),
      language: primaryLang
    },
    {
      questionId: "q9",
      type: "coding", 
      question: primaryLang === 'javascript'
        ? `Create a simple JavaScript function that checks if a string is a palindrome (reads the same forwards and backwards). For example, "racecar" is a palindrome.`
        : `Write a ${primaryLang} function that checks if a string is a palindrome (reads the same forwards and backwards). This tests your string manipulation skills.`,
      category: "strings",
      difficulty: "easy",
      expectedDuration: 300,
      followUpQuestions: [],
      starterCode: generateInternLevelStarterCode("palindrome check", [primaryLang]),
      language: primaryLang
    },
    {
      questionId: "q10",
      type: "coding",
      question: `Write a ${primaryLang} function that counts how many times each character appears in a string. For example, "hello" should return h:1, e:1, l:2, o:1. This tests your ability to work with data structures.`,
      category: "data_structures",
      difficulty: "medium",
      expectedDuration: 300,
      followUpQuestions: [],
      starterCode: generateInternLevelStarterCode("character count", [primaryLang]),
      language: primaryLang
    }
  ];

  return questions;
}

function generateInternLevelStarterCode(questionHint, candidateLanguages) {
  const primaryLang = candidateLanguages[0] || 'javascript';
  const starterCode = {};

  if (primaryLang === 'javascript' || candidateLanguages.includes('javascript')) {
    if (questionHint.includes('max') || questionHint.includes('largest')) {
      starterCode.javascript = `function findMax(numbers) {
    // Your code here
    // Hint: Use a loop to compare numbers
    
    return maxNumber;
}

// Test
const testArray = [3, 7, 2, 9, 1];
console.log(findMax(testArray)); // Should return 9`;
    } else if (questionHint.includes('palindrome')) {
      starterCode.javascript = `function isPalindrome(str) {
    // Your code here
    // Hint: Compare the string with its reverse
    
    return true; // or false
}

// Test
console.log(isPalindrome("racecar")); // Should return true
console.log(isPalindrome("hello")); // Should return false`;
    } else if (questionHint.includes('character') || questionHint.includes('count')) {
      starterCode.javascript = `function countCharacters(str) {
    // Your code here
    // Hint: Use an object to store character counts
    const counts = {};
    
    return counts;
}

// Test
console.log(countCharacters("hello")); // Should return {h:1, e:1, l:2, o:1}`;
    } else {
      starterCode.javascript = `function solution(input) {
    // Your code here
    
    return result;
}

// Test case
console.log(solution(testInput));`;
    }
  }

  if (primaryLang === 'python' || candidateLanguages.includes('python')) {
    if (questionHint.includes('max') || questionHint.includes('largest')) {
      starterCode.python = `def find_max(numbers):
    # Your code here
    # Hint: Use a loop to compare numbers
    pass

# Test
test_array = [3, 7, 2, 9, 1]
print(find_max(test_array))  # Should return 9`;
    } else if (questionHint.includes('palindrome')) {
      starterCode.python = `def is_palindrome(s):
    # Your code here
    # Hint: Compare the string with its reverse
    pass

# Test
print(is_palindrome("racecar"))  # Should return True
print(is_palindrome("hello"))    # Should return False`;
    } else if (questionHint.includes('character') || questionHint.includes('count')) {
      starterCode.python = `def count_characters(s):
    # Your code here
    # Hint: Use a dictionary to store character counts
    counts = {}
    return counts

# Test
print(count_characters("hello"))  # Should return {'h':1, 'e':1, 'l':2, 'o':1}`;
    } else {
      starterCode.python = `def solution(input_data):
    # Your code here
    pass

# Test case
print(solution(test_input))`;
    }
  }

  if (primaryLang === 'java' || candidateLanguages.includes('java')) {
    if (questionHint.includes('max') || questionHint.includes('largest')) {
      starterCode.java = `public class Solution {
    public static int findMax(int[] numbers) {
        // Your code here
        return 0;
    }
    
    public static void main(String[] args) {
        int[] test = {3, 7, 2, 9, 1};
        System.out.println(findMax(test)); // Should return 9
    }
}`;
    } else if (questionHint.includes('palindrome')) {
      starterCode.java = `public class Solution {
    public static boolean isPalindrome(String str) {
        // Your code here
        return false;
    }
    
    public static void main(String[] args) {
        System.out.println(isPalindrome("racecar")); // Should return true
        System.out.println(isPalindrome("hello"));   // Should return false
    }
}`;
    } else {
      starterCode.java = `public class Solution {
    public static int solution(int[] input) {
        // Your code here
        return 0;
    }
    
    public static void main(String[] args) {
        int[] test = {1, 2, 3, 4, 5};
        System.out.println(solution(test));
    }
}`;
    }
  }

  if (primaryLang === 'c++' || candidateLanguages.includes('c++')) {
    if (questionHint.includes('max') || questionHint.includes('largest')) {
      starterCode.cpp = `#include <iostream>
#include <vector>
using namespace std;

int findMax(vector<int>& numbers) {
    // Your code here
    return 0;
}

int main() {
    vector<int> test = {3, 7, 2, 9, 1};
    cout << findMax(test) << endl; // Should return 9
    return 0;
}`;
    } else {
      starterCode.cpp = `#include <iostream>
#include <vector>
using namespace std;

int solution(vector<int>& input) {
    // Your code here
    return 0;
}

int main() {
    vector<int> test = {1, 2, 3, 4, 5};
    cout << solution(test) << endl;
    return 0;
}`;
    }
  }

  if (primaryLang === 'c#' || primaryLang === 'csharp' || candidateLanguages.includes('c#') || candidateLanguages.includes('csharp')) {
    if (questionHint.includes('max') || questionHint.includes('largest')) {
      starterCode.csharp = `using System;

public class Solution {
    public static int FindMax(int[] numbers) {
        // Your code here
        return 0;
    }
    
    public static void Main() {
        int[] test = {3, 7, 2, 9, 1};
        Console.WriteLine(FindMax(test)); // Should return 9
    }
}`;
    } else if (questionHint.includes('palindrome')) {
      starterCode.csharp = `using System;

public class Solution {
    public static bool IsPalindrome(string str) {
        // Your code here
        return false;
    }
    
    public static void Main() {
        Console.WriteLine(IsPalindrome("racecar")); // Should return True
        Console.WriteLine(IsPalindrome("hello"));   // Should return False
    }
}`;
    } else {
      starterCode.csharp = `using System;

public class Solution {
    public static int SolutionMethod(int[] input) {
        // Your code here
        return 0;
    }
    
    public static void Main() {
        int[] test = {1, 2, 3, 4, 5};
        Console.WriteLine(SolutionMethod(test));
    }
}`;
    }
  }

  if (Object.keys(starterCode).length === 0) {
    starterCode[primaryLang] = `// Your ${primaryLang} solution here
// This is an intern-level problem`;
  }

  return starterCode;
}

function normalizeQuestionType(type) {
  const typeMapping = {
    'behavioral': 'behavioral',
    'technical': 'technical',
    'coding': 'coding',
    'problem-solving': 'problem-solving',
    'system_design': 'system_design',
    'technical_coding': 'coding',
    'technical_conceptual': 'technical',
    'problemsolving': 'problem-solving',
    'algorithm': 'coding',
    'algorithms': 'coding',
    'data-structure': 'technical',
    'data-structures': 'technical',
    'system-design': 'system_design',
    'systemdesign': 'system_design',
    'design': 'technical',
    'web-development': 'technical',
    'frontend': 'technical',
    'backend': 'technical',
    'database': 'technical',
    'api': 'technical',
    'general': 'technical'
  };

  const normalized = type ? type.toLowerCase().replace(/[^a-z-]/g, '') : '';
  return typeMapping[normalized] || typeMapping[type?.toLowerCase()] || 'technical';
}

function cleanAndExtractJSON(text) {
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```javascript\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/^```/gm, '')
    .replace(/```$/gm, '')
    .trim();
  
  const arrayStartIndex = cleaned.indexOf('[');
  const arrayEndIndex = cleaned.lastIndexOf(']');
  
  if (arrayStartIndex !== -1 && arrayEndIndex !== -1 && arrayEndIndex > arrayStartIndex) {
    cleaned = cleaned.substring(arrayStartIndex, arrayEndIndex + 1);
  }
  
  return cleaned;
}

async function generateOverallFeedback(responses, resumeText, jobDescription) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { 
        temperature: 0.2,
        maxOutputTokens: 1200
      }
    });

    // Calculate basic stats
    const scores = responses.map(r => r.feedback?.score || 0);
    const averageScore = scores.length > 0 
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
      : 0;

    const behavioralResponses = responses.filter(r => r.questionType === 'behavioral');
    const technicalResponses = responses.filter(r => r.questionType === 'technical');
    const codingResponses = responses.filter(r => r.questionType === 'coding');

    // Truncate inputs to prevent issues
    const maxLength = 1000;
    const sanitizedResume = resumeText.split(' ').slice(0, maxLength).join(' ');
    const sanitizedJob = jobDescription.split(' ').slice(0, 300).join(' ');

    const prompt = `Provide overall interview feedback for a SOFTWARE ENGINEERING INTERN candidate.

CRITICAL: Respond with ONLY valid JSON. No markdown, no explanations, no additional text.

PERFORMANCE SUMMARY:
- Average Score: ${averageScore.toFixed(1)}/100
- Questions Answered: ${responses.length}
- Behavioral: ${behavioralResponses.length} questions
- Technical: ${technicalResponses.length} questions  
- Coding: ${codingResponses.length} questions

CANDIDATE BACKGROUND:
${sanitizedResume}

JOB REQUIREMENTS:
${sanitizedJob}

Return this exact JSON structure:

{
  "overallScore": 75,
  "readinessLevel": "Needs Development",
  "keyStrengths": ["Shows learning potential", "Good communication skills"],
  "majorImprovements": ["Strengthen technical fundamentals", "Practice coding problems"],
  "specificRecommendations": ["Build personal projects", "Study data structures"],
  "generalFeedback": "Detailed assessment of overall performance and readiness for intern role",
  "categoryBreakdown": {
    "technicalKnowledge": 70,
    "codingAbility": 65,
    "behavioralSkills": 80,
    "communication": 75
  }
}

ASSESSMENT LEVELS: "Ready", "Needs Development", "Not Ready"`;

    console.log('🤖 Generating overall feedback...');

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let feedbackText = response.text().trim();

    console.log('📥 Raw feedback response preview:', feedbackText.substring(0, 100) + "...");

    // Enhanced JSON extraction
    let cleanText = feedbackText.replace(/```json\s*|```\s*/g, '').trim();
    
    let jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    }

    let aiAnalysis;
    try {
      aiAnalysis = JSON.parse(cleanText);
      console.log('✅ Successfully parsed overall feedback JSON');
    } catch (parseError) {
      console.error('❌ Overall feedback JSON parse error:', parseError.message);
      console.log('🔍 Failed to parse:', cleanText.substring(0, 200));
      return generateFallbackOverallFeedback(responses);
    }

    // Validate required fields
    const requiredFields = ['overallScore', 'readinessLevel', 'keyStrengths', 'majorImprovements'];
    const isValid = requiredFields.every(field => aiAnalysis.hasOwnProperty(field));
    
    if (!isValid) {
      console.warn("Invalid overall feedback structure, using fallback");
      return generateFallbackOverallFeedback(responses);
    }

    // Ensure category breakdown exists with proper structure
    const categoryBreakdown = aiAnalysis.categoryBreakdown || {
      technicalKnowledge: technicalResponses.length > 0 
        ? Math.round(technicalResponses.reduce((sum,r) => sum + (r.feedback?.score || 0), 0) / technicalResponses.length)
        : Math.round(averageScore),
      codingAbility: codingResponses.length > 0 
        ? Math.round(codingResponses.reduce((sum,r) => sum + (r.feedback?.score || 0), 0) / codingResponses.length)
        : Math.round(averageScore),
      behavioralSkills: behavioralResponses.length > 0 
        ? Math.round(behavioralResponses.reduce((sum,r) => sum + (r.feedback?.score || 0), 0) / behavioralResponses.length)
        : Math.round(averageScore),
      communication: Math.round(responses.reduce((sum,r) => sum + (r.feedback?.communicationClarity || 5), 0) / responses.length * 10)
    };

    console.log('✅ Overall feedback generated successfully');

    return {
      score: Math.round(aiAnalysis.overallScore || averageScore),
      feedback: {
        readinessLevel: aiAnalysis.readinessLevel || 'Under Assessment',
        strengths: Array.isArray(aiAnalysis.keyStrengths) ? aiAnalysis.keyStrengths.slice(0, 5) : ['Completed all interview questions'],
        improvements: Array.isArray(aiAnalysis.majorImprovements) ? aiAnalysis.majorImprovements.slice(0, 5) : ['Continue practicing technical skills'],
        recommendations: Array.isArray(aiAnalysis.specificRecommendations) ? aiAnalysis.specificRecommendations.slice(0, 5) : ['Build more projects', 'Practice coding problems'],
        generalFeedback: aiAnalysis.generalFeedback || `Candidate completed ${responses.length} questions with an average score of ${averageScore.toFixed(1)}%. Shows ${averageScore >= 70 ? 'good potential' : 'developing skills'} for an intern position.`,
        categoryScores: categoryBreakdown
      }
    };

  } catch (error) {
    console.error('❌ Overall feedback generation failed:', error.message);
    return generateFallbackOverallFeedback(responses);
  }
}

function generateFallbackOverallFeedback(responses) {
  const scores = responses.map(r => r.feedback?.score || 0);
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  
  const behavioralResponses = responses.filter(r => r.questionType === 'behavioral');
  const technicalResponses = responses.filter(r => r.questionType === 'technical');
  const codingResponses = responses.filter(r => r.questionType === 'coding');

  const behavioralAvg = behavioralResponses.length > 0 
    ? behavioralResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / behavioralResponses.length 
    : averageScore;
  
  const technicalAvg = technicalResponses.length > 0 
    ? technicalResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / technicalResponses.length 
    : averageScore;
  
  const codingAvg = codingResponses.length > 0 
    ? codingResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / codingResponses.length 
    : averageScore;

  const readinessLevel = averageScore >= 75 ? 'Ready' : averageScore >= 60 ? 'Needs Development' : 'Not Ready';
  
  return {
    score: Math.round(averageScore),
    feedback: {
      readinessLevel: readinessLevel + ' for intern position',
      strengths: [
        'Completed all interview questions successfully',
        averageScore >= 70 ? 'Demonstrated solid foundational knowledge' : 'Showed willingness to engage with technical challenges',
        behavioralAvg >= technicalAvg ? 'Strong communication and interpersonal skills' : 'Good technical problem-solving approach'
      ],
      improvements: [
        averageScore < 60 ? 'Focus on building stronger technical fundamentals' : 'Continue developing advanced technical concepts',
        'Practice explaining complex ideas more clearly',
        codingAvg < 60 ? 'Improve coding implementation skills' : 'Work on code optimization and best practices'
      ],
      recommendations: [
        'Build personal projects to gain hands-on experience',
        'Practice coding problems on platforms like LeetCode or HackerRank',
        'Study computer science fundamentals (data structures, algorithms)',
        'Join coding communities and participate in code reviews',
        'Work on communication skills through technical presentations'
      ],
      generalFeedback: `The candidate completed a ${responses.length}-question interview with an overall average score of ${averageScore.toFixed(1)}%. They demonstrated ${readinessLevel.toLowerCase()} for a software engineering internship position. ${averageScore >= 80 ? 'Excellent performance showing strong technical foundation and clear communication.' : averageScore >= 70 ? 'Good performance with solid understanding and room for growth.' : averageScore >= 60 ? 'Satisfactory performance showing basic understanding but requiring significant development.' : 'Performance indicates need for substantial improvement in technical skills before being ready for internship responsibilities.'} The candidate would benefit from focused practice in areas where they scored below 60%.`,
      categoryScores: {
        technicalKnowledge: Math.round(technicalAvg),
        codingAbility: Math.round(codingAvg),
        behavioralSkills: Math.round(behavioralAvg),
        communication: Math.round(responses.reduce((sum, r) => sum + (r.feedback?.communicationClarity || 5), 0) / responses.length)
      }
    }
  };
}

function calculateFinalResults(responses, totalDuration) {
  const scores = responses.map(r => r.feedback?.score || 0);
  const overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  
  const behavioralResponses = responses.filter(r => r.questionType === 'behavioral');
  const technicalResponses = responses.filter(r => r.questionType === 'technical');
  const codingResponses = responses.filter(r => r.questionType === 'coding');

  const categoryScores = {
    behavioral: behavioralResponses.length > 0 
      ? Math.round(behavioralResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / behavioralResponses.length)
      : Math.round(overallScore),
    
    technical: technicalResponses.length > 0 
      ? Math.round(technicalResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / technicalResponses.length)
      : Math.round(overallScore),
    
    coding: codingResponses.length > 0 
      ? Math.round(codingResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / codingResponses.length)
      : Math.round(overallScore)
  };

  const communicationScore = Math.round(
    responses.reduce((sum, r) => sum + (r.feedback?.communicationClarity || 5), 0) / responses.length
  );

  const technicalAccuracyScore = Math.round(
    responses.reduce((sum, r) => sum + (r.feedback?.technicalAccuracy || 5), 0) / responses.length
  );

  const problemSolvingScore = Math.round(
    (categoryScores.coding + categoryScores.technical) / 2
  );

  return {
    score: Math.round(overallScore),
    duration: totalDuration,
    categoryPercentages: {
      behavioral: categoryScores.behavioral,
      technical: categoryScores.technical,
      coding: categoryScores.coding,
      communication: (communicationScore / 10) * 100,
      technicalAccuracy: (technicalAccuracyScore / 10) * 100,
      problemSolving: problemSolvingScore
    },
    breakdown: {
      totalQuestions: responses.length,
      behavioralQuestions: behavioralResponses.length,
      technicalQuestions: technicalResponses.length,
      codingQuestions: codingResponses.length,
      averageResponseTime: responses.length > 0 
        ? Math.round(responses.reduce((sum, r) => sum + (r.responseTime || 0), 0) / responses.length)
        : 0
    }
  };
}
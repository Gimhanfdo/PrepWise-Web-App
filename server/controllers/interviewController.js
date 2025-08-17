import InterviewModel from '../models/InterviewModel.js';
import userModel from '../models/userModel.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

    // Generate questions with error handling
    let questions;
    try {
      questions = await generateInterviewQuestions(resumeText, jobDescription);
    } catch (questionError) {
      console.error('Question generation failed:', questionError);
      // Use fallback questions
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

    // Find user and check CV
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

    // Get CV text safely
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

    // Generate questions with error handling
    let questions;
    try {
      questions = await generateInterviewQuestions(actualCVText, jobDescription);
    } catch (questionError) {
      console.error('Question generation failed:', questionError);
      // Use fallback questions
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

// Validation helper functions
function validateAndSanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove potentially harmful characters and limit length
  return input
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .substring(0, 10000); // Limit length to prevent overflow
}

function validateCodingSubmission(questionType, responseText, code, language, expectedLanguage, isSkipped = false) {
  const errors = [];

  if (isSkipped) {
    return errors; // No validation errors for skipped questions
  }

  if (questionType === 'coding') {
    // Code presence
    if (!code || code.trim().length === 0) {
      errors.push('Code is required for coding questions');
    }

    // Language presence
    if (!language) {
      errors.push('Programming language must be specified for coding questions');
    }

    // Language match
    if (expectedLanguage && language && language.toLowerCase() !== expectedLanguage.toLowerCase()) {
      errors.push(`Submitted code language (${language}) does not match expected (${expectedLanguage})`);
    }

    // Check if code contains basic programming elements
    const codeToCheck = code || responseText || '';
    const hasBasicElements = /\b(function|def|class|int|string|return|if|for|while|const|let|var)\b/i.test(codeToCheck);

    if (!hasBasicElements && codeToCheck.length > 0) {
      console.warn('Code submission may not contain valid programming syntax');
    }
  }

  return errors;
}

// Helper function to validate the submitted language
function validateLanguage(language) {
  return language ? language.trim() : null;
}

export const submitAnswer = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { questionId, responseTime, answerMode, responseText, code, language, skipped } = req.body;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    // Input validation and sanitization
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

    // ✅ Skip handling: bypass coding validation entirely
    if (skipped) {
      const analysis = await generateStrictAIFeedback(
        question.question,
        question.type,
        sanitizedResponseText,
        sanitizedCode,
        validatedLanguage,
        true // <- tell AI feedback this was skipped
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

    // ✅ Normal submission path (non-skipped)
    const validationErrors = validateCodingSubmission(
      question.type,
      sanitizedResponseText,
      sanitizedCode,
      validatedLanguage,
      question.language, // expected language
      false // <- not skipped
    );

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid submission',
        details: validationErrors
      });
    }

    console.log('=== ANALYZING RESPONSE ===');
    console.log('Question:', question.question);
    console.log('Question Type:', question.type);
    console.log('Response:', sanitizedResponseText);
    console.log('Code:', sanitizedCode || 'None');
    console.log('Language:', validatedLanguage);

    // Use improved AI feedback
    let analysis;
    try {
      analysis = await generateStrictAIFeedback(
        question.question,
        question.type,
        sanitizedResponseText,
        sanitizedCode,
        validatedLanguage,
        false // <- not skipped
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
      skipped: false
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

async function generateStrictAIFeedback(question, questionType, responseText, code, language, isSkipped = false) {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-pro",
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
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
      strengths: [],
      improvements: [],
      detailedAnalysis: "This question was skipped by the candidate.",
      overallAssessment: "No assessment since the question was skipped."
    };
  }

  const codeSection = code ? `
CODE PROVIDED (${language}): 
\`\`\`${language}
${code}
\`\`\`` : 'NO CODE PROVIDED';

  const prompt = `You are a senior software engineering interviewer and code reviewer. 
Analyze this response thoroughly and give strict, constructive feedback. For coding questions, evaluate correctness, syntax, language best practices, efficiency, code structure/readability, and edge case handling.

CRITICAL: Your response MUST be valid JSON only. Do not include any explanatory text, markdown formatting, or wrapper tags. Start directly with { and end with }.

{
  "score": [number 0-100],
  "questionRelevance": [number 1-10],
  "responseType": "[perfectly-relevant|mostly-relevant|partially-relevant|mostly-irrelevant|completely-off-topic]",
  "correctness": [number 1-10],
  "syntax": [number 1-10],
  "languageBestPractices": [number 1-10],
  "efficiency": [number 1-10],
  "structureAndReadability": [number 1-10],
  "edgeCaseHandling": [number 1-10],
  "strengths": ["strength1","strength2","strength3"],
  "improvements": ["improvement1","improvement2","improvement3","improvement4"],
  "detailedAnalysis": "Honest analysis of response quality",
  "overallAssessment": "Final verdict on quality"
}

QUESTION: "${question}"
QUESTION TYPE: ${questionType}
RESPONSE: "${responseText}"
${codeSection}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let analysisText = response.text().trim();

    // Multiple JSON extraction strategies
    let jsonText = analysisText;
    
    // Strategy 1: Remove common markdown wrappers
    jsonText = jsonText.replace(/```json\s*/gi, '').replace(/```javascript\s*/gi, '').replace(/```\s*/g, '');
    
    // Strategy 2: Extract content between first { and last }
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText.substring(firstBrace, lastBrace + 1);
    }
    
    // Strategy 3: Remove any remaining non-JSON text before/after
    jsonText = jsonText.replace(/^[^{]*/, '').replace(/[^}]*$/, '');

    let aiAnalysis;
    try {
      aiAnalysis = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError.message);
      console.error('Cleaned JSON attempt:', jsonText.substring(0, 200) + '...');
      
      // Try one more extraction method - look for JSON-like structure
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          aiAnalysis = JSON.parse(jsonMatch[0]);
        } catch (secondParseError) {
          throw new Error('Failed to parse AI feedback JSON after multiple attempts');
        }
      } else {
        throw new Error('No JSON structure found in AI response');
      }
    }

    return validateAndSanitizeAIResponse(aiAnalysis, questionType);
  } catch (error) {
    console.error('AI Feedback Generation Error:', error.message);
    throw error;
  }
}

// Enhanced response validation with better defaults
function validateAndSanitizeAIResponse(aiAnalysis, questionType) {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value || min));
  
  // Ensure all required fields exist with proper defaults
  const validatedResponse = {
    score: Math.round(clamp(aiAnalysis.score || 40, 0, 100)),
    questionRelevance: clamp(aiAnalysis.questionRelevance || 5, 1, 10),
    responseType: aiAnalysis.responseType || 'partially-relevant',
    correctness: clamp(aiAnalysis.correctness || 5, 1, 10),
    syntax: clamp(aiAnalysis.syntax || 5, 1, 10),
    languageBestPractices: clamp(aiAnalysis.languageBestPractices || 5, 1, 10),
    efficiency: clamp(aiAnalysis.efficiency || 5, 1, 10),
    structureAndReadability: clamp(aiAnalysis.structureAndReadability || 5, 1, 10),
    edgeCaseHandling: clamp(aiAnalysis.edgeCaseHandling || 5, 1, 10),
    strengths: Array.isArray(aiAnalysis.strengths) && aiAnalysis.strengths.length > 0 
      ? aiAnalysis.strengths.slice(0, 3) 
      : ['Attempted to provide a response'],
    improvements: Array.isArray(aiAnalysis.improvements) && aiAnalysis.improvements.length > 0 
      ? aiAnalysis.improvements.slice(0, 4) 
      : [
          'Focus on correct problem-solving approach',
          'Use best practices for the selected language',
          'Improve readability and structure',
          'Handle edge cases and optimize logic'
        ],
    detailedAnalysis: aiAnalysis.detailedAnalysis || 'Response analyzed for correctness, efficiency, and best practices.',
    overallAssessment: aiAnalysis.overallAssessment || 'Response shows effort but needs improvement in technical accuracy and approach'
  };

  // Validate responseType is one of expected values
  const validResponseTypes = ['perfectly-relevant', 'mostly-relevant', 'partially-relevant', 'mostly-irrelevant', 'completely-off-topic'];
  if (!validResponseTypes.includes(validatedResponse.responseType)) {
    validatedResponse.responseType = 'partially-relevant';
  }

  return validatedResponse;
}

// Fallback feedback for when AI fails
function generateFallbackFeedback(questionType, responseText, code) {
  const hasCode = code && code.trim().length > 0;
  const responseLength = responseText.length;
  
  let score = 40; // Default middle-low score
  let strengths = ['Provided a response to the question'];
  let improvements = ['Provide more detailed and specific information'];
  
  // Adjust based on question type
  if (questionType === 'coding') {
    if (hasCode) {
      score = 45;
      strengths = ['Attempted to provide code solution'];
      improvements = [
        'Ensure code directly solves the problem stated',
        'Check syntax and logic flow',
        'Add comments explaining the approach'
      ];
    } else {
      score = 20;
      strengths = ['None identified'];
      improvements = [
        'Must provide actual code for coding questions',
        'Implement the solution using proper programming syntax',
        'Test the solution with example inputs'
      ];
    }
  } else if (questionType === 'technical') {
    if (responseLength > 100) {
      score = 50;
      strengths = ['Provided detailed technical response'];
    } else {
      score = 35;
      improvements.push('Provide more comprehensive technical explanations');
    }
  } else if (questionType === 'behavioral') {
    if (responseLength > 150) {
      score = 55;
      strengths = ['Shared personal experience or examples'];
    } else {
      score = 40;
      improvements.push('Include specific examples and personal experiences');
    }
  }

  return {
    score: score,
    questionRelevance: 5,
    responseType: 'partially-relevant',
    strengths: strengths,
    improvements: improvements,
    detailedAnalysis: 'System fallback analysis: Response submitted but needs improvement in addressing the specific question requirements.',
    communicationClarity: responseLength > 50 ? 6 : 4,
    technicalAccuracy: hasCode ? 5 : 4,
    overallAssessment: 'Response shows effort but requires significant improvement'
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

    // Validate and sanitize inputs
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    
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
    "starterCode": null
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
        starterCode: starterCode
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
      starterCode: null
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
      starterCode: null
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
      starterCode: null
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
      starterCode: null
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
      starterCode: null
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
      starterCode: null
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
      starterCode: null
    },
    {
      questionId: "q8",
      type: "coding",
      question: `Write a simple ${primaryLang} function that takes an array of numbers and returns the largest number. This is a basic problem that tests your understanding of loops and comparison logic.`,
      category: "arrays",
      difficulty: "easy",
      expectedDuration: 300,
      followUpQuestions: [],
      starterCode: generateInternLevelStarterCode("find max in array", [primaryLang])
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
      starterCode: generateInternLevelStarterCode("palindrome check", [primaryLang])
    },
    {
      questionId: "q10",
      type: "coding",
      question: `Write a ${primaryLang} function that counts how many times each character appears in a string. For example, "hello" should return h:1, e:1, l:2, o:1. This tests your ability to work with data structures.`,
      category: "data_structures",
      difficulty: "medium",
      expectedDuration: 300,
      followUpQuestions: [],
      starterCode: generateInternLevelStarterCode("character count", [primaryLang])
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    
    const scores = responses.map(r => r.feedback?.score || 0);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    const behavioralResponses = responses.filter(r => r.questionType === 'behavioral');
    const technicalResponses = responses.filter(r => r.questionType === 'technical');
    const codingResponses = responses.filter(r => r.questionType === 'coding');

    const responseSummary = responses.map((r, i) => 
      `Q${i+1} (${r.questionType}): "${r.question}" - Score: ${r.feedback?.score || 0}/100`
    ).join('\n');

    const prompt = `Provide comprehensive overall interview feedback for a SOFTWARE ENGINEERING INTERN candidate based on their actual responses.

INTERVIEW PERFORMANCE SUMMARY:
- Overall Average Score: ${averageScore.toFixed(1)}/100
- Total Questions Answered: ${responses.length}
- Behavioral Questions: ${behavioralResponses.length} (avg: ${behavioralResponses.length > 0 ? (behavioralResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / behavioralResponses.length).toFixed(1) : 'N/A'})
- Technical Questions: ${technicalResponses.length} (avg: ${technicalResponses.length > 0 ? (technicalResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / technicalResponses.length).toFixed(1) : 'N/A'})
- Coding Questions: ${codingResponses.length} (avg: ${codingResponses.length > 0 ? (codingResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / codingResponses.length).toFixed(1) : 'N/A'})

DETAILED QUESTION BREAKDOWN:
${responseSummary}

JOB APPLIED FOR: Software Engineering Intern
CANDIDATE'S BACKGROUND: Based on CV analysis

Provide a comprehensive assessment covering:
1. Overall technical readiness for an intern position
2. Communication and explanation abilities
3. Problem-solving approach demonstrated
4. Key strengths shown across all responses
5. Major areas needing improvement
6. Specific actionable recommendations for growth
7. General feedback on interview performance

Return ONLY valid JSON:
{
  "overallScore": ${Math.round(averageScore)},
  "readinessLevel": "Ready/Needs Development/Not Ready for intern position",
  "keyStrengths": ["strength1", "strength2", "strength3"],
  "majorImprovements": ["improvement1", "improvement2", "improvement3"],
  "specificRecommendations": ["rec1", "rec2", "rec3", "rec4"],
  "generalFeedback": "Comprehensive paragraph about overall interview performance, communication style, technical understanding, and readiness for internship",
  "categoryBreakdown": {
    "technicalKnowledge": ${Math.round(technicalResponses.length > 0 ? technicalResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / technicalResponses.length : averageScore)},
    "codingAbility": ${Math.round(codingResponses.length > 0 ? codingResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / codingResponses.length : averageScore)},
    "behavioralSkills": ${Math.round(behavioralResponses.length > 0 ? behavioralResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / behavioralResponses.length : averageScore)},
    "communication": ${Math.round(responses.reduce((sum, r) => sum + (r.feedback?.communicationClarity || 5), 0) / responses.length)}
  }
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const feedbackText = response.text().trim();
    
    const cleanedText = feedbackText.replace(/```json\s*|```\s*/g, '').trim();
    const aiAnalysis = JSON.parse(cleanedText);
    
    return {
      score: aiAnalysis.overallScore || Math.round(averageScore),
      feedback: {
        readinessLevel: aiAnalysis.readinessLevel || 'Under Assessment',
        strengths: aiAnalysis.keyStrengths || ['Completed all interview questions'],
        improvements: aiAnalysis.majorImprovements || ['Continue practicing technical skills'],
        recommendations: aiAnalysis.specificRecommendations || ['Build more projects', 'Practice coding problems'],
        generalFeedback: aiAnalysis.generalFeedback || `Candidate completed ${responses.length} questions with an average score of ${averageScore.toFixed(1)}%. Shows ${averageScore >= 70 ? 'good potential' : 'developing skills'} for an intern position.`,
        categoryScores: aiAnalysis.categoryBreakdown || {
          technicalKnowledge: Math.round(averageScore),
          codingAbility: Math.round(averageScore),
          behavioralSkills: Math.round(averageScore),
          communication: Math.round(averageScore / 10)
        }
      }
    };

  } catch (error) {
    console.error('Overall feedback generation failed:', error);
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
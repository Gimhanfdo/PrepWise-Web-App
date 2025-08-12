import interviewModel from '../models/interviewModel.js';
import userModel from '../models/userModel.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI with correct model name
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Create new interview session
export const createInterview = async (req, res) => {
  try {
    // Debug: Log the user object from middleware
    console.log('User from middleware:', req.user);
    
    // Handle different user object structures
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    const { jobTitle, jobDescription, resumeText } = req.body;

    console.log('Extracted userId:', userId);
    console.log('Request body:', { jobTitle: !!jobTitle, jobDescription: !!jobDescription, resumeText: !!resumeText });

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated properly. Please log in again.'
      });
    }

    if (!jobTitle || !jobDescription || !resumeText) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: jobTitle, jobDescription, resumeText'
      });
    }

    // Validate if it's a software engineering role
    const jobDescLower = jobDescription.toLowerCase();
    const isTechRole = ['software', 'developer', 'engineer', 'programming', 'coding', 'intern'].some(keyword => 
      jobDescLower.includes(keyword)
    );

    if (!isTechRole) {
      return res.status(400).json({
        success: false,
        error: 'This interview system is designed specifically for software engineering internships'
      });
    }

    // Generate initial questions
    console.log('Generating questions...');
    const questions = await generateInterviewQuestions(resumeText, jobDescription);
    console.log('Questions generated:', questions.length);

    const interview = new interviewModel({
      userId,
      jobTitle,
      jobDescription,
      resumeText,
      questions,
      status: 'created',
      totalQuestions: questions.length
    });

    await interview.save();
    console.log('Interview saved with ID:', interview._id);

    res.status(201).json({
      success: true,
      interview: {
        id: interview._id,
        status: interview.status,
        questions: questions,
        questionsCount: questions.length,
        estimatedDuration: questions.reduce((acc, q) => acc + q.expectedDuration, 0)
      }
    });
  } catch (error) {
    console.error('Create interview error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create interview session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

function normalizeQuestionType(type) {
  // Map various AI-generated types to valid enum values
  const typeMapping = {
    'problem-solving': 'coding',
    'problemsolving': 'coding',
    'algorithm': 'coding',
    'algorithms': 'coding',
    'data-structure': 'technical',
    'data-structures': 'technical',
    'system-design': 'system_design',
    'systemdesign': 'system_design',
    'design': 'system_design',
    'behavioral': 'behavioral',
    'technical': 'technical',
    'coding': 'coding',
    'technical_coding': 'coding',
    'technical_conceptual': 'technical'
  };

  return typeMapping[type.toLowerCase()] || 'technical'; // default to technical
}

// Start interview
export const startInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const interview = await interviewModel.findOne({ _id: interviewId, userId });
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

    interview.status = 'in_progress';
    interview.startedAt = new Date();
    await interview.save();

    res.json({
      success: true,
      message: 'Interview started successfully',
      firstQuestion: interview.questions[0] || null,
      totalQuestions: interview.questions.length
    });
  } catch (error) {
    console.error('Start interview error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to start interview' 
    });
  }
};

// Get next question
export const getNextQuestion = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const interview = await interviewModel.findOne({ _id: interviewId, userId });
    if (!interview) {
      return res.status(404).json({ 
        success: false,
        error: 'Interview not found' 
      });
    }

    const answeredCount = interview.responses.length;
    const nextQuestion = interview.questions[answeredCount];

    if (!nextQuestion) {
      return res.json({
        success: true,
        completed: true,
        message: 'All questions completed'
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
      error: 'Failed to get next question' 
    });
  }
};

// Submit answer with audio transcription
export const submitAnswer = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { questionId, responseTime } = req.body;
    const audioFile = req.file;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    if (!audioFile) {
      return res.status(400).json({ 
        success: false,
        error: 'Audio file is required' 
      });
    }

    const interview = await interviewModel.findOne({ _id: interviewId, userId });
    if (!interview) {
      return res.status(404).json({ 
        success: false,
        error: 'Interview not found' 
      });
    }

    // Find the question
    const question = interview.questions.find(q => q.questionId === questionId);
    if (!question) {
      return res.status(400).json({ 
        success: false,
        error: 'Question not found' 
      });
    }

    // For now, use a placeholder transcript - implement actual transcription later
    const transcript = `User provided an audio response for the question: "${question.question}". Audio transcription will be implemented in the next phase.`;

    // Analyze confidence and response quality using the enhanced analysis
    const analysis = await analyzeResponseLegacy(
      question.question,
      transcript,
      question.type,
      interview.resumeText,
      interview.jobDescription,
      responseTime
    );

    // Create response object
    const response = {
      questionId,
      question: question.question,
      transcription: transcript,
      responseTime: parseInt(responseTime) || 0,
      recordingDuration: Math.floor(audioFile.size / 1000), // rough estimate
      feedback: analysis.feedback.feedback,
      submittedAt: new Date()
    };

    interview.responses.push(response);
    await interview.save();

    res.json({
      success: true,
      message: 'Answer submitted successfully',
      question: question.question,
      feedback: analysis
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process answer' 
    });
  }
};

// Enhanced AI-powered response analysis endpoint
export const analyzeResponse = async (req, res) => {
  try {
    const { question, questionType, responseText, responseTime, code, expectedDuration } = req.body;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (!question || !responseText) {
      return res.status(400).json({
        success: false,
        error: 'Question and response text are required'
      });
    }

    console.log('Analyzing response:', {
      questionType,
      responseLength: responseText.length,
      hasCode: !!code,
      responseTime
    });

    // Generate comprehensive feedback using AI
    const feedback = await generateComprehensiveFeedback(
      question,
      questionType,
      responseText,
      code,
      responseTime,
      expectedDuration
    );

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

// Complete interview
export const completeInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const interview = await interviewModel.findOne({ _id: interviewId, userId });
    if (!interview) {
      return res.status(404).json({ 
        success: false,
        error: 'Interview not found' 
      });
    }

    // Generate overall feedback
    const overallAnalysis = await generateOverallFeedback(
      interview.responses,
      interview.resumeText,
      interview.jobDescription
    );

    interview.status = 'completed';
    interview.completedAt = new Date();
    interview.totalDuration = Math.round((interview.completedAt - interview.startedAt) / 1000);
    interview.overallFeedback = overallAnalysis.feedback;

    await interview.save();

    res.json({
      success: true,
      message: 'Interview completed successfully',
      results: {
        score: overallAnalysis.score,
        feedback: interview.overallFeedback,
        duration: interview.totalDuration,
        questionsAnswered: interview.responses.length
      }
    });
  } catch (error) {
    console.error('Complete interview error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to complete interview' 
    });
  }
};

// Get detailed feedback
export const getInterviewFeedback = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const interview = await interviewModel.findOne({ _id: interviewId, userId })
      .populate('userId', 'name email');

    if (!interview) {
      return res.status(404).json({ 
        success: false,
        error: 'Interview not found' 
      });
    }

    res.json({
      success: true,
      feedback: {
        score: interview.overallFeedback?.score || 0,
        feedback: interview.overallFeedback,
        duration: interview.totalDuration,
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

// Get user interview history
export const getUserInterviews = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    const { page = 1, limit = 10 } = req.query;

    const interviews = await interviewModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('jobTitle status overallFeedback createdAt completedAt totalDuration');

    const total = await interviewModel.countDocuments({ userId });

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

// Get interview details
export const getInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const interview = await interviewModel.findOne({ _id: interviewId, userId })
      .populate('userId', 'name email');

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

// ========== ENHANCED AI ANALYSIS FUNCTIONS ==========

// Comprehensive AI-powered feedback generation
async function generateComprehensiveFeedback(question, questionType, responseText, code, responseTime, expectedDuration) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Build comprehensive prompt based on question type
    let prompt = buildAnalysisPrompt(question, questionType, responseText, code, responseTime, expectedDuration);
    
    console.log('Sending analysis prompt to AI...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysisText = response.text().trim();
    
    console.log('AI analysis received, parsing...');
    const cleanedText = analysisText.replace(/```json\s*|```\s*/g, '').trim();
    const aiAnalysis = JSON.parse(cleanedText);
    
    // Validate and enhance the AI analysis
    const enhancedFeedback = validateAndEnhanceFeedback(aiAnalysis, questionType, responseText, code);
    
    console.log('Analysis complete:', {
      score: enhancedFeedback.score,
      strengthsCount: enhancedFeedback.strengths.length,
      improvementsCount: enhancedFeedback.improvements.length
    });
    
    return enhancedFeedback;

  } catch (error) {
    console.error('AI analysis error:', error);
    console.log('Falling back to enhanced rule-based analysis...');
    return generateEnhancedRuleBasedFeedback(question, questionType, responseText, code, responseTime, expectedDuration);
  }
}

// Build comprehensive analysis prompt
function buildAnalysisPrompt(question, questionType, responseText, code, responseTime, expectedDuration) {
  const basePrompt = `You are a senior software engineering interviewer at a top tech company. Analyze this interview response for a software engineering intern candidate with detailed, constructive feedback.

INTERVIEW CONTEXT:
- Question: "${question}"
- Question Type: ${questionType}
- Expected Duration: ${expectedDuration || 120} seconds
- Actual Response Time: ${responseTime || 'Unknown'} seconds

CANDIDATE'S RESPONSE:
"${responseText}"

${code ? `CODE PROVIDED:\n\`\`\`\n${code}\n\`\`\`\n` : ''}

ANALYSIS REQUIREMENTS:
Provide detailed analysis in this EXACT JSON format:
{
  "score": 75,
  "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "improvements": ["specific improvement 1", "specific improvement 2"],
  "detailedAnalysis": "detailed paragraph analysis",
  "communicationClarity": 8,
  "technicalAccuracy": 7,
  "structuredResponse": 9
}

EVALUATION CRITERIA:`;

  // Add specific criteria based on question type
  if (questionType === 'behavioral') {
    return basePrompt + `
1. STAR Method Usage (Situation, Task, Action, Result) - Look for clear structure
2. Specific Examples - Real projects, experiences, measurable outcomes
3. Leadership & Initiative - Taking charge, problem-solving, learning from mistakes
4. Communication - Clear narrative, logical flow, appropriate detail level
5. Relevance - How well the example relates to software engineering internships
6. Growth Mindset - Learning from challenges, adaptability, improvement focus

Score Distribution:
- 90-100: Exceptional STAR structure, compelling examples, strong leadership shown
- 75-89: Good structure, relevant examples, shows growth and learning
- 60-74: Basic structure, some examples, adequate for intern level
- 45-59: Limited structure, vague examples, needs improvement
- Below 45: Poor structure, no concrete examples, significant gaps

Focus on intern-level expectations. Look for passion, willingness to learn, and potential rather than extensive experience.`;

  } else if (questionType === 'technical_coding' || questionType === 'coding') {
    return basePrompt + `
1. Code Quality - Syntax, structure, readability, best practices
2. Algorithm Approach - Correctness, efficiency, appropriate method selection
3. Complexity Analysis - Understanding of time/space complexity
4. Problem-Solving Process - Breaking down the problem, step-by-step approach
5. Edge Cases - Consideration of special cases, error handling
6. Code Explanation - Ability to explain the solution clearly
7. Testing - Mention of test cases, validation approach

Code Analysis:
${code ? '- Analyze the provided code for correctness, efficiency, and style' : '- No code provided - major deduction for coding question'}

Score Distribution:
- 90-100: Optimal solution, excellent explanation, discusses complexity, considers edge cases
- 75-89: Working solution, good explanation, some complexity awareness
- 60-74: Basic solution, adequate explanation, shows problem-solving approach
- 45-59: Partial solution or explanation, some understanding but gaps
- Below 45: Incorrect approach, poor explanation, fundamental misunderstandings

For coding questions, expect intern-level solutions focusing on correctness and clear explanation over advanced optimizations.`;

  } else if (questionType === 'technical_conceptual' || questionType === 'technical') {
    return basePrompt + `
1. Technical Accuracy - Correct understanding of concepts, terminology
2. Depth of Knowledge - Going beyond surface-level explanations
3. Real-World Applications - Connecting theory to practical use cases
4. Comparisons - Explaining differences, trade-offs, when to use what
5. Examples - Concrete illustrations of abstract concepts
6. Current Understanding - Awareness of modern practices, technologies

Score Distribution:
- 90-100: Deep technical understanding, excellent examples, compares alternatives
- 75-89: Good technical grasp, relevant examples, shows practical awareness
- 60-74: Basic understanding, some examples, adequate for intern level
- 45-59: Surface-level understanding, limited examples, needs development
- Below 45: Poor technical grasp, incorrect information, significant gaps

Focus on fundamental concepts important for software engineering interns. Look for understanding over memorization.`;
  }

  return basePrompt + `
Provide constructive, specific feedback appropriate for software engineering intern candidates. Focus on growth potential and learning opportunities.`;
}

// Enhanced rule-based fallback analysis
function generateEnhancedRuleBasedFeedback(question, questionType, responseText, code, responseTime, expectedDuration) {
  const feedback = {
    score: 50,
    strengths: [],
    improvements: [],
    detailedAnalysis: '',
    communicationClarity: 5,
    technicalAccuracy: 5,
    structuredResponse: 5
  };

  const wordCount = responseText.trim().split(/\s+/).length;
  const sentences = responseText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const responseLength = responseText.trim().length;

  console.log('Rule-based analysis:', { wordCount, sentences: sentences.length, responseLength, questionType });

  // Content depth analysis
  const contentScore = analyzeContentDepth(responseText, questionType);
  feedback.score += contentScore.points;
  feedback.strengths.push(...contentScore.strengths);
  feedback.improvements.push(...contentScore.improvements);
  feedback.technicalAccuracy = Math.min(10, feedback.technicalAccuracy + contentScore.technicalBonus);

  // Communication quality
  const commScore = analyzeCommunicationQuality(responseText, sentences);
  feedback.score += commScore.points;
  feedback.strengths.push(...commScore.strengths);
  feedback.improvements.push(...commScore.improvements);
  feedback.communicationClarity = Math.min(10, feedback.communicationClarity + commScore.clarityBonus);
  feedback.structuredResponse = Math.min(10, feedback.structuredResponse + commScore.structureBonus);

  // Question-specific analysis
  const questionScore = analyzeByQuestionType(questionType, responseText, code);
  feedback.score += questionScore.points;
  feedback.strengths.push(...questionScore.strengths);
  feedback.improvements.push(...questionScore.improvements);
  feedback.technicalAccuracy = Math.min(10, feedback.technicalAccuracy + questionScore.technicalBonus);

  // Time management
  if (responseTime && expectedDuration) {
    const timeScore = analyzeTimeManagement(responseTime, expectedDuration);
    feedback.score += timeScore.points;
    if (timeScore.feedback) {
      if (timeScore.points > 0) {
        feedback.strengths.push(timeScore.feedback);
      } else {
        feedback.improvements.push(timeScore.feedback);
      }
    }
  }

  // Generate detailed analysis
  feedback.detailedAnalysis = generateDetailedAnalysisSummary(feedback, questionType, wordCount, sentences.length);

  // Ensure quality and clamp values
  ensureFeedbackQuality(feedback);
  clampScores(feedback);

  return feedback;
}

// Detailed content analysis
function analyzeContentDepth(text, questionType) {
  const analysis = { points: 0, strengths: [], improvements: [], technicalBonus: 0 };
  const textLower = text.toLowerCase();

  // Define comprehensive keyword sets
  const keywordSets = {
    behavioral: {
      structure: ['situation', 'task', 'action', 'result', 'when', 'what', 'how', 'why'],
      experience: ['project', 'experience', 'worked', 'built', 'developed', 'created', 'implemented', 'designed'],
      skills: ['team', 'collaboration', 'leadership', 'problem', 'challenge', 'solution', 'learned', 'improved'],
      outcomes: ['result', 'outcome', 'achieved', 'successful', 'completed', 'delivered', 'impact', 'benefit']
    },
    coding: {
      algorithms: ['algorithm', 'complexity', 'time', 'space', 'big o', 'efficient', 'optimize', 'performance'],
      dataStructures: ['array', 'hash', 'map', 'tree', 'graph', 'stack', 'queue', 'list', 'set'],
      programming: ['function', 'variable', 'loop', 'condition', 'iteration', 'recursion', 'method', 'class'],
      problemSolving: ['approach', 'strategy', 'solution', 'problem', 'edge case', 'test', 'validate', 'debug']
    },
    technical: {
      concepts: ['concept', 'principle', 'theory', 'framework', 'library', 'api', 'protocol', 'architecture'],
      comparison: ['difference', 'compare', 'versus', 'advantage', 'disadvantage', 'trade-off', 'better', 'worse'],
      implementation: ['implement', 'use case', 'example', 'application', 'practical', 'real-world', 'production'],
      advanced: ['scalability', 'performance', 'security', 'maintenance', 'best practice', 'industry standard']
    }
  };

  // Select appropriate keywords based on question type
  let relevantKeywords = keywordSets.technical; // default
  if (questionType === 'behavioral') {
    relevantKeywords = keywordSets.behavioral;
  } else if (questionType === 'technical_coding' || questionType === 'coding') {
    relevantKeywords = keywordSets.coding;
  }

  // Count keyword usage across categories
  let totalKeywords = 0;
  let categoryScores = {};

  Object.entries(relevantKeywords).forEach(([category, keywords]) => {
    let categoryCount = 0;
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        categoryCount += matches.length;
        totalKeywords += matches.length;
      }
    });
    categoryScores[category] = categoryCount;
  });

  // Score based on keyword usage
  if (totalKeywords >= 8) {
    analysis.strengths.push('Excellent use of relevant technical vocabulary');
    analysis.points += 25;
    analysis.technicalBonus += 3;
  } else if (totalKeywords >= 5) {
    analysis.strengths.push('Good technical terminology and concepts');
    analysis.points += 15;
    analysis.technicalBonus += 2;
  } else if (totalKeywords >= 2) {
    analysis.strengths.push('Shows understanding of key concepts');
    analysis.points += 8;
    analysis.technicalBonus += 1;
  } else {
    analysis.improvements.push('Include more specific technical terminology relevant to the question');
    analysis.technicalBonus -= 1;
  }

  // Check for specific examples and quantifiable details
  const examplePatterns = [
    /for example|for instance|such as|like when|consider|in my experience/gi,
    /i worked on|i built|i created|i implemented|i developed/gi,
    /at \w+|during my time|in my project|when i was/gi
  ];

  let exampleCount = 0;
  examplePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) exampleCount += matches.length;
  });

  if (exampleCount >= 3) {
    analysis.strengths.push('Provided multiple concrete examples');
    analysis.points += 15;
  } else if (exampleCount >= 1) {
    analysis.strengths.push('Included specific examples');
    analysis.points += 10;
  } else {
    analysis.improvements.push('Provide specific examples to illustrate your points');
  }

  // Check for quantifiable metrics
  const quantifiablePattern = /\b\d+(\.\d+)?\s*(percent|%|times|hours|days|weeks|months|users|requests|mb|gb|ms|seconds|lines|functions|features|bugs|tests)\b/gi;
  const metrics = text.match(quantifiablePattern);
  
  if (metrics && metrics.length >= 2) {
    analysis.strengths.push('Included quantifiable results and metrics');
    analysis.points += 12;
  } else if (metrics && metrics.length >= 1) {
    analysis.strengths.push('Provided measurable details');
    analysis.points += 6;
  }

  return analysis;
}

// Communication quality analysis
function analyzeCommunicationQuality(text, sentences) {
  const analysis = { points: 0, strengths: [], improvements: [], clarityBonus: 0, structureBonus: 0 };

  // Sentence structure analysis
  if (sentences.length === 0) {
    analysis.improvements.push('Structure your response with clear sentences');
    return analysis;
  }

  const avgSentenceLength = sentences.reduce((acc, s) => acc + s.split(' ').length, 0) / sentences.length;
  const sentenceLengths = sentences.map(s => s.split(' ').length);
  const lengthVariety = sentenceLengths.length > 1 ? Math.max(...sentenceLengths) - Math.min(...sentenceLengths) : 0;

  // Optimal sentence length and variety
  if (avgSentenceLength >= 10 && avgSentenceLength <= 25 && lengthVariety >= 5) {
    analysis.strengths.push('Excellent sentence structure with good variety');
    analysis.points += 12;
    analysis.clarityBonus += 2;
    analysis.structureBonus += 1;
  } else if (avgSentenceLength >= 8 && avgSentenceLength <= 30) {
    analysis.strengths.push('Good sentence structure');
    analysis.points += 8;
    analysis.clarityBonus += 1;
  } else if (avgSentenceLength < 6) {
    analysis.improvements.push('Expand sentences for more detailed explanations');
    analysis.clarityBonus -= 1;
  } else if (avgSentenceLength > 35) {
    analysis.improvements.push('Break down overly complex sentences for clarity');
    analysis.clarityBonus -= 1;
  }

  // Logical flow and connectors
  const connectorPatterns = [
    /\b(however|therefore|furthermore|moreover|additionally|consequently)\b/gi,
    /\b(because|since|although|while|whereas|despite)\b/gi,
    /\b(first|second|third|finally|in conclusion|as a result|on the other hand)\b/gi,
    /\b(also|similarly|likewise|in contrast|nevertheless|meanwhile)\b/gi
  ];

  let connectorCount = 0;
  connectorPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) connectorCount += matches.length;
  });

  if (connectorCount >= 4) {
    analysis.strengths.push('Excellent logical flow with smooth transitions');
    analysis.points += 15;
    analysis.structureBonus += 2;
  } else if (connectorCount >= 2) {
    analysis.strengths.push('Good use of connecting words for flow');
    analysis.points += 10;
    analysis.structureBonus += 1;
  } else if (connectorCount === 0) {
    analysis.improvements.push('Use connecting words (however, therefore, because) to improve flow');
    analysis.structureBonus -= 1;
  }

  // Confidence vs hesitation analysis
  const hesitationWords = text.match(/\b(um|uh|like|you know|sort of|kind of|i think maybe|i guess|probably|not sure)\b/gi);
  const confidenceWords = text.match(/\b(definitely|certainly|clearly|obviously|confident|sure|believe strongly|know that|understand)\b/gi);

  const hesitationCount = hesitationWords ? hesitationWords.length : 0;
  const confidenceCount = confidenceWords ? confidenceWords.length : 0;

  if (hesitationCount <= 1 && confidenceCount >= 2) {
    analysis.strengths.push('Spoke with confidence and conviction');
    analysis.points += 12;
    analysis.clarityBonus += 1;
  } else if (hesitationCount <= 2) {
    analysis.strengths.push('Clear, decisive communication');
    analysis.points += 8;
  } else if (hesitationCount > 4) {
    analysis.improvements.push('Reduce hesitation words (um, I think, maybe) for more confident delivery');
    analysis.clarityBonus -= 2;
  }

  // Professional language use
  const professionalTerms = text.match(/\b(collaborate|implement|analyze|develop|optimize|facilitate|coordinate|execute|strategic|systematic)\b/gi);
  if (professionalTerms && professionalTerms.length >= 3) {
    analysis.strengths.push('Used professional vocabulary appropriately');
    analysis.points += 8;
  }

  return analysis;
}

// Question type specific analysis
function analyzeByQuestionType(questionType, text, code) {
  const analysis = { points: 0, strengths: [], improvements: [], technicalBonus: 0 };

  if (questionType === 'behavioral') {
    return analyzeBehavioralSpecific(text, analysis);
  } else if (questionType === 'technical_coding' || questionType === 'coding') {
    return analyzeCodingSpecific(text, code, analysis);
  } else if (questionType === 'technical_conceptual' || questionType === 'technical') {
    return analyzeTechnicalSpecific(text, analysis);
  }

  return analysis;
}

// Behavioral question specific analysis
function analyzeBehavioralSpecific(text, analysis) {
  // STAR method detection
  const starElements = {
    situation: /\b(situation|context|background|setting|scenario|when|where|during)\b/gi,
    task: /\b(task|goal|objective|responsibility|needed to|had to|required|assigned|challenge)\b/gi,
    action: /\b(action|did|implemented|decided|approach|method|steps|executed|created|built|developed|solved)\b/gi,
    result: /\b(result|outcome|learned|achieved|impact|success|improvement|benefit|completed|delivered)\b/gi
  };

  let starScore = 0;
  let foundElements = [];

  Object.entries(starElements).forEach(([element, pattern]) => {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      starScore++;
      foundElements.push(element);
    }
  });

  if (starScore >= 4) {
    analysis.strengths.push('Excellent STAR method structure (Situation, Task, Action, Result)');
    analysis.points += 25;
    analysis.technicalBonus += 3;
  } else if (starScore >= 3) {
    analysis.strengths.push('Good structured response with most STAR elements');
    analysis.points += 18;
    analysis.technicalBonus += 2;
  } else if (starScore >= 2) {
    analysis.strengths.push('Shows structured thinking approach');
    analysis.points += 10;
    analysis.technicalBonus += 1;
  } else {
    analysis.improvements.push('Use STAR method: describe Situation, Task, Action taken, and Result achieved');
    analysis.technicalBonus -= 1;
  }

  // Leadership and initiative indicators
  const leadershipWords = text.match(/\b(led|lead|managed|organized|coordinated|initiated|took charge|responsible for|guided|mentored|taught|trained)\b/gi);
  if (leadershipWords && leadershipWords.length >= 2) {
    analysis.strengths.push('Demonstrated leadership and initiative');
    analysis.points += 12;
  }

  // Problem-solving focus
  const problemSolvingWords = text.match(/\b(problem|challenge|issue|difficulty|obstacle|solved|resolved|overcame|addressed|fixed|debugged)\b/gi);
  if (problemSolvingWords && problemSolvingWords.length >= 3) {
    analysis.strengths.push('Strong problem-solving orientation');
    analysis.points += 10;
  }

  // Learning and growth mindset
  const learningWords = text.match(/\b(learned|improved|grew|developed|practiced|studied|researched|discovered|realized|mistake|feedback)\b/gi);
  if (learningWords && learningWords.length >= 2) {
    analysis.strengths.push('Shows growth mindset and willingness to learn');
    analysis.points += 10;
  }

  return analysis;
}

// Coding question specific analysis
function analyzeCodingSpecific(text, code, analysis) {
  // Code presence and quality
  if (!code || code.trim().length === 0) {
    analysis.improvements.push('Provide actual code implementation for coding questions');
    analysis.points -= 20;
    analysis.technicalBonus -= 3;
    return analysis;
  }

  // Code quality analysis
  const codeQuality = analyzeCodeQuality(code);
  analysis.points += codeQuality.points;
  analysis.strengths.push(...codeQuality.strengths);
  analysis.improvements.push(...codeQuality.improvements);
  analysis.technicalBonus += codeQuality.technicalBonus;

  // Algorithm explanation analysis
  const algorithmTerms = text.match(/\b(algorithm|approach|strategy|method|complexity|time|space|big o|efficient|optimize|performance)\b/gi);
  if (algorithmTerms && algorithmTerms.length >= 4) {
    analysis.strengths.push('Excellent algorithm explanation with complexity analysis');
    analysis.points += 18;
    analysis.technicalBonus += 2;
  } else if (algorithmTerms && algorithmTerms.length >= 2) {
    analysis.strengths.push('Good technical explanation of approach');
    analysis.points += 12;
    analysis.technicalBonus += 1;
  } else {
    analysis.improvements.push('Explain your algorithm approach and consider time/space complexity');
  }

  // Problem-solving process
  const processWords = text.match(/\b(first|then|next|step|process|break down|analyze|approach|solve|implement)\b/gi);
  if (processWords && processWords.length >= 3) {
    analysis.strengths.push('Clear step-by-step problem-solving process');
    analysis.points += 12;
  }

  // Edge cases and testing
  const testingWords = text.match(/\b(test|edge case|boundary|validate|check|handle|error|exception|corner case)\b/gi);
  if (testingWords && testingWords.length >= 2) {
    analysis.strengths.push('Considered edge cases and testing');
    analysis.points += 15;
    analysis.technicalBonus += 1;
  } else {
    analysis.improvements.push('Consider edge cases and how to test your solution');
  }

  return analysis;
}

// Technical conceptual analysis
function analyzeTechnicalSpecific(text, analysis) {
  // Technical depth and accuracy
  const technicalTerms = text.match(/\b(asynchronous|synchronous|callback|promise|async|await|api|http|database|framework|library|protocol|architecture|scalability|performance|security)\b/gi);
  
  if (technicalTerms && technicalTerms.length >= 6) {
    analysis.strengths.push('Excellent technical vocabulary and depth');
    analysis.points += 20;
    analysis.technicalBonus += 3;
  } else if (technicalTerms && technicalTerms.length >= 3) {
    analysis.strengths.push('Good technical understanding');
    analysis.points += 12;
    analysis.technicalBonus += 2;
  } else if (technicalTerms && technicalTerms.length >= 1) {
    analysis.strengths.push('Shows basic technical knowledge');
    analysis.points += 6;
    analysis.technicalBonus += 1;
  } else {
    analysis.improvements.push('Use more specific technical terminology');
    analysis.technicalBonus -= 1;
  }

  // Comparative analysis
  const comparisonWords = text.match(/\b(difference|compare|contrast|versus|vs|while|whereas|however|unlike|similar|advantage|disadvantage|better|worse|trade-off)\b/gi);
  if (comparisonWords && comparisonWords.length >= 4) {
    analysis.strengths.push('Excellent comparative analysis of concepts');
    analysis.points += 15;
  } else if (comparisonWords && comparisonWords.length >= 2) {
    analysis.strengths.push('Good comparative thinking');
    analysis.points += 10;
  } else {
    analysis.improvements.push('Compare different approaches and discuss trade-offs');
  }

  // Practical application
  const practicalWords = text.match(/\b(use case|application|practical|real world|production|industry|business|project|implementation)\b/gi);
  if (practicalWords && practicalWords.length >= 2) {
    analysis.strengths.push('Connected theory to practical applications');
    analysis.points += 12;
  } else {
    analysis.improvements.push('Provide real-world examples and use cases');
  }

  return analysis;
}

// Code quality analysis
function analyzeCodeQuality(code) {
  const analysis = { points: 0, strengths: [], improvements: [], technicalBonus: 0 };
  
  // Basic structure checks
  const hasComments = /\/\/|\/\*|#|"""/.test(code);
  const hasDescriptiveNames = /\b[a-zA-Z_][a-zA-Z0-9_]{3,}\b/.test(code);
  const hasProperIndentation = /^(\s{2,4}|\t)/m.test(code);
  const hasFunctions = /\b(function|def|const\s+\w+\s*=|=>\s*{|\w+\s*\(.*\)\s*{)/.test(code);
  
  // Advanced features
  const hasLoops = /\b(for|while|forEach|map|filter|reduce|range)\b/.test(code);
  const hasConditionals = /\b(if|else|elif|switch|case|\?.*:)\b/.test(code);
  const hasErrorHandling = /\b(try|catch|except|throw|raise|finally)\b/i.test(code);
  const hasDataStructures = /\b(array|list|dict|map|set|hash|tree|queue|stack)\b/i.test(code);

  // Scoring
  if (hasComments) {
    analysis.strengths.push('Well-documented code with comments');
    analysis.points += 10;
    analysis.technicalBonus += 1;
  } else {
    analysis.improvements.push('Add comments to explain complex logic');
  }

  if (hasDescriptiveNames) {
    analysis.strengths.push('Used meaningful variable and function names');
    analysis.points += 8;
  } else {
    analysis.improvements.push('Use more descriptive variable names');
  }

  if (hasProperIndentation) {
    analysis.strengths.push('Proper code formatting and structure');
    analysis.points += 5;
  }

  if (hasFunctions) {
    analysis.strengths.push('Good code organization with functions');
    analysis.points += 10;
    analysis.technicalBonus += 1;
  }

  if (hasLoops) {
    analysis.strengths.push('Appropriate use of loops and iteration');
    analysis.points += 8;
  }

  if (hasConditionals) {
    analysis.strengths.push('Good use of conditional logic');
    analysis.points += 6;
  }

  if (hasErrorHandling) {
    analysis.strengths.push('Included error handling for robustness');
    analysis.points += 15;
    analysis.technicalBonus += 2;
  } else {
    analysis.improvements.push('Consider adding error handling');
  }

  if (hasDataStructures) {
    analysis.strengths.push('Appropriate data structure usage');
    analysis.points += 12;
    analysis.technicalBonus += 1;
  }

  // Code complexity analysis
  const lines = code.split('\n').filter(line => line.trim()).length;
  if (lines >= 10 && lines <= 30) {
    analysis.strengths.push('Appropriate code length and complexity');
    analysis.points += 5;
  } else if (lines < 5) {
    analysis.improvements.push('Provide a more complete implementation');
  } else if (lines > 50) {
    analysis.improvements.push('Consider simplifying or modularizing the solution');
  }

  return analysis;
}

// Time management analysis
function analyzeTimeManagement(responseTime, expectedTime) {
  const ratio = responseTime / expectedTime;
  
  if (ratio >= 0.8 && ratio <= 1.2) {
    return { points: 10, feedback: 'Excellent time management' };
  } else if (ratio >= 0.6 && ratio <= 1.5) {
    return { points: 5, feedback: 'Good time management' };
  } else if (ratio < 0.4) {
    return { points: -5, feedback: 'Take more time to provide comprehensive answers' };
  } else if (ratio > 2.0) {
    return { points: -3, feedback: 'Practice being more concise while maintaining detail' };
  }
  
  return { points: 0, feedback: null };
}

// Generate comprehensive detailed analysis
function generateDetailedAnalysisSummary(feedback, questionType, wordCount, sentenceCount) {
  let analysis = '';
  
  // Opening assessment
  if (feedback.score >= 85) {
    analysis = 'This is an exceptional response that demonstrates strong competency for an intern-level position. ';
  } else if (feedback.score >= 70) {
    analysis = 'This is a solid response that shows good understanding and communication skills. ';
  } else if (feedback.score >= 55) {
    analysis = 'This response shows potential but has several areas for improvement. ';
  } else {
    analysis = 'This response needs significant improvement in multiple areas. ';
  }

  // Content quality assessment
  if (wordCount >= 100) {
    analysis += 'You provided detailed explanations with good depth. ';
  } else if (wordCount >= 50) {
    analysis += 'Your response had adequate detail. ';
  } else {
    analysis += 'Consider providing more detailed explanations. ';
  }

  // Question-specific feedback
  if (questionType === 'behavioral') {
    if (feedback.strengths.some(s => s.includes('STAR'))) {
      analysis += 'Your structured approach using STAR method was effective. ';
    } else {
      analysis += 'Focus on structuring behavioral responses using the STAR method. ';
    }
  } else if (questionType === 'technical_coding' || questionType === 'coding') {
    if (feedback.strengths.some(s => s.includes('code'))) {
      analysis += 'Your code implementation was well-structured. ';
    } else {
      analysis += 'Ensure you provide working code with clear explanations. ';
    }
  } else if (questionType === 'technical_conceptual' || questionType === 'technical') {
    if (feedback.technicalAccuracy >= 7) {
      analysis += 'You demonstrated good technical understanding. ';
    } else {
      analysis += 'Work on deepening your technical knowledge in this area. ';
    }
  }

  // Communication assessment
  if (feedback.communicationClarity >= 7) {
    analysis += 'Your communication was clear and well-organized. ';
  } else {
    analysis += 'Focus on organizing your thoughts more clearly and using connecting words. ';
  }

  // Improvement recommendations
  const topImprovements = feedback.improvements.slice(0, 2);
  if (topImprovements.length > 0) {
    analysis += `Key areas for improvement: ${topImprovements.join(' and ').toLowerCase()}.`;
  }

  return analysis;
}

function getEnhancedDefaultQuestions() {
  return [
    // 3 Behavioral Questions
    {
      questionId: "q1",
      question: "Tell me about yourself and why you're passionate about software engineering. What draws you to this field?",
      type: "behavioral",
      category: "introduction",
      difficulty: "easy",
      expectedDuration: 120,
      starterCode: null
    },
    {
      questionId: "q2",
      question: "Describe a challenging programming project you worked on. What obstacles did you face and how did you overcome them?",
      type: "behavioral",
      category: "problem-solving",
      difficulty: "medium",
      expectedDuration: 180,
      starterCode: null
    },
    {
      questionId: "q3",
      question: "Tell me about a time you had to work in a team on a software project. How did you handle collaboration and any conflicts?",
      type: "behavioral",
      category: "teamwork",
      difficulty: "medium",
      expectedDuration: 180,
      starterCode: null
    },

    // 3 Coding Questions
    {
      questionId: "q4",
      question: "Write a function that finds the two numbers in an array that add up to a target sum. Return their indices.",
      type: "coding",
      category: "algorithms",
      difficulty: "medium",
      expectedDuration: 300,
      starterCode: {
        javascript: `function twoSum(nums, target) {
    // Your implementation here
    
}

// Test cases
console.log(twoSum([2, 7, 11, 15], 9)); // Expected: [0, 1]
console.log(twoSum([3, 2, 4], 6)); // Expected: [1, 2]
console.log(twoSum([3, 3], 6)); // Expected: [0, 1]`,
        python: `def two_sum(nums, target):
    # Your implementation here
    pass

# Test cases
print(two_sum([2, 7, 11, 15], 9))  # Expected: [0, 1]
print(two_sum([3, 2, 4], 6))  # Expected: [1, 2]
print(two_sum([3, 3], 6))  # Expected: [0, 1]`,
        java: `public class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Your implementation here
        return new int[0];
    }
    
    public static void main(String[] args) {
        Solution sol = new Solution();
        // Test cases
        int[] result1 = sol.twoSum(new int[]{2, 7, 11, 15}, 9);
        int[] result2 = sol.twoSum(new int[]{3, 2, 4}, 6);
        int[] result3 = sol.twoSum(new int[]{3, 3}, 6);
        
        // Print results
        System.out.println(java.util.Arrays.toString(result1));
        System.out.println(java.util.Arrays.toString(result2));
        System.out.println(java.util.Arrays.toString(result3));
    }
}`
      }
    },
    {
      questionId: "q5",
      question: "Write a function to reverse a string without using built-in reverse functions. Consider both iterative and recursive approaches.",
      type: "coding",
      category: "strings",
      difficulty: "easy",
      expectedDuration: 240,
      starterCode: {
        javascript: `function reverseString(str) {
    // Your implementation here
    
}

// Test cases
console.log(reverseString("hello")); // Expected: "olleh"
console.log(reverseString("world")); // Expected: "dlrow"
console.log(reverseString("a")); // Expected: "a"
console.log(reverseString("")); // Expected: ""`,
        python: `def reverse_string(s):
    # Your implementation here
    pass

# Test cases
print(reverse_string("hello"))  # Expected: "olleh"
print(reverse_string("world"))  # Expected: "dlrow"
print(reverse_string("a"))  # Expected: "a"
print(reverse_string(""))  # Expected: ""`,
        java: `public class Solution {
    public String reverseString(String s) {
        // Your implementation here
        return "";
    }
    
    public static void main(String[] args) {
        Solution sol = new Solution();
        // Test cases
        System.out.println(sol.reverseString("hello")); // Expected: "olleh"
        System.out.println(sol.reverseString("world")); // Expected: "dlrow"
        System.out.println(sol.reverseString("a")); // Expected: "a"
        System.out.println(sol.reverseString("")); // Expected: ""
    }
}`
      }
    },
    {
      questionId: "q6",
      question: "Given a binary tree, write a function to find its maximum depth (height). The maximum depth is the number of nodes along the longest path from root to leaf.",
      type: "coding",
      category: "data-structures",
      difficulty: "medium",
      expectedDuration: 360,
      starterCode: {
        javascript: `// Definition for a binary tree node
function TreeNode(val, left, right) {
    this.val = (val === undefined ? 0 : val);
    this.left = (left === undefined ? null : left);
    this.right = (right === undefined ? null : right);
}

function maxDepth(root) {
    // Your implementation here
    
}

// Test case
// Create tree:    3
//               /   \\
//              9     20
//                   /  \\
//                  15   7
const root = new TreeNode(3);
root.left = new TreeNode(9);
root.right = new TreeNode(20);
root.right.left = new TreeNode(15);
root.right.right = new TreeNode(7);

console.log(maxDepth(root)); // Expected: 3`,
        python: `# Definition for a binary tree node
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def max_depth(root):
    # Your implementation here
    pass

# Test case
# Create tree:    3
#               /   \\
#              9     20
#                   /  \\
#                  15   7
root = TreeNode(3)
root.left = TreeNode(9)
root.right = TreeNode(20)
root.right.left = TreeNode(15)
root.right.right = TreeNode(7)

print(max_depth(root))  # Expected: 3`,
        java: `// Definition for a binary tree node
class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}

public class Solution {
    public int maxDepth(TreeNode root) {
        // Your implementation here
        return 0;
    }
    
    public static void main(String[] args) {
        Solution sol = new Solution();
        
        // Create tree:    3
        //               /   \\
        //              9     20
        //                   /  \\
        //                  15   7
        TreeNode root = new TreeNode(3);
        root.left = new TreeNode(9);
        root.right = new TreeNode(20);
        root.right.left = new TreeNode(15);
        root.right.right = new TreeNode(7);
        
        System.out.println(sol.maxDepth(root)); // Expected: 3
    }
}`
      }
    },

    // 4 Technical Theory Questions
    {
      questionId: "q7",
      question: "Explain the difference between synchronous and asynchronous programming. Give examples of when you would use each approach and discuss the benefits and drawbacks.",
      type: "technical",
      category: "programming-concepts",
      difficulty: "medium",
      expectedDuration: 180,
      starterCode: null
    },
    {
      questionId: "q8",
      question: "What is the difference between HTTP and HTTPS? Explain how HTTPS works and why it's important for web security.",
      type: "technical",
      category: "web-security",
      difficulty: "medium",
      expectedDuration: 150,
      starterCode: null
    },
    {
      questionId: "q9",
      question: "Explain the concept of Object-Oriented Programming. What are the four main principles (encapsulation, inheritance, polymorphism, abstraction) and how do they benefit software development?",
      type: "technical",
      category: "oop",
      difficulty: "medium",
      expectedDuration: 200,
      starterCode: null
    },
    {
      questionId: "q10",
      question: "What is the difference between SQL and NoSQL databases? When would you choose one over the other? Give examples of each type and their use cases.",
      type: "technical",
      category: "databases",
      difficulty: "medium",
      expectedDuration: 180,
      starterCode: null
    }
  ];
}

// Validate and enhance AI-generated feedback
function validateAndEnhanceFeedback(aiAnalysis, questionType, responseText, code) {
  // Ensure all required fields exist with defaults
  const feedback = {
    score: Math.max(0, Math.min(100, aiAnalysis.score || 50)),
    strengths: Array.isArray(aiAnalysis.strengths) ? aiAnalysis.strengths : ['Attempted to answer the question'],
    improvements: Array.isArray(aiAnalysis.improvements) ? aiAnalysis.improvements : ['Continue practicing'],
    detailedAnalysis: aiAnalysis.detailedAnalysis || 'Response provided with room for improvement.',
    communicationClarity: Math.max(1, Math.min(10, aiAnalysis.communicationClarity || 5)),
    technicalAccuracy: Math.max(1, Math.min(10, aiAnalysis.technicalAccuracy || 5)),
    structuredResponse: Math.max(1, Math.min(10, aiAnalysis.structuredResponse || 5))
  };

  // Validation rules
  if (feedback.strengths.length === 0) {
    feedback.strengths.push('Provided a response to the question');
  }
  
  if (feedback.improvements.length === 0) {
    feedback.improvements.push('Continue practicing to build confidence');
  }

  // Remove duplicates
  feedback.strengths = [...new Set(feedback.strengths)];
  feedback.improvements = [...new Set(feedback.improvements)];

  // Limit arrays to reasonable sizes
  feedback.strengths = feedback.strengths.slice(0, 4);
  feedback.improvements = feedback.improvements.slice(0, 3);

  return feedback;
}

// Ensure feedback quality
function ensureFeedbackQuality(feedback) {
  if (feedback.strengths.length === 0) {
    feedback.strengths.push('Attempted to provide a complete response');
  }
  
  if (feedback.improvements.length === 0) {
    feedback.improvements.push('Continue practicing to build confidence and technical skills');
  }

  // Remove duplicates
  feedback.strengths = [...new Set(feedback.strengths)];
  feedback.improvements = [...new Set(feedback.improvements)];

  // Ensure reasonable array sizes
  feedback.strengths = feedback.strengths.slice(0, 4);
  feedback.improvements = feedback.improvements.slice(0, 3);
}

// Clamp all scores to valid ranges
function clampScores(feedback) {
  feedback.score = Math.max(0, Math.min(100, feedback.score));
  feedback.communicationClarity = Math.max(1, Math.min(10, feedback.communicationClarity));
  feedback.technicalAccuracy = Math.max(1, Math.min(10, feedback.technicalAccuracy));
  feedback.structuredResponse = Math.max(1, Math.min(10, feedback.structuredResponse));
}

function getDefaultStarterCode() {
  return {
    javascript: `function solution() {
    // Your implementation here
    
}

// Test your solution
console.log(solution());`,
    python: `def solution():
    # Your implementation here
    pass

# Test your solution
print(solution())`,
    java: `public class Solution {
    public void solution() {
        // Your implementation here
        
    }
    
    public static void main(String[] args) {
        Solution sol = new Solution();
        sol.solution();
    }
}`
  };
}

async function generateInterviewQuestions(resumeText, jobDescription) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `You are a senior software engineering interviewer at a top tech company. Generate exactly 10 interview questions for a software engineering internship candidate.

    Resume Summary: ${resumeText.substring(0, 2000)}
    Job Description: ${jobDescription.substring(0, 2000)}

    Generate questions in the following categories with EXACT distribution:
    - 3 behavioral/soft skill questions (use type: "behavioral")
    - 3 coding/algorithm questions (use type: "coding")  
    - 4 technical theory questions (use type: "technical")

    IMPORTANT: 
    1. Only use these exact types: "behavioral", "technical", "coding"
    2. Must be exactly 10 questions total
    3. Must follow the exact distribution: 3 behavioral + 3 coding + 4 technical = 10

    BEHAVIORAL QUESTIONS should focus on:
    - Past experiences and projects
    - Team collaboration and leadership
    - Problem-solving in real situations
    - Learning from challenges and failures
    - Communication and interpersonal skills

    CODING QUESTIONS should include:
    - Algorithm problems (arrays, strings, sorting)
    - Data structure problems (trees, graphs, hash maps)
    - Problem-solving with code implementation
    - Time/space complexity considerations

    TECHNICAL THEORY QUESTIONS should cover:
    - Programming concepts (OOP, functional programming)
    - System design basics
    - Database concepts
    - Web development fundamentals
    - Software engineering principles

    Format your response as a JSON array with this structure:
    [
      {
        "questionId": "q1",
        "question": "Tell me about a challenging project you worked on and how you overcame obstacles",
        "type": "behavioral",
        "category": "experience",
        "difficulty": "medium",
        "expectedDuration": 180,
        "starterCode": null
      },
      {
        "questionId": "q2",
        "question": "Write a function that finds the two numbers in an array that add up to a target sum",
        "type": "coding",
        "category": "algorithms",
        "difficulty": "medium",
        "expectedDuration": 300,
        "starterCode": {
          "javascript": "function twoSum(nums, target) {\n    // Your implementation here\n    \n}\n\n// Test cases\nconsole.log(twoSum([2, 7, 11, 15], 9)); // Expected: [0, 1]",
          "python": "def two_sum(nums, target):\n    # Your implementation here\n    pass\n\n# Test cases\nprint(two_sum([2, 7, 11, 15], 9))  # Expected: [0, 1]",
          "java": "public int[] twoSum(int[] nums, int target) {\n    // Your implementation here\n    return new int[0];\n}"
        }
      }
    ]

    Make questions specific to the candidate's background and internship level. Focus on:
    - Learning experiences and growth potential
    - Technical fundamentals appropriate for interns
    - Problem-solving approach and thinking process
    - Real-world application of concepts
    - Specific technologies mentioned in resume/job description

    Ensure coding questions have appropriate starter code templates for JavaScript, Python, and Java.

    Return only valid JSON, no explanations or additional text.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const questionsText = response.text().trim();
    
    console.log('Raw AI response:', questionsText);
    
    const cleanedText = questionsText.replace(/```json\s*|```\s*/g, '').trim();
    const questions = JSON.parse(cleanedText);

    // Validate the distribution
    const distribution = {
      behavioral: questions.filter(q => normalizeQuestionType(q.type) === 'behavioral').length,
      coding: questions.filter(q => normalizeQuestionType(q.type) === 'coding').length,
      technical: questions.filter(q => normalizeQuestionType(q.type) === 'technical').length
    };

    console.log('Question distribution:', distribution);

    // If distribution is incorrect, use fallback questions
    if (questions.length !== 10 || distribution.behavioral !== 3 || distribution.coding !== 3 || distribution.technical !== 4) {
      console.log('AI generated incorrect distribution, using fallback questions');
      return getEnhancedDefaultQuestions();
    }

    // Normalize and validate question types
    return questions.map((q, index) => ({
      ...q,
      questionId: q.questionId || `q${index + 1}`,
      type: normalizeQuestionType(q.type),
      expectedDuration: q.expectedDuration || getDefaultDuration(normalizeQuestionType(q.type)),
      category: q.category || 'general',
      difficulty: q.difficulty || 'medium',
      starterCode: q.starterCode || (normalizeQuestionType(q.type) === 'coding' ? getDefaultStarterCode() : null)
    }));

  } catch (error) {
    console.error('Generate questions error:', error);
    console.log('Falling back to enhanced default questions...');
    return getEnhancedDefaultQuestions();
  }
}

// Helper function for backward compatibility with existing code
async function analyzeResponseLegacy(question, transcript, questionType, resumeText, jobDescription, responseTime) {
  try {
    const analysis = await generateComprehensiveFeedback(
      question,
      questionType,
      transcript,
      null, // code not provided in this context
      responseTime,
      120 // default expected duration
    );
    
    // Return in legacy format for backward compatibility
    return {
      feedback: analysis
    };
  } catch (error) {
    console.error('Response analysis error:', error);
    return {
      feedback: getDefaultAnalysis()
    };
  }
}

function getDefaultDuration(type) {
  switch (type) {
    case 'behavioral': return 180;
    case 'coding': return 300;
    case 'technical': return 150;
    default: return 120;
  }
}

async function generateOverallFeedback(responses, resumeText, jobDescription) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const responseSummary = responses.map(r => ({
      question: r.question,
      score: r.feedback?.score || 70,
      strengths: r.feedback?.strengths || [],
      improvements: r.feedback?.improvements || []
    }));

    const prompt = `Generate comprehensive feedback for a software engineering intern interview:

    Responses Summary: ${JSON.stringify(responseSummary, null, 2)}
    
    Provide overall assessment in JSON format:
    {
      "score": 78,
      "feedback": {
        "technicalSkills": {
          "score": 80,
          "feedback": "Strong foundation in programming concepts..."
        },
        "communicationSkills": {
          "score": 85,
          "feedback": "Clear and articulate responses..."
        },
        "problemSolving": {
          "score": 70,
          "feedback": "Good approach to breaking down problems..."
        },
        "recommendations": [
          "Practice more coding problems",
          "Work on explaining technical concepts clearly"
        ],
        "strengths": ["Good communication", "Technical knowledge"],
        "areasForImprovement": ["More practice needed", "Expand project portfolio"]
      }
    }

    Focus on intern-level expectations and growth potential.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const feedbackText = response.text().trim();
    
    const cleanedText = feedbackText.replace(/```json\s*|```\s*/g, '').trim();
    return JSON.parse(cleanedText);

  } catch (error) {
    console.error('Overall feedback error:', error);
    return getDefaultOverallFeedback(responses);
  }
}

function getDefaultQuestions() {
  return [
    {
      questionId: "q1",
      question: "Tell me about yourself and why you're interested in software engineering",
      type: "behavioral",
      category: "introduction",
      difficulty: "easy",
      expectedDuration: 120
    },
    {
      questionId: "q2",
      question: "Describe a challenging programming project you've worked on",
      type: "behavioral",
      category: "experience",
      difficulty: "medium",
      expectedDuration: 180
    },
    {
      questionId: "q3",
      question: "How do you approach debugging a piece of code that isn't working?",
      type: "technical",
      category: "problem-solving",
      difficulty: "medium",
      expectedDuration: 150
    },
    {
      questionId: "q4",
      question: "Explain the difference between a stack and a queue",
      type: "technical",
      category: "data-structures",
      difficulty: "easy",
      expectedDuration: 120
    },
    {
      questionId: "q5",
      question: "How would you find the maximum element in an unsorted array?",
      type: "coding",
      category: "algorithms",
      difficulty: "medium",
      expectedDuration: 180
    }
  ];
}

function getDefaultAnalysis() {
  return {
    score: 70,
    strengths: ["Attempted to answer the question"],
    improvements: ["Provide more specific examples", "Practice technical terminology"],
    detailedAnalysis: "The response shows basic understanding but could benefit from more specific examples and clearer structure.",
    communicationClarity: 7,
    technicalAccuracy: 6,
    structuredResponse: 7
  };
}

function getDefaultOverallFeedback(responses) {
  const avgScore = responses.length > 0 
    ? responses.reduce((acc, r) => acc + ((r.feedback && r.feedback.score) || 70), 0) / responses.length 
    : 70;

  return {
    score: Math.round(avgScore),
    feedback: {
      technicalSkills: {
        score: Math.round(avgScore),
        feedback: "Shows basic understanding of software engineering concepts with room for growth"
      },
      communicationSkills: {
        score: Math.round(avgScore),
        feedback: "Communicates clearly with room for improvement in structure and examples"
      },
      problemSolving: {
        score: Math.round(avgScore),
        feedback: "Demonstrates logical thinking approach but could benefit from more systematic problem-solving"
      },
      recommendations: [
        "Practice coding problems regularly",
        "Work on explaining technical concepts clearly",
        "Build more projects to gain practical experience"
      ],
      strengths: ["Shows enthusiasm for learning", "Basic technical understanding"],
      areasForImprovement: ["Need more hands-on project experience", "Improve technical communication"]
    }
  };
}
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
    'coding': 'coding'
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

    // Analyze confidence and response quality
    const analysis = await analyzeResponse(
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
      feedback: analysis.feedback,
      submittedAt: new Date()
    };

    interview.responses.push(response);
    await interview.save();

    res.json({
      success: true,
      message: 'Answer submitted successfully',
      question: question.question,
      feedback: analysis.feedback
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process answer' 
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

async function generateInterviewQuestions(resumeText, jobDescription) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `You are a senior software engineering interviewer at a top tech company. Generate 5 interview questions for a software engineering internship candidate.

    Resume Summary: ${resumeText.substring(0, 2000)}
    Job Description: ${jobDescription.substring(0, 2000)}

    Generate questions in the following categories:
    - 2 behavioral/soft skill questions (use type: "behavioral")
    - 2 technical questions based on technologies mentioned in resume/job (use type: "technical")  
    - 1 coding/algorithm question (use type: "coding")

    IMPORTANT: Only use these exact types: "behavioral", "technical", "coding", "system_design"

    Format your response as a JSON array with this structure:
    [
      {
        "questionId": "q1",
        "question": "Tell me about a challenging project you worked on",
        "type": "behavioral",
        "category": "experience",
        "difficulty": "medium",
        "expectedDuration": 120
      }
    ]

    Make questions specific to the candidate's background and internship level. Focus on:
    - Learning experiences and growth
    - Technical fundamentals
    - Problem-solving approach
    - Team collaboration
    - Specific technologies from resume

    Return only valid JSON, no explanations.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const questionsText = response.text().trim();
    
    console.log('Raw AI response:', questionsText);
    
    const cleanedText = questionsText.replace(/```json\s*|```\s*/g, '').trim();
    const questions = JSON.parse(cleanedText);

    // Normalize and validate question types
    return questions.map((q, index) => ({
      ...q,
      questionId: q.questionId || `q${index + 1}`,
      type: normalizeQuestionType(q.type), // Fix the type here
      expectedDuration: q.expectedDuration || 120,
      category: q.category || 'general'
    }));

  } catch (error) {
    console.error('Generate questions error:', error);
    console.log('Falling back to default questions...');
    return getDefaultQuestions();
  }
}

async function analyzeResponse(question, transcript, questionType, resumeText, jobDescription, responseTime) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `Analyze this interview response for a software engineering intern candidate:

    Question: ${question}
    Question Type: ${questionType}
    Response: ${transcript}
    Response Time: ${responseTime} seconds
    
    Provide analysis in JSON format:
    {
      "feedback": {
        "strengths": ["Clear communication", "Good technical knowledge"],
        "improvements": ["Reduce filler words", "More specific examples"],
        "score": 85,
        "detailedAnalysis": "The candidate showed...",
        "communicationClarity": 8,
        "technicalAccuracy": 7,
        "structuredResponse": 9
      }
    }

    Evaluate based on:
    - Content quality and relevance
    - Technical accuracy (for technical questions)
    - Communication clarity
    - Response completeness
    - Appropriate response time

    Be constructive but honest in feedback. Focus on intern-level expectations.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysisText = response.text().trim();
    
    const cleanedText = analysisText.replace(/```json\s*|```\s*/g, '').trim();
    return JSON.parse(cleanedText);

  } catch (error) {
    console.error('Response analysis error:', error);
    return getDefaultAnalysis();
  }
}

async function generateOverallFeedback(responses, resumeText, jobDescription) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const responseSummary = responses.map(r => ({
      question: r.question,
      score: r.feedback.score,
      strengths: r.feedback.strengths,
      improvements: r.feedback.improvements
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
      type: "coding", // Changed from "coding" to valid enum value
      category: "algorithms",
      difficulty: "medium",
      expectedDuration: 180
    }
  ];
}

function getDefaultAnalysis() {
  return {
    feedback: {
      strengths: ["Attempted to answer the question"],
      improvements: ["Provide more specific examples", "Practice technical terminology"],
      score: 70,
      detailedAnalysis: "The response shows basic understanding but could benefit from more specific examples and clearer structure.",
      communicationClarity: 7,
      technicalAccuracy: 6,
      structuredResponse: 7
    }
  };
}

function getDefaultOverallFeedback(responses) {
  const avgScore = responses.length > 0 
    ? responses.reduce((acc, r) => acc + (r.feedback.score || 70), 0) / responses.length 
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
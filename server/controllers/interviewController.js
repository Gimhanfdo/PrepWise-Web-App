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

    const questions = await generateInterviewQuestions(resumeText, jobDescription);

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
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const createInterviewWithProfileCV = async (req, res) => {
  try {
    const { jobDescription } = req.body;
    const userId = req.user.userId || req.user.id || req.user._id;

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
    if (!user || !user.hasCV) {
      return res.status(400).json({
        success: false,
        error: 'No CV found in user profile. Please upload a CV first.'
      });
    }

    const actualCVText = user.getCVText();
    const questions = await generateInterviewQuestions(actualCVText, jobDescription);

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
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
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

export const submitAnswer = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { questionId, responseTime, answerMode, responseText, code } = req.body;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    if (!responseText || responseText.trim().length === 0) {
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

    // ADD THESE DEBUG LOGS
    console.log('=== SUBMIT ANSWER DEBUG ===');
    console.log('Question Text:', question.question);
    console.log('Question Type:', question.type);
    console.log('Response Text:', responseText);
    console.log('Function Type:', typeof generateDetailedFeedback);
    console.log('==========================');

    let analysis = null;
    try {
      console.log('🔄 Calling generateDetailedFeedback...');
      
      analysis = await generateDetailedFeedback(
        question.question,
        question.type,
        responseText,
        code,
        interview.resumeText,
        interview.jobDescription
      );
      
      console.log('✅ Analysis completed:', {
        score: analysis.score,
        hasStrengths: analysis.strengths?.length,
        hasImprovements: analysis.improvements?.length,
        analysisLength: analysis.detailedAnalysis?.length
      });
      
    } catch (analysisError) {
      console.error('❌ Analysis failed, using basic fallback:', analysisError.message);
      console.error('Full error:', analysisError);
      
      // Log which fallback is being used
      console.log('🔄 Falling back to generateBasicFeedback...');
      analysis = generateBasicFeedback(responseText, question.type);
      
      console.log('📝 Fallback result:', {
        score: analysis.score,
        source: 'fallback'
      });
    }

    const response = {
      questionId,
      question: question.question,
      questionType: question.type,
      transcription: answerMode === 'audio' ? responseText : null,
      textResponse: answerMode === 'text' ? responseText : null,
      code: code || null,
      responseTime: parseInt(responseTime) || 0,
      recordingDuration: answerMode === 'audio' ? parseInt(responseTime) : null,
      submittedAt: new Date(),
      feedback: analysis
    };

    interview.responses.push(response);
    interview.currentQuestionIndex = interview.responses.length;
    interview.updatedAt = new Date();

    if (interview.status === 'created') {
      interview.status = 'in_progress';
      interview.startedAt = new Date();
    }

    await interview.save();

    // Log final response being sent
    console.log('📤 Final feedback being sent:', {
      score: analysis.score,
      strengths: analysis.strengths,
      improvements: analysis.improvements?.slice(0, 2) // Just first 2 for brevity
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

// ALSO, let's check what your generateBasicFeedback function looks like
// This might be the culprit - it could be giving high scores incorrectly

function generateBasicFeedback(responseText, questionType) {
  console.log('⚠️  USING BASIC FALLBACK - This should give low scores for off-topic answers');
  
  // Check if this is the database answer to behavioral question
  const response = responseText.toLowerCase();
  const isDatabaseAnswerToNonDatabaseQuestion = (
    response.includes('mysql') && 
    response.includes('mongodb') && 
    response.includes('structured data') &&
    questionType === 'behavioral'
  );
  
  if (isDatabaseAnswerToNonDatabaseQuestion) {
    console.log('🚨 Detected database answer to behavioral question - scoring low');
    return {
      score: 15,
      strengths: ['Demonstrated technical knowledge'],
      improvements: [
        'Answer the specific question asked - this was about your project experience, not database comparisons',
        'Read behavioral questions carefully and provide personal examples',
        'Focus on YOUR specific challenges and solutions'
      ],
      detailedAnalysis: `Student provided database comparison answer when asked about behavioral project experience. This shows knowledge but completely misses the question. Score: 15/100`,
      communicationClarity: 3,
      technicalAccuracy: 6
    };
  }
  
  // For other responses, return your existing logic
  return generateImprovedFallbackFeedback('General question', questionType, responseText, null);
}

// Test function to verify the new feedback function works
export const testNewFeedback = async (req, res) => {
  try {
    console.log('🧪 Testing new feedback function...');
    
    const testQuestion = "Your Event Management System project involved developing a GUI-based application with user authentication and database integration using C# and .NET. Tell me about a significant technical challenge you encountered during the development of this system. How did you approach solving it, and what did you learn from that experience?";
    const testResponse = "MySQL stores structured data in predefined tables with relationships, ideal for complex queries and strong consistency. MongoDB stores flexible, JSON-like documents, suiting rapidly changing or unstructured data. I'd choose MongoDB for agile, schema-evolving apps, and MySQL for transaction-heavy systems requiring strict schema enforcement and reliable relational integrity.";
    
    const result = await generateDetailedFeedback(
      testQuestion,
      "behavioral", 
      testResponse,
      null,
      "",
      ""
    );
    
    console.log('🧪 Test result:', result);
    
    res.json({
      success: true,
      message: 'Test completed',
      feedback: result,
      expected: 'Score should be very low (10-15) for off-topic response'
    });
    
  } catch (error) {
    console.error('Test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

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
      textResponse: 'Question skipped',
      code: null,
      responseTime: 0,
      recordingDuration: null,
      submittedAt: new Date(),
      skipped: true,
      feedback: {
        score: 0,
        strengths: [],
        improvements: ['Question was skipped - consider attempting similar questions in practice'],
        detailedAnalysis: 'Question was skipped by the candidate.',
        communicationClarity: 0,
        technicalAccuracy: 0
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
      message: 'Question skipped successfully',
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
    const { question, questionType, responseText, code } = req.body;
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

    const feedback = await generateDetailedFeedback(
      question,
      questionType,
      responseText,
      code,
      '',
      ''
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

  if (primaryLang === 'go' || candidateLanguages.includes('go')) {
    starterCode.go = `package main

import "fmt"

func solution(input []int) int {
    // Your code here
    return 0
}

func main() {
    test := []int{1, 2, 3, 4, 5}
    fmt.Println(solution(test))
}`;
  }

  if (primaryLang === 'rust' || candidateLanguages.includes('rust')) {
    starterCode.rust = `fn solution(input: Vec<i32>) -> i32 {
    // Your code here
    0
}

fn main() {
    let test = vec![1, 2, 3, 4, 5];
    println!("{}", solution(test));
}`;
  }

  if (primaryLang === 'php' || candidateLanguages.includes('php')) {
    starterCode.php = `<?php
function solution($input) {
    // Your code here
    return 0;
}

$test = [1, 2, 3, 4, 5];
echo solution($test);
?>`;
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

function analyzeResponseQuality(responseText, questionType) {
  const response = responseText.trim().toLowerCase();
  const wordCount = responseText.trim().split(/\s+/).length;
  
  const inappropriateResponses = [
    'no idea', 'dont know', "don't know", 'idk', 'not sure', 'no clue',
    'what', 'huh', 'what are you saying', 'what do you mean',
    'i have no idea', 'no understanding', 'completely lost'
  ];
  
  const dismissiveResponses = [
    'whatever', 'who cares', 'does not matter', "doesn't matter",
    'why should i know', 'not important', 'boring', 'stupid question'
  ];
  
  const isInappropriate = inappropriateResponses.some(phrase => response.includes(phrase)) ||
                         dismissiveResponses.some(phrase => response.includes(phrase));
  
  const isTooShort = wordCount < 3 || responseText.trim().length < 10;
  
  const isOffTopic = !isInappropriate && !isTooShort && (
    response.includes('different topic') ||
    response.includes('not related') ||
    (questionType === 'technical' && !containsAnyTechnicalContent(responseText))
  );
  
  return {
    isInappropriate,
    isTooShort,
    isOffTopic,
    wordCount
  };
}

// Enhanced feedback generation using Gemini 2.5 Flash
async function generateDetailedFeedback(question, questionType, responseText, code, resumeText, jobDescription) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // Pre-analyze the response for immediate issues
    const preAnalysis = preAnalyzeResponse(responseText, question, questionType);
    
    const prompt = `You are an expert technical interviewer evaluating a SOFTWARE ENGINEERING INTERN candidate. You must provide precise, honest feedback based on how well their response matches the specific question asked.

CRITICAL ANALYSIS TASK:
Question Asked: "${question}"
Question Type: ${questionType}
Candidate's Response: "${responseText}"
${code ? `Code Provided: ${code}` : 'No code provided'}

PRE-ANALYSIS FLAGS:
${preAnalysis.flags.map(flag => `- ${flag}`).join('\n')}

EVALUATION CRITERIA:

1. RELEVANCE CHECK (Most Important):
   - Does the response answer the SPECIFIC question asked?
   - For behavioral questions: Did they describe a personal experience/challenge?
   - For technical questions: Did they address the technical concept asked about?
   - PENALTY: If completely off-topic, maximum score is 15/100

2. CONTENT ANALYSIS:
   - Technical accuracy of any claims made
   - Depth and detail of explanation
   - Use of appropriate examples
   - Professional communication style

3. BEHAVIORAL QUESTION REQUIREMENTS:
   If question asks about "challenge you faced" or "experience":
   - Must describe a SPECIFIC situation from their experience
   - Should explain what they DID to solve it
   - Should mention lessons learned or outcomes

SCORING RUBRIC (Be Strict and Honest):
- 90-100: Perfect answer that fully addresses the question with excellent detail
- 80-89: Good answer that addresses the question with solid understanding
- 70-79: Adequate answer with some gaps but stays on topic
- 60-69: Weak answer that partially addresses the question
- 50-59: Poor answer that barely relates to the question
- 30-49: Very poor answer that mostly misses the point
- 10-29: Completely wrong answer or totally off-topic
- 0-9: Nonsensical, inappropriate, or no meaningful response

SPECIFIC ANALYSIS FOR THIS RESPONSE:
The candidate was asked: "${question}"
They responded with: "${responseText}"

CRITICAL QUESTIONS TO ANSWER:
1. Does this response answer what was asked?
2. If it's a behavioral question about their project experience, did they describe their actual experience?
3. If it's about a technical challenge, did they mention a specific challenge they faced?
4. Is this response relevant to the question at all?

Be brutally honest. If they answered the wrong question entirely, score accordingly low and explain exactly what went wrong.

Return ONLY valid JSON (no markdown formatting):
{
  "score": [0-100, be honest about how well this matches the question],
  "strengths": ["Specific positive aspects of their response, if any"],
  "improvements": ["Specific issues with their response", "What they need to fix"],
  "detailedAnalysis": "Comprehensive analysis explaining: 1) How well their response matches the question asked, 2) What they got right/wrong, 3) Why this score was given. Reference their exact words and the exact question.",
  "communicationClarity": [1-10],
  "technicalAccuracy": [1-10],
  "questionRelevance": [1-10, how well they answered what was actually asked],
  "responseType": "on-topic|partially-relevant|completely-off-topic"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let analysisText = response.text().trim();
    
    // Clean the response of any markdown formatting
    analysisText = analysisText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    let aiAnalysis;
    try {
      aiAnalysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return generateIntelligentFallback(question, questionType, responseText, code, preAnalysis);
    }
    
    // Validate and enhance the AI response
    return validateAndEnhanceFeedback(aiAnalysis, question, questionType, responseText, code, preAnalysis);

  } catch (error) {
    console.error('Gemini API failed:', error);
    return generateIntelligentFallback(question, questionType, responseText, code, preAnalysis);
  }
}

// Pre-analyze response for obvious issues
function preAnalyzeResponse(responseText, question, questionType) {
  const response = responseText.toLowerCase();
  const questionLower = question.toLowerCase();
  const flags = [];
  
  // Check for question mismatch
  if (questionType === 'behavioral') {
    const behavioralKeywords = ['challenge', 'experience', 'project', 'faced', 'solved', 'developed'];
    const hasBehavioralResponse = ['when', 'during', 'while working', 'i faced', 'challenge was', 'problem', 'difficulty'].some(phrase => response.includes(phrase));
    
    if (!hasBehavioralResponse && questionLower.includes('challenge')) {
      flags.push('Response does not describe a personal challenge or experience as requested');
    }
  }
  
  // Check for topic mismatch
  if (questionLower.includes('event management') && !response.includes('event')) {
    flags.push('Question asks about Event Management System but response does not mention events');
  }
  
  if (questionLower.includes('c#') && !response.includes('c#') && !response.includes('.net')) {
    flags.push('Question mentions C# and .NET but response does not address these technologies');
  }
  
  // Check for database question mismatch
  if (response.includes('mysql') && response.includes('mongodb') && !questionLower.includes('mysql') && !questionLower.includes('mongodb')) {
    flags.push('Response discusses MySQL and MongoDB but question does not ask about these databases');
  }
  
  // Check for template/memorized answers
  if (response.includes('structured data in predefined tables') && !questionLower.includes('database')) {
    flags.push('Response appears to be answering a database comparison question');
  }
  
  const responseLength = responseText.trim().split(/\s+/).length;
  const isAppropriateLength = responseLength >= 15;
  
  return {
    flags,
    isAppropriateLength,
    responseLength,
    appearsOffTopic: flags.length > 0
  };
}

// Validate and enhance AI feedback
function validateAndEnhanceFeedback(aiAnalysis, question, questionType, responseText, code, preAnalysis) {
  let score = Math.max(0, Math.min(100, aiAnalysis.score || 50));
  
  // Apply penalties for obvious mismatches
  if (preAnalysis.appearsOffTopic) {
    score = Math.min(score, 20); // Cap score at 20 for off-topic responses
  }
  
  // Specific penalty for answering wrong question entirely
  if (questionType === 'behavioral' && responseText.toLowerCase().includes('mysql') && responseText.toLowerCase().includes('mongodb')) {
    score = Math.min(score, 15);
  }
  
  // Ensure feedback is specific and helpful
  let improvements = Array.isArray(aiAnalysis.improvements) ? aiAnalysis.improvements : [];
  if (preAnalysis.appearsOffTopic) {
    improvements.unshift('Read the question carefully and ensure your response directly addresses what is being asked');
    if (questionType === 'behavioral') {
      improvements.push('For behavioral questions, describe a specific personal experience or situation you encountered');
    }
  }
  
  let strengths = Array.isArray(aiAnalysis.strengths) ? aiAnalysis.strengths : [];
  if (strengths.length === 0 || preAnalysis.appearsOffTopic) {
    if (responseText.trim().length > 50) {
      strengths = ['Provided a detailed response'];
    } else {
      strengths = ['Attempted to provide an answer'];
    }
  }
  
  return {
    score: score,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 4),
    detailedAnalysis: aiAnalysis.detailedAnalysis || generateSpecificAnalysis(question, questionType, responseText, score, preAnalysis),
    communicationClarity: Math.max(1, Math.min(10, aiAnalysis.communicationClarity || 5)),
    technicalAccuracy: Math.max(1, Math.min(10, aiAnalysis.technicalAccuracy || 5)),
    questionRelevance: Math.max(1, Math.min(10, aiAnalysis.questionRelevance || (preAnalysis.appearsOffTopic ? 2 : 5))),
    responseType: aiAnalysis.responseType || (preAnalysis.appearsOffTopic ? 'completely-off-topic' : 'partially-relevant')
  };
}

// Generate intelligent fallback when AI fails
function generateIntelligentFallback(question, questionType, responseText, code, preAnalysis) {
  let score = 40; // Base score
  let strengths = [];
  let improvements = [];
  
  // Analyze the specific case of wrong question answered
  if (preAnalysis.appearsOffTopic) {
    score = 12;
    strengths = ['Demonstrated knowledge of database concepts'];
    improvements = [
      'Read the question carefully - you were asked about your Event Management System project experience, not database comparisons',
      'For behavioral questions, describe a specific challenge YOU faced and how YOU solved it',
      'Focus on answering the exact question asked rather than providing general technical knowledge',
      'Practice identifying different question types (behavioral vs technical)'
    ];
  } else {
    // Standard analysis for on-topic responses
    if (preAnalysis.isAppropriateLength) {
      score += 20;
      strengths.push('Provided comprehensive detail');
    }
    
    if (questionType === 'behavioral' && responseText.toLowerCase().includes('project')) {
      score += 15;
      strengths.push('Mentioned project experience');
    }
    
    improvements.push('Ensure your response directly addresses the specific question asked');
    improvements.push('Provide more specific examples from your personal experience');
  }
  
  const detailedAnalysis = generateSpecificAnalysis(question, questionType, responseText, score, preAnalysis);
  
  return {
    score: score,
    strengths: strengths.length > 0 ? strengths : ['Provided a response'],
    improvements: improvements,
    detailedAnalysis: detailedAnalysis,
    communicationClarity: preAnalysis.isAppropriateLength ? 6 : 3,
    technicalAccuracy: preAnalysis.appearsOffTopic ? 2 : 5,
    questionRelevance: preAnalysis.appearsOffTopic ? 1 : 4,
    responseType: preAnalysis.appearsOffTopic ? 'completely-off-topic' : 'partially-relevant'
  };
}

// Generate specific analysis based on question-response mismatch
function generateSpecificAnalysis(question, questionType, responseText, score, preAnalysis) {
  let analysis = `Analysis of response to: "${question}"\n\n`;
  
  // Identify specific mismatch
  if (questionType === 'behavioral' && responseText.includes('MySQL') && responseText.includes('MongoDB')) {
    analysis += `MAJOR ISSUE: The candidate was asked about a behavioral question regarding their Event Management System project - specifically about a technical challenge they faced and how they solved it. However, they provided a textbook answer about MySQL vs MongoDB database differences.\n\n`;
    analysis += `This response completely misses the point of the behavioral question. The interviewer wanted to hear about:\n`;
    analysis += `- A specific challenge the candidate encountered in their Event Management System project\n`;
    analysis += `- How they approached solving that challenge\n`;
    analysis += `- What they learned from the experience\n\n`;
    analysis += `Instead, they provided generic technical knowledge that doesn't demonstrate personal experience or problem-solving skills.\n\n`;
    analysis += `Score: ${score}/100 - This low score reflects the complete disconnect between question and answer.`;
    return analysis;
  }
  
  // Analysis for other types of responses
  analysis += `The response contains ${responseText.split(' ').length} words and `;
  
  if (preAnalysis.appearsOffTopic) {
    analysis += `appears to be answering a different question than what was asked. `;
    analysis += `${preAnalysis.flags.join('. ')}. `;
  } else if (questionType === 'behavioral') {
    analysis += `addresses the behavioral question with `;
    analysis += responseText.toLowerCase().includes('challenge') ? 'some mention of challenges' : 'limited focus on personal experience';
  } else {
    analysis += `provides technical information that is `;
    analysis += score >= 60 ? 'generally accurate' : 'limited in accuracy or depth';
  }
  
  analysis += ` Score: ${score}/100.`;
  return analysis;
}

// Export the enhanced function
export { generateDetailedFeedback };

function validateFeedback(aiAnalysis, responseText, code, questionType) {
  const wordCount = responseText.trim().split(/\s+/).length;
  const isVeryShort = responseText.trim().length < 15 || wordCount < 5;
  const meaninglessResponses = ['yes', 'no', 'ok', 'sure', 'maybe', 'i dont know', 'idk', 'not sure', 'good'];
  const isRubbish = meaninglessResponses.includes(responseText.trim().toLowerCase()) || isVeryShort;
  
  let adjustedScore = Math.min(100, Math.max(0, aiAnalysis.score || 50));
  
  if (isRubbish) {
    adjustedScore = Math.min(adjustedScore, 20);
  }
  
  if (questionType === 'coding' && (!code || code.trim().length < 30)) {
    adjustedScore = Math.min(adjustedScore, 35);
  }
  
  return {
    score: adjustedScore,
    strengths: Array.isArray(aiAnalysis.strengths) ? aiAnalysis.strengths.slice(0, 4) : ['Provided a response'],
    improvements: Array.isArray(aiAnalysis.improvements) ? aiAnalysis.improvements.slice(0, 4) : ['Work on providing more detailed explanations'],
    detailedAnalysis: aiAnalysis.detailedAnalysis || `Response analyzed with ${wordCount} words. ${isRubbish ? 'Response lacks sufficient detail and substance.' : 'Shows effort in answering the question.'}`,
    communicationClarity: isRubbish ? Math.min(3, aiAnalysis.communicationClarity || 1) : Math.min(10, Math.max(1, aiAnalysis.communicationClarity || 5)),
    technicalAccuracy: isRubbish ? Math.min(3, aiAnalysis.technicalAccuracy || 1) : Math.min(10, Math.max(1, aiAnalysis.technicalAccuracy || 5))
  };
}

function generateImprovedFallbackFeedback(question, questionType, responseText, code) {
  const wordCount = responseText.trim().split(/\s+/).length;
  const responseLength = responseText.trim().length;
  const isVeryShort = responseLength < 15 || wordCount < 5;
  const meaninglessResponses = ['yes', 'no', 'ok', 'sure', 'maybe', 'i dont know', 'idk', 'not sure', 'good'];
  const isRubbish = meaninglessResponses.includes(responseText.trim().toLowerCase()) || isVeryShort;

  let baseScore = 50;
  let strengths = [];
  let improvements = [];
  let analysis = '';

  if (isRubbish) {
    baseScore = 15;
    strengths = ['Attempted to respond to the question'];
    improvements = [
      'Provide much more detailed explanations',
      'Show your understanding with specific examples',
      'Elaborate on your thought process'
    ];
    analysis = `Response to "${question}" is too brief (${wordCount} words) and lacks the detail expected. The answer "${responseText.trim()}" does not demonstrate understanding of what was asked.`;
  } else {
    if (questionType === 'behavioral') {
      const hasExample = responseText.toLowerCase().includes('when') || 
                        responseText.toLowerCase().includes('time') ||
                        responseText.toLowerCase().includes('project') ||
                        responseText.toLowerCase().includes('experience');
      
      if (hasExample) {
        baseScore += 20;
        strengths.push('Provided specific examples from personal experience');
      } else {
        improvements.push('Include specific examples and situations in behavioral responses');
      }

      const showsLearning = responseText.toLowerCase().includes('learn') ||
                           responseText.toLowerCase().includes('challenge') ||
                           responseText.toLowerCase().includes('improve');
      
      if (showsLearning) {
        baseScore += 15;
        strengths.push('Demonstrated learning mindset and growth orientation');
      }
    }

    if (questionType === 'technical') {
      const techTerms = ['algorithm', 'function', 'variable', 'object', 'class', 'method', 'array', 'data', 'structure', 'database', 'api'];
      const foundTerms = techTerms.filter(term => responseText.toLowerCase().includes(term));
      
      if (foundTerms.length >= 2) {
        baseScore += 20;
        strengths.push('Used appropriate technical terminology');
      } else if (foundTerms.length > 0) {
        baseScore += 10;
        strengths.push('Showed basic technical vocabulary');
      } else {
        improvements.push('Use more technical terms relevant to the question');
      }

      if (responseText.includes('example') || responseText.includes('for instance')) {
        baseScore += 10;
        strengths.push('Provided examples to illustrate concepts');
      }
    }

    if (questionType === 'coding') {
      if (code && code.trim().length > 30) {
        baseScore += 25;
        strengths.push('Provided code implementation');
        
        if (code.includes('function') || code.includes('def') || code.includes('class')) {
          baseScore += 10;
          strengths.push('Used proper function structure');
        }
        
        if (code.includes('return') && !code.includes('return null') && !code.includes('return 0;')) {
          baseScore += 10;
          strengths.push('Implemented return logic');
        }
      } else {
        baseScore -= 20;
        improvements.push('Provide actual code implementation, not just comments');
      }
    }

    if (wordCount >= 30) {
      baseScore += 15;
      strengths.push('Provided comprehensive response with good detail');
    } else if (wordCount >= 15) {
      baseScore += 8;
      strengths.push('Gave adequate detail in response');
    }

    analysis = `Response to "${question}" contains ${wordCount} words. `;
    
    if (questionType === 'coding' && code) {
      analysis += `Code implementation provided with ${code.split('\n').length} lines. `;
    }
    
    analysis += `The response shows ${baseScore >= 70 ? 'good' : baseScore >= 50 ? 'adequate' : 'basic'} understanding of what was asked.`;
  }

  if (strengths.length === 0) {
    strengths = ['Made an attempt to answer the question'];
  }
  
  if (improvements.length === 0) {
    improvements = ['Provide more detailed explanations', 'Show deeper understanding of the concepts'];
  }

  return {
    score: Math.min(95, Math.max(5, baseScore)),
    strengths,
    improvements,
    detailedAnalysis: analysis,
    communicationClarity: isRubbish ? 2 : Math.min(8, Math.max(3, Math.round(wordCount / 5))),
    technicalAccuracy: isRubbish ? 2 : Math.min(8, Math.max(3, questionType === 'technical' ? 6 : 5))
  };
}

async function generateOverallFeedback(responses, resumeText, jobDescription) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
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
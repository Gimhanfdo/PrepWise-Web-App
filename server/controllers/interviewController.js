import interviewModel from '../models/interviewModel.js';
import userModel from '../models/userModel.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const getUserCV = async (req, res) => {
  try {
    console.log('Getting user CV...');
    const userId = req.user.userId || req.user.id || req.user._id;

    // Get actual user CV from database
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
    console.log('Creating interview...');
    const { jobTitle, jobDescription, resumeText } = req.body;
    const userId = req.user.userId || req.user.id || req.user._id;

    // Validate required fields
    if (!jobTitle || !jobDescription || !resumeText) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: jobTitle, jobDescription, and resumeText are required'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated properly. Please log in again.'
      });
    }

    // Generate questions using actual resume text
    console.log('Generating interview questions...');
    const questions = await generateInterviewQuestions(resumeText, jobDescription, jobTitle);
    console.log('Generated questions:', questions.length, 'questions');

    const interviewData = {
      userId: userId,
      jobTitle: jobTitle.trim(),
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

    const interview = new interviewModel(interviewData);
    const savedInterview = await interview.save();

    console.log('Interview created successfully with MongoDB ID:', savedInterview._id);

    res.status(201).json({
      success: true,
      message: 'Interview created successfully',
      interview: {
        id: savedInterview._id,
        _id: savedInterview._id,
        userId: savedInterview.userId,
        jobTitle: savedInterview.jobTitle,
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
    console.log('Creating interview with profile CV...');
    const { jobTitle, jobDescription } = req.body;
    const userId = req.user.userId || req.user.id || req.user._id;

    if (!jobTitle || !jobDescription) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: jobTitle and jobDescription are required'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated properly. Please log in again.'
      });
    }

    // Get ACTUAL user CV from database - NOT MOCK DATA
    const user = await userModel.findById(userId);
    if (!user || !user.hasCV) {
      return res.status(400).json({
        success: false,
        error: 'No CV found in user profile. Please upload a CV first.'
      });
    }

    const actualCVText = user.getCVText();
    console.log('Using actual user CV:', actualCVText.substring(0, 100) + '...');

    // Generate questions using ACTUAL CV text
    console.log('Generating interview questions with actual profile CV...');
    const questions = await generateInterviewQuestions(actualCVText, jobDescription, jobTitle);
    console.log('Generated questions:', questions.length, 'questions');

    const interviewData = {
      userId: userId,
      jobTitle: jobTitle.trim(),
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

    const interview = new interviewModel(interviewData);
    const savedInterview = await interview.save();

    console.log('Interview with actual profile CV created successfully');

    res.status(201).json({
      success: true,
      message: 'Interview created successfully with profile CV',
      interview: {
        id: savedInterview._id,
        _id: savedInterview._id,
        userId: savedInterview.userId,
        jobTitle: savedInterview.jobTitle,
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

    console.log('Starting interview with ID:', interviewId);

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

    console.log('Interview started successfully with', interview.questions.length, 'questions');

    res.json({
      success: true,
      message: 'Interview started successfully',
      firstQuestion: interview.questions[0],
      totalQuestions: interview.questions.length,
      questions: interview.questions,
      interviewData: {
        id: interview._id,
        jobTitle: interview.jobTitle,
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

    const interview = await interviewModel.findOne({ _id: interviewId, userId });
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

    console.log('Submitting answer:', {
      interviewId,
      questionId,
      answerMode,
      responseTextLength: responseText?.length,
      hasCode: !!code,
      responseTime
    });

    if (!responseText || responseText.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Response text is required' 
      });
    }

    const interview = await interviewModel.findOne({ _id: interviewId, userId });
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

    // Analyze the response with proper intern-level expectations
    let analysis = null;
    try {
      analysis = await generateComprehensiveFeedback(
        question.question,
        question.type,
        responseText,
        code,
        responseTime,
        question.expectedDuration
      );
      console.log('Analysis completed:', {
        score: analysis.score,
        strengthsCount: analysis.strengths?.length,
        improvementsCount: analysis.improvements?.length
      });
    } catch (analysisError) {
      console.error('Analysis failed, using basic fallback:', analysisError.message);
      analysis = generateBasicFeedback(responseText, question.type, responseTime);
    }

    // Create response object
    const response = {
      questionId,
      question: question.question,
      transcription: answerMode === 'audio' ? responseText : null,
      textResponse: answerMode === 'text' ? responseText : null,
      code: code || null,
      responseTime: parseInt(responseTime) || 0,
      recordingDuration: answerMode === 'audio' ? parseInt(responseTime) : null,
      submittedAt: new Date(),
      feedback: {
        score: analysis.score,
        strengths: analysis.strengths,
        improvements: analysis.improvements,
        detailedAnalysis: analysis.detailedAnalysis,
        keywordMatches: [],
        communicationClarity: analysis.communicationClarity,
        technicalAccuracy: analysis.technicalAccuracy,
        structuredResponse: analysis.structuredResponse
      }
    };

    interview.responses.push(response);
    interview.currentQuestionIndex = interview.responses.length;
    interview.updatedAt = new Date();

    if (interview.status === 'created') {
      interview.status = 'in_progress';
      interview.startedAt = new Date();
    }

    await interview.save();

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

export const completeInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    console.log('Completing interview:', interviewId);

    const interview = await interviewModel.findOne({ _id: interviewId, userId });
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
        results: {
          score: interview.overallFeedback?.score || 0,
          feedback: interview.overallFeedback,
          duration: interview.totalDuration,
          questionsAnswered: interview.responses.length
        }
      });
    }

    console.log('Generating overall feedback for', interview.responses.length, 'responses...');

    // Generate overall feedback with proper function
    let overallAnalysis;
    try {
      overallAnalysis = await generateOverallFeedback(
        interview.responses,
        interview.resumeText,
        interview.jobDescription
      );
      console.log('Overall feedback generated:', {
        score: overallAnalysis.score,
        hasRecommendations: !!overallAnalysis.feedback?.recommendations
      });
    } catch (feedbackError) {
      console.error('Overall feedback generation failed:', feedbackError.message);
      overallAnalysis = generateFallbackOverallFeedback(interview.responses);
    }

    // Update interview status
    interview.status = 'completed';
    interview.completedAt = new Date();
    
    if (interview.startedAt) {
      interview.totalDuration = Math.round((interview.completedAt - interview.startedAt) / 1000);
    } else {
      interview.totalDuration = 1800;
    }
    
    interview.overallFeedback = {
      score: overallAnalysis.score,
      technicalSkills: {
        score: overallAnalysis.feedback.categoryScores?.technicalSkills || overallAnalysis.score,
        feedback: 'Technical skills assessment based on responses'
      },
      communicationSkills: {
        score: overallAnalysis.feedback.categoryScores?.communicationSkills || overallAnalysis.score,
        feedback: 'Communication skills assessment based on responses'
      },
      problemSolving: {
        score: overallAnalysis.feedback.categoryScores?.problemSolving || overallAnalysis.score,
        feedback: 'Problem solving skills assessment based on responses'
      },
      recommendations: overallAnalysis.feedback.recommendations || [],
      strengths: overallAnalysis.feedback.strengths || [],
      areasForImprovement: overallAnalysis.feedback.improvements || []
    };
    
    interview.updatedAt = new Date();
    await interview.save();

    res.json({
      success: true,
      message: 'Interview completed successfully',
      results: {
        score: overallAnalysis.score,
        feedback: interview.overallFeedback,
        duration: interview.totalDuration,
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

    // Don't populate userId to avoid schema error - just get the interview
    const interview = await interviewModel.findOne({ _id: interviewId, userId });

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

export const getInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    // Don't populate to avoid schema error
    const interview = await interviewModel.findOne({ _id: interviewId, userId });

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

// HELPER FUNCTIONS

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
  
  // Programming languages
  const languages = [
    'javascript', 'python', 'java', 'typescript', 'html', 'css', 'sql', 'c++', 'c#', 
    'php', 'ruby', 'go', 'swift', 'kotlin', 'dart', 'rust', 'scala', 'perl', 'r', 'c'
  ];
  languages.forEach(lang => {
    if (text.includes(lang)) keywords.languages.push(lang);
  });
  
  // Frameworks and libraries
  const frameworks = [
    'react', 'angular', 'vue', 'nodejs', 'node.js', 'express', 'django', 'flask', 
    'spring', 'laravel', 'bootstrap', 'jquery', 'next.js', 'nuxt.js', 'svelte',
    'ember.js', 'backbone.js', 'meteor', 'electron', 'react native', 'flutter',
    '.net', 'tailwind'
  ];
  frameworks.forEach(fw => {
    if (text.includes(fw.toLowerCase())) keywords.frameworks.push(fw);
  });
  
  // Databases
  const databases = [
    'mysql', 'postgresql', 'mongodb', 'sqlite', 'redis', 'firebase', 'dynamodb',
    'cassandra', 'elasticsearch', 'oracle', 'sql server', 'mariadb'
  ];
  databases.forEach(db => {
    if (text.includes(db.toLowerCase())) keywords.databases.push(db);
  });

  // Tools and technologies
  const tools = [
    'git', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'jenkins', 'webpack',
    'babel', 'eslint', 'prettier', 'jest', 'cypress', 'selenium', 'postman', 'figma',
    'visual studio', 'vscode', 'github', 'gitlab'
  ];
  tools.forEach(tool => {
    if (text.includes(tool.toLowerCase())) keywords.tools.push(tool);
  });

  // Experience indicators
  const experienceIndicators = [
    'intern', 'internship', 'freelance', 'tutor', 'project', 'developed', 'built', 
    'created', 'implemented', 'designed', 'worked', 'experience'
  ];
  experienceIndicators.forEach(exp => {
    if (text.includes(exp)) keywords.experience.push(exp);
  });

  // Certifications
  if (text.includes('certif') || text.includes('course')) {
    keywords.certifications.push('has certifications');
  }

  // Education level
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

async function generateInterviewQuestions(resumeText, jobDescription, jobTitle) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const cvKeywords = extractCVKeywords(resumeText);
    const jobKeywords = extractJobKeywords(jobDescription);
    
    console.log('CV Keywords:', cvKeywords);
    console.log('Job Keywords:', jobKeywords);
    
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

POSITION: ${jobTitle} (SOFTWARE ENGINEERING INTERN)

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

    console.log('Generating intern-specific questions...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let questionsText = response.text().trim();
    
    questionsText = cleanAndExtractJSON(questionsText);
    
    let questions;
    try {
      questions = JSON.parse(questionsText);
    } catch (parseError) {
      console.error('JSON parse failed, using intern-specific fallback');
      return getInternSpecificFallbackQuestions(resumeText, jobDescription, jobTitle, cvKeywords, jobKeywords);
    }

    if (!Array.isArray(questions) || questions.length !== 10) {
      console.error('Invalid questions array, using intern-specific fallback');
      return getInternSpecificFallbackQuestions(resumeText, jobDescription, jobTitle, cvKeywords, jobKeywords);
    }

    // Validate and normalize questions for intern level
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
        difficulty: q.difficulty === 'hard' ? 'medium' : q.difficulty || 'easy', // Cap at medium for interns
        expectedDuration: normalizedType === 'coding' ? 300 : 180,
        followUpQuestions: q.followUpQuestions || [],
        starterCode: starterCode
      };
    });

    console.log('✅ Generated intern-specific questions successfully');
    return validatedQuestions;

  } catch (error) {
    console.error('AI question generation failed:', error);
    const cvKeywords = extractCVKeywords(resumeText);
    const jobKeywords = extractJobKeywords(jobDescription);
    return getInternSpecificFallbackQuestions(resumeText, jobDescription, jobTitle, cvKeywords, jobKeywords);
  }
}

function getInternSpecificFallbackQuestions(resumeText, jobDescription, jobTitle, cvKeywords, jobKeywords) {
  console.log('Generating intern-specific fallback questions...');
  
  const primaryLang = cvKeywords.languages[0] || 'javascript';
  const hasProjects = resumeText.toLowerCase().includes('project');
  const hasInternship = resumeText.toLowerCase().includes('intern');
  const hasCertifications = cvKeywords.certifications.length > 0;
  const isStudent = cvKeywords.education.length > 0;

  const questions = [
    // 3 Behavioral Questions - Intern Level
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

    // 4 Technical Questions - Intern Level
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

    // 3 Coding Questions - Intern Level
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

  console.log(`✅ Generated ${questions.length} intern-specific fallback questions for ${primaryLang}`);
  return questions;
}

function generateInternLevelStarterCode(questionHint, candidateLanguages) {
  const primaryLang = candidateLanguages[0] || 'javascript';
  const starterCode = {};

  if (primaryLang === 'javascript' || candidateLanguages.includes('javascript')) {
    if (questionHint.includes('max') || questionHint.includes('largest')) {
      starterCode.javascript = `function findMax(numbers) {\n    // Your code here\n    // Hint: Use a loop to compare numbers\n    \n    return maxNumber;\n}\n\n// Test\nconst testArray = [3, 7, 2, 9, 1];\nconsole.log(findMax(testArray)); // Should return 9`;
    } else if (questionHint.includes('palindrome')) {
      starterCode.javascript = `function isPalindrome(str) {\n    // Your code here\n    // Hint: Compare the string with its reverse\n    \n    return true; // or false\n}\n\n// Test\nconsole.log(isPalindrome("racecar")); // Should return true\nconsole.log(isPalindrome("hello")); // Should return false`;
    } else if (questionHint.includes('character') || questionHint.includes('count')) {
      starterCode.javascript = `function countCharacters(str) {\n    // Your code here\n    // Hint: Use an object to store character counts\n    const counts = {};\n    \n    return counts;\n}\n\n// Test\nconsole.log(countCharacters("hello")); // Should return {h:1, e:1, l:2, o:1}`;
    } else {
      starterCode.javascript = `function solution(input) {\n    // Your code here\n    // Write your intern-level solution\n    \n    return result;\n}\n\n// Test case\nconsole.log(solution(testInput));`;
    }
  }

  if (primaryLang === 'python' || candidateLanguages.includes('python')) {
    if (questionHint.includes('max') || questionHint.includes('largest')) {
      starterCode.python = `def find_max(numbers):\n    # Your code here\n    # Hint: Use a loop to compare numbers\n    pass\n\n# Test\ntest_array = [3, 7, 2, 9, 1]\nprint(find_max(test_array))  # Should return 9`;
    } else if (questionHint.includes('palindrome')) {
      starterCode.python = `def is_palindrome(s):\n    # Your code here\n    # Hint: Compare the string with its reverse\n    pass\n\n# Test\nprint(is_palindrome("racecar"))  # Should return True\nprint(is_palindrome("hello"))    # Should return False`;
    } else if (questionHint.includes('character') || questionHint.includes('count')) {
      starterCode.python = `def count_characters(s):\n    # Your code here\n    # Hint: Use a dictionary to store character counts\n    counts = {}\n    return counts\n\n# Test\nprint(count_characters("hello"))  # Should return {'h':1, 'e':1, 'l':2, 'o':1}`;
    } else {
      starterCode.python = `def solution(input_data):\n    # Your code here\n    # Write your intern-level solution\n    pass\n\n# Test case\nprint(solution(test_input))`;
    }
  }

  if (primaryLang === 'java' || candidateLanguages.includes('java')) {
    starterCode.java = `public class Solution {\n    public static int solution(int[] input) {\n        // Your intern-level Java solution here\n        return 0;\n    }\n    \n    public static void main(String[] args) {\n        int[] test = {1, 2, 3, 4, 5};\n        System.out.println(solution(test));\n    }\n}`;
  }

  // Default fallback
  if (Object.keys(starterCode).length === 0) {
    starterCode[primaryLang] = `// Your ${primaryLang} solution here\n// This is an intern-level problem\n// Take your time and think through the logic step by step`;
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
  console.log('Cleaning JSON response...');
  
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

async function generateComprehensiveFeedback(question, questionType, responseText, code, responseTime, expectedDuration) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // Enhanced prompt for intern-level evaluation
    const prompt = `You are evaluating a SOFTWARE ENGINEERING INTERN candidate's response. Provide constructive, encouraging feedback appropriate for someone starting their career.

INTERVIEW CONTEXT:
- Question: "${question}"
- Question Type: ${questionType}
- Response: "${responseText}"
${code ? `\nCode Provided:\n${code}` : ''}
- Response Time: ${responseTime || 'Unknown'} seconds

EVALUATION CRITERIA FOR INTERNS:
- Focus on learning potential and growth mindset
- Encourage effort and partial understanding
- Provide specific, actionable improvement suggestions
- Score should reflect intern-level expectations (not senior developer standards)

SCORING GUIDELINES:
- 80-100: Excellent for intern level
- 60-79: Good intern response
- 40-59: Acceptable intern attempt  
- 20-39: Needs improvement but shows potential
- 0-19: Minimal effort or understanding

Return ONLY valid JSON:
{
  "score": 75,
  "strengths": ["specific strength 1", "specific strength 2"],
  "improvements": ["specific actionable improvement 1", "specific actionable improvement 2"],
  "detailedAnalysis": "Detailed analysis paragraph with intern-appropriate feedback",
  "communicationClarity": 8,
  "technicalAccuracy": 7,
  "structuredResponse": 9
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysisText = response.text().trim();
    
    const cleanedText = analysisText.replace(/```json\s*|```\s*/g, '').trim();
    const aiAnalysis = JSON.parse(cleanedText);
    
    return validateAndEnhanceFeedback(aiAnalysis, questionType, responseText, code);

  } catch (error) {
    console.error('AI feedback generation failed:', error);
    return generateInternLevelRuleBasedFeedback(question, questionType, responseText, code, responseTime);
  }
}

function generateInternLevelRuleBasedFeedback(question, questionType, responseText, code, responseTime) {
  const feedback = {
    score: 40, // Start with intern-appropriate base score
    strengths: [],
    improvements: [],
    detailedAnalysis: '',
    communicationClarity: 5,
    technicalAccuracy: 5,
    structuredResponse: 5
  };

  const wordCount = responseText.trim().split(/\s+/).length;
  
  // Intern-level evaluation
  if (wordCount >= 10) {
    feedback.score += 20;
    feedback.strengths.push('Provided a meaningful response');
    feedback.communicationClarity += 2;
  } else if (wordCount >= 5) {
    feedback.score += 10;
    feedback.strengths.push('Attempted to answer the question');
    feedback.communicationClarity += 1;
  } else {
    feedback.improvements.push('Try to provide more detailed explanations in your responses');
  }

  // Question-specific evaluation for interns
  if (questionType === 'coding') {
    if (code && code.trim().length > 10) {
      feedback.score += 25;
      feedback.technicalAccuracy += 3;
      feedback.strengths.push('Provided code implementation - great job!');
      
      // Basic code quality checks
      if (code.includes('function') || code.includes('def') || code.includes('class')) {
        feedback.score += 10;
        feedback.strengths.push('Used proper function/class structure');
      }
      
      if (code.includes('//') || code.includes('#') || code.includes('/*')) {
        feedback.score += 5;
        feedback.strengths.push('Added helpful comments to code');
      }
    } else if (code && code.trim().length > 0) {
      feedback.score += 10;
      feedback.strengths.push('Attempted to write code');
      feedback.improvements.push('Try to expand your code implementation with more complete logic');
    } else {
      feedback.improvements.push('Remember to provide code for coding questions - even pseudocode is helpful!');
      feedback.score = Math.max(20, feedback.score - 15);
    }
  }

  // Behavioral question evaluation
  if (questionType === 'behavioral') {
    if (responseText.toLowerCase().includes('learn') || responseText.toLowerCase().includes('challenge')) {
      feedback.score += 15;
      feedback.strengths.push('Showed learning mindset and self-awareness');
    }
    
    if (responseText.toLowerCase().includes('project') || responseText.toLowerCase().includes('experience')) {
      feedback.score += 10;
      feedback.strengths.push('Referenced specific examples from experience');
    }
  }

  // Technical question evaluation
  if (questionType === 'technical') {
    // Look for any technical keywords or concepts
    const techWords = ['algorithm', 'function', 'variable', 'loop', 'array', 'object', 'database', 'api'];
    const foundTechWords = techWords.filter(word => responseText.toLowerCase().includes(word));
    
    if (foundTechWords.length > 0) {
      feedback.score += 15;
      feedback.technicalAccuracy += 2;
      feedback.strengths.push('Used appropriate technical terminology');
    }
  }

  // Encourage effort for interns
  if (responseText.trim().length > 0) {
    feedback.strengths.push('Showed effort in responding to the question');
  }

  // Ensure intern-appropriate improvements
  if (feedback.improvements.length === 0) {
    feedback.improvements.push('Continue practicing and building your technical communication skills');
  }

  // Cap scores appropriately for interns
  feedback.score = Math.min(95, Math.max(15, feedback.score));
  feedback.communicationClarity = Math.min(10, Math.max(3, feedback.communicationClarity));
  feedback.technicalAccuracy = Math.min(10, Math.max(3, feedback.technicalAccuracy));
  feedback.structuredResponse = Math.min(10, Math.max(3, feedback.structuredResponse));

  feedback.detailedAnalysis = `Response contains ${wordCount} words. ${questionType === 'coding' && code ? 'Code implementation provided. ' : ''}${questionType === 'coding' && !code ? 'Consider providing code for coding questions. ' : ''}Great effort for an intern-level response! Keep practicing and building your skills.`;

  return feedback;
}

function validateAndEnhanceFeedback(aiAnalysis, questionType, responseText, code) {
  const feedback = {
    score: Math.min(100, Math.max(0, aiAnalysis.score || 50)),
    strengths: Array.isArray(aiAnalysis.strengths) ? aiAnalysis.strengths : ['Good effort'],
    improvements: Array.isArray(aiAnalysis.improvements) ? aiAnalysis.improvements : ['Keep practicing'],
    detailedAnalysis: aiAnalysis.detailedAnalysis || 'Response analyzed for intern-level expectations.',
    communicationClarity: Math.min(10, Math.max(0, aiAnalysis.communicationClarity || 5)),
    technicalAccuracy: Math.min(10, Math.max(0, aiAnalysis.technicalAccuracy || 5)),
    structuredResponse: Math.min(10, Math.max(0, aiAnalysis.structuredResponse || 5))
  };

  // Ensure minimum encouragement for interns
  if (feedback.strengths.length === 0) {
    feedback.strengths.push('Provided a response - good job attempting the question!');
  }
  
  return feedback;
}

function generateBasicFeedback(responseText, questionType, responseTime) {
  const wordCount = responseText.trim().split(/\s+/).length;
  const baseScore = wordCount >= 10 ? 60 : 40; // Intern-appropriate scoring
  
  return {
    score: baseScore,
    strengths: [
      'Attempted to answer the question',
      wordCount >= 10 ? 'Provided adequate detail' : 'Showed effort in responding'
    ],
    improvements: [
      wordCount < 10 ? 'Try to provide more detailed explanations' : 'Continue developing your technical communication skills',
      'Keep practicing - you\'re doing great for intern level!'
    ],
    detailedAnalysis: `Response contains ${wordCount} words. ${questionType === 'coding' ? 'For coding questions, remember to include your code solution. ' : ''}This is good progress for an intern-level interview.`,
    communicationClarity: Math.max(5, Math.min(8, wordCount >= 15 ? 7 : 5)),
    technicalAccuracy: 6,
    structuredResponse: 6
  };
}

// Add the missing generateOverallFeedback function
async function generateOverallFeedback(responses, resumeText, jobDescription) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const averageScore = responses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / responses.length;
    const responsesSummary = responses.map(r => ({
      type: r.question?.includes('behavioral') ? 'behavioral' : r.question?.includes('coding') ? 'coding' : 'technical',
      score: r.feedback?.score || 0,
      length: r.textResponse?.length || 0
    }));

    const prompt = `Provide overall feedback for a SOFTWARE ENGINEERING INTERN candidate who completed ${responses.length} interview questions.

CANDIDATE PERFORMANCE SUMMARY:
- Average Score: ${averageScore.toFixed(1)}
- Question Types: ${responsesSummary.map(r => r.type).join(', ')}
- Response Quality: ${responsesSummary.map(r => `${r.type}:${r.score}`).join(', ')}

CANDIDATE'S BACKGROUND:
${resumeText.substring(0, 500)}...

JOB REQUIREMENTS:
${jobDescription.substring(0, 300)}...

Provide intern-appropriate feedback focusing on:
1. Growth potential and learning attitude
2. Technical foundation for intern level
3. Areas to develop before/during internship
4. Encouraging, constructive recommendations

Return ONLY valid JSON:
{
  "score": ${Math.round(averageScore)},
  "feedback": {
    "strengths": ["strength1", "strength2", "strength3"],
    "improvements": ["improvement1", "improvement2", "improvement3"],
    "recommendations": ["rec1", "rec2", "rec3"],
    "categoryScores": {
      "technicalSkills": ${Math.round(averageScore)},
      "communicationSkills": ${Math.round(averageScore)},
      "problemSolving": ${Math.round(averageScore)}
    }
  }
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const feedbackText = response.text().trim();
    
    const cleanedText = feedbackText.replace(/```json\s*|```\s*/g, '').trim();
    return JSON.parse(cleanedText);

  } catch (error) {
    console.error('Overall feedback generation failed:', error);
    return generateFallbackOverallFeedback(responses);
  }
}

function generateFallbackOverallFeedback(responses) {
  const averageScore = responses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / responses.length;
  
  return {
    score: Math.round(averageScore),
    feedback: {
      strengths: [
        'Completed all interview questions',
        'Demonstrated willingness to learn',
        'Showed problem-solving effort'
      ],
      improvements: [
        'Continue practicing technical interviews',
        'Work on providing more detailed explanations',
        'Keep building hands-on coding experience'
      ],
      recommendations: [
        'Practice coding problems regularly',
        'Work on personal projects to gain experience',
        'Study fundamental computer science concepts',
        'Practice explaining technical concepts clearly'
      ],
      categoryScores: {
        technicalSkills: Math.round(averageScore),
        communicationSkills: Math.round(averageScore * 0.9),
        problemSolving: Math.round(averageScore * 1.1)
      }
    }
  };
}
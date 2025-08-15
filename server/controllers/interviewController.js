import interviewModel from '../models/interviewModel.js';
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

    const interview = new interviewModel(interviewData);
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

    const interview = new interviewModel(interviewData);
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

    let analysis = null;
    try {
      analysis = await generateDetailedFeedback(
        question.question,
        question.type,
        responseText,
        code,
        responseTime,
        question.expectedDuration,
        interview.resumeText,
        interview.jobDescription
      );
    } catch (analysisError) {
      console.error('Analysis failed, using basic fallback:', analysisError.message);
      analysis = generateBasicFeedback(responseText, question.type, responseTime);
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

    const feedback = await generateDetailedFeedback(
      question,
      questionType,
      responseText,
      code,
      responseTime,
      expectedDuration,
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

    const interview = await interviewModel.findOne({ _id: interviewId, userId });

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

    const interviews = await interviewModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('status overallFeedback createdAt completedAt totalDuration');

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
      starterCode.javascript = `function findMax(numbers) {\n    // Your code here\n    // Hint: Use a loop to compare numbers\n    \n    return maxNumber;\n}\n\n// Test\nconst testArray = [3, 7, 2, 9, 1];\nconsole.log(findMax(testArray)); // Should return 9`;
    } else if (questionHint.includes('palindrome')) {
      starterCode.javascript = `function isPalindrome(str) {\n    // Your code here\n    // Hint: Compare the string with its reverse\n    \n    return true; // or false\n}\n\n// Test\nconsole.log(isPalindrome("racecar")); // Should return true\nconsole.log(isPalindrome("hello")); // Should return false`;
    } else if (questionHint.includes('character') || questionHint.includes('count')) {
      starterCode.javascript = `function countCharacters(str) {\n    // Your code here\n    // Hint: Use an object to store character counts\n    const counts = {};\n    \n    return counts;\n}\n\n// Test\nconsole.log(countCharacters("hello")); // Should return {h:1, e:1, l:2, o:1}`;
    } else {
      starterCode.javascript = `function solution(input) {\n    // Your code here\n    \n    return result;\n}\n\n// Test case\nconsole.log(solution(testInput));`;
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
      starterCode.python = `def solution(input_data):\n    # Your code here\n    pass\n\n# Test case\nprint(solution(test_input))`;
    }
  }

  if (primaryLang === 'java' || candidateLanguages.includes('java')) {
    if (questionHint.includes('max') || questionHint.includes('largest')) {
      starterCode.java = `public class Solution {\n    public static int findMax(int[] numbers) {\n        // Your code here\n        return 0;\n    }\n    \n    public static void main(String[] args) {\n        int[] test = {3, 7, 2, 9, 1};\n        System.out.println(findMax(test)); // Should return 9\n    }\n}`;
    } else if (questionHint.includes('palindrome')) {
      starterCode.java = `public class Solution {\n    public static boolean isPalindrome(String str) {\n        // Your code here\n        return false;\n    }\n    \n    public static void main(String[] args) {\n        System.out.println(isPalindrome("racecar")); // Should return true\n        System.out.println(isPalindrome("hello"));   // Should return false\n    }\n}`;
    } else {
      starterCode.java = `public class Solution {\n    public static int solution(int[] input) {\n        // Your code here\n        return 0;\n    }\n    \n    public static void main(String[] args) {\n        int[] test = {1, 2, 3, 4, 5};\n        System.out.println(solution(test));\n    }\n}`;
    }
  }

  if (primaryLang === 'c++' || candidateLanguages.includes('c++')) {
    if (questionHint.includes('max') || questionHint.includes('largest')) {
      starterCode.cpp = `#include <iostream>\n#include <vector>\nusing namespace std;\n\nint findMax(vector<int>& numbers) {\n    // Your code here\n    return 0;\n}\n\nint main() {\n    vector<int> test = {3, 7, 2, 9, 1};\n    cout << findMax(test) << endl; // Should return 9\n    return 0;\n}`;
    } else {
      starterCode.cpp = `#include <iostream>\n#include <vector>\nusing namespace std;\n\nint solution(vector<int>& input) {\n    // Your code here\n    return 0;\n}\n\nint main() {\n    vector<int> test = {1, 2, 3, 4, 5};\n    cout << solution(test) << endl;\n    return 0;\n}`;
    }
  }

  if (primaryLang === 'go' || candidateLanguages.includes('go')) {
    starterCode.go = `package main\n\nimport "fmt"\n\nfunc solution(input []int) int {\n    // Your code here\n    return 0\n}\n\nfunc main() {\n    test := []int{1, 2, 3, 4, 5}\n    fmt.Println(solution(test))\n}`;
  }

  if (primaryLang === 'rust' || candidateLanguages.includes('rust')) {
    starterCode.rust = `fn solution(input: Vec<i32>) -> i32 {\n    // Your code here\n    0\n}\n\nfn main() {\n    let test = vec![1, 2, 3, 4, 5];\n    println!("{}", solution(test));\n}`;
  }

  if (primaryLang === 'php' || candidateLanguages.includes('php')) {
    starterCode.php = `<?php\nfunction solution($input) {\n    // Your code here\n    return 0;\n}\n\n$test = [1, 2, 3, 4, 5];\necho solution($test);\n?>`;
  }

  if (Object.keys(starterCode).length === 0) {
    starterCode[primaryLang] = `// Your ${primaryLang} solution here\n// This is an intern-level problem`;
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

async function generateDetailedFeedback(question, questionType, responseText, code, responseTime, expectedDuration, resumeText, jobDescription) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `You are evaluating a SOFTWARE ENGINEERING INTERN candidate's response. Provide specific, detailed, and constructive feedback.

INTERVIEW CONTEXT:
- Question: "${question}"
- Question Type: ${questionType}
- Response: "${responseText}"
${code ? `\nCode Provided:\n${code}` : ''}
- Response Time: ${responseTime || 'Unknown'} seconds
- Expected Duration: ${expectedDuration || 180} seconds

EVALUATION CRITERIA - STRICT GRADING:
- Technical accuracy and understanding
- Communication clarity and structure
- Problem-solving approach
- Code quality (if applicable) - NO POINTS FOR EMPTY/PLACEHOLDER CODE
- Time management - NO POINTS FOR POOR RESPONSES REGARDLESS OF TIME

CRITICAL RULES:
1. If response is meaningless/rubbish (like "yes", "no", single words, irrelevant text), score must be 0-15
2. If code is empty, contains only comments, or is just placeholder text, codeQuality must be 1-2
3. Poor responses get NO credit for communication or time management
4. Only award points where genuine effort and understanding is shown

SCORING GUIDELINES (STRICT):
- 85-100: Excellent intern response with clear understanding
- 70-84: Good intern response with minor gaps
- 55-69: Acceptable intern response with some understanding
- 40-54: Poor response with major issues
- 0-39: Rubbish/meaningless response

Return ONLY valid JSON:
{
  "score": 75,
  "strengths": ["specific strength based on actual response", "another specific strength"],
  "improvements": ["specific improvement with actionable advice", "another specific improvement"],
  "detailedAnalysis": "Detailed paragraph analyzing the response content, technical accuracy, and communication",
  "communicationClarity": 8,
  "technicalAccuracy": 7,
  "structuredResponse": 9,
  "codeQuality": ${questionType === 'coding' ? '8' : 'null'},
  "timeEfficiency": ${responseTime ? Math.min(10, Math.max(1, Math.round((expectedDuration / responseTime) * 5))) : 'null'}
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysisText = response.text().trim();
    
    const cleanedText = analysisText.replace(/```json\s*|```\s*/g, '').trim();
    const aiAnalysis = JSON.parse(cleanedText);
    
    return validateAndEnhanceFeedback(aiAnalysis, questionType, responseText, code, responseTime);

  } catch (error) {
    console.error('AI feedback generation failed:', error);
    return generateDetailedRuleBasedFeedback(question, questionType, responseText, code, responseTime);
  }
}

function generateDetailedRuleBasedFeedback(question, questionType, responseText, code, responseTime) {
  const feedback = {
    score: 0,
    strengths: [],
    improvements: [],
    detailedAnalysis: '',
    communicationClarity: 1,
    technicalAccuracy: 1,
    structuredResponse: 1,
    codeQuality: questionType === 'coding' ? 1 : null,
    timeEfficiency: null
  };

  const wordCount = responseText.trim().split(/\s+/).length;
  const responseLength = responseText.trim().length;
  const meaninglessResponses = ['yes', 'no', 'ok', 'sure', 'maybe', 'i dont know', 'idk', 'not sure'];
  const isRubbish = responseLength < 10 || meaninglessResponses.includes(responseText.trim().toLowerCase()) || wordCount < 3;
  
  if (isRubbish) {
    feedback.score = Math.random() > 0.5 ? 5 : 10;
    feedback.improvements = [
      'Provide meaningful responses that demonstrate your understanding',
      'Expand your answers with explanations and examples',
      'Show your thought process and reasoning'
    ];
    feedback.detailedAnalysis = `Response is too brief (${wordCount} words, ${responseLength} characters) and lacks substance. For internship interviews, candidates must provide detailed explanations to demonstrate understanding.`;
    feedback.strengths = ['Attempted to respond to the question'];
    return feedback;
  }
  
  if (wordCount >= 20 && responseLength >= 50) {
    feedback.score += 30;
    feedback.strengths.push('Provided a comprehensive response with good detail');
    feedback.communicationClarity += 3;
    feedback.structuredResponse += 3;
  } else if (wordCount >= 10 && responseLength >= 25) {
    feedback.score += 15;
    feedback.strengths.push('Provided a meaningful response');
    feedback.communicationClarity += 2;
    feedback.structuredResponse += 2;
  } else {
    feedback.improvements.push('Provide more detailed explanations to demonstrate your understanding');
    feedback.communicationClarity += 1;
  }

  if (questionType === 'coding') {
    const hasCode = code && code.trim().length > 0;
    const isEmptyCode = !hasCode || code.trim().length < 20 || 
                       code.includes('// Your code here') || 
                       code.includes('# Your code here') ||
                       code.includes('pass') && code.split('\n').length < 4;
    
    if (hasCode && !isEmptyCode) {
      feedback.score += 40;
      feedback.technicalAccuracy += 4;
      feedback.codeQuality += 5;
      feedback.strengths.push('Provided a meaningful code implementation');
      
      if (code.includes('function') || code.includes('def') || code.includes('class') || code.includes('public')) {
        feedback.score += 10;
        feedback.codeQuality += 2;
        feedback.strengths.push('Used proper function/class structure');
      }
      
      if (code.includes('//') || code.includes('#') || code.includes('/*')) {
        const commentLines = (code.match(/(\/\/|#|\/\*)/g) || []).length;
        const totalLines = code.split('\n').length;
        if (commentLines < totalLines - 2) {
          feedback.score += 5;
          feedback.codeQuality += 1;
          feedback.strengths.push('Added helpful comments');
        }
      }

      if (code.includes('return') && !code.includes('return 0;') && !code.includes('return null')) {
        feedback.score += 10;
        feedback.strengths.push('Implemented proper return logic');
      }
      
      if (code.includes('for') || code.includes('while') || code.includes('.map') || code.includes('.forEach')) {
        feedback.score += 5;
        feedback.technicalAccuracy += 1;
        feedback.strengths.push('Demonstrated understanding of iteration');
      }
      
    } else if (hasCode && isEmptyCode) {
      feedback.improvements.push('Provide actual implementation instead of placeholder code');
      feedback.codeQuality = 1;
      feedback.score = Math.max(feedback.score, 10);
    } else {
      feedback.improvements.push('Code implementation is required for coding questions');
      feedback.codeQuality = 1;
      feedback.score = Math.max(feedback.score - 30, 5);
    }
  }

  if (questionType === 'behavioral') {
    const hasLearningMentality = responseText.toLowerCase().includes('learn') || 
                                responseText.toLowerCase().includes('challenge') ||
                                responseText.toLowerCase().includes('grow') ||
                                responseText.toLowerCase().includes('improve');
    
    if (hasLearningMentality) {
      feedback.score += 15;
      feedback.strengths.push('Demonstrated learning mindset and growth orientation');
    }
    
    const hasSpecificExample = responseText.toLowerCase().includes('project') || 
                              responseText.toLowerCase().includes('experience') ||
                              responseText.toLowerCase().includes('when i') ||
                              responseText.toLowerCase().includes('for example');
    
    if (hasSpecificExample) {
      feedback.score += 15;
      feedback.strengths.push('Provided specific examples from personal experience');
    }

    const hasTeamwork = responseText.toLowerCase().includes('team') || 
                       responseText.toLowerCase().includes('collaborate') ||
                       responseText.toLowerCase().includes('others') ||
                       responseText.toLowerCase().includes('group');
    
    if (hasTeamwork) {
      feedback.score += 8;
      feedback.strengths.push('Showed understanding of teamwork and collaboration');
    }
  }

  if (questionType === 'technical') {
    const techWords = ['algorithm', 'function', 'variable', 'loop', 'array', 'object', 'database', 'api', 'framework', 'library', 'method', 'class', 'interface'];
    const foundTechWords = techWords.filter(word => responseText.toLowerCase().includes(word));
    
    if (foundTechWords.length >= 3) {
      feedback.score += 25;
      feedback.technicalAccuracy += 4;
      feedback.strengths.push('Used appropriate technical terminology throughout response');
    } else if (foundTechWords.length > 0) {
      feedback.score += 15;
      feedback.technicalAccuracy += 2;
      feedback.strengths.push('Demonstrated basic technical vocabulary');
    } else {
      feedback.improvements.push('Use more technical terminology to show understanding of concepts');
    }

    if (responseText.includes('example') || responseText.includes('for instance') || responseText.includes('such as')) {
      feedback.score += 10;
      feedback.strengths.push('Provided examples to illustrate concepts');
    }
    
    const hasComparison = responseText.toLowerCase().includes('difference') || 
                         responseText.toLowerCase().includes('compared to') ||
                         responseText.toLowerCase().includes('versus') ||
                         responseText.toLowerCase().includes('unlike');
    
    if (hasComparison) {
      feedback.score += 8;
      feedback.strengths.push('Made comparisons to clarify understanding');
    }
  }

  if (responseTime && responseTime > 0 && !isRubbish) {
    const expectedTime = expectedDuration || 180;
    if (responseTime <= expectedTime) {
      feedback.timeEfficiency = Math.min(10, Math.round((expectedTime / responseTime) * 6));
      if (feedback.timeEfficiency >= 7) {
        feedback.score += Math.min(15, Math.round((expectedTime / responseTime) * 3));
        feedback.strengths.push('Responded efficiently within time frame');
      }
    } else {
      feedback.timeEfficiency = Math.max(1, Math.round((expectedTime / responseTime) * 4));
      if (feedback.timeEfficiency < 4) {
        feedback.improvements.push('Work on managing time more effectively during responses');
      }
    }
  }

  if (feedback.strengths.length === 0) {
    feedback.strengths.push('Made an attempt to answer the question');
  }

  if (feedback.improvements.length === 0) {
    feedback.improvements.push('Continue practicing to build confidence in technical communication');
  }

  feedback.score = Math.min(95, Math.max(isRubbish ? 5 : 15, feedback.score));
  feedback.communicationClarity = Math.min(10, Math.max(1, feedback.communicationClarity));
  feedback.technicalAccuracy = Math.min(10, Math.max(1, feedback.technicalAccuracy));
  feedback.structuredResponse = Math.min(10, Math.max(1, feedback.structuredResponse));
  if (feedback.codeQuality !== null) {
    feedback.codeQuality = Math.min(10, Math.max(1, feedback.codeQuality));
  }

  feedback.detailedAnalysis = `Response contains ${wordCount} words and ${responseLength} characters. ${questionType === 'coding' && code ? `Code implementation provided with ${code.split('\n').length} lines. ` : ''}${questionType === 'coding' && !code ? 'No code implementation provided. ' : ''}The response ${wordCount >= 15 ? 'shows good effort in explanation' : 'lacks sufficient detail and depth'}. ${feedback.timeEfficiency ? `Time management was ${feedback.timeEfficiency >= 7 ? 'excellent' : feedback.timeEfficiency >= 5 ? 'adequate' : 'needs improvement'}.` : ''} ${isRubbish ? 'This response does not meet the minimum standards expected for an internship interview.' : ''}`;

  return feedback;
}

function validateAndEnhanceFeedback(aiAnalysis, questionType, responseText, code, responseTime) {
  const wordCount = responseText.trim().split(/\s+/).length;
  const isRubbish = responseText.trim().length < 10 || wordCount < 3;
  const isEmptyCode = questionType === 'coding' && (!code || code.trim().length < 20 || code.includes('// Your code here'));
  
  let adjustedScore = Math.min(100, Math.max(0, aiAnalysis.score || 50));
  
  if (isRubbish) {
    adjustedScore = Math.min(adjustedScore, 15);
  }
  
  if (isEmptyCode) {
    adjustedScore = Math.min(adjustedScore, 25);
  }
  
  const feedback = {
    score: adjustedScore,
    strengths: Array.isArray(aiAnalysis.strengths) ? aiAnalysis.strengths.slice(0, 5) : ['Provided a response'],
    improvements: Array.isArray(aiAnalysis.improvements) ? aiAnalysis.improvements.slice(0, 5) : ['Continue practicing'],
    detailedAnalysis: aiAnalysis.detailedAnalysis || 'Response analyzed.',
    communicationClarity: isRubbish ? Math.min(2, aiAnalysis.communicationClarity || 1) : Math.min(10, Math.max(0, aiAnalysis.communicationClarity || 5)),
    technicalAccuracy: isRubbish ? Math.min(2, aiAnalysis.technicalAccuracy || 1) : Math.min(10, Math.max(0, aiAnalysis.technicalAccuracy || 5)),
    structuredResponse: isRubbish ? Math.min(2, aiAnalysis.structuredResponse || 1) : Math.min(10, Math.max(0, aiAnalysis.structuredResponse || 5)),
    codeQuality: questionType === 'coding' ? (isEmptyCode ? Math.min(2, aiAnalysis.codeQuality || 1) : Math.min(10, Math.max(0, aiAnalysis.codeQuality || 5))) : null,
    timeEfficiency: isRubbish ? null : aiAnalysis.timeEfficiency || null
  };
  
  return feedback;
}

function generateBasicFeedback(responseText, questionType, responseTime) {
  const wordCount = responseText.trim().split(/\s+/).length;
  const isRubbish = responseText.trim().length < 10 || wordCount < 3;
  const baseScore = isRubbish ? 8 : (wordCount >= 15 ? 65 : wordCount >= 10 ? 55 : 40);
  
  return {
    score: baseScore,
    strengths: isRubbish ? ['Attempted to respond'] : [
      'Attempted to answer the question',
      wordCount >= 15 ? 'Provided good detail in response' : 'Showed effort in responding'
    ],
    improvements: isRubbish ? [
      'Provide meaningful responses that demonstrate understanding',
      'Expand answers with explanations and examples'
    ] : [
      wordCount < 15 ? 'Provide more detailed explanations to demonstrate understanding' : 'Continue developing technical communication skills',
      'Keep practicing and building confidence'
    ],
    detailedAnalysis: `Response contains ${wordCount} words. ${questionType === 'coding' ? 'For coding questions, ensure you include your implementation. ' : ''}This shows ${isRubbish ? 'insufficient' : wordCount >= 15 ? 'good' : 'basic'} effort for an intern-level response.`,
    communicationClarity: isRubbish ? 1 : Math.max(4, Math.min(8, wordCount >= 20 ? 7 : 5)),
    technicalAccuracy: isRubbish ? 1 : (questionType === 'technical' ? 6 : 5),
    structuredResponse: isRubbish ? 1 : (wordCount >= 15 ? 7 : 5),
    codeQuality: questionType === 'coding' ? (isRubbish ? 1 : 4) : null,
    timeEfficiency: null
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

    const behavioralAvg = behavioralResponses.length > 0 
      ? behavioralResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / behavioralResponses.length 
      : averageScore;
    
    const technicalAvg = technicalResponses.length > 0 
      ? technicalResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / technicalResponses.length 
      : averageScore;
    
    const codingAvg = codingResponses.length > 0 
      ? codingResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / codingResponses.length 
      : averageScore;

    const prompt = `Provide comprehensive overall feedback for a SOFTWARE ENGINEERING INTERN candidate.

PERFORMANCE SUMMARY:
- Overall Average: ${averageScore.toFixed(1)}
- Behavioral Questions Average: ${behavioralAvg.toFixed(1)} (${behavioralResponses.length} questions)
- Technical Questions Average: ${technicalAvg.toFixed(1)} (${technicalResponses.length} questions)  
- Coding Questions Average: ${codingAvg.toFixed(1)} (${codingResponses.length} questions)
- Total Questions: ${responses.length}

INDIVIDUAL RESPONSE ANALYSIS:
${responses.map((r, i) => `Q${i+1} (${r.questionType}): Score ${r.feedback?.score || 0}/100`).join('\n')}

Provide detailed overall assessment focusing on:
1. Technical competency for intern level
2. Communication and explanation skills
3. Problem-solving approach
4. Areas of strength and growth
5. Specific actionable recommendations

Return ONLY valid JSON:
{
  "score": ${Math.round(averageScore)},
  "feedback": {
    "strengths": ["strength1", "strength2", "strength3"],
    "improvements": ["improvement1", "improvement2", "improvement3"],
    "recommendations": ["rec1", "rec2", "rec3", "rec4"],
    "categoryScores": {
      "behavioralSkills": ${Math.round(behavioralAvg)},
      "technicalKnowledge": ${Math.round(technicalAvg)},
      "codingAbility": ${Math.round(codingAvg)}
    },
    "detailedAssessment": "Comprehensive paragraph about overall performance"
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
  
  return {
    score: Math.round(averageScore),
    feedback: {
      strengths: [
        'Completed all interview questions successfully',
        'Demonstrated effort and engagement throughout the interview',
        averageScore >= 70 ? 'Showed strong foundation for intern-level position' : 'Showed basic understanding with room for growth'
      ],
      improvements: [
        averageScore < 60 ? 'Focus on building stronger technical fundamentals' : 'Continue practicing advanced technical concepts',
        'Work on providing more detailed explanations in responses',
        'Practice coding problems regularly to improve implementation speed'
      ],
      recommendations: [
        'Build personal projects to gain hands-on experience',
        'Practice explaining technical concepts clearly and concisely',
        'Study fundamental computer science concepts and algorithms',
        'Join coding communities and participate in code reviews'
      ],
      categoryScores: {
        behavioralSkills: Math.round(behavioralAvg),
        technicalKnowledge: Math.round(technicalAvg),
        codingAbility: Math.round(codingAvg)
      },
      detailedAssessment: `Overall performance shows ${averageScore >= 80 ? 'excellent' : averageScore >= 70 ? 'good' : averageScore >= 60 ? 'satisfactory' : 'developing'} readiness for a software engineering internship. Completed ${responses.length} questions with an average score of ${averageScore.toFixed(1)}%. ${behavioralAvg >= technicalAvg ? 'Strong communication and behavioral responses' : 'Good technical foundation'} ${codingAvg >= 70 ? 'with solid coding abilities.' : 'with coding skills that can be developed further.'}`
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
// controllers/interviewController.js
const Interview = require('../models/Interview');
const User = require('../models/User');
const OpenAI = require('openai');
const FormData = require('form-data');

// Initialize Gemini API (reusing from your existing code)
const AI = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

const interviewController = {
  // Create new interview session
  async createInterview(req, res) {
    try {
      const { userId, jobTitle, jobDescription, resumeText } = req.body;

      if (!userId || !jobTitle || !jobDescription || !resumeText) {
        return res.status(400).json({
          error: 'Missing required fields: userId, jobTitle, jobDescription, resumeText'
        });
      }

      // Validate if it's a software engineering role
      const jobDescLower = jobDescription.toLowerCase();
      const isTechRole = ['software', 'developer', 'engineer', 'programming', 'coding', 'intern'].some(keyword => 
        jobDescLower.includes(keyword)
      );

      if (!isTechRole) {
        return res.status(400).json({
          error: 'This interview system is designed specifically for software engineering internships'
        });
      }

      // Generate initial questions
      const questions = await generateInterviewQuestions(resumeText, jobDescription);

      const interview = new Interview({
        userId,
        jobTitle,
        jobDescription,
        resumeText,
        questions,
        status: 'pending'
      });

      await interview.save();

      res.status(201).json({
        success: true,
        interview: {
          id: interview._id,
          status: interview.status,
          questionsCount: questions.length,
          estimatedDuration: questions.reduce((acc, q) => acc + q.expectedDuration, 0)
        }
      });
    } catch (error) {
      console.error('Create interview error:', error);
      res.status(500).json({ error: 'Failed to create interview session' });
    }
  },

  // Start interview
  async startInterview(req, res) {
    try {
      const { interviewId } = req.params;

      const interview = await Interview.findById(interviewId);
      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      if (interview.status !== 'pending') {
        return res.status(400).json({ error: 'Interview already started or completed' });
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
      res.status(500).json({ error: 'Failed to start interview' });
    }
  },

  // Get next question
  async getNextQuestion(req, res) {
    try {
      const { interviewId } = req.params;

      const interview = await Interview.findById(interviewId);
      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
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
      res.status(500).json({ error: 'Failed to get next question' });
    }
  },

  // Submit answer with audio transcription
  async submitAnswer(req, res) {
    try {
      const { interviewId } = req.params;
      const { questionId, responseTime } = req.body;
      const audioFile = req.file;

      if (!audioFile) {
        return res.status(400).json({ error: 'Audio file is required' });
      }

      const interview = await Interview.findById(interviewId);
      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      // Find the question
      const question = interview.questions.find(q => q.questionId === questionId);
      if (!question) {
        return res.status(400).json({ error: 'Question not found' });
      }

      // Transcribe audio using Whisper (you'll need to implement this with your preferred service)
      const transcript = await transcribeAudio(audioFile.buffer);

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
        audioTranscript: transcript,
        responseTime: parseInt(responseTime),
        confidenceAnalysis: analysis.confidence,
        feedback: analysis.feedback,
        answeredAt: new Date()
      };

      interview.responses.push(response);
      await interview.save();

      res.json({
        success: true,
        message: 'Answer submitted successfully',
        feedback: analysis.feedback,
        confidence: analysis.confidence
      });
    } catch (error) {
      console.error('Submit answer error:', error);
      res.status(500).json({ error: 'Failed to process answer' });
    }
  },

  // Complete interview
  async completeInterview(req, res) {
    try {
      const { interviewId } = req.params;

      const interview = await Interview.findById(interviewId);
      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      // Generate overall feedback
      const overallAnalysis = await generateOverallFeedback(
        interview.responses,
        interview.resumeText,
        interview.jobDescription
      );

      interview.status = 'completed';
      interview.completedAt = new Date();
      interview.duration = Math.round((interview.completedAt - interview.startedAt) / 1000);
      interview.overallScore = overallAnalysis.score;
      interview.overallFeedback = overallAnalysis.feedback;

      await interview.save();

      res.json({
        success: true,
        message: 'Interview completed successfully',
        results: {
          overallScore: interview.overallScore,
          feedback: interview.overallFeedback,
          duration: interview.duration,
          questionsAnswered: interview.responses.length
        }
      });
    } catch (error) {
      console.error('Complete interview error:', error);
      res.status(500).json({ error: 'Failed to complete interview' });
    }
  },

  // Get detailed feedback
  async getDetailedFeedback(req, res) {
    try {
      const { interviewId } = req.params;

      const interview = await Interview.findById(interviewId)
        .populate('userId', 'name email');

      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      res.json({
        success: true,
        feedback: {
          overall: interview.overallFeedback,
          score: interview.overallScore,
          duration: interview.duration,
          responses: interview.responses.map(r => ({
            question: r.question,
            type: interview.questions.find(q => q.questionId === r.questionId)?.type,
            feedback: r.feedback,
            confidence: r.confidenceAnalysis,
            responseTime: r.responseTime
          })),
          recommendations: interview.overallFeedback?.recommendations || []
        }
      });
    } catch (error) {
      console.error('Get feedback error:', error);
      res.status(500).json({ error: 'Failed to get feedback' });
    }
  },

  // Get user interview history
  async getUserInterviews(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const interviews = await Interview.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .select('jobTitle status overallScore createdAt completedAt duration');

      const total = await Interview.countDocuments({ userId });

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
      res.status(500).json({ error: 'Failed to get interview history' });
    }
  },

  // Get interview details
  async getInterview(req, res) {
    try {
      const { interviewId } = req.params;

      const interview = await Interview.findById(interviewId)
        .populate('userId', 'name email');

      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      res.json({
        success: true,
        interview
      });
    } catch (error) {
      console.error('Get interview error:', error);
      res.status(500).json({ error: 'Failed to get interview details' });
    }
  }
};

// Helper Functions

async function generateInterviewQuestions(resumeText, jobDescription) {
  try {
    const prompt = `You are a senior software engineering interviewer at a top tech company. Generate 8 interview questions for a software engineering internship candidate.

    Resume Summary: ${resumeText.substring(0, 2000)}
    Job Description: ${jobDescription.substring(0, 2000)}

    Generate questions in the following categories:
    - 3 behavioral/soft skill questions
    - 3 technical questions based on technologies mentioned in resume/job
    - 2 problem-solving/coding questions

    Format your response as a JSON array with this structure:
    [
      {
        "questionId": "q1",
        "question": "Tell me about a challenging project you worked on",
        "type": "behavioral",
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

    const response = await AI.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "system",
          content: "You are an expert technical interviewer. Respond only with valid JSON array."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const questionsText = response.choices?.[0]?.message?.content?.trim();
    const cleanedText = questionsText.replace(/```json\s*|```\s*/g, '').trim();
    const questions = JSON.parse(cleanedText);

    return questions.map((q, index) => ({
      ...q,
      questionId: q.questionId || `q${index + 1}`,
      expectedDuration: q.expectedDuration || 120
    }));

  } catch (error) {
    console.error('Generate questions error:', error);
    // Return default questions if AI fails
    return getDefaultQuestions();
  }
}

async function transcribeAudio(audioBuffer) {
  try {
    // This is a placeholder - you'll need to implement audio transcription
    // You can use OpenAI Whisper, Google Speech-to-Text, or similar service
    // For now, returning a placeholder
    
    // Example implementation with OpenAI Whisper would look like:
    /*
    const formData = new FormData();
    formData.append('file', audioBuffer, 'audio.wav');
    formData.append('model', 'whisper-1');
    
    const response = await openai.audio.transcriptions.create({
      file: formData.get('file'),
      model: 'whisper-1',
    });
    
    return response.text;
    */
    
    return "This is a placeholder transcript. Please implement actual audio transcription.";
  } catch (error) {
    console.error('Transcription error:', error);
    return "Transcription failed";
  }
}

async function analyzeResponse(question, transcript, questionType, resumeText, jobDescription, responseTime) {
  try {
    const prompt = `Analyze this interview response for a software engineering intern candidate:

    Question: ${question}
    Question Type: ${questionType}
    Response: ${transcript}
    Response Time: ${responseTime} seconds
    
    Provide analysis in JSON format:
    {
      "confidence": {
        "overallScore": 85,
        "fillerWordsCount": 3,
        "speakingPace": "appropriate",
        "clarity": 90,
        "technicalAccuracy": 80
      },
      "feedback": {
        "strengths": ["Clear communication", "Good technical knowledge"],
        "improvements": ["Reduce filler words", "More specific examples"],
        "score": 85
      }
    }

    Evaluate based on:
    - Content quality and relevance
    - Technical accuracy (for technical questions)
    - Communication clarity
    - Confidence indicators
    - Response completeness
    - Appropriate response time

    Be constructive but honest in feedback. Focus on intern-level expectations.`;

    const response = await AI.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "system",
          content: "You are an expert interview assessor. Respond only with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 1000
    });

    const analysisText = response.choices?.[0]?.message?.content?.trim();
    const cleanedText = analysisText.replace(/```json\s*|```\s*/g, '').trim();
    return JSON.parse(cleanedText);

  } catch (error) {
    console.error('Response analysis error:', error);
    return getDefaultAnalysis();
  }
}

async function generateOverallFeedback(responses, resumeText, jobDescription) {
  try {
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
        ]
      }
    }

    Focus on intern-level expectations and growth potential.`;

    const response = await AI.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "system",
          content: "You are a senior technical interviewer providing comprehensive feedback."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 1500
    });

    const feedbackText = response.choices?.[0]?.message?.content?.trim();
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
      difficulty: "easy",
      expectedDuration: 120
    },
    {
      questionId: "q2",
      question: "Describe a challenging programming project you've worked on",
      type: "behavioral",
      difficulty: "medium",
      expectedDuration: 180
    },
    {
      questionId: "q3",
      question: "How do you approach debugging a piece of code that isn't working?",
      type: "technical",
      difficulty: "medium",
      expectedDuration: 150
    },
    {
      questionId: "q4",
      question: "Explain the difference between a stack and a queue",
      type: "technical",
      difficulty: "easy",
      expectedDuration: 120
    },
    {
      questionId: "q5",
      question: "How would you find the maximum element in an unsorted array?",
      type: "technical",
      difficulty: "medium",
      expectedDuration: 180
    }
  ];
}

function getDefaultAnalysis() {
  return {
    confidence: {
      overallScore: 70,
      fillerWordsCount: 2,
      speakingPace: "appropriate",
      clarity: 75,
      technicalAccuracy: 70
    },
    feedback: {
      strengths: ["Attempted to answer the question"],
      improvements: ["Provide more specific examples", "Practice technical terminology"],
      score: 70
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
        feedback: "Shows basic understanding of software engineering concepts"
      },
      communicationSkills: {
        score: Math.round(avgScore),
        feedback: "Communicates clearly with room for improvement"
      },
      problemSolving: {
        score: Math.round(avgScore),
        feedback: "Demonstrates logical thinking approach"
      },
      recommendations: [
        "Practice coding problems regularly",
        "Work on explaining technical concepts clearly",
        "Build more projects to gain practical experience"
      ]
    }
  };
}

module.exports = interviewController;
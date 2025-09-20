import InterviewModel from '../models/InterviewModel.js';
import userModel from '../models/userModel.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import axios from 'axios';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// DEBUG: Add API key validation
console.log('🔑 Gemini API Key Status:', {
  exists: !!process.env.GEMINI_API_KEY,
  length: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0,
  prefix: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 10) + '...' : 'Not found'
});

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

    console.log('=== CREATE INTERVIEW DEBUG ===');
    console.log('User ID:', userId);
    console.log('Job Description length:', jobDescription?.length || 0);
    console.log('Resume Text length:', resumeText?.length || 0);
    console.log('Gemini API Key exists:', !!process.env.GEMINI_API_KEY);

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

    console.log('🤖 Starting question generation with full CV and JD content...');
    
    let questions;
    try {
      questions = await generatePersonalizedQuestionsWithFullContent(resumeText, jobDescription);
      console.log('✅ Successfully generated questions:', questions.length);
    } catch (questionError) {
      console.error('❌ Question generation failed:', questionError);
      console.log('🔄 Using fallback questions...');
      questions = getFallbackQuestions();
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

    console.log('✅ Interview saved successfully:', savedInterview._id);

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
    console.error('❌ Create interview error:', error);
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

    console.log('=== CREATE INTERVIEW WITH PROFILE CV DEBUG ===');
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
    console.log('🤖 Starting question generation with full CV and JD content...');

    let questions;
    try {
      questions = await generatePersonalizedQuestionsWithFullContent(actualCVText, jobDescription);
      console.log('✅ Successfully generated questions:', questions.length);
    } catch (questionError) {
      console.error('❌ Question generation failed:', questionError);
      console.log('🔄 Using fallback questions...');
      questions = getFallbackQuestions();
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

    console.log('✅ Interview saved successfully:', savedInterview._id);

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
    console.error('❌ Create interview with profile CV error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create interview with profile CV',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// NEW: Generate personalized questions using full CV and JD content
async function generatePersonalizedQuestionsWithFullContent(resumeText, jobDescription) {
  console.log('🚀 ENHANCED DEBUG: Starting API call to Gemini');
  console.log('📝 Resume length:', resumeText.length);
  console.log('💼 Job description length:', jobDescription.length);
  
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { 
        temperature: 0.3,
        maxOutputTokens: 2000,
        topP: 0.8,
        topK: 40,
        candidateCount: 1,
      }
    });

    console.log('🔧 Model configuration:', {
      model: "gemini-1.5-flash",
      temperature: 0.3,
      maxOutputTokens: 2000
    });

    // Truncate inputs if too long to avoid token limits
    const maxResumeLength = 3000;
    const maxJobLength = 2000;
    const truncatedResume = resumeText.length > maxResumeLength 
      ? resumeText.substring(0, maxResumeLength) + "..." 
      : resumeText;
    const truncatedJob = jobDescription.length > maxJobLength 
      ? jobDescription.substring(0, maxJobLength) + "..." 
      : jobDescription;

    console.log('✂️ Content truncated:', {
      resumeOriginal: resumeText.length,
      resumeTruncated: truncatedResume.length,
      jobOriginal: jobDescription.length,
      jobTruncated: truncatedJob.length
    });

    const prompt = `You are a senior technical interviewer at a top tech company. Create highly specific, challenging interview questions for a software engineering intern position.

CANDIDATE'S CV:
${truncatedResume}

JOB DESCRIPTION:
${truncatedJob}

CRITICAL REQUIREMENTS:
1. Generate exactly 10 questions (3 behavioral, 4 technical, 3 coding)
2. Each question MUST reference SPECIFIC projects, technologies, or experiences from the CV
3. Questions should test depth of understanding, not just surface knowledge
4. Behavioral questions should probe problem-solving methodology and learning approach
5. Technical questions should assess conceptual understanding with practical application
6. Coding questions should be realistic problems they might face in this role

QUALITY STANDARDS:
- Questions must be impossible to answer generically
- Should reveal gaps in knowledge when candidate doesn't truly understand
- Test both theoretical knowledge AND practical application
- Include edge cases and real-world considerations
- Assess communication of technical concepts

Return ONLY valid JSON array:
[
  {
    "questionId": "q1",
    "type": "behavioral",
    "question": "You mentioned building [specific project from CV] using [specific tech stack]. Walk me through how you approached the [specific technical challenge - e.g., authentication, database design, API integration]. What specific problems did you encounter with [mentioned technology] and how did your debugging process evolve throughout the project?",
    "category": "problem_solving_depth",
    "difficulty": "medium",
    "expectedDuration": 180,
    "followUpQuestions": [],
    "starterCode": null,
    "language": null
  },
  {
    "questionId": "q2",
    "type": "technical", 
    "question": "In your [specific project], you used [specific database/framework]. The job requires [specific job requirement]. Explain how you would handle [specific technical scenario relevant to both CV and job] - what are the trade-offs, potential issues, and how would you optimize for [specific performance/security concern]?",
    "category": "system_design_thinking",
    "difficulty": "medium",
    "expectedDuration": 180,
    "followUpQuestions": [],
    "starterCode": null,
    "language": null
  },
  {
    "questionId": "q3",
    "type": "coding",
    "question": "Based on your experience with [specific technology from CV] and this role's focus on [job requirement], implement a function that [specific problem related to both]. Consider edge cases like [specific edge case] and explain your approach to [specific optimization/error handling concern].",
    "category": "applied_programming",
    "difficulty": "medium",
    "expectedDuration": 300,
    "followUpQuestions": [],
    "starterCode": null,
    "language": "[primary language from CV]"
  }
]

Make each question impossible to fake - they should reveal true understanding vs memorized responses.`;

    console.log('📤 Sending prompt to Gemini API...');
    console.log('📏 Prompt length:', prompt.length);

    const startTime = Date.now();
    const result = await model.generateContent(prompt);
    const responseTime = Date.now() - startTime;

    console.log('⏱️ API Response time:', responseTime + 'ms');

    const response = await result.response;
    const rawText = response.text();

    console.log('📥 Raw API Response received:');
    console.log('📏 Response length:', rawText.length);
    console.log('🔍 Response preview (first 500 chars):', rawText.substring(0, 500));

    // Clean the response
    let cleanedText = rawText
      .trim()
      .replace(/```json\s*/gi, '')
      .replace(/```javascript\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/^```/gm, '')
      .replace(/```$/gm, '');

    console.log('🧹 Cleaned response preview:', cleanedText.substring(0, 500));

    // Find JSON array bounds
    const arrayStart = cleanedText.indexOf('[');
    const arrayEnd = cleanedText.lastIndexOf(']');
    
    if (arrayStart === -1 || arrayEnd === -1) {
      throw new Error('No JSON array found in response');
    }

    const jsonText = cleanedText.substring(arrayStart, arrayEnd + 1);
    console.log('🎯 Extracted JSON:', jsonText.substring(0, 300) + '...');

    let questions;
    try {
      questions = JSON.parse(jsonText);
      console.log('✅ JSON parsed successfully');
      console.log('📊 Generated questions:', questions.length);
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError.message);
      console.log('🔧 Trying to fix malformed JSON...');
      
      // Try to fix common JSON issues
      let fixedJson = jsonText
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // Quote unquoted keys
        .replace(/:\s*'([^']*)'/g, ': "$1"'); // Replace single quotes with double quotes
      
      try {
        questions = JSON.parse(fixedJson);
        console.log('✅ Fixed JSON parsed successfully');
      } catch (fixError) {
        console.error('❌ Failed to fix JSON:', fixError.message);
        throw new Error('Could not parse AI response as JSON');
      }
    }

    // Validate and process questions
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Invalid questions array received from AI');
    }

    // Process and validate each question
    const processedQuestions = questions.slice(0, 10).map((q, index) => {
      const questionId = q.questionId || `q${index + 1}`;
      const type = normalizeQuestionType(q.type || 'technical');
      const language = type === 'coding' ? (q.language || 'javascript').toLowerCase() : null;
      
      console.log(`🔍 Processing question ${questionId}:`, {
        type: type,
        hasQuestion: !!q.question,
        language: language
      });

      return {
        questionId: questionId,
        type: type,
        question: q.question || 'Default question generated',
        category: q.category || 'general',
        difficulty: q.difficulty || 'easy',
        expectedDuration: type === 'coding' ? 300 : (type === 'behavioral' ? 180 : 150),
        followUpQuestions: q.followUpQuestions || [],
        starterCode: type === 'coding' ? generateStarterCode(q.question, language) : null,
        language: language
      };
    });

    console.log('✅ SUCCESSFUL API GENERATION:', processedQuestions.length, 'questions');
    return processedQuestions;

  } catch (error) {
    console.error('❌ GEMINI API ERROR:', {
      name: error.name,
      message: error.message,
      status: error.status,
      statusText: error.statusText
    });

    // Log more details for debugging
    if (error.response) {
      console.error('❌ API Response Error:', error.response);
    }
    if (error.request) {
      console.error('❌ API Request Error:', error.request);
    }

    throw error;
  }
}

// Generate starter code based on the question and language
function generateStarterCode(questionText, language) {
  if (!language) return null;

  const starterCode = {};
  
  // Basic templates for different languages
  const templates = {
    javascript: `function solution(input) {
    // Your code here
    // ${questionText.length > 50 ? questionText.substring(0, 50) + '...' : questionText}
    
    return result;
}

// Test
console.log(solution(testInput));`,
    
    python: `def solution(input_data):
    # Your code here
    # ${questionText.length > 50 ? questionText.substring(0, 50) + '...' : questionText}
    
    pass

# Test
print(solution(test_input))`,
    
    java: `public class Solution {
    public static int solution(int[] input) {
        // Your code here
        // ${questionText.length > 50 ? questionText.substring(0, 50) + '...' : questionText}
        
        return 0;
    }
    
    public static void main(String[] args) {
        int[] test = {1, 2, 3, 4, 5};
        System.out.println(solution(test));
    }
}`
  };

  starterCode[language] = templates[language] || templates.javascript;
  return starterCode;
}

// Fallback questions if API fails
function getFallbackQuestions() {
  return [
    {
      questionId: "q1",
      type: "behavioral",
      question: "Tell me about a challenging programming project you've worked on and how you approached solving the problems you encountered.",
      category: "problem_solving",
      difficulty: "easy",
      expectedDuration: 180,
      followUpQuestions: [],
      starterCode: null,
      language: null
    },
    {
      questionId: "q2", 
      type: "behavioral",
      question: "Describe a time when you had to learn a new programming language or technology quickly. What was your approach?",
      category: "learning",
      difficulty: "easy",
      expectedDuration: 180,
      followUpQuestions: [],
      starterCode: null,
      language: null
    },
    {
      questionId: "q3",
      type: "behavioral",
      question: "Tell me about a time you collaborated on a coding project. How did you handle any conflicts or differences in approach?",
      category: "teamwork",
      difficulty: "easy", 
      expectedDuration: 180,
      followUpQuestions: [],
      starterCode: null,
      language: null
    },
    {
      questionId: "q4",
      type: "technical",
      question: "Explain the difference between frontend and backend development. What are the main responsibilities of each?",
      category: "web_development",
      difficulty: "easy",
      expectedDuration: 150,
      followUpQuestions: [],
      starterCode: null,
      language: null
    },
    {
      questionId: "q5",
      type: "technical", 
      question: "What is version control and why is it important in software development? Can you explain Git basics?",
      category: "tools",
      difficulty: "easy",
      expectedDuration: 150,
      followUpQuestions: [],
      starterCode: null,
      language: null
    },
    {
      questionId: "q6",
      type: "technical",
      question: "Explain what an API is and how it's used in web applications. Give an example of when you might use one.",
      category: "apis",
      difficulty: "easy",
      expectedDuration: 150,
      followUpQuestions: [],
      starterCode: null,
      language: null
    },
    {
      questionId: "q7",
      type: "technical",
      question: "What are the main differences between SQL and NoSQL databases? When would you choose one over the other?",
      category: "databases",
      difficulty: "easy",
      expectedDuration: 150,
      followUpQuestions: [],
      starterCode: null,
      language: null
    },
    {
      questionId: "q8",
      type: "coding",
      question: "Write a function that finds the maximum number in an array. Explain your approach and the time complexity.",
      category: "algorithms",
      difficulty: "easy",
      expectedDuration: 300,
      followUpQuestions: [],
      starterCode: generateStarterCode("find maximum number in array", "javascript"),
      language: "javascript"
    },
    {
      questionId: "q9",
      type: "coding",
      question: "Create a function that checks if a string is a palindrome (reads the same forwards and backwards).",
      category: "string_manipulation",
      difficulty: "easy",
      expectedDuration: 300,
      followUpQuestions: [],
      starterCode: generateStarterCode("check if string is palindrome", "javascript"),
      language: "javascript"
    },
    {
      questionId: "q10",
      type: "coding",
      question: "Write a function that counts the frequency of each character in a string and returns the result as an object.",
      category: "data_structures",
      difficulty: "medium",
      expectedDuration: 300,
      followUpQuestions: [],
      starterCode: generateStarterCode("count character frequency", "javascript"),
      language: "javascript"
    }
  ];
}

function normalizeQuestionType(type) {
  const typeMapping = {
    'behavioral': 'behavioral',
    'technical': 'technical', 
    'coding': 'coding',
    'problem-solving': 'problem-solving',
    'system_design': 'system_design'
  };

  const normalized = type ? type.toLowerCase().replace(/[^a-z-]/g, '') : '';
  return typeMapping[normalized] || 'technical';
}

// Add the test endpoint for debugging
export const testGeminiConnection = async (req, res) => {
  try {
    console.log('🧪 TESTING GEMINI CONNECTION...');
    console.log('🔑 API Key Status:', {
      exists: !!process.env.GEMINI_API_KEY,
      length: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0
    });

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash"
    });

    const testPrompt = `Test connection. Respond with exactly this JSON: {"status": "connected", "message": "Gemini API is working"}`;
    
    console.log('📤 Sending test prompt...');
    const startTime = Date.now();
    
    const result = await model.generateContent(testPrompt);
    const responseTime = Date.now() - startTime;
    
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ TEST RESPONSE:', {
      responseTime: responseTime + 'ms',
      textLength: text.length,
      text: text
    });

    res.json({
      success: true,
      message: 'Gemini API connection test successful',
      data: {
        responseTime: responseTime + 'ms',
        apiKeyConfigured: true,
        modelUsed: 'gemini-1.5-flash',
        response: text
      }
    });

  } catch (error) {
    console.error('❌ GEMINI CONNECTION TEST FAILED:', {
      name: error.name,
      message: error.message,
      status: error.status
    });

    res.status(500).json({
      success: false,
      error: 'Gemini API connection failed',
      details: {
        errorName: error.name,
        errorMessage: error.message,
        hasApiKey: !!process.env.GEMINI_API_KEY,
        apiKeyLength: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0
      }
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

function validateLanguage(language) {
  return language ? language.trim() : null;
}

export const submitAnswer = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { questionId, responseTime, answerMode, responseText, code, language, skipped, executionResults } = req.body;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    console.log('=== SUBMIT ANSWER DEBUG ===');
    console.log('Interview ID:', interviewId);
    console.log('Question ID:', questionId);
    console.log('Skipped:', skipped);
    console.log('Response Text Length:', responseText?.length || 0);
    console.log('Has Code:', !!code);

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

    // Handle skipped questions quickly
    if (skipped) {
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
        feedback: generateSkippedQuestionFeedback(),
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
        feedback: response.feedback,
        progress: {
          current: interview.responses.length,
          total: interview.questions.length,
          completed: interview.responses.length >= interview.questions.length
        }
      });
    }

    console.log('=== ANALYZING RESPONSE WITH AI ===');
    console.log('Question Type:', question.type);
    console.log('Response Length:', sanitizedResponseText.length);
    console.log('Has Code:', !!sanitizedCode);

    let analysis;
    try {
      analysis = await generateEnhancedAIFeedback(
        question.question,
        question.type,
        sanitizedResponseText,
        sanitizedCode,
        validatedLanguage,
        executionResults
      );
      console.log('✅ AI Analysis completed:', { score: analysis.score });
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
    console.error('❌ Submit answer error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process answer',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Enhanced AI feedback with better debugging and strict validation
async function generateEnhancedAIFeedback(question, questionType, responseText, code, language, executionResults = null) {
  console.log('🤖 ENHANCED AI FEEDBACK DEBUG:');
  console.log('📝 Question length:', question.length);
  console.log('📋 Question type:', questionType);
  console.log('💬 Response length:', responseText.length);
  console.log('💻 Has code:', !!code);
  console.log('🔧 Language:', language);

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { 
        temperature: 0.2,
        maxOutputTokens: 1000,
        topP: 0.8,
      }
    });

    // Truncate inputs for better API performance
    const maxQuestionLength = 500;
    const maxResponseLength = 1000;
    const maxCodeLength = 1000;

    const truncatedQuestion = question.length > maxQuestionLength 
      ? question.substring(0, maxQuestionLength) + "..." 
      : question;
    
    const truncatedResponse = responseText.length > maxResponseLength 
      ? responseText.substring(0, maxResponseLength) + "..." 
      : responseText;
    
    const truncatedCode = code && code.length > maxCodeLength 
      ? code.substring(0, maxCodeLength) + "..." 
      : code;

    console.log('✂️ Content truncated for API call');

    const prompt = `You are a strict senior technical interviewer evaluating an intern candidate's response. Be rigorous and honest in your assessment.

QUESTION: "${truncatedQuestion}"
QUESTION TYPE: ${questionType}
CANDIDATE RESPONSE: "${truncatedResponse}"
${truncatedCode ? `CODE SUBMITTED: "${truncatedCode}"` : ''}
${language ? `PROGRAMMING LANGUAGE: ${language}` : ''}
${executionResults ? `CODE OUTPUT: "${executionResults.output || 'None'}"` : ''}

EVALUATION CRITERIA:
- 0-20: Completely irrelevant, wrong, or no real attempt
- 21-40: Shows minimal understanding but significant gaps/errors
- 41-60: Basic understanding with some correct elements but lacks depth
- 61-75: Good understanding with minor gaps or communication issues  
- 76-85: Strong understanding with clear explanation
- 86-100: Exceptional insight, thorough understanding, excellent communication

STRICT REQUIREMENTS:
- If response is completely off-topic or doesn't address the question at all: 0-20 points
- If code doesn't compile or has major logical errors: Maximum 40 points
- If explanation lacks technical depth or accuracy: Maximum 60 points
- If communication is unclear or missing key concepts: Deduct 10-20 points
- Reward specific examples, edge case consideration, and clear reasoning

RESPONSE RELEVANCE CLASSIFICATION:
- "perfectly-relevant": Response directly and completely addresses all aspects of the question (80+ score)
- "mostly-relevant": Response addresses main question but missing some details (60-79 score)
- "partially-relevant": Response addresses some aspects but significant gaps (40-59 score)
- "mostly-irrelevant": Response barely relates to question or has major errors (20-39 score)
- "completely-off-topic": Response doesn't address the question at all (0-19 score)

BEHAVIORAL QUESTIONS: Look for specific examples, structured thinking (STAR method), learning from experience, and clear communication.

TECHNICAL QUESTIONS: Assess conceptual understanding, practical application, consideration of trade-offs, and ability to explain complex topics clearly.

CODING QUESTIONS: Evaluate algorithm correctness, code quality, edge case handling, time/space complexity awareness, and explanation of approach.

Return ONLY this JSON (ensure responseType matches allowed values):
{
  "score": 45,
  "responseType": "partially-relevant",
  "strengths": ["Identified core concept", "Attempted structured approach"],
  "improvements": ["Missed key technical details", "Code has logical errors", "Didn't consider edge cases", "Explanation lacks depth"],
  "detailedAnalysis": "Rigorous 2-3 sentence assessment explaining the score and highlighting specific technical gaps or strengths. Be specific about what they got right and wrong.",
  "overallAssessment": "Honest evaluation of performance with specific areas for improvement. Reference specific parts of their response.",
  "questionRelevance": 4,
  "correctness": 3,
  "communicationClarity": 5,
  "technicalAccuracy": 3
}

CRITICAL: responseType MUST be one of: "perfectly-relevant", "mostly-relevant", "partially-relevant", "mostly-irrelevant", or "completely-off-topic"

BE STRICT: Don't inflate scores. Most intern responses should be 40-70 range unless truly exceptional.`;

    console.log('📤 Sending enhanced feedback request...');
    console.log('📏 Prompt length:', prompt.length);

    const startTime = Date.now();
    const result = await model.generateContent(prompt);
    const responseTime = Date.now() - startTime;

    console.log('⏱️ AI Feedback Response time:', responseTime + 'ms');

    const response = await result.response;
    const rawText = response.text();

    console.log('📥 AI Feedback Raw Response:');
    console.log('📏 Response length:', rawText.length);
    console.log('🔍 Response preview:', rawText.substring(0, 300) + '...');

    // Clean and parse the JSON response
    let cleanText = rawText
      .trim()
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/^```/gm, '')
      .replace(/```$/gm, '');

    console.log('🧹 Cleaned response preview:', cleanText.substring(0, 200) + '...');

    let aiAnalysis;
    try {
      aiAnalysis = JSON.parse(cleanText);
      console.log('✅ AI feedback JSON parsed successfully');
      console.log('📊 Parsed score:', aiAnalysis.score);
      console.log('🏷️ Response type:', aiAnalysis.responseType);
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError.message);
      console.log('🔧 Attempting JSON repair...');
      
      // Try to find and extract valid JSON
      const jsonStart = cleanText.indexOf('{');
      const jsonEnd = cleanText.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonOnly = cleanText.substring(jsonStart, jsonEnd + 1);
        try {
          aiAnalysis = JSON.parse(jsonOnly);
          console.log('✅ Repaired JSON parsed successfully');
        } catch (repairError) {
          console.error('❌ JSON repair failed:', repairError.message);
          throw new Error('Could not parse AI feedback JSON');
        }
      } else {
        throw new Error('No valid JSON found in AI response');
      }
    }

    // Validate and normalize responseType - CRITICAL FIX
    const validResponseTypes = [
      'perfectly-relevant', 
      'mostly-relevant', 
      'partially-relevant', 
      'mostly-irrelevant', 
      'completely-off-topic'
    ];
    
    let normalizedResponseType = aiAnalysis.responseType;
    
    // Map common AI variations to valid enum values
    const responseTypeMapping = {
      'irrelevant': 'mostly-irrelevant',
      'off-topic': 'completely-off-topic',
      'relevant': 'mostly-relevant',
      'partially_relevant': 'partially-relevant',
      'mostly_relevant': 'mostly-relevant',
      'perfectly_relevant': 'perfectly-relevant',
      'completely_off_topic': 'completely-off-topic',
      'mostly_irrelevant': 'mostly-irrelevant'
    };
    
    if (responseTypeMapping[normalizedResponseType]) {
      normalizedResponseType = responseTypeMapping[normalizedResponseType];
    }
    
    if (!validResponseTypes.includes(normalizedResponseType)) {
      console.warn(`⚠️ Invalid responseType '${aiAnalysis.responseType}', mapping to valid type based on score`);
      // Map based on score if responseType is invalid
      const score = Math.max(0, Math.min(100, aiAnalysis.score || 50));
      if (score >= 80) normalizedResponseType = 'perfectly-relevant';
      else if (score >= 60) normalizedResponseType = 'mostly-relevant';
      else if (score >= 40) normalizedResponseType = 'partially-relevant';
      else if (score >= 20) normalizedResponseType = 'mostly-irrelevant';
      else normalizedResponseType = 'completely-off-topic';
    }

    console.log('✅ Normalized response type:', normalizedResponseType);

    // Validate and structure the response with enhanced scoring logic
    const score = Math.max(0, Math.min(100, aiAnalysis.score || 50));
    
    const structuredFeedback = {
      score: score,
      questionRelevance: Math.max(0, Math.min(10, aiAnalysis.questionRelevance || Math.floor(score / 10))),
      responseType: normalizedResponseType, // Use normalized type
      correctness: Math.max(0, Math.min(10, aiAnalysis.correctness || Math.floor(score / 10))),
      syntax: questionType === 'coding' ? Math.max(0, Math.min(10, aiAnalysis.correctness || Math.floor(score / 10))) : Math.floor(score / 10),
      languageBestPractices: questionType === 'coding' ? Math.max(0, Math.min(10, aiAnalysis.technicalAccuracy || Math.floor(score / 10))) : Math.floor(score / 10),
      efficiency: questionType === 'coding' ? Math.max(0, Math.min(10, Math.floor(score / 10))) : Math.floor(score / 15),
      structureAndReadability: Math.max(0, Math.min(10, aiAnalysis.communicationClarity || Math.floor(score / 10))),
      edgeCaseHandling: questionType === 'coding' ? Math.max(0, Math.min(10, Math.floor(score / 12))) : Math.floor(score / 15),
      strengths: Array.isArray(aiAnalysis.strengths) && aiAnalysis.strengths.length > 0 
        ? aiAnalysis.strengths.slice(0, 4) 
        : generateContextualStrengths(questionType, score, responseText, code),
      improvements: Array.isArray(aiAnalysis.improvements) && aiAnalysis.improvements.length > 0 
        ? aiAnalysis.improvements.slice(0, 4) 
        : generateContextualImprovements(questionType, score, responseText, code),
      detailedAnalysis: aiAnalysis.detailedAnalysis || generateDetailedAnalysis(questionType, score, responseText, code, question),
      overallAssessment: aiAnalysis.overallAssessment || generateOverallAssessment(score, questionType),
      communicationClarity: Math.max(0, Math.min(10, aiAnalysis.communicationClarity || Math.floor(score / 10))),
      technicalAccuracy: Math.max(0, Math.min(10, aiAnalysis.technicalAccuracy || Math.floor(score / 10)))
    };

    console.log('✅ ENHANCED AI FEEDBACK SUCCESS:', {
      score: structuredFeedback.score,
      responseType: structuredFeedback.responseType,
      strengthsCount: structuredFeedback.strengths.length,
      improvementsCount: structuredFeedback.improvements.length
    });

    return structuredFeedback;

  } catch (error) {
    console.error('❌ ENHANCED AI FEEDBACK ERROR:', {
      name: error.name,
      message: error.message,
      status: error.status
    });
    throw error;
  }
}

// Helper functions for better contextual feedback
function generateContextualStrengths(questionType, score, responseText, code) {
  const strengths = [];
  
  if (score >= 70) {
    if (questionType === 'coding' && code) {
      strengths.push('Provided working code solution');
      if (code.includes('return')) strengths.push('Included proper return statement');
      if (/\b(if|else|for|while)\b/i.test(code)) strengths.push('Used appropriate control structures');
    } else if (questionType === 'technical') {
      if (responseText.length > 100) strengths.push('Provided comprehensive explanation');
      if (/\b(example|instance|such as)\b/i.test(responseText)) strengths.push('Included relevant examples');
    } else if (questionType === 'behavioral') {
      if (responseText.length > 150) strengths.push('Provided detailed response');
      if (/\b(I did|I implemented|I learned)\b/i.test(responseText)) strengths.push('Used specific personal examples');
    }
  } else if (score >= 40) {
    strengths.push('Made a genuine attempt to answer');
    if (responseText.length > 50) strengths.push('Provided substantive response');
  } else {
    strengths.push('Submitted a response');
  }
  
  return strengths.length > 0 ? strengths : ['Attempted to answer the question'];
}

function generateContextualImprovements(questionType, score, responseText, code) {
  const improvements = [];
  
  if (score < 30) {
    improvements.push('Response needs to directly address the question asked');
    improvements.push('Show understanding of core concepts');
    if (questionType === 'coding') improvements.push('Provide actual working code');
  } else if (score < 50) {
    improvements.push('Provide more specific technical details');
    improvements.push('Include concrete examples or evidence');
    if (questionType === 'coding') improvements.push('Improve code logic and structure');
  } else if (score < 70) {
    improvements.push('Add more depth to technical explanations');
    improvements.push('Consider edge cases and trade-offs');
    if (questionType === 'behavioral') improvements.push('Structure response using STAR method');
  } else {
    improvements.push('Consider additional optimization opportunities');
    improvements.push('Explain reasoning and decision-making process');
  }
  
  return improvements;
}

function generateDetailedAnalysis(questionType, score, responseText, code, question) {
  const responseLength = responseText?.length || 0;
  const hasCode = code && code.trim().length > 0;
  
  if (score < 25) {
    if (questionType === 'coding' && !hasCode) {
      return `Failed to provide any code for this coding question. The response of ${responseLength} characters doesn't address the programming requirements and shows lack of understanding of what was being asked.`;
    }
    return `Response demonstrates minimal understanding of the question. With only ${responseLength} characters, it fails to address the core requirements and lacks the technical depth needed for a proper answer.`;
  } else if (score < 50) {
    if (questionType === 'coding' && hasCode) {
      return `Code attempt was made but contains significant logical issues or syntax problems. The ${responseLength} character response shows basic programming concepts but fails to solve the problem effectively.`;
    }
    return `Response shows basic understanding but lacks technical accuracy and depth. The ${responseLength} character answer addresses some aspects but misses key concepts expected for this ${questionType} question.`;
  } else if (score < 70) {
    return `Solid attempt with reasonable understanding demonstrated. The ${responseLength} character response covers main points but could benefit from more specific examples, deeper technical details, and clearer explanation of reasoning.`;
  } else {
    return `Good response showing strong technical understanding. The ${responseLength} character answer effectively addresses the question with appropriate detail and demonstrates solid grasp of the concepts.`;
  }
}

function generateOverallAssessment(score, questionType) {
  if (score >= 80) return `Excellent performance for an intern-level ${questionType} question - shows strong foundation`;
  if (score >= 65) return `Good performance meeting expectations for intern level with room for growth`;
  if (score >= 50) return `Acceptable performance but requires development in key areas`;
  if (score >= 35) return `Below expectations - needs focused study and practice`;
  return `Significantly below intern level - requires substantial preparation before being job-ready`;
}

// Instant feedback for skipped questions
function generateSkippedQuestionFeedback() {
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
    improvements: [
      "Always attempt to answer interview questions",
      "Prepare thoroughly before interviews",
      "Practice explaining your thought process"
    ],
    detailedAnalysis: "Question was skipped - shows lack of preparation and engagement",
    overallAssessment: "Skipping questions is a significant concern in interviews",
    communicationClarity: 0,
    technicalAccuracy: 0
  };
}

// Enhanced fallback feedback with stricter scoring and better context awareness
function generateFallbackFeedback(questionType, responseText, code) {
  const hasCode = code && code.trim().length > 0;
  const responseLength = responseText?.length || 0;
  
  let score = 30; // Start lower - most responses need improvement
  let strengths = [];
  let improvements = [];
  let responseType = 'mostly-irrelevant';
  
  // Strict evaluation based on response characteristics
  if (questionType === 'coding') {
    if (!hasCode || code.trim().length < 10) {
      score = 5; // Almost no effort
      strengths = ['Submitted response'];
      improvements = ['Must provide actual code', 'Implement the required function', 'Show problem-solving approach'];
      responseType = 'completely-off-topic';
    } else {
      // Check for basic programming constructs
      const hasBasicSyntax = /\b(function|def|class|return|if|for|while|let|const|var|int|string)\b/i.test(code);
      const hasLogic = /\b(if|else|for|while|loop)\b/i.test(code);
      const hasReturn = /\breturn\b/i.test(code);
      
      if (hasBasicSyntax && hasLogic && hasReturn) {
        score = 55; // Basic attempt with some logic
        strengths = ['Provided code structure', 'Used appropriate syntax', 'Included control flow'];
        improvements = ['Optimize algorithm efficiency', 'Add error handling', 'Consider edge cases'];
        responseType = 'partially-relevant';
      } else if (hasBasicSyntax) {
        score = 35; // Some syntax but lacks logic
        strengths = ['Attempted code solution'];
        improvements = ['Add proper logic flow', 'Include return statements', 'Complete the algorithm'];
        responseType = 'mostly-irrelevant';
      } else {
        score = 15; // Poor code quality
        strengths = ['Made an attempt'];
        improvements = ['Use proper programming syntax', 'Implement actual logic', 'Study basic programming concepts'];
        responseType = 'mostly-irrelevant';
      }
    }
  } else if (questionType === 'technical') {
    // Technical questions require specific knowledge
    if (responseLength < 50) {
      score = 10;
      strengths = ['Provided brief response'];
      improvements = ['Provide detailed technical explanation', 'Include specific examples', 'Demonstrate deeper understanding'];
      responseType = 'completely-off-topic';
    } else if (responseLength < 150) {
      // Check for technical terms or concepts
      const hasTechnicalTerms = /\b(algorithm|database|API|framework|library|function|variable|array|object|server|client|HTTP|JSON|SQL)\b/i.test(responseText);
      
      if (hasTechnicalTerms) {
        score = 45;
        strengths = ['Used relevant technical terminology', 'Attempted to explain concepts'];
        improvements = ['Provide more detailed explanations', 'Include practical examples', 'Explain trade-offs and considerations'];
        responseType = 'partially-relevant';
      } else {
        score = 20;
        strengths = ['Provided some explanation'];
        improvements = ['Use technical terminology correctly', 'Show understanding of core concepts', 'Provide specific examples'];
        responseType = 'mostly-irrelevant';
      }
    } else {
      // Longer response - check quality indicators
      const hasExamples = /\b(example|instance|such as|like|for example)\b/i.test(responseText);
      const hasExplanation = /\b(because|therefore|thus|since|reason|due to)\b/i.test(responseText);
      
      if (hasExamples && hasExplanation) {
        score = 65;
        strengths = ['Comprehensive explanation', 'Included examples', 'Showed reasoning'];
        improvements = ['Add more technical depth', 'Consider alternative approaches', 'Discuss potential issues'];
        responseType = 'mostly-relevant';
      } else {
        score = 50;
        strengths = ['Detailed response', 'Attempted thorough explanation'];
        improvements = ['Include concrete examples', 'Explain reasoning more clearly', 'Show deeper technical understanding'];
        responseType = 'partially-relevant';
      }
    }
  } else { // Behavioral questions
    if (responseLength < 100) {
      score = 15;
      strengths = ['Provided response'];
      improvements = ['Use STAR method (Situation, Task, Action, Result)', 'Provide specific examples', 'Explain learning outcomes'];
      responseType = 'mostly-irrelevant';
    } else {
      // Check for STAR method indicators
      const hasSituation = /\b(project|work|team|experience|situation|when|during)\b/i.test(responseText);
      const hasAction = /\b(I did|I implemented|I decided|I approached|I solved|I learned)\b/i.test(responseText);
      const hasResult = /\b(result|outcome|success|completed|achieved|learned)\b/i.test(responseText);
      
      const starCount = [hasSituation, hasAction, hasResult].filter(Boolean).length;
      
      if (starCount >= 2) {
        score = 60;
        strengths = ['Used structured approach', 'Provided specific example', 'Explained actions taken'];
        improvements = ['Include more measurable results', 'Explain lessons learned', 'Connect to job requirements'];
        responseType = 'mostly-relevant';
      } else {
        score = 35;
        strengths = ['Provided personal example'];
        improvements = ['Structure response using STAR method', 'Be more specific about actions', 'Explain what you learned'];
        responseType = 'partially-relevant';
      }
    }
  }

  return {
    score: score,
    questionRelevance: Math.max(1, Math.floor(score / 15)),
    responseType: responseType, // Now using valid enum values
    correctness: Math.max(1, Math.floor(score / 15)),
    syntax: hasCode ? Math.max(1, Math.floor(score / 12)) : Math.floor(score / 15),
    languageBestPractices: Math.max(1, Math.floor(score / 15)),
    efficiency: Math.max(1, Math.floor(score / 20)),
    structureAndReadability: Math.max(1, Math.floor(score / 15)),
    edgeCaseHandling: Math.max(1, Math.floor(score / 25)),
    strengths: strengths,
    improvements: improvements,
    detailedAnalysis: generateStrictAnalysis(questionType, score, responseLength, hasCode),
    overallAssessment: generateStrictAssessment(score),
    communicationClarity: Math.max(1, Math.floor(score / 15)),
    technicalAccuracy: Math.max(1, Math.floor(score / 15))
  };
}

function generateStrictAnalysis(questionType, score, responseLength, hasCode) {
  if (score < 25) {
    if (questionType === 'coding' && !hasCode) {
      return 'Failed to provide code for a coding question, showing lack of preparation and understanding of requirements. This demonstrates insufficient readiness for technical interviews.';
    }
    return `Response demonstrates minimal understanding and fails to address core question requirements effectively. The ${responseLength} character response lacks the technical depth and accuracy expected.`;
  } else if (score < 50) {
    return `Basic attempt with ${responseLength} characters but lacks technical depth and specific examples needed for thorough evaluation. Shows some understanding but significant gaps remain.`;
  } else if (score < 70) {
    return `Shows reasonable understanding with some good elements, but missing key details and depth expected for complete answer. The ${responseLength} character response covers basics but needs more comprehensive coverage.`;
  } else {
    return `Solid response demonstrating good understanding with ${responseLength} characters of relevant content, though could benefit from additional technical details or examples for exceptional performance.`;
  }
}

function generateStrictAssessment(score) {
  if (score < 20) return 'Significantly below expectations - requires substantial improvement and preparation';
  if (score < 40) return 'Below intern level expectations - needs focused study and practice in fundamental concepts';
  if (score < 60) return 'Approaching acceptable level but requires development in key technical areas';
  if (score < 75) return 'Meets basic intern expectations with room for growth and deeper understanding';
  return 'Good performance for intern level with strong foundation and clear potential for growth';
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
      feedback: generateSkippedQuestionFeedback()
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
      feedback = await generateEnhancedAIFeedback(
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
      overallAnalysis = await generateOverallFeedback(interview.responses);
    } catch (feedbackError) {
      console.error('Overall feedback generation failed:', feedbackError.message);
      overallAnalysis = generateFastOverallFeedback(interview.responses);
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

// Generate overall feedback for completed interview
async function generateOverallFeedback(responses) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { 
        temperature: 0.3,
        maxOutputTokens: 800,
      }
    });

    const scores = responses.map(r => r.feedback?.score || 0);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    const behavioralCount = responses.filter(r => r.questionType === 'behavioral').length;
    const technicalCount = responses.filter(r => r.questionType === 'technical').length;
    const codingCount = responses.filter(r => r.questionType === 'coding').length;

    const prompt = `You are a senior hiring manager conducting final assessment of an intern interview. Provide honest, constructive evaluation.

INTERVIEW SUMMARY:
- Questions Answered: ${responses.length}
- Behavioral Questions: ${behavioralCount}
- Technical Questions: ${technicalCount}  
- Coding Questions: ${codingCount}
- Average Score: ${averageScore.toFixed(1)}/100

INDIVIDUAL QUESTION PERFORMANCE:
${responses.map((r, i) => `Q${i+1} (${r.questionType}): ${r.feedback?.score || 0}/100`).join('\n')}

STRICT EVALUATION CRITERIA:
- 85-100: Exceptional candidate, exceeds intern expectations
- 70-84: Strong candidate, ready for intern position  
- 55-69: Acceptable candidate, needs mentoring but has potential
- 40-54: Weak candidate, requires significant development
- 0-39: Not ready for intern position

Return ONLY this JSON:
{
  "overallScore": 62,
  "readinessLevel": "Needs Development Before Ready",
  "keyStrengths": ["Specific strengths observed across questions"],
  "majorImprovements": ["Critical areas requiring focused improvement"],
  "recommendations": ["Specific, actionable steps for improvement"],
  "generalFeedback": "Honest assessment of performance with specific examples from their responses",
  "hiringRecommendation": "Clear recommendation with justification"
}

readinessLevel options:
- "Ready for Intern Position" (70+ average)
- "Nearly Ready with Mentoring" (55-69 average)  
- "Needs Development Before Ready" (40-54 average)
- "Not Yet Ready for Intern Role" (below 40 average)

hiringRecommendation options:
- "Strong Hire" - Exceptional performance
- "Hire" - Meets requirements well
- "Hire with Mentoring" - Has potential, needs support  
- "No Hire - Reapply After Development" - Not ready currently

Be honest about gaps while providing constructive guidance for improvement.`;

    console.log('Generating overall interview feedback...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();

    let cleanText = rawText.trim().replace(/```json\s*|```\s*/g, '');
    let aiAnalysis = JSON.parse(cleanText);

    return {
      score: Math.round(aiAnalysis.overallScore || averageScore),
      feedback: {
        readinessLevel: aiAnalysis.readinessLevel || 'Under Assessment',
        strengths: Array.isArray(aiAnalysis.keyStrengths) ? aiAnalysis.keyStrengths : ['Completed interview'],
        improvements: Array.isArray(aiAnalysis.majorImprovements) ? aiAnalysis.majorImprovements : ['Continue practicing'],
        recommendations: Array.isArray(aiAnalysis.recommendations) ? aiAnalysis.recommendations : ['Build experience'],
        generalFeedback: aiAnalysis.generalFeedback || `Completed ${responses.length} questions with ${averageScore.toFixed(1)}% average.`,
        categoryScores: calculateCategoryScores(responses)
      }
    };

  } catch (error) {
    console.error('Overall feedback generation failed:', error.message);
    return generateFastOverallFeedback(responses);
  }
}

// Fast fallback for overall feedback
function generateFastOverallFeedback(responses) {
  const scores = responses.map(r => r.feedback?.score || 0);
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  
  const readinessLevel = averageScore >= 75 ? 'Ready for Intern Position' : 
                        averageScore >= 60 ? 'Nearly Ready' : 
                        averageScore >= 45 ? 'Needs Development' : 'Not Ready Yet';
  
  return {
    score: Math.round(averageScore),
    feedback: {
      readinessLevel: readinessLevel,
      strengths: [
        'Completed all interview questions',
        averageScore >= 70 ? 'Demonstrated good understanding' : 'Showed engagement with questions'
      ],
      improvements: [
        averageScore < 60 ? 'Focus on technical fundamentals' : 'Continue developing skills',
        'Practice explaining concepts clearly'
      ],
      recommendations: [
        'Build personal projects',
        'Practice coding problems',
        'Study computer science fundamentals'
      ],
      generalFeedback: `Completed ${responses.length} questions with ${averageScore.toFixed(1)}% average. ${readinessLevel} based on performance.`,
      categoryScores: calculateCategoryScores(responses)
    }
  };
}

function calculateCategoryScores(responses) {
  const behavioralResponses = responses.filter(r => r.questionType === 'behavioral');
  const technicalResponses = responses.filter(r => r.questionType === 'technical');
  const codingResponses = responses.filter(r => r.questionType === 'coding');
  
  const averageScore = responses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / responses.length;

  return {
    technicalKnowledge: technicalResponses.length > 0 
      ? Math.round(technicalResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / technicalResponses.length)
      : Math.round(averageScore),
    codingAbility: codingResponses.length > 0 
      ? Math.round(codingResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / codingResponses.length)
      : Math.round(averageScore),
    behavioralSkills: behavioralResponses.length > 0 
      ? Math.round(behavioralResponses.reduce((sum, r) => sum + (r.feedback?.score || 0), 0) / behavioralResponses.length)
      : Math.round(averageScore),
    communication: Math.round(responses.reduce((sum, r) => sum + (r.feedback?.communicationClarity || 5), 0) / responses.length)
  };
}

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

// Additional debugging endpoint for testing the complete flow
export const debugInterviewFlow = async (req, res) => {
  try {
    console.log('Debug interview flow test');
    
    const testResumeText = `John Doe
Software Engineering Student
Email: john@example.com

EDUCATION
Bachelor of Computer Science, University of Technology (2021-2025)
Relevant Coursework: Data Structures, Algorithms, Web Development, Database Systems

TECHNICAL SKILLS
Programming Languages: JavaScript, Python, Java
Web Technologies: HTML, CSS, React, Node.js
Databases: MySQL, MongoDB
Tools: Git, VS Code, Docker

PROJECTS
E-commerce Website (2024)
- Built a full-stack web application using React and Node.js
- Implemented user authentication and payment processing
- Used MongoDB for data storage

Personal Portfolio (2023)
- Created responsive portfolio website using HTML, CSS, and JavaScript
- Deployed on GitHub Pages

EXPERIENCE
Software Development Intern, TechCorp (Summer 2024)
- Collaborated with development team on web applications
- Fixed bugs and implemented new features
- Gained experience with Agile methodology`;

    const testJobDescription = `Software Engineering Intern Position

We are seeking a motivated Software Engineering Intern to join our backend development team. 

Requirements:
- Currently pursuing Computer Science degree
- Experience with JavaScript, Python, or Java
- Understanding of web development concepts
- Familiarity with databases and APIs
- Git version control experience
- Strong problem-solving skills

Responsibilities:
- Develop and maintain backend APIs
- Work with databases and data processing
- Collaborate with frontend developers
- Participate in code reviews
- Debug and fix issues

This is a great opportunity for students to gain real-world experience in backend development and work with modern technologies like Node.js, Express, and MongoDB.`;

    console.log('Test inputs prepared');
    console.log('Testing question generation...');
    
    const questions = await generatePersonalizedQuestionsWithFullContent(testResumeText, testJobDescription);
    
    console.log('Questions generated successfully:', questions.length);
    
    res.json({
      success: true,
      message: 'Debug test completed successfully',
      data: {
        questionsGenerated: questions.length,
        questions: questions.map(q => ({
          id: q.questionId,
          type: q.type,
          category: q.category,
          questionPreview: q.question.substring(0, 100) + '...'
        })),
        testInputs: {
          resumeLength: testResumeText.length,
          jobDescriptionLength: testJobDescription.length
        }
      }
    });
    
  } catch (error) {
    console.error('Debug flow error:', error);
    res.status(500).json({
      success: false,
      error: 'Debug test failed',
      details: {
        message: error.message,
        name: error.name
      }
    });
  }
};

// Test endpoint to verify Gemini API connectivity and environment setup
export const testEnvironmentSetup = async (req, res) => {
  try {
    console.log('Testing environment setup');
    
    const environmentCheck = {
      geminiApiKey: {
        exists: !!process.env.GEMINI_API_KEY,
        length: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0,
        valid: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.startsWith('AIza') : false
      },
      jdoodleCredentials: {
        clientId: !!process.env.JDOODLE_CLIENT_ID,
        clientSecret: !!process.env.JDOODLE_CLIENT_SECRET
      },
      nodeEnv: process.env.NODE_ENV || 'development'
    };

    console.log('Environment check results:', environmentCheck);

    if (!environmentCheck.geminiApiKey.exists) {
      return res.status(500).json({
        success: false,
        error: 'Gemini API key not found in environment variables',
        environmentCheck
      });
    }

    if (!environmentCheck.geminiApiKey.valid) {
      return res.status(500).json({
        success: false,
        error: 'Gemini API key format appears invalid',
        environmentCheck
      });
    }

    // Test actual API connection
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const testResult = await model.generateContent("Respond with: API_TEST_SUCCESS");
    const response = await testResult.response;
    const text = response.text();

    console.log('API test response:', text);

    res.json({
      success: true,
      message: 'Environment setup verified successfully',
      environmentCheck,
      apiTest: {
        response: text,
        success: text.includes('API_TEST_SUCCESS')
      }
    });

  } catch (error) {
    console.error('Environment test failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Environment test failed',
      details: {
        message: error.message,
        name: error.name,
        code: error.code
      }
    });
  }
};
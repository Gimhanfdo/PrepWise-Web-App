import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Play, Pause, ChevronRight, Clock, User, FileText, BarChart3, CheckCircle, AlertCircle, Volume2, Code, Terminal, Send, Type, Headphones } from 'lucide-react';

const MockInterviewSystem = () => {
  // Main state
  const [currentStep, setCurrentStep] = useState('setup'); 
  const [interviewData, setInterviewData] = useState({
    jobTitle: '',
    jobDescription: '',
    resumeText: ''
  });
  const [interview, setInterview] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(0);
  const [responses, setResponses] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [user, setUser] = useState(null);
  
  // Audio states
  const [audioStream, setAudioStream] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioPermission, setAudioPermission] = useState(false);
  const [audioError, setAudioError] = useState('');
  
  // Answer input states
  const [answerMode, setAnswerMode] = useState('audio'); // 'audio' or 'text'
  const [textAnswer, setTextAnswer] = useState('');
  const [transcription, setTranscription] = useState('');
  const [transcriptionError, setTranscriptionError] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  // Code editor states
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [codeOutput, setCodeOutput] = useState('');
  const [showCodeEditor, setShowCodeEditor] = useState(false);

  // Debug states
  const [debugMode, setDebugMode] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const timerRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioPlaybackRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Debug logger
  const addDebugLog = useCallback((message, type = 'info') => {
    const log = {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    setDebugLogs(prev => [...prev.slice(-50), log]); // Keep last 50 logs
    console.log(`[${type.toUpperCase()}] ${message}`);
  }, []);

  // Mock interview questions
  const mockQuestions = [
    {
      questionId: 'q1',
      type: 'behavioral',
      question: 'Tell me about yourself and why you\'re interested in this software engineering internship position.',
      expectedDuration: 120
    },
    {
      questionId: 'q2',
      type: 'technical_coding',
      question: 'Write a function that finds the two numbers in an array that add up to a target sum. Return their indices.',
      expectedDuration: 300,
      starterCode: {
        javascript: `function twoSum(nums, target) {
    // Your implementation here
    
}

// Test cases
console.log(twoSum([2, 7, 11, 15], 9)); // Expected: [0, 1]
console.log(twoSum([3, 2, 4], 6)); // Expected: [1, 2]`,
        python: `def two_sum(nums, target):
    # Your implementation here
    pass

# Test cases
print(two_sum([2, 7, 11, 15], 9))  # Expected: [0, 1]
print(two_sum([3, 2, 4], 6))  # Expected: [1, 2]`,
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
    }
}`
      }
    },
    {
      questionId: 'q3',
      type: 'behavioral',
      question: 'Describe a challenging project you worked on. What obstacles did you face and how did you overcome them?',
      expectedDuration: 180
    },
    {
      questionId: 'q4',
      type: 'technical_conceptual',
      question: 'Explain the difference between synchronous and asynchronous programming. Give examples of when you would use each approach.',
      expectedDuration: 120
    }
  ];

  // Check authentication on component mount
  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      addDebugLog('Checking authentication...');
      
      const response = await fetch('/api/auth/is-auth', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      addDebugLog(`Response status: ${response.status}`);

      const contentType = response.headers.get('content-type');
      addDebugLog(`Content-Type: ${contentType}`);

      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        addDebugLog(`Non-JSON response: ${textResponse.substring(0, 500)}`, 'error');
        throw new Error('Server returned HTML instead of JSON. Check if the API endpoint exists and is working properly.');
      }

      const result = await response.json();
      addDebugLog(`Auth response: ${JSON.stringify(result)}`);
      
      if (result.success && result.user) {
        setUser(result.user);
        setError(''); 
        addDebugLog(`User authenticated: ${result.user.name}`);
      } else {
        setError(result.message || 'Please log in to access the mock interview system.');
        addDebugLog('Authentication failed - no user found', 'error');
      }
    } catch (err) {
      console.error('Authentication check failed:', err);
      addDebugLog(`Authentication failed: ${err.message}`, 'error');
      setError(`Authentication failed: ${err.message}`);
    }
  };

  // Audio Recording Functions with Better Error Handling
  const initializeAudio = async () => {
    try {
      addDebugLog('Initializing audio...');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media recording not supported in this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });

      addDebugLog('Audio stream acquired successfully');
      setAudioStream(stream);
      audioStreamRef.current = stream;
      setAudioPermission(true);
      setAudioError('');

      // Create audio context for better control
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      addDebugLog('Audio context created successfully');
      return stream;
    } catch (err) {
      addDebugLog(`Audio initialization failed: ${err.message}`, 'error');
      setAudioError(`Microphone access failed: ${err.message}`);
      setAudioPermission(false);
      throw new Error(`Microphone access failed: ${err.message}`);
    }
  };

  const startRecording = async () => {
    try {
      addDebugLog('Starting recording...');
      setAudioError('');
      setTranscriptionError('');
      let stream = audioStream;
      
      if (!stream) {
        stream = await initializeAudio();
      }

      // Clear previous recording
      setAudioBlob(null);
      audioChunksRef.current = [];
      setRecordingTime(0);
      setTranscription('');

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          addDebugLog(`Audio chunk received: ${event.data.size} bytes`);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        addDebugLog(`Recording stopped, blob size: ${blob.size} bytes`);
        
        // Start transcription process
        transcribeAudio(blob);
      };

      mediaRecorder.onerror = (event) => {
        addDebugLog(`MediaRecorder error: ${event.error.message}`, 'error');
        setAudioError(`Recording error: ${event.error.message}`);
      };

      mediaRecorder.start(250); // Collect data every 250ms
      setIsRecording(true);
      addDebugLog('Recording started successfully');

      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          if (newTime % 5 === 0) {
            addDebugLog(`Recording time: ${newTime}s`);
          }
          return newTime;
        });
      }, 1000);

    } catch (err) {
      addDebugLog(`Start recording failed: ${err.message}`, 'error');
      setAudioError(err.message);
    }
  };

  const stopRecording = () => {
    try {
      addDebugLog('Stopping recording...');
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
        addDebugLog('Recording stopped successfully');
      }
    } catch (err) {
      addDebugLog(`Stop recording failed: ${err.message}`, 'error');
      setAudioError('Failed to stop recording');
    }
  };

  // Real transcription function using the API
  const transcribeAudio = async (audioBlob) => {
    try {
      setIsTranscribing(true);
      setTranscriptionError('');
      addDebugLog('Starting transcription...');
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/interviews/transcribe', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const result = await response.json();
      addDebugLog(`Transcription response: ${JSON.stringify(result)}`);

      if (result.success && result.text) {
        setTranscription(result.text);
        addDebugLog(`Transcription successful: ${result.text.substring(0, 100)}...`);
      } else {
        throw new Error(result.error || 'Transcription failed');
      }
      
    } catch (err) {
      addDebugLog(`Transcription failed: ${err.message}`, 'error');
      setTranscriptionError(`Transcription failed: ${err.message}. Please use text input instead.`);
      // Don't set a fallback transcript - let user handle this
    } finally {
      setIsTranscribing(false);
    }
  };

  const playRecording = async () => {
    if (!audioBlob) return;

    try {
      addDebugLog('Playing recording...');
      
      if (isPlaying) {
        audioPlaybackRef.current.pause();
        setIsPlaying(false);
        addDebugLog('Playback paused');
        return;
      }

      const url = URL.createObjectURL(audioBlob);
      audioPlaybackRef.current.src = url;
      
      audioPlaybackRef.current.onplay = () => {
        setIsPlaying(true);
        addDebugLog('Playback started');
      };
      audioPlaybackRef.current.onpause = () => {
        setIsPlaying(false);
        addDebugLog('Playback paused');
      };
      audioPlaybackRef.current.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
        addDebugLog('Playback ended');
      };
      
      await audioPlaybackRef.current.play();
    } catch (err) {
      addDebugLog(`Playback failed: ${err.message}`, 'error');
      setAudioError('Failed to play recording');
    }
  };

  // Code Execution Functions
  const executeCode = () => {
    try {
      setCodeOutput('Running code...\n');
      addDebugLog('Executing code...');
      
      if (language === 'javascript') {
        // Capture console.log output
        const originalLog = console.log;
        let output = '';
        
        console.log = (...args) => {
          output += args.join(' ') + '\n';
        };
        
        try {
          // Execute the code in a try-catch to handle errors
          const result = eval(code);
          if (result !== undefined) {
            output += 'Return value: ' + result + '\n';
          }
        } catch (error) {
          output += 'Error: ' + error.message + '\n';
        }
        
        console.log = originalLog;
        setCodeOutput(output || 'Code executed successfully (no output)');
        addDebugLog(`Code executed: ${output.substring(0, 100)}`);
      } else {
        const simulatedOutput = `Code execution for ${language} is simulated in this demo.\nYour code would be executed on the server.\n\nCode submitted:\n${code}`;
        setCodeOutput(simulatedOutput);
        addDebugLog(`Simulated execution for ${language}`);
      }
    } catch (error) {
      const errorMsg = `Execution Error: ${error.message}`;
      setCodeOutput(errorMsg);
      addDebugLog(`Code execution error: ${error.message}`, 'error');
    }
  };

  // Replace the generateDynamicFeedback function in your React component with this enhanced version

const generateDynamicFeedback = async (questionData, response, responseText, responseTime) => {
  addDebugLog('Generating advanced feedback based on user content...');
  
  // If no valid response text, return error feedback
  if (!responseText || responseText.trim().length === 0) {
    return {
      strengths: [],
      improvements: ['Please provide a complete response to the question'],
      score: 0,
      detailedAnalysis: 'No valid response provided. Please answer the question to receive feedback.',
      communicationClarity: 1,
      technicalAccuracy: 1,
      structuredResponse: 1
    };
  }

  try {
    // Call backend API for AI-powered analysis
    const analysisResponse = await fetch('/api/interviews/analyze-response', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question: questionData.question,
        questionType: questionData.type,
        responseText: responseText,
        responseTime: responseTime,
        code: response.code || null,
        expectedDuration: questionData.expectedDuration
      })
    });

    if (analysisResponse.ok) {
      const result = await analysisResponse.json();
      if (result.success && result.feedback) {
        addDebugLog(`AI-powered feedback generated successfully`);
        return result.feedback;
      }
    }
    
    addDebugLog('AI analysis failed, falling back to enhanced local analysis');
  } catch (error) {
    addDebugLog(`AI analysis error: ${error.message}`, 'error');
  }

  // Enhanced fallback analysis if AI fails
  return generateEnhancedLocalFeedback(questionData, response, responseText, responseTime);
};

const generateEnhancedLocalFeedback = (questionData, response, responseText, responseTime) => {
  const feedback = {
    strengths: [],
    improvements: [],
    score: 50, // Start with neutral score
    detailedAnalysis: '',
    communicationClarity: 5,
    technicalAccuracy: 5,
    structuredResponse: 5
  };

  const responseLength = responseText.trim().length;
  const wordCount = responseText.trim().split(/\s+/).length;
  const sentences = responseText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  addDebugLog(`Enhanced analysis: ${responseLength} chars, ${wordCount} words, ${sentences.length} sentences`);

  // Content depth analysis
  const contentAnalysis = analyzeContentDepth(responseText, questionData.type);
  feedback.score += contentAnalysis.score;
  feedback.strengths.push(...contentAnalysis.strengths);
  feedback.improvements.push(...contentAnalysis.improvements);

  // Communication quality analysis
  const commAnalysis = analyzeCommunicationQuality(responseText, sentences);
  feedback.communicationClarity = commAnalysis.clarity;
  feedback.structuredResponse = commAnalysis.structure;
  feedback.score += commAnalysis.score;
  feedback.strengths.push(...commAnalysis.strengths);
  feedback.improvements.push(...commAnalysis.improvements);

  // Question-specific analysis
  const questionAnalysis = analyzeQuestionSpecific(questionData, responseText, response.code);
  feedback.technicalAccuracy = questionAnalysis.technical;
  feedback.score += questionAnalysis.score;
  feedback.strengths.push(...questionAnalysis.strengths);
  feedback.improvements.push(...questionAnalysis.improvements);

  // Time management analysis
  const timeAnalysis = analyzeTimeManagement(responseTime, questionData.expectedDuration);
  feedback.score += timeAnalysis.score;
  if (timeAnalysis.feedback) {
    if (timeAnalysis.score > 0) {
      feedback.strengths.push(timeAnalysis.feedback);
    } else {
      feedback.improvements.push(timeAnalysis.feedback);
    }
  }

  // Generate detailed analysis
  feedback.detailedAnalysis = generateDetailedAnalysis(feedback, contentAnalysis, commAnalysis, questionAnalysis);

  // Ensure minimum feedback and clamp scores
  ensureFeedbackQuality(feedback);
  
  return feedback;
};

const analyzeContentDepth = (text, questionType) => {
  const analysis = { score: 0, strengths: [], improvements: [] };
  const textLower = text.toLowerCase();

  // Keywords and concepts by question type
  const keywords = {
    behavioral: {
      positive: ['experience', 'project', 'team', 'challenge', 'learned', 'improved', 'result', 'outcome', 'responsibility', 'collaboration', 'problem', 'solution', 'leadership', 'initiative'],
      structure: ['situation', 'task', 'action', 'result', 'when', 'what', 'how', 'why', 'because', 'therefore', 'consequently']
    },
    technical_coding: {
      positive: ['algorithm', 'complexity', 'optimization', 'data structure', 'variable', 'function', 'loop', 'condition', 'array', 'object', 'method', 'efficient', 'solution', 'approach'],
      advanced: ['time complexity', 'space complexity', 'big o', 'hash map', 'binary search', 'dynamic programming', 'recursion', 'iteration']
    },
    technical_conceptual: {
      positive: ['concept', 'principle', 'example', 'difference', 'advantage', 'disadvantage', 'use case', 'implementation', 'performance', 'scalability'],
      technical: ['asynchronous', 'synchronous', 'callback', 'promise', 'api', 'database', 'framework', 'library', 'protocol', 'architecture']
    }
  };

  const relevantKeywords = keywords[questionType] || keywords.technical_conceptual;
  
  // Count relevant keywords
  let keywordScore = 0;
  let foundKeywords = [];
  
  Object.values(relevantKeywords).flat().forEach(keyword => {
    if (textLower.includes(keyword)) {
      keywordScore += 2;
      foundKeywords.push(keyword);
    }
  });

  analysis.score += Math.min(keywordScore, 30); // Cap at 30 points
  
  if (foundKeywords.length >= 5) {
    analysis.strengths.push('Used relevant technical vocabulary and concepts');
  } else if (foundKeywords.length >= 2) {
    analysis.strengths.push('Showed understanding of key concepts');
  } else {
    analysis.improvements.push('Include more specific technical terminology and concepts');
  }

  // Check for examples and specificity
  const exampleIndicators = /for example|for instance|such as|like when|consider|imagine|in my experience|i worked on|i built|i implemented/gi;
  const examples = text.match(exampleIndicators);
  
  if (examples && examples.length >= 2) {
    analysis.strengths.push('Provided multiple concrete examples');
    analysis.score += 15;
  } else if (examples && examples.length >= 1) {
    analysis.strengths.push('Included specific examples');
    analysis.score += 10;
  } else {
    analysis.improvements.push('Provide specific examples to illustrate your points');
  }

  // Check for quantifiable metrics
  const numbers = text.match(/\d+(\.\d+)?(%|percent|times|hours|days|weeks|months|years|users|requests|mb|gb|ms|seconds)/gi);
  if (numbers && numbers.length > 0) {
    analysis.strengths.push('Included quantifiable metrics and specific details');
    analysis.score += 10;
  }

  return analysis;
};

const analyzeCommunicationQuality = (text, sentences) => {
  const analysis = { clarity: 5, structure: 5, score: 0, strengths: [], improvements: [] };
  
  // Sentence length and variety analysis
  const avgSentenceLength = sentences.reduce((acc, s) => acc + s.split(' ').length, 0) / sentences.length;
  const sentenceLengths = sentences.map(s => s.split(' ').length);
  const lengthVariety = Math.max(...sentenceLengths) - Math.min(...sentenceLengths);

  if (avgSentenceLength >= 12 && avgSentenceLength <= 25 && lengthVariety >= 5) {
    analysis.strengths.push('Good sentence structure and variety');
    analysis.clarity += 2;
    analysis.score += 10;
  } else if (avgSentenceLength < 8) {
    analysis.improvements.push('Expand your sentences for more detailed explanations');
    analysis.clarity -= 1;
  } else if (avgSentenceLength > 30) {
    analysis.improvements.push('Break down complex sentences for better clarity');
    analysis.clarity -= 1;
  }

  // Check for connective words and logical flow
  const connectors = text.match(/\b(however|therefore|furthermore|moreover|additionally|consequently|because|since|although|while|whereas|first|second|third|finally|in conclusion|as a result|on the other hand)\b/gi);
  
  if (connectors && connectors.length >= 3) {
    analysis.strengths.push('Excellent logical flow and structure');
    analysis.structure += 2;
    analysis.score += 15;
  } else if (connectors && connectors.length >= 1) {
    analysis.strengths.push('Good use of connecting words');
    analysis.structure += 1;
    analysis.score += 8;
  } else {
    analysis.improvements.push('Use more connecting words to improve flow (however, therefore, because, etc.)');
    analysis.structure -= 1;
  }

  // Check for filler words and confidence
  const fillerWords = text.match(/\b(um|uh|like|you know|actually|basically|sort of|kind of|i think|i guess|maybe|probably)\b/gi);
  const confidenceWords = text.match(/\b(definitely|certainly|clearly|obviously|absolutely|confident|sure|believe|know|understand)\b/gi);

  if (!fillerWords || fillerWords.length <= 2) {
    analysis.strengths.push('Clear, confident communication');
    analysis.clarity += 1;
    analysis.score += 8;
  } else if (fillerWords.length > 5) {
    analysis.improvements.push('Reduce hesitation words (um, like, I think) for more confident delivery');
    analysis.clarity -= 2;
  }

  if (confidenceWords && confidenceWords.length >= 2) {
    analysis.strengths.push('Spoke with confidence and certainty');
    analysis.score += 5;
  }

  return analysis;
};

// Enhanced question-specific analysis
const analyzeQuestionSpecific = (questionData, text, code) => {
  const analysis = { technical: 5, score: 0, strengths: [], improvements: [] };

  if (questionData.type === 'behavioral') {
    return analyzeBehavioralResponse(text, analysis);
  } else if (questionData.type === 'technical_coding') {
    return analyzeCodingResponse(text, code, analysis);
  } else if (questionData.type === 'technical_conceptual') {
    return analyzeTechnicalConceptualResponse(text, analysis);
  }

  return analysis;
};

const analyzeBehavioralResponse = (text, analysis) => {
  // STAR method analysis
  const starElements = {
    situation: /\b(situation|context|background|setting|when|where|during|at the time|scenario)\b/gi,
    task: /\b(task|goal|objective|responsibility|needed to|had to|required|assigned|expected)\b/gi,
    action: /\b(action|did|implemented|decided|approach|solution|steps|method|executed|performed|created|built|developed)\b/gi,
    result: /\b(result|outcome|learned|achieved|impact|success|conclusion|end|effect|improvement|benefit)\b/gi
  };

  const starCount = Object.entries(starElements).reduce((count, [element, regex]) => {
    const matches = text.match(regex);
    return count + (matches ? 1 : 0);
  }, 0);

  if (starCount >= 4) {
    analysis.strengths.push('Excellent use of STAR method (Situation, Task, Action, Result)');
    analysis.technical += 3;
    analysis.score += 25;
  } else if (starCount >= 3) {
    analysis.strengths.push('Good structure using STAR method elements');
    analysis.technical += 2;
    analysis.score += 15;
  } else if (starCount >= 2) {
    analysis.strengths.push('Shows some structured thinking');
    analysis.technical += 1;
    analysis.score += 8;
  } else {
    analysis.improvements.push('Use STAR method: describe the Situation, Task, Action taken, and Result achieved');
    analysis.technical -= 1;
  }

  // Leadership and initiative analysis
  const leadership = text.match(/\b(led|leadership|managed|coordinated|organized|initiated|took charge|responsible for|guided|mentored)\b/gi);
  if (leadership && leadership.length >= 2) {
    analysis.strengths.push('Demonstrated leadership and initiative');
    analysis.score += 10;
  }

  // Problem-solving indicators
  const problemSolving = text.match(/\b(problem|challenge|issue|difficulty|obstacle|solution|solved|resolved|overcame|addressed)\b/gi);
  if (problemSolving && problemSolving.length >= 3) {
    analysis.strengths.push('Strong focus on problem-solving');
    analysis.score += 8;
  }

  return analysis;
};


// Coding analysis
const analyzeCodingResponse = (text, code, analysis) => {
  // Code quality analysis
  if (code && code.trim()) {
    const codeAnalysis = analyzeCodeQuality(code);
    analysis.technical += codeAnalysis.technical;
    analysis.score += codeAnalysis.score;
    analysis.strengths.push(...codeAnalysis.strengths);
    analysis.improvements.push(...codeAnalysis.improvements);
  } else {
    analysis.improvements.push('Provide code implementation along with explanation');
    analysis.technical -= 2;
    analysis.score -= 15;
  }

  // Algorithm explanation analysis
  const algorithmKeywords = text.match(/\b(algorithm|approach|strategy|method|complexity|time|space|efficient|optimize|iterate|loop|recursion|data structure|array|hash|map|tree|graph|sort|search)\b/gi);
  
  if (algorithmKeywords && algorithmKeywords.length >= 5) {
    analysis.strengths.push('Excellent technical explanation with algorithm concepts');
    analysis.technical += 2;
    analysis.score += 15;
  } else if (algorithmKeywords && algorithmKeywords.length >= 2) {
    analysis.strengths.push('Good use of technical terminology');
    analysis.technical += 1;
    analysis.score += 8;
  } else {
    analysis.improvements.push('Include more technical terms and algorithm concepts in your explanation');
  }

  // Complexity analysis mention
  const complexity = text.match(/\b(O\(|big o|time complexity|space complexity|linear|quadratic|logarithmic|constant|efficient|performance)\b/gi);
  if (complexity) {
    analysis.strengths.push('Discussed algorithm complexity and performance');
    analysis.technical += 2;
    analysis.score += 12;
  } else {
    analysis.improvements.push('Discuss time and space complexity of your solution');
  }

  return analysis;
};

// Technical conceptual analysis
const analyzeTechnicalConceptualResponse = (text, analysis) => {
  // Technical depth
  const technicalTerms = text.match(/\b(asynchronous|synchronous|callback|promise|async|await|api|http|database|algorithm|data structure|class|object|function|variable|loop|condition|boolean|string|array|hash|map|queue|stack|thread|process|memory|cpu|performance|scalability|framework|library|protocol|architecture)\b/gi);
  
  if (technicalTerms && technicalTerms.length >= 5) {
    analysis.strengths.push('Excellent technical vocabulary and depth');
    analysis.technical += 3;
    analysis.score += 20;
  } else if (technicalTerms && technicalTerms.length >= 2) {
    analysis.strengths.push('Good technical understanding');
    analysis.technical += 1;
    analysis.score += 10;
  } else {
    analysis.improvements.push('Use more specific technical terminology');
    analysis.technical -= 1;
  }

  // Comparison and contrast
  const comparisons = text.match(/\b(difference|compare|contrast|versus|vs|while|whereas|however|on the other hand|unlike|similar|different|advantage|disadvantage|better|worse|prefer)\b/gi);
  if (comparisons && comparisons.length >= 3) {
    analysis.strengths.push('Excellent comparative analysis');
    analysis.score += 12;
  } else if (comparisons && comparisons.length >= 1) {
    analysis.strengths.push('Good comparative thinking');
    analysis.score += 6;
  } else {
    analysis.improvements.push('Compare and contrast different approaches or concepts');
  }

  return analysis;
};

const analyzeCodeQuality = (code) => {
  const analysis = { technical: 0, score: 0, strengths: [], improvements: [] };
  
  // Basic code structure
  const hasComments = /\/\/|\/\*|\#|"""/.test(code);
  const hasVariableNames = /[a-zA-Z_][a-zA-Z0-9_]{2,}/.test(code);
  const hasLoops = /\b(for|while|forEach|map|filter|reduce)\b/.test(code);
  const hasFunctions = /\b(function|def|const\s+\w+\s*=|=>\s*{|\w+\s*\(.*\)\s*{)/.test(code);
  const hasErrorHandling = /\b(try|catch|except|if.*error|throw|raise)\b/i.test(code);
  
  if (hasComments) {
    analysis.strengths.push('Good code documentation with comments');
    analysis.technical += 1;
    analysis.score += 8;
  } else {
    analysis.improvements.push('Add comments to explain your code logic');
  }

  if (hasVariableNames) {
    analysis.strengths.push('Used descriptive variable names');
    analysis.technical += 1;
    analysis.score += 5;
  }

  if (hasLoops) {
    analysis.strengths.push('Proper use of iteration/loops');
    analysis.technical += 1;
    analysis.score += 8;
  }

  if (hasFunctions) {
    analysis.strengths.push('Good code organization with functions');
    analysis.technical += 1;
    analysis.score += 8;
  }

  if (hasErrorHandling) {
    analysis.strengths.push('Included error handling');
    analysis.technical += 2;
    analysis.score += 12;
  } else {
    analysis.improvements.push('Consider adding error handling to make code more robust');
  }

  // Code length and complexity
  const lines = code.split('\n').filter(line => line.trim()).length;
  if (lines >= 5 && lines <= 50) {
    analysis.strengths.push('Appropriate code length and complexity');
    analysis.score += 5;
  } else if (lines < 5) {
    analysis.improvements.push('Provide a more complete implementation');
  } else if (lines > 50) {
    analysis.improvements.push('Consider simplifying or breaking down the solution');
  }

  return analysis;
};


// Time management analysis
const analyzeTimeManagement = (responseTime, expectedTime) => {
  const analysis = { score: 0, feedback: null };
  
  if (!responseTime || !expectedTime) return analysis;
  
  const ratio = responseTime / expectedTime;
  
  if (ratio >= 0.7 && ratio <= 1.3) {
    analysis.feedback = 'Excellent time management';
    analysis.score = 10;
  } else if (ratio >= 0.5 && ratio <= 1.7) {
    analysis.feedback = 'Good time management';
    analysis.score = 5;
  } else if (ratio < 0.3) {
    analysis.feedback = 'Take more time to provide thorough answers';
    analysis.score = -5;
  } else if (ratio > 2.0) {
    analysis.feedback = 'Practice being more concise while maintaining detail';
    analysis.score = -3;
  }
  
  return analysis;
};

const generateDetailedAnalysis = (feedback, contentAnalysis, commAnalysis, questionAnalysis) => {
  const strengths = feedback.strengths.slice(0, 3).join(', ').toLowerCase();
  const improvements = feedback.improvements.slice(0, 2).join(' and ').toLowerCase();
  
  let analysis = `Your response demonstrates ${strengths || 'basic understanding of the topic'}. `;
  
  if (feedback.score >= 80) {
    analysis += 'This was an excellent response with strong technical depth and clear communication. ';
  } else if (feedback.score >= 65) {
    analysis += 'This was a solid response with good technical understanding. ';
  } else if (feedback.score >= 50) {
    analysis += 'This response shows potential but has room for improvement. ';
  } else {
    analysis += 'This response needs significant improvement in several areas. ';
  }
  
  if (improvements) {
    analysis += `To enhance your future responses, focus on ${improvements}. `;
  }
  
  if (feedback.communicationClarity >= 7) {
    analysis += 'Your communication was clear and well-structured.';
  } else {
    analysis += 'Work on organizing your thoughts more clearly and using connecting words to improve flow.';
  }
  
  return analysis;
};

// Ensure feedback quality
const ensureFeedbackQuality = (feedback) => {
  // Ensure minimum feedback
  if (feedback.strengths.length === 0) {
    feedback.strengths.push('Attempted to answer the question completely');
  }
  
  if (feedback.improvements.length === 0) {
    feedback.improvements.push('Continue practicing to build confidence and technical depth');
  }

  // Remove duplicates
  feedback.strengths = [...new Set(feedback.strengths)];
  feedback.improvements = [...new Set(feedback.improvements)];

  // Clamp scores
  feedback.score = Math.max(0, Math.min(100, feedback.score));
  feedback.communicationClarity = Math.max(1, Math.min(10, feedback.communicationClarity));
  feedback.technicalAccuracy = Math.max(1, Math.min(10, feedback.technicalAccuracy));
  feedback.structuredResponse = Math.max(1, Math.min(10, feedback.structuredResponse));
};

// Clamp scores to valid ranges
const clampScoresLocal = (feedback) => {
  feedback.score = Math.max(0, Math.min(100, feedback.score));
  feedback.communicationClarity = Math.max(1, Math.min(10, feedback.communicationClarity));
  feedback.technicalAccuracy = Math.max(1, Math.min(10, feedback.technicalAccuracy));
  feedback.structuredResponse = Math.max(1, Math.min(10, feedback.structuredResponse));
};

  // Setup phase - collect job details
  const SetupPhase = () => (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mock Interview Setup</h1>
        <p className="text-gray-600">
          Welcome {user?.name || 'User'}! Set up your software engineering internship mock interview
        </p>
      </div>

      {/* Debug Panel */}
      {debugMode && (
        <div className="mb-6 bg-gray-900 text-green-400 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Debug Console</h3>
            <button 
              onClick={() => setDebugLogs([])}
              className="text-xs bg-red-600 text-white px-2 py-1 rounded"
            >
              Clear
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto text-xs font-mono space-y-1">
            {debugLogs.slice(-10).map((log, index) => (
              <div key={index} className={`${log.type === 'error' ? 'text-red-400' : log.type === 'warn' ? 'text-yellow-400' : 'text-green-400'}`}>
                [{log.timestamp}] {log.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {user && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="font-medium text-gray-900 mb-2">Interview Candidate</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="text-gray-900">{user.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="text-gray-900">{user.email}</p>
              </div>
            </div>
            <div className="mt-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                user.accountPlan === 'premium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {user.accountPlan?.toUpperCase() || 'BASIC'} PLAN
              </span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Job Title *</label>
          <input
            type="text"
            value={interviewData.jobTitle}
            onChange={(e) => setInterviewData(prev => ({...prev, jobTitle: e.target.value}))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Software Engineering Intern"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Job Description *</label>
          <textarea
            value={interviewData.jobDescription}
            onChange={(e) => setInterviewData(prev => ({...prev, jobDescription: e.target.value}))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32"
            placeholder="Paste the complete job description here..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Resume Content *</label>
          <textarea
            value={interviewData.resumeText}
            onChange={(e) => setInterviewData(prev => ({...prev, resumeText: e.target.value}))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-40"
            placeholder="Paste your resume text here..."
          />
        </div>

        {/* Audio permission test */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Audio Test</h4>
          <p className="text-sm text-blue-700 mb-3">Test your microphone before starting the interview:</p>
          <div className="space-y-2">
            <button
              onClick={initializeAudio}
              disabled={audioPermission}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-green-600 text-white px-4 py-2 rounded-lg text-sm transition-colors mr-2"
            >
              {audioPermission ? '✓ Microphone Ready' : 'Test Microphone'}
            </button>
            <button
              onClick={() => setDebugMode(!debugMode)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {debugMode ? 'Hide Debug' : 'Show Debug'}
            </button>
          </div>
          {audioError && (
            <p className="text-sm text-red-600 mt-2">⚠️ {audioError}</p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <button
          onClick={createInterview}
          disabled={loading || !isSetupValid() || !user}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Creating Interview...
            </>
          ) : (
            <>
              <ChevronRight className="w-5 h-5" />
              Start Mock Interview
            </>
          )}
        </button>
      </div>
    </div>
  );

  // Enhanced Interview phase with both audio and text input
  const InterviewPhase = () => (
    <div className="max-w-6xl mx-auto p-6">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Question {questionIndex + 1} of {mockQuestions.length}</span>
          <span className="text-sm text-gray-500">
            <Clock className="w-4 h-4 inline mr-1" />
            {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((questionIndex + 1) / mockQuestions.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Question Panel */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              currentQuestion?.type === 'technical_coding' ? 'bg-purple-100 text-purple-600' :
              currentQuestion?.type === 'technical_conceptual' ? 'bg-indigo-100 text-indigo-600' :
              currentQuestion?.type === 'behavioral' ? 'bg-green-100 text-green-600' :
              'bg-blue-100 text-blue-600'
            }`}>
              {currentQuestion?.type === 'technical_coding' ? <Code className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  currentQuestion?.type === 'technical_coding' ? 'bg-purple-100 text-purple-700' :
                  currentQuestion?.type === 'technical_conceptual' ? 'bg-indigo-100 text-indigo-700' :
                  currentQuestion?.type === 'behavioral' ? 'bg-green-100 text-green-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {currentQuestion?.type?.replace('_', ' ').toUpperCase()}
                </span>
                <span className="text-xs text-gray-500">
                  Expected: {currentQuestion?.expectedDuration || 120}s
                </span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {currentQuestion?.question}
              </h2>
            </div>
          </div>

          {/* Answer Mode Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Choose Answer Method:</label>
            <div className="flex gap-4">
              <button
                onClick={() => setAnswerMode('audio')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  answerMode === 'audio' 
                    ? 'bg-blue-100 border-blue-500 text-blue-700' 
                    : 'bg-gray-50 border-gray-300 text-gray-600'
                }`}
              >
                <Headphones className="w-4 h-4" />
                Audio Response
              </button>
              <button
                onClick={() => setAnswerMode('text')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  answerMode === 'text' 
                    ? 'bg-green-100 border-green-500 text-green-700' 
                    : 'bg-gray-50 border-gray-300 text-gray-600'
                }`}
              >
                <Type className="w-4 h-4" />
                Text Response
              </button>
            </div>
          </div>

          {/* Coding environment toggle */}
          {currentQuestion?.type === 'technical_coding' && (
            <div className="mb-4">
              <button
                onClick={() => setShowCodeEditor(!showCodeEditor)}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Terminal className="w-4 h-4" />
                {showCodeEditor ? 'Hide Code Editor' : 'Open Code Editor'}
              </button>
            </div>
          )}

          {/* Audio Response Interface */}
          {answerMode === 'audio' && (
            <div className="space-y-4">
              {/* Recording controls */}
              <div className="flex items-center justify-center gap-4 py-6">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={loading}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                    isRecording 
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </button>
                
                {audioBlob && (
                  <button
                    onClick={playRecording}
                    className={`w-12 h-12 ${isPlaying ? 'bg-orange-500' : 'bg-gray-500'} hover:bg-gray-600 text-white rounded-full flex items-center justify-center transition-colors`}
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  </button>
                )}
              </div>

              <div className="text-center">
                <p className="text-gray-600 mb-2">
                  {isRecording ? `Recording... ${recordingTime}s` : 'Click the microphone to start recording'}
                </p>
                {audioBlob && (
                  <p className="text-sm text-green-600 mb-2">✓ Response recorded ({Math.round(audioBlob.size / 1024)}KB)</p>
                )}
                {isTranscribing && (
                  <p className="text-sm text-blue-600 mb-2">🔄 Transcribing audio...</p>
                )}
                {audioError && (
                  <p className="text-sm text-red-600 mb-2">⚠️ {audioError}</p>
                )}
                {transcriptionError && (
                  <div className="text-sm text-red-600 mb-2 p-2 bg-red-50 rounded">
                    ⚠️ {transcriptionError}
                    <br />
                    <button 
                      onClick={() => setAnswerMode('text')} 
                      className="mt-2 text-blue-600 hover:text-blue-800 underline"
                    >
                      Switch to Text Input
                    </button>
                  </div>
                )}
              </div>

              {/* Transcription Display */}
              {transcription && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Transcription:</h4>
                  <p className="text-sm text-blue-700">{transcription}</p>
                </div>
              )}

              {/* Manual transcript input if transcription fails */}
              {transcriptionError && audioBlob && answerMode === 'audio' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-medium text-yellow-800 mb-2">Manual Transcription:</h4>
                  <p className="text-sm text-yellow-700 mb-2">Please type what you said in the recording:</p>
                  <textarea
                    value={transcription}
                    onChange={(e) => setTranscription(e.target.value)}
                    className="w-full h-24 px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 resize-none"
                    placeholder="Type your audio response here..."
                  />
                </div>
              )}
            </div>
          )}

          {/* Text Response Interface */}
          {answerMode === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Written Response:</label>
                <textarea
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                  placeholder="Type your answer here..."
                />
              </div>
              <div className="text-sm text-gray-500">
                Characters: {textAnswer.length} | Words: {textAnswer.split(' ').filter(word => word.length > 0).length}
              </div>
            </div>
          )}

          {/* Submit answer button */}
          {((answerMode === 'audio' && transcription) || (answerMode === 'text' && textAnswer.trim())) && (
            <div className="flex justify-center mt-6">
              <button
                onClick={submitAnswer}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Submit Answer & Continue
                  </>
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mt-4">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {/* Debug logs in interview */}
          {debugMode && (
            <div className="mt-4 bg-gray-900 text-green-400 p-3 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Debug Logs:</h4>
              <div className="max-h-24 overflow-y-auto text-xs font-mono space-y-1">
                {debugLogs.slice(-5).map((log, index) => (
                  <div key={index} className={`${log.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                    [{log.timestamp}] {log.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Code Editor Panel */}
        {showCodeEditor && currentQuestion?.type === 'technical_coding' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Code Editor</h3>
              <div className="flex items-center gap-2">
                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    setCode(currentQuestion.starterCode?.[e.target.value] || '');
                    setCodeOutput('');
                  }}
                  className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                </select>
                <button
                  onClick={executeCode}
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                >
                  <Send className="w-3 h-3" />
                  Run
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Code:</label>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder={`Write your ${language} code here...`}
                  style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
                />
              </div>

              {codeOutput && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Output:</label>
                  <div className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {codeOutput}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Audio element for playback */}
      <audio ref={audioPlaybackRef} className="hidden" />
    </div>
  );

  // Feedback phase - results and analysis with dynamic feedback
  const FeedbackPhase = () => (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Interview Complete!</h1>
        <p className="text-gray-600">Here's your detailed performance analysis</p>
      </div>

      {feedback && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Overall Score */}
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{feedback.score || 0}%</div>
            <div className="text-gray-600">Overall Score</div>
          </div>

          {/* Technical Skills */}
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">{feedback.feedback?.technicalSkills?.score || 0}%</div>
            <div className="text-gray-600">Technical Skills</div>
          </div>

          {/* Communication */}
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">{feedback.feedback?.communicationSkills?.score || 0}%</div>
            <div className="text-gray-600">Communication</div>
          </div>
        </div>
      )}

      {/* Detailed Feedback */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Detailed Analysis</h2>
        
        {feedback?.feedback && (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Technical Skills</h3>
              <p className="text-gray-600 mb-2">{feedback.feedback.technicalSkills?.feedback}</p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Communication Skills</h3>
              <p className="text-gray-600 mb-2">{feedback.feedback.communicationSkills?.feedback}</p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Problem Solving</h3>
              <p className="text-gray-600 mb-2">{feedback.feedback.problemSolving?.feedback}</p>
            </div>

            {feedback.feedback.recommendations && feedback.feedback.recommendations.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Recommendations for Improvement</h3>
                <ul className="space-y-1">
                  {feedback.feedback.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-600">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Question-by-question breakdown with dynamic feedback */}
      {responses && responses.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Question Breakdown</h2>
          <div className="space-y-4">
            {responses.map((response, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900">Question {index + 1}</h4>
                  <span className="text-sm font-medium text-blue-600">{response.feedback?.score || 0}%</span>
                </div>
                <p className="text-gray-600 text-sm mb-3">{mockQuestions[index]?.question}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-sm font-medium text-green-700 mb-1">Strengths</h5>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {(response.feedback?.strengths || []).length > 0 ? 
                        response.feedback.strengths.map((strength, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <CheckCircle className="w-3 h-3 text-green-500 mt-1 flex-shrink-0" />
                            {strength}
                          </li>
                        )) : 
                        <li className="flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 text-gray-400 mt-1 flex-shrink-0" />
                          <span className="text-gray-400">No specific strengths identified</span>
                        </li>
                      }
                    </ul>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-orange-700 mb-1">Areas for Improvement</h5>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {(response.feedback?.improvements || []).map((improvement, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 text-orange-500 mt-1 flex-shrink-0" />
                          {improvement}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {response.code && (
                  <div className="mt-3 p-3 bg-gray-50 rounded border">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Submitted Code:</h5>
                    <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap">{response.code}</pre>
                  </div>
                )}

                {(response.transcription || response.textResponse) && (
                  <div className="mt-3 p-3 bg-blue-50 rounded border">
                    <h5 className="text-sm font-medium text-blue-700 mb-2">
                      {response.transcription ? 'Audio Transcription:' : 'Written Response:'}
                    </h5>
                    <p className="text-sm text-blue-600">{response.transcription || response.textResponse}</p>
                  </div>
                )}

                {response.feedback?.detailedAnalysis && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded border">
                    <h5 className="text-sm font-medium text-yellow-700 mb-2">Detailed Analysis:</h5>
                    <p className="text-sm text-yellow-600">{response.feedback.detailedAnalysis}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-center gap-4 mt-8">
        <button
          onClick={() => {
            setCurrentStep('setup');
            setInterview(null);
            setCurrentQuestion(null);
            setQuestionIndex(0);
            setResponses([]);
            setFeedback(null);
            setInterviewData({ jobTitle: '', jobDescription: '', resumeText: '' });
            setCode('');
            setCodeOutput('');
            setShowCodeEditor(false);
            setAudioBlob(null);
            setRecordingTime(0);
            setTimer(0);
            setTextAnswer('');
            setTranscription('');
            setTranscriptionError('');
            setAnswerMode('audio');
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
        >
          Start New Interview
        </button>
        <button
          onClick={() => window.print()}
          className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
        >
          Print Report
        </button>
      </div>
    </div>
  );

  // Helper functions
  const isSetupValid = () => {
    return interviewData.jobTitle && interviewData.jobDescription && interviewData.resumeText;
  };

  const createInterview = async () => {
    if (!user) {
      setError('Please log in to start an interview');
      return;
    }

    setLoading(true);
    setError('');
    addDebugLog('Creating interview...');

    try {
      // Create interview with authenticated user
      const interviewResponse = await fetch('/api/interviews/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          jobTitle: interviewData.jobTitle,
          jobDescription: interviewData.jobDescription,
          resumeText: interviewData.resumeText
        })
      });

      const interviewResult = await interviewResponse.json();
      addDebugLog(`Interview creation response: ${interviewResult.success}`);
      
      if (!interviewResult.success) {
        throw new Error(interviewResult.error || 'Failed to create interview');
      }

      setInterview(interviewResult.interview);
      addDebugLog('Interview created successfully');
      
      // Start the interview
      await startInterview(interviewResult.interview.id);
      
    } catch (err) {
      addDebugLog(`Interview creation failed: ${err.message}`, 'error');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startInterview = async (interviewId) => {
    try {
      addDebugLog('Starting interview...');
      const response = await fetch(`/api/interviews/${interviewId}/start`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      const result = await response.json();
      addDebugLog(`Start interview response: ${result.success}`);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      // Use first mock question instead of API response
      const firstQuestion = mockQuestions[0];
      setCurrentQuestion(firstQuestion);
      setCode(firstQuestion.starterCode?.[language] || '');
      setShowCodeEditor(firstQuestion.type === 'technical_coding');
      setCurrentStep('interview');
      startTimer();
      addDebugLog('Interview started successfully');
      
    } catch (err) {
      addDebugLog(`Start interview failed: ${err.message}`, 'error');
      setError(err.message);
    }
  };

  const submitAnswer = async () => {
    const responseText = answerMode === 'audio' ? transcription : textAnswer;
    
    if (!responseText || responseText.trim().length === 0) {
      setError('Please provide a valid response before submitting');
      return;
    }

    setLoading(true);
    setError('');
    addDebugLog(`Submitting answer for question ${questionIndex + 1}...`);
    addDebugLog(`Response text length: ${responseText.length} characters`);

    try {
      // Generate dynamic feedback based on the actual user response
      const dynamicFeedback = generateDynamicFeedback(
        currentQuestion,
        { 
          code: currentQuestion.type === 'technical_coding' ? code : null,
          transcription: answerMode === 'audio' ? transcription : null,
          textResponse: answerMode === 'text' ? textAnswer : null
        },
        responseText,
        timer - (responses.length * 150) // rough estimate of time for this question
      );
      
      const response = {
        questionId: currentQuestion.questionId,
        question: currentQuestion.question,
        transcription: answerMode === 'audio' ? transcription : null,
        textResponse: answerMode === 'text' ? textAnswer : null,
        responseTime: timer - (responses.length * 150),
        code: currentQuestion.type === 'technical_coding' ? code : null,
        feedback: dynamicFeedback,
        answerMode: answerMode,
        timestamp: new Date().toISOString()
      };

      setResponses(prev => [...prev, response]);
      addDebugLog(`Answer submitted for question ${questionIndex + 1}`);

      // Move to next question or complete interview
      if (questionIndex < mockQuestions.length - 1) {
        const nextQuestion = mockQuestions[questionIndex + 1];
        setCurrentQuestion(nextQuestion);
        setQuestionIndex(prev => prev + 1);
        setAudioBlob(null);
        setRecordingTime(0);
        setTextAnswer('');
        setTranscription('');
        setTranscriptionError('');
        setCode(nextQuestion.starterCode?.[language] || '');
        setCodeOutput('');
        setShowCodeEditor(nextQuestion.type === 'technical_coding');
        addDebugLog(`Moved to question ${questionIndex + 2}`);
      } else {
        addDebugLog('Completing interview...');
        completeInterview();
      }
      
    } catch (err) {
      addDebugLog(`Submit answer failed: ${err.message}`, 'error');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const completeInterview = async () => {
    try {
      addDebugLog('Generating overall feedback...');
      
      // Calculate overall scores based on individual question feedback
      const avgScore = responses.length > 0 
        ? Math.round(responses.reduce((acc, r) => acc + (r.feedback?.score || 0), 0) / responses.length)
        : 0;

      const techQuestions = responses.filter(r => r.question && (
        mockQuestions.find(q => q.questionId === r.questionId)?.type?.includes('technical') ||
        mockQuestions.find(q => q.questionId === r.questionId)?.type?.includes('coding')
      ));
      
      const behavioralQuestions = responses.filter(r => r.question && (
        mockQuestions.find(q => q.questionId === r.questionId)?.type === 'behavioral'
      ));

      const techScore = techQuestions.length > 0 
        ? Math.round(techQuestions.reduce((acc, r) => acc + (r.feedback?.technicalAccuracy * 10 || r.feedback?.score || 0), 0) / techQuestions.length)
        : avgScore;

      const commScore = behavioralQuestions.length > 0 
        ? Math.round(behavioralQuestions.reduce((acc, r) => acc + (r.feedback?.communicationClarity * 10 || r.feedback?.score || 0), 0) / behavioralQuestions.length)
        : avgScore;

      // Aggregate all recommendations
      const allRecommendations = responses.reduce((acc, r) => {
        return [...acc, ...(r.feedback?.improvements || [])];
      }, []);

      // Remove duplicates and limit to top 5
      const uniqueRecommendations = [...new Set(allRecommendations)].slice(0, 5);

      const mockFeedback = {
        score: avgScore,
        feedback: {
          technicalSkills: {
            score: techScore,
            feedback: techScore >= 80 
              ? "Excellent technical knowledge with strong problem-solving skills and clear code implementation."
              : techScore >= 60 
              ? "Good technical foundation with room for improvement in code optimization and edge case handling."
              : techScore > 0
              ? "Basic technical understanding demonstrated. Focus on strengthening fundamental concepts and practice more coding problems."
              : "Technical skills need significant improvement. Focus on learning fundamental programming concepts."
          },
          communicationSkills: {
            score: commScore,
            feedback: commScore >= 80
              ? "Outstanding communication with clear, structured responses and excellent use of examples."
              : commScore >= 60
              ? "Good communication skills with clear explanations. Could benefit from more structured responses."
              : commScore > 0
              ? "Communication shows potential but needs improvement in clarity and organization of thoughts."
              : "Communication skills need significant development. Practice explaining concepts clearly and concisely."
          },
          problemSolving: {
            score: Math.round((techScore + commScore) / 2),
            feedback: avgScore >= 80
              ? "Excellent analytical approach with systematic problem-solving methodology."
              : avgScore >= 60
              ? "Good problem-solving approach with logical thinking. Continue practicing complex scenarios."
              : avgScore > 0
              ? "Shows basic problem-solving skills. Focus on developing more systematic approaches to complex problems."
              : "Problem-solving approach needs significant improvement. Practice breaking down problems step by step."
          },
          recommendations: uniqueRecommendations.length > 0 ? uniqueRecommendations : [
            "Practice more technical interviews with live coding",
            "Work on explaining thought process clearly while solving problems",
            "Build more projects to gain hands-on experience",
            "Practice behavioral questions using the STAR method"
          ]
        }
      };

      setFeedback(mockFeedback);
      setCurrentStep('feedback');
      stopTimer();
      addDebugLog(`Interview completed with overall score: ${avgScore}%`);
      
    } catch (err) {
      addDebugLog(`Complete interview failed: ${err.message}`, 'error');
      setError(err.message);
    }
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Initialize first question when starting interview
  useEffect(() => {
    if (currentQuestion && currentQuestion.starterCode) {
      setCode(currentQuestion.starterCode[language] || '');
    }
  }, [currentQuestion, language]);

  // Show loading while checking auth
  if (user === null && !error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading interview system...</p>
        </div>
      </div>
    );
  }

  // Render current step
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'setup':
        return <SetupPhase />;
      case 'interview':
        return <InterviewPhase />;
      case 'feedback':
        return <FeedbackPhase />;
      default:
        return <SetupPhase />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {renderCurrentStep()}
    </div>
  );
};

export default MockInterviewSystem;
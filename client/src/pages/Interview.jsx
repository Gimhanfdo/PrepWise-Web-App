import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  const [answerMode, setAnswerMode] = useState('audio');
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

  // Memoize mock questions to prevent re-creation
  const mockQuestions = useMemo(() => [
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
  ], []);

  // Debug logger - memoized to prevent re-creation
  const addDebugLog = useCallback((message, type = 'info') => {
    const log = {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    setDebugLogs(prev => [...prev.slice(-50), log]);
    console.log(`[${type.toUpperCase()}] ${message}`);
  }, []);

  // Memoize handler functions to prevent re-creation
  const handleJobTitleChange = useCallback((e) => {
    setInterviewData(prev => ({ ...prev, jobTitle: e.target.value }));
  }, []);

  const handleJobDescriptionChange = useCallback((e) => {
    setInterviewData(prev => ({ ...prev, jobDescription: e.target.value }));
  }, []);

  const handleResumeTextChange = useCallback((e) => {
    setInterviewData(prev => ({ ...prev, resumeText: e.target.value }));
  }, []);

  const handleTextAnswerChange = useCallback((e) => {
    setTextAnswer(e.target.value);
  }, []);

  const handleCodeChange = useCallback((e) => {
    setCode(e.target.value);
  }, []);

  const handleTranscriptionChange = useCallback((e) => {
    setTranscription(e.target.value);
  }, []);

  const handleLanguageChange = useCallback((e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    setCode(currentQuestion?.starterCode?.[newLanguage] || '');
    setCodeOutput('');
  }, [currentQuestion]);

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

  // Audio Recording Functions
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
        transcribeAudio(blob);
      };

      mediaRecorder.onerror = (event) => {
        addDebugLog(`MediaRecorder error: ${event.error.message}`, 'error');
        setAudioError(`Recording error: ${event.error.message}`);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      addDebugLog('Recording started successfully');

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

  // Code execution
  const executeCode = () => {
    try {
      setCodeOutput('Running code...\n');
      addDebugLog('Executing code...');
      
      if (language === 'javascript') {
        const originalLog = console.log;
        let output = '';
        
        console.log = (...args) => {
          output += args.join(' ') + '\n';
        };
        
        try {
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

  // Helper functions
  const isSetupValid = useCallback(() => {
    return interviewData.jobTitle && interviewData.jobDescription && interviewData.resumeText;
  }, [interviewData]);

  const createInterview = useCallback(async () => {
    if (!user) {
      setError('Please log in to start an interview');
      return;
    }

    setLoading(true);
    setError('');
    addDebugLog('Creating interview...');

    try {
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
      
      await startInterview(interviewResult.interview.id);
      
    } catch (err) {
      addDebugLog(`Interview creation failed: ${err.message}`, 'error');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, interviewData, addDebugLog]);

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

    try {
      const response = {
        questionId: currentQuestion.questionId,
        question: currentQuestion.question,
        transcription: answerMode === 'audio' ? transcription : null,
        textResponse: answerMode === 'text' ? textAnswer : null,
        responseTime: timer - (responses.length * 150),
        code: currentQuestion.type === 'technical_coding' ? code : null,
        answerMode: answerMode,
        timestamp: new Date().toISOString()
      };

      setResponses(prev => [...prev, response]);
      addDebugLog(`Answer submitted for question ${questionIndex + 1}`);

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
      
      const mockFeedback = {
        score: 75,
        feedback: {
          technicalSkills: {
            score: 78,
            feedback: "Good technical foundation with room for improvement in code optimization."
          },
          communicationSkills: {
            score: 82,
            feedback: "Clear communication with well-structured responses."
          },
          problemSolving: {
            score: 70,
            feedback: "Good analytical approach. Continue practicing complex scenarios."
          },
          recommendations: [
            "Practice more coding problems",
            "Work on time management",
            "Improve algorithm complexity analysis"
          ]
        }
      };

      setFeedback(mockFeedback);
      setCurrentStep('feedback');
      stopTimer();
      addDebugLog(`Interview completed with overall score: 75%`);
      
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

  const resetInterview = useCallback(() => {
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
  }, []);

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

  useEffect(() => {
    if (currentQuestion && currentQuestion.starterCode) {
      setCode(currentQuestion.starterCode[language] || '');
    }
  }, [currentQuestion, language]);

  // Memoized components to prevent unnecessary re-renders
  const SetupPhase = useMemo(() => (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mock Interview Setup</h1>
        <p className="text-gray-600">
          Welcome {user?.name || 'User'}! Set up your software engineering internship mock interview
        </p>
      </div>

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
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Job Title *</label>
          <input
            type="text"
            value={interviewData.jobTitle}
            onChange={handleJobTitleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Software Engineering Intern"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Job Description *</label>
          <textarea
            value={interviewData.jobDescription}
            onChange={handleJobDescriptionChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32"
            placeholder="Paste the complete job description here..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Resume Content *</label>
          <textarea
            value={interviewData.resumeText}
            onChange={handleResumeTextChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-40"
            placeholder="Paste your resume text here..."
          />
        </div>

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
  ), [user, interviewData, debugMode, debugLogs, audioPermission, audioError, error, loading, isSetupValid, createInterview, handleJobTitleChange, handleJobDescriptionChange, handleResumeTextChange]);

  const InterviewPhase = useMemo(() => (
    <div className="max-w-6xl mx-auto p-6">
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

          {answerMode === 'audio' && (
            <div className="space-y-4">
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

              {transcription && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Transcription:</h4>
                  <p className="text-sm text-blue-700">{transcription}</p>
                </div>
              )}

              {transcriptionError && audioBlob && answerMode === 'audio' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-medium text-yellow-800 mb-2">Manual Transcription:</h4>
                  <p className="text-sm text-yellow-700 mb-2">Please type what you said in the recording:</p>
                  <textarea
                    value={transcription}
                    onChange={handleTranscriptionChange}
                    className="w-full h-24 px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 resize-none"
                    placeholder="Type your audio response here..."
                  />
                </div>
              )}
            </div>
          )}

          {answerMode === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Written Response:</label>
                <textarea
                  value={textAnswer}
                  onChange={handleTextAnswerChange}
                  className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                  placeholder="Type your answer here..."
                />
              </div>
              <div className="text-sm text-gray-500">
                Characters: {textAnswer.length} | Words: {textAnswer.split(' ').filter(word => word.length > 0).length}
              </div>
            </div>
          )}

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

        {showCodeEditor && currentQuestion?.type === 'technical_coding' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Code Editor</h3>
              <div className="flex items-center gap-2">
                <select
                  value={language}
                  onChange={handleLanguageChange}
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
                  onChange={handleCodeChange}
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

      <audio ref={audioPlaybackRef} className="hidden" />
    </div>
  ), [questionIndex, mockQuestions.length, timer, currentQuestion, answerMode, isRecording, loading, audioBlob, isPlaying, recordingTime, audioError, isTranscribing, transcriptionError, transcription, textAnswer, error, debugMode, debugLogs, showCodeEditor, language, code, codeOutput, handleTranscriptionChange, handleTextAnswerChange, handleCodeChange, handleLanguageChange]);

  const FeedbackPhase = useMemo(() => (
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
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{feedback.score || 0}%</div>
            <div className="text-gray-600">Overall Score</div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">{feedback.feedback?.technicalSkills?.score || 0}%</div>
            <div className="text-gray-600">Technical Skills</div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">{feedback.feedback?.communicationSkills?.score || 0}%</div>
            <div className="text-gray-600">Communication</div>
          </div>
        </div>
      )}

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

      {responses && responses.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Question Breakdown</h2>
          <div className="space-y-4">
            {responses.map((response, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900">Question {index + 1}</h4>
                  <span className="text-sm font-medium text-blue-600">Completed</span>
                </div>
                <p className="text-gray-600 text-sm mb-3">{mockQuestions[index]?.question}</p>
                
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
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center gap-4 mt-8">
        <button
          onClick={resetInterview}
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
  ), [feedback, responses, mockQuestions, resetInterview]);

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
        return SetupPhase;
      case 'interview':
        return InterviewPhase;
      case 'feedback':
        return FeedbackPhase;
      default:
        return SetupPhase;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {renderCurrentStep()}
    </div>
  );
};

export default MockInterviewSystem;
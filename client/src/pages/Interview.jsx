import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Play, Pause, ChevronRight, Clock, User, FileText, BarChart3, CheckCircle, AlertCircle, Volume2, Code, Terminal, Send } from 'lucide-react';

const MockInterviewSystem = () => {
  // State management
  const [currentStep, setCurrentStep] = useState('setup'); // setup, interview, feedback
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
  
  // Audio recording improvements
  const [audioStream, setAudioStream] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Coding environment state
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [codeOutput, setCodeOutput] = useState('');
  const [showCodeEditor, setShowCodeEditor] = useState(false);

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const timerRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioPlaybackRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  // Check authentication on component mount
  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      console.log('Checking authentication...');
      
      const response = await fetch('/api/auth/is-auth', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      console.log('Content-Type:', contentType);

      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.log('Non-JSON response:', textResponse.substring(0, 500));
        throw new Error('Server returned HTML instead of JSON. Check if the API endpoint exists and is working properly.');
      }

      const result = await response.json();
      console.log('Auth response:', result);
      
      if (result.success && result.user) {
        setUser(result.user);
        setError(''); // Clear any previous errors
      } else {
        setError(result.message || 'Please log in to access the mock interview system.');
      }
    } catch (err) {
      console.error('Authentication check failed:', err);
      setError(`Authentication failed: ${err.message}`);
    }
  };

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

  // Audio Recording Functions with Better Error Handling
  const initializeAudio = async () => {
    try {
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

      setAudioStream(stream);
      audioStreamRef.current = stream;

      // Create audio context for better control
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      setError('');

      return stream;
    } catch (err) {
      console.error('Audio initialization failed:', err);
      throw new Error(`Microphone access failed: ${err.message}`);
    }
  };

  const startRecording = async () => {
    try {
      setError('');
      let stream = audioStream;
      
      if (!stream) {
        stream = await initializeAudio();
      }

      // Clear previous recording
      setAudioBlob(null);
      setAudioChunks([]);
      setRecordingTime(0);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        console.log('Recording stopped, blob size:', blob.size);
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        setError(`Recording error: ${event.error.message}`);
      };

      mediaRecorder.start(250); // Collect data every 250ms
      setIsRecording(true);

      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Start recording failed:', err);
      setError(err.message);
    }
  };

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
      }
    } catch (err) {
      console.error('Stop recording failed:', err);
      setError('Failed to stop recording');
    }
  };

  const playRecording = async () => {
    if (!audioBlob) return;

    try {
      if (isPlaying) {
        audioPlaybackRef.current.pause();
        setIsPlaying(false);
        return;
      }

      const url = URL.createObjectURL(audioBlob);
      audioPlaybackRef.current.src = url;
      
      audioPlaybackRef.current.onplay = () => setIsPlaying(true);
      audioPlaybackRef.current.onpause = () => setIsPlaying(false);
      audioPlaybackRef.current.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };
      
      await audioPlaybackRef.current.play();
    } catch (err) {
      console.error('Playback failed:', err);
      setError('Failed to play recording');
    }
  };

  // Code Execution Functions
  const executeCode = () => {
    try {
      setCodeOutput('Running code...\n');
      
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
      } else {
        setCodeOutput(`Code execution for ${language} is simulated in this demo.\nYour code would be executed on the server.\n\nCode submitted:\n${code}`);
      }
    } catch (error) {
      setCodeOutput(`Execution Error: ${error.message}`);
    }
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
            onChange={(e) => setInterviewData({...interviewData, jobTitle: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Software Engineering Intern"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Job Description *</label>
          <textarea
            value={interviewData.jobDescription}
            onChange={(e) => setInterviewData({...interviewData, jobDescription: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32"
            placeholder="Paste the complete job description here..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Resume Content *</label>
          <textarea
            value={interviewData.resumeText}
            onChange={(e) => setInterviewData({...interviewData, resumeText: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-40"
            placeholder="Paste your resume text here..."
          />
        </div>

        {/* Audio permission test */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Audio Test</h4>
          <p className="text-sm text-blue-700 mb-3">Test your microphone before starting the interview:</p>
          <button
            onClick={initializeAudio}
            disabled={!!audioStream}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-green-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {audioStream ? '✓ Microphone Ready' : 'Test Microphone'}
          </button>
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

  // Enhanced Interview phase with coding environment
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
              <p className="text-sm text-green-600 mb-4">✓ Response recorded ({Math.round(audioBlob.size / 1024)}KB)</p>
            )}
          </div>

          {/* Submit answer button */}
          {audioBlob && (
            <div className="flex justify-center">
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

  // Feedback phase - results and analysis
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

      {/* Question-by-question breakdown */}
      {responses && responses.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Question Breakdown</h2>
          <div className="space-y-4">
            {responses.map((response, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900">Question {index + 1}</h4>
                  <span className="text-sm font-medium text-blue-600">{85 - (index * 5)}%</span>
                </div>
                <p className="text-gray-600 text-sm mb-3">{mockQuestions[index]?.question}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-sm font-medium text-green-700 mb-1">Strengths</h5>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li className="flex items-start gap-1">
                        <CheckCircle className="w-3 h-3 text-green-500 mt-1 flex-shrink-0" />
                        Clear communication and structure
                      </li>
                      <li className="flex items-start gap-1">
                        <CheckCircle className="w-3 h-3 text-green-500 mt-1 flex-shrink-0" />
                        Good understanding of concepts
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-orange-700 mb-1">Areas for Improvement</h5>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li className="flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 text-orange-500 mt-1 flex-shrink-0" />
                        Consider edge cases more thoroughly
                      </li>
                      <li className="flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 text-orange-500 mt-1 flex-shrink-0" />
                        Optimize time complexity
                      </li>
                    </ul>
                  </div>
                </div>

                {response.code && (
                  <div className="mt-3 p-3 bg-gray-50 rounded border">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Submitted Code:</h5>
                    <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap">{response.code}</pre>
                  </div>
                )}

                {response.transcription && (
                  <div className="mt-3 p-3 bg-blue-50 rounded border">
                    <h5 className="text-sm font-medium text-blue-700 mb-2">Audio Transcription:</h5>
                    <p className="text-sm text-blue-600">{response.transcription}</p>
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
      
      if (!interviewResult.success) {
        throw new Error(interviewResult.error || 'Failed to create interview');
      }

      setInterview(interviewResult.interview);
      
      // Start the interview
      await startInterview(interviewResult.interview.id);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startInterview = async (interviewId) => {
    try {
      const response = await fetch(`/api/interviews/${interviewId}/start`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error);
      }

      setCurrentQuestion(result.firstQuestion);
      setCode(result.firstQuestion.starterCode?.[language] || '');
      setShowCodeEditor(result.firstQuestion.type === 'technical_coding');
      setCurrentStep('interview');
      startTimer();
      
    } catch (err) {
      setError(err.message);
    }
  };

  const submitAnswer = async () => {
    if (!audioBlob || !currentQuestion) return;

    setLoading(true);
    setError('');

    try {
      // Simulate answer processing with transcription
      console.log('Processing audio blob:', audioBlob.size, 'bytes');
      
      // Mock transcription (in real app, this would be sent to backend)
      const mockTranscriptions = [
        "Hi, my name is John and I'm really excited about this software engineering internship opportunity. I've been programming for about 3 years and have experience with JavaScript, Python, and React.",
        "For the two sum problem, I'll use a hash map approach. I'll iterate through the array once and for each number, check if the complement exists in my hash map.",
        "One challenging project I worked on was building a full-stack web application for my university. The main obstacle was handling real-time data synchronization between multiple users.",
        "Synchronous programming executes code line by line, blocking until each operation completes. Asynchronous programming allows other code to run while waiting for operations to complete."
      ];
      
      const response = {
        questionId: currentQuestion.questionId,
        audioBlob: audioBlob,
        transcription: mockTranscriptions[questionIndex] || "Mock transcription of the user's response.",
        code: currentQuestion.type === 'technical_coding' ? code : null,
        timestamp: new Date().toISOString()
      };

      setResponses(prev => [...prev, response]);

      // Move to next question or complete interview
      if (questionIndex < mockQuestions.length - 1) {
        const nextQuestion = mockQuestions[questionIndex + 1];
        setCurrentQuestion(nextQuestion);
        setQuestionIndex(prev => prev + 1);
        setAudioBlob(null);
        setRecordingTime(0);
        setCode(nextQuestion.starterCode?.[language] || '');
        setCodeOutput('');
        setShowCodeEditor(nextQuestion.type === 'technical_coding');
      } else {
        completeInterview();
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const completeInterview = async () => {
    try {
      // Mock feedback generation
      const mockFeedback = {
        score: 85,
        feedback: {
          technicalSkills: {
            score: 82,
            feedback: "Strong problem-solving approach with good code structure. Consider optimizing time complexity in coding challenges."
          },
          communicationSkills: {
            score: 88,
            feedback: "Clear articulation of ideas with good examples. Excellent at explaining complex concepts."
          },
          problemSolving: {
            score: 85,
            feedback: "Good analytical thinking and systematic approach to breaking down problems."
          },
          recommendations: [
            "Practice more advanced algorithms and data structures",
            "Work on explaining code while writing it",
            "Consider edge cases more thoroughly in technical questions",
            "Improve time complexity analysis skills"
          ]
        }
      };

      setFeedback(mockFeedback);
      setCurrentStep('feedback');
      stopTimer();
      
    } catch (err) {
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
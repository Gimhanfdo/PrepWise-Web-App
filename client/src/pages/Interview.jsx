import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Play, Pause, ChevronRight, Clock, User, FileText, BarChart3, CheckCircle, AlertCircle, Volume2 } from 'lucide-react';

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

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const timerRef = useRef(null);
  const audioPlaybackRef = useRef(null);

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

  // Setup phase - collect job details (user info already available)
  const SetupPhase = () => (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mock Interview Setup</h1>
        <p className="text-gray-600">
          Welcome {user?.name || 'User'}! Set up your software engineering internship mock interview
        </p>
      </div>

      <div className="space-y-4">
        {/* User info display (read-only) */}
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
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Job Description *</label>
          <textarea
            value={interviewData.jobDescription}
            onChange={(e) => setInterviewData({...interviewData, jobDescription: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32"
            placeholder="Paste the complete job description here..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Resume Content *</label>
          <textarea
            value={interviewData.resumeText}
            onChange={(e) => setInterviewData({...interviewData, resumeText: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-40"
            placeholder="Paste your resume text here..."
            required
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Debug information */}
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Debug Info:</h4>
          <div className="text-xs text-gray-600">
            <p>User loaded: {user ? 'Yes' : 'No'}</p>
            {user && (
              <>
                <p>User ID: {user.id || user._id}</p>
                <p>Account Plan: {user.accountPlan}</p>
              </>
            )}
            <p>Setup valid: {isSetupValid() ? 'Yes' : 'No'}</p>
          </div>
        </div>

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

  // Interview phase - questions and recording
  const InterviewPhase = () => (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Question {questionIndex + 1} of {interview?.questions?.length || 0}</span>
          <span className="text-sm text-gray-500">
            <Clock className="w-4 h-4 inline mr-1" />
            {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((questionIndex + 1) / (interview?.questions?.length || 1)) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Current question */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            currentQuestion?.type === 'technical' ? 'bg-purple-100 text-purple-600' :
            currentQuestion?.type === 'behavioral' ? 'bg-green-100 text-green-600' :
            'bg-blue-100 text-blue-600'
          }`}>
            <FileText className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                currentQuestion?.type === 'technical' ? 'bg-purple-100 text-purple-700' :
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

        {/* Recording controls */}
        <div className="flex items-center justify-center gap-4 py-8">
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
              className="w-12 h-12 bg-gray-500 hover:bg-gray-600 text-white rounded-full flex items-center justify-center"
            >
              <Play className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="text-center">
          <p className="text-gray-600 mb-2">
            {isRecording ? 'Recording your response...' : 'Click the microphone to start recording'}
          </p>
          {audioBlob && (
            <p className="text-sm text-green-600 mb-4">✓ Response recorded successfully</p>
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
                  Submit Answer
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Audio element for playback */}
      <audio ref={audioPlaybackRef} controls className="hidden" />
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
                  <span className="text-sm font-medium text-blue-600">{response.feedback?.score || 0}%</span>
                </div>
                <p className="text-gray-600 text-sm mb-3">{response.question}</p>
                
                {response.feedback && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-sm font-medium text-green-700 mb-1">Strengths</h5>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {response.feedback.strengths?.map((strength, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <CheckCircle className="w-3 h-3 text-green-500 mt-1 flex-shrink-0" />
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-orange-700 mb-1">Areas for Improvement</h5>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {response.feedback.improvements?.map((improvement, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 text-orange-500 mt-1 flex-shrink-0" />
                            {improvement}
                          </li>
                        ))}
                      </ul>
                    </div>
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
      setCurrentStep('interview');
      startTimer();
      
    } catch (err) {
      setError(err.message);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setAudioBlob(blob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setError('');
      
    } catch (err) {
      setError('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playRecording = () => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      audioPlaybackRef.current.src = url;
      audioPlaybackRef.current.play();
    }
  };

  const submitAnswer = async () => {
    if (!audioBlob || !interview || !currentQuestion) return;

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('questionId', currentQuestion.questionId);
      formData.append('responseTime', timer);

      const response = await fetch(`/api/interviews/${interview.id}/answer`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error);
      }

      // Add response to local state
      setResponses(prev => [...prev, result]);

      // Get next question or complete interview
      const nextQuestionResponse = await fetch(`/api/interviews/${interview.id}/next-question`, {
        credentials: 'include'
      });
      const nextQuestionResult = await nextQuestionResponse.json();

      if (nextQuestionResult.completed) {
        await completeInterview();
      } else {
        setCurrentQuestion(nextQuestionResult.question);
        setQuestionIndex(prev => prev + 1);
        setAudioBlob(null);
        setTimer(0);
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const completeInterview = async () => {
    try {
      const response = await fetch(`/api/interviews/${interview.id}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error);
      }

      // Get detailed feedback
      const feedbackResponse = await fetch(`/api/interviews/${interview.id}/feedback`, {
        credentials: 'include'
      });
      const feedbackResult = await feedbackResponse.json();
      
      if (feedbackResult.success) {
        setFeedback(feedbackResult.feedback);
      }

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
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Show loading while checking auth
  if (user === null && !error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!user && error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.href = '/login'}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Go to Login
          </button>
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
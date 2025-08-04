import React, { useState, useCallback } from "react";
import { CheckCircle, XCircle, AlertTriangle, Lightbulb, FileText, Layout, Target, BarChart3 } from "lucide-react";

// Import the corrected SWOT component
import SWOTAnalysis from "./SWOTAnalysis";

// API Configuration - Update these URLs to match your backend
const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:4000'; // For Vite
// Alternative for Create React App: const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const API_ENDPOINTS = {
  analyzeResume: `${API_BASE_URL}/api/analyze/analyze-resume`, // Fixed: added /api/analyze prefix
  saveAnalysis: `${API_BASE_URL}/api/analyze/save`,            // Fixed: added /api/analyze prefix
};

// Renders a circular progress bar with percentage label and color
const CircularProgress = ({ percentage, label, colorIndex = 0 }) => {
  const colors = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#06B6D4",
  ];
  const color = colors[colorIndex % colors.length];
  const strokeDasharray = 2 * Math.PI * 45;
  const strokeDashoffset =
    strokeDasharray - (strokeDasharray * percentage) / 100;

  return (
    <div className="flex flex-col items-center p-4">
      <div className="relative w-24 h-24">
        <svg className="transform -rotate-90 w-24 h-24">
          <circle
            cx="48"
            cy="48"
            r="45"
            stroke="#E5E7EB"
            strokeWidth="6"
            fill="none"
          />
          <circle
            cx="48"
            cy="48"
            r="45"
            stroke={color}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-300 ease-in-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold" style={{ color }}>
            {percentage}%
          </span>
        </div>
      </div>
      <span className="mt-2 text-sm font-medium text-gray-600">{label}</span>
    </div>
  );
};

// Component for displaying structured recommendations
const StructuredRecommendations = ({ result, index }) => {
  const [activeTab, setActiveTab] = useState('strengths');

  if (result.isNonTechRole) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
        <div className="flex items-center mb-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
          <h3 className="font-semibold text-yellow-800">Non-Technical Role Detected</h3>
        </div>
        <p className="text-yellow-700">{result.message}</p>
      </div>
    );
  }

  const tabs = [
    { id: 'strengths', label: 'Strengths', icon: CheckCircle, color: 'text-green-600' },
    { id: 'content', label: 'Content Issues', icon: FileText, color: 'text-orange-600' },
    { id: 'structure', label: 'Structure Issues', icon: Layout, color: 'text-red-600' },
    { id: 'recommendations', label: 'Recommendations', icon: Lightbulb, color: 'text-blue-600' }
  ];

  const renderList = (items, icon, colorClass) => {
    if (!items || items.length === 0) {
      return (
        <div className="text-gray-500 italic text-center py-4">
          No items available for this category
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${colorClass}`} />
            <span className="text-gray-700 leading-relaxed">{item}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'strengths':
        return renderList(result.strengths, CheckCircle, 'text-green-600');
      case 'content':
        return renderList(result.contentWeaknesses, FileText, 'text-orange-600');
      case 'structure':
        return renderList(result.structureWeaknesses, Layout, 'text-red-600');
      case 'recommendations':
        const allRecommendations = [
          ...(result.contentRecommendations || []).map(rec => ({ text: rec, type: 'content' })),
          ...(result.structureRecommendations || []).map(rec => ({ text: rec, type: 'structure' }))
        ];
        return (
          <div className="space-y-3">
            {allRecommendations.length === 0 ? (
              <div className="text-gray-500 italic text-center py-4">
                No recommendations available
              </div>
            ) : (
              allRecommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      rec.type === 'content' 
                        ? 'bg-orange-100 text-orange-700' 
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {rec.type}
                    </span>
                  </div>
                  <span className="text-gray-700 leading-relaxed">{rec.text}</span>
                </div>
              ))
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white p-6 shadow-sm border rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Job Description {index + 1}</h3>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            result.matchPercentage >= 80
              ? "bg-green-100 text-green-800"
              : result.matchPercentage >= 60
              ? "bg-yellow-100 text-yellow-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          Match Score: {result.matchPercentage}%
        </span>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 mb-6 bg-gray-100 p-1 rounded-lg">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${activeTab === tab.id ? tab.color : 'text-gray-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {renderTabContent()}
      </div>
    </div>
  );
};

const CVAnalyzer = () => {
  // State to store uploaded resume file
  const [resumeFile, setResumeFile] = useState(null);
  // State to hold multiple job descriptions
  const [jobDescriptions, setJobDescriptions] = useState([""]);
  // State to store analysis results returned from API
  const [results, setResults] = useState([]);
  // Loading indicator state while waiting for API response
  const [loading, setLoading] = useState(false);
  // Error message state for validation and API errors
  const [error, setError] = useState(null);
  // State to track drag-and-drop UI state
  const [dragActive, setDragActive] = useState(false);
  // State to store extracted resume text and hash for SWOT analysis
  const [resumeData, setResumeData] = useState(null); // { resumeText, resumeHash }
  // State to control which view to show
  const [currentView, setCurrentView] = useState('analysis'); // 'analysis' or 'swot'

  // File validation
  const validateFile = (file) => {
    if (!file) return { valid: false, error: "No file selected" };

    if (file.type !== "application/pdf") {
      return { valid: false, error: "Only PDF files are allowed" };
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      return { valid: false, error: "File size must be less than 10MB" };
    }

    return { valid: true };
  };

  // Handle user selecting a file manually or via drag and drop
  const handleFileChange = (file) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error);
      setResumeFile(null);
      return;
    }

    setError(null);
    setResumeFile(file);
  };

  // Drag event handler for dragenter and dragover events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  // Handle file dropped via drag and drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  }, []);

  // Update a specific job description in the list when user types
  const handleJDChange = (index, value) => {
    const updated = [...jobDescriptions];
    updated[index] = value;
    setJobDescriptions(updated);

    if (error && value.trim()) {
      setError(null);
    }
  };

  // Add a new empty job description input
  const addJD = () => {
    if (jobDescriptions.length < 5) {
      setJobDescriptions([...jobDescriptions, ""]);
    }
  };

  // Remove a job description input by index
  const removeJD = (index) => {
    if (jobDescriptions.length > 1) {
      setJobDescriptions(jobDescriptions.filter((_, i) => i !== index));
    }
  };

  // Function for form validation
  const validateForm = () => {
    if (!resumeFile) {
      setError("Please upload a PDF resume");
      return false;
    }

    if (jobDescriptions.some((jd) => jd.trim() === "")) {
      setError("Please fill in all job descriptions");
      return false;
    }

    if (jobDescriptions.some((jd) => jd.trim().length < 50)) {
      setError("Job descriptions should be at least 50 characters long");
      return false;
    }

    return true;
  };

  // Helper function to extract text from PDF (placeholder)
  const extractTextFromPDF = async (file) => {
    // Placeholder since actual text extraction happens on the backend
    return `Resume content from ${file.name}`;
  };

    // In the handleAnalyze function, replace the resume text extraction section:

const handleAnalyze = async () => {
  setError(null);

  if (!validateForm()) return;

  setLoading(true);
  setResults([]);

  try {
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('resume', resumeFile);
    formData.append('jobDescriptions', JSON.stringify(jobDescriptions.filter(jd => jd.trim())));

    console.log("Making API call to", API_ENDPOINTS.analyzeResume);

    // Make API call with credentials to include cookies
    const response = await fetch(API_ENDPOINTS.analyzeResume, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } else {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        }
      } catch (parseError) {
        console.warn("Could not parse error response:", parseError);
      }
      
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Server returned non-JSON response');
    }

    const responseText = await response.text();
    console.log("Raw response:", responseText);

    if (!responseText.trim()) {
      throw new Error('Server returned empty response');
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      throw new Error('Invalid JSON response from server');
    }

    console.log("Parsed response data:", data);
    
    if (!data || !data.analysis) {
      throw new Error('Invalid response format: missing analysis data');
    }
    
    // FIXED: Get resume text from API response instead of placeholder
    const resumeHash = `resume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    setResumeData({
      // Try to get resume text from API response, fallback to filename if not available
      resumeText: data.resumeText || data.metadata?.resumeText || `Resume: ${resumeFile.name}`,
      resumeHash: resumeHash,
      jobDescriptions: jobDescriptions.filter(jd => jd.trim()),
      // Also pass any extracted technologies if available
      extractedTechnologies: data.extractedTechnologies || data.metadata?.technologies || []
    });

    setResults(data.analysis);

  } catch (err) {
    console.error("Analyze Error:", err);
    
    let userMessage = "Failed to analyze resume. ";
    
    if (err.message.includes('404')) {
      userMessage += "The analysis service is not available. Please check if the backend server is running on the correct port.";
    } else if (err.message.includes('401') || err.message.includes('403')) {
      userMessage += "You are not authorized. Please log in again.";
    } else if (err.message.includes('500')) {
      userMessage += "Server error occurred. Please try again later.";
    } else if (err.message.includes('Failed to fetch') || err.message.includes('TypeError: NetworkError')) {
      userMessage += "Network error. Please check your connection and ensure the backend server is running.";
    } else {
      userMessage += err.message;
    }
    
    setError(userMessage);
  } finally {
    setLoading(false);
  }
};
  // Track indices of saved analysis to disable multiple saves of the same result
  const [savedIndices, setSavedIndices] = useState([]);

 const handleSaveIndividualAnalysis = async (index) => {
  if (!resumeFile || !results[index] || savedIndices.includes(index)) return;

  try {
    const saveData = {
      resumeName: resumeFile.name,
      jobDescriptions: jobDescriptions.filter(jd => jd.trim()),
      results: [results[index]],
      resumeHash: resumeData?.resumeHash
    };

    const response = await fetch(API_ENDPOINTS.saveAnalysis, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Remove Authorization header
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify(saveData)
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        }
      } catch (parseError) {
        console.warn("Could not parse save error response:", parseError);
      }
      
      throw new Error(errorMessage);
    }

    setSavedIndices((prev) => [...prev, index]);
  } catch (err) {
    console.error("Save error:", err);
    alert(`Error saving analysis: ${err.message}`);
  }
};

  // Navigate to SWOT analysis
  const handleNavigateToSWOT = () => {
    if (!resumeData) {
      setError("No resume analysis available for SWOT analysis. Please analyze your resume first.");
      return;
    }

    setCurrentView('swot');
  };

  // Clear all data
  const handleClear = () => {
    setResumeFile(null);
    setJobDescriptions([""]);
    setResults([]);
    setError(null);
    setResumeData(null);
    setSavedIndices([]);
    setCurrentView('analysis');
  };

  // Handle back navigation from SWOT
  const handleBackFromSWOT = () => {
    setCurrentView('analysis');
  };

  // If in SWOT view, render SWOT component
  if (currentView === 'swot') {
    return (
      <SWOTAnalysis 
        resumeHash={resumeData?.resumeHash}
        resumeText={resumeData?.resumeText}
        jobDescriptions={resumeData?.jobDescriptions || []}
        onBack={handleBackFromSWOT}
      />
    );
  }

  return (
    <div className="flex flex-col lg:flex-row p-6 gap-6 min-h-screen bg-gray-50 text-gray-800">
      {/* Left Column */}
      <div className="w-full lg:w-1/3 space-y-6">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* File Upload */}
        <div>
          <label className="block font-semibold mb-3 text-gray-700">
            Upload Resume (PDF only)
          </label>
          <div
            className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive
                ? "border-blue-400 bg-blue-50"
                : resumeFile
                ? "border-green-400 bg-green-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".pdf"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => handleFileChange(e.target.files[0])}
            />

            {resumeFile ? (
              <div className="space-y-2">
                <svg
                  className="w-8 h-8 mx-auto text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="font-medium text-green-700">{resumeFile.name}</p>
                <p className="text-sm text-green-600">
                  {(resumeFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <svg
                  className="w-8 h-8 mx-auto text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-gray-600">
                  <span className="font-medium text-blue-600">
                    Click to upload
                  </span>{" "}
                  or drag and drop
                </p>
                <p className="text-xs text-gray-500">PDF files up to 10MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Job Descriptions */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="block font-semibold text-gray-700">
              Job Descriptions
            </label>
            <span className="text-sm text-gray-500">
              {jobDescriptions.length}/5
            </span>
          </div>

          <div className="space-y-3">
            {jobDescriptions.map((jd, index) => (
              <div key={index} className="relative">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <textarea
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                      rows="4"
                      placeholder={`Enter job description ${index + 1}`}
                      value={jd}
                      onChange={(e) => handleJDChange(index, e.target.value)}
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-400">
                        JD {index + 1}
                      </span>
                      <span
                        className={`text-xs ${
                          jd.length < 50 ? "text-orange-500" : "text-green-500"
                        }`}
                      >
                        {jd.length} characters
                      </span>
                    </div>
                  </div>

                  {jobDescriptions.length > 1 && (
                    <button
                      onClick={() => removeJD(index)}
                      className="self-start mt-1 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      title="Remove this job description"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {jobDescriptions.length < 5 && (
            <button
              onClick={addJD}
              className="w-full mt-3 p-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              + Add Another Job Description
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleAnalyze}
            disabled={
              loading ||
              !resumeFile ||
              jobDescriptions.some((jd) => jd.trim() === "")
            }
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
              loading ||
              !resumeFile ||
              jobDescriptions.some((jd) => jd.trim() === "")
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Analyzing...
              </div>
            ) : (
              "Analyze Resume"
            )}
          </button>

          {(resumeFile || jobDescriptions.some((jd) => jd.trim())) && (
            <button
              onClick={handleClear}
              disabled={loading}
              className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Right Column */}
      <div className="w-full lg:w-2/3 space-y-6 overflow-y-auto max-h-[90vh]">
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <svg
                className="animate-spin h-12 w-12 mx-auto text-blue-600 mb-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                Analyzing Resume
              </h3>
              <p className="text-gray-500">This may take a few moments...</p>
            </div>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            {/* Match Scores */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Match Scores
              </h2>
              <div
                className={`grid gap-4 ${
                  results.length > 2 ? "grid-cols-3" : "grid-cols-2"
                }`}
              >
                {results.map((res, idx) => (
                  <CircularProgress
                    key={idx}
                    percentage={res.matchPercentage || 0}
                    label={`JD ${idx + 1}`}
                    colorIndex={idx}
                  />
                ))}
              </div>
            </div>

            {/* SWOT Analysis Navigation */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 p-6 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <BarChart3 className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">SWOT Analysis</h3>
                    <p className="text-gray-600 text-sm">
                      Get a comprehensive strengths, weaknesses, opportunities, and threats analysis of your resume
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleNavigateToSWOT}
                  disabled={!resumeData}
                  className={`px-6 py-3 rounded-lg font-medium transition-all ${
                    !resumeData
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800 shadow-md hover:shadow-lg"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Generate SWOT
                  </div>
                </button>
              </div>
            </div>

            {/* Detailed Analysis */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Detailed Analysis
              </h2>
              {results.map((res, idx) => (
                <div key={idx} className="space-y-4">
                  <StructuredRecommendations result={res} index={idx} />
                  <div className="flex justify-end">
                    <button
                      className={`px-4 py-2 rounded transition text-sm ${
                        savedIndices.includes(idx)
                          ? "bg-gray-600 cursor-not-allowed text-white"
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                      }`}
                      disabled={savedIndices.includes(idx)}
                      onClick={() => handleSaveIndividualAnalysis(idx)}
                    >
                      {savedIndices.includes(idx) ? "Analysis Saved" : "Save Analysis"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && results.length === 0 && (
          <div className="text-center py-20 border rounded-lg border-gray-300">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              Ready to Analyze
            </h3>
            <p className="text-gray-500">
              Upload your resume and add job descriptions to get started.
              <br /> <br />
              Make sure to include only what's necessary in the job descriptions for improved analysis
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CVAnalyzer;
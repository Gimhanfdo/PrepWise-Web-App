import React, { useState, useCallback } from "react";

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
  // Pick color by cycling through colors array
  const color = colors[colorIndex % colors.length];
  // Calculate circumference
  const strokeDasharray = 2 * Math.PI * 45;
  // Calculate how much of the circumference to offset based on percentage
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
      // Show validation error and reset file
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

    // Extract file from event and pass to handleFileChange
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  }, []);

  // Update a specific job description in the list when user types
  const handleJDChange = (index, value) => {
    const updated = [...jobDescriptions];
    updated[index] = value;
    setJobDescriptions(updated);

    // Clear error when user starts typing in a previously empty field
    if (error && value.trim()) {
      setError(null);
    }
  };

  // Add a new empty job description input
  const addJD = () => {
    if (jobDescriptions.length < 5) {
      // Limit to 5 job descriptions
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

  // Sends resume file and job descriptions to backend for analysis
  const handleAnalyze = async () => {
    setError(null);

    if (!validateForm()) return;

    setLoading(true);
    setResults([]); // Clear previous results

    const formData = new FormData();
    formData.append("resume", resumeFile);
    formData.append("jobDescriptions", JSON.stringify(jobDescriptions));

    try {
      const res = await fetch("/api/analyze/analyze-resume", {
        method: "POST",
        credentials: "include", // Include cookies for authentication
        body: formData,
        signal: AbortSignal.timeout(60000), // 60 second timeout
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      if (data?.analysis) {
        setResults(data.analysis); // Store analysis results
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error("Analyze Error:", err);

      let errorMessage = "Failed to analyze resume. ";

      // Handle specific error types to display meaningful messages
      if (err.name === "AbortError") {
        errorMessage += "Request timed out. Please try again.";
      } else if (err.message.includes("413")) {
        errorMessage += "File too large.";
      } else if (err.message.includes("429")) {
        errorMessage += "Too many requests. Please wait a moment.";
      } else {
        errorMessage += "Please check your connection and try again.";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Track indices of saved analysis to disable multiple saves of the same result
  const [savedIndices, setSavedIndices] = useState([]);

  // Save a single analysis result for a job description to the backend
  const handleSaveIndividualAnalysis = async (index) => {
  if (!resumeFile || !results[index] || savedIndices.includes(index)) return;

  const payload = {
    resumeName: resumeFile.name,
    jobDescriptions: [jobDescriptions[index]],
    results: [results[index]],
  };

  try {
    const res = await fetch(`/api/analyze/save`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok) {
      // Mark this result as saved
      setSavedIndices((prev) => [...prev, index]);
    } else {
      throw new Error(data.message || "Failed to save analysis.");
    }
  } catch (err) {
    console.error("Save error:", err);
    alert("Error saving analysis. Please try again.");
  }
};


  // Clear all data
  const handleClear = () => {
    setResumeFile(null);
    setJobDescriptions([""]);
    setResults([]);
    setError(null);
  };

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

            {/* Suggestions */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Improvement Suggestions
              </h2>
              {results.map((res, idx) => (
                <div
                  key={idx}
                  className="bg-white p-6 shadow-sm border rounded-lg"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800">
                      Job Description {idx + 1}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        res.matchPercentage >= 80
                          ? "bg-green-100 text-green-800"
                          : res.matchPercentage >= 60
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      Match Score: {res.matchPercentage}%
                    </span>
                  </div>
                  <div
                    className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: res.suggestions || "No suggestions available.",
                    }}
                  ></div>
                  <button
                    className={`mt-4 px-4 py-2 rounded transition text-sm ${
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

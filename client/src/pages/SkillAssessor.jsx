import React, { useState, useEffect } from 'react';

// Simple icon components to replace Lucide icons
const AlertCircle = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const CheckCircle = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
  </svg>
);

const ArrowLeft = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12,19 5,12 12,5"></polyline>
  </svg>
);

const Loader = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.416" strokeDashoffset="31.416">
      <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
      <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
    </circle>
  </svg>
);

const Star = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
  </svg>
);

const TrendingUp = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"></polyline>
    <polyline points="17,6 23,6 23,12"></polyline>
  </svg>
);

const SWOTAnalysis = ({ 
  resumeHash = null, 
  resumeText = null,
  jobDescriptions = [],
  extractedTechnologies = [],
  onBack = null,
  userId = null
}) => {
  const [step, setStep] = useState('rating');
  const [technologies, setTechnologies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Initialize technologies when extractedTechnologies prop changes - DEFAULT TO 0
  useEffect(() => {
    console.log("SWOT: Received extractedTechnologies:", extractedTechnologies);
    if (extractedTechnologies && extractedTechnologies.length > 0) {
      const initializedTechnologies = extractedTechnologies.map(tech => ({
        name: tech.name,
        category: tech.category,
        confidenceLevel: 0 // CHANGED: Default to 0 instead of 5
      }));
      setTechnologies(initializedTechnologies);
      console.log("SWOT: Initialized technologies with 0 default:", initializedTechnologies);
    }
  }, [extractedTechnologies]);

  // Handle confidence rating changes
  const handleRatingChange = (techIndex, newRating) => {
    const updatedTechnologies = [...technologies];
    updatedTechnologies[techIndex].confidenceLevel = parseInt(newRating);
    setTechnologies(updatedTechnologies);
  };

  // Validation before saving - ensure no technologies are left at 0
  const validateRatings = () => {
    const unratedTechs = technologies.filter(tech => tech.confidenceLevel === 0);
    if (unratedTechs.length > 0) {
      setError(`Please rate all technologies. ${unratedTechs.length} technology(ies) still have a rating of 0.`);
      return false;
    }
    return true;
  };

  // UPDATED: API call with validation
  const handleSaveRatings = async () => {
    if (!resumeHash) {
      setError('Resume hash is required. Please analyze your resume first.');
      return;
    }

    if (technologies.length === 0) {
      setError('No technologies to save. Please extract technologies first.');
      return;
    }

    // Validate that all technologies have been rated (not 0)
    if (!validateRatings()) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('http://localhost:4000/api/swot/save-ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          technologies: technologies,
          resumeHash: resumeHash
        })
      });

      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server returned ${response.status}: ${text.slice(0, 100)}...`);
      }

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      setSuccess(data.message || 'Technology ratings saved successfully!');
      setStep('success');
      
    } catch (err) {
      console.error('Error saving ratings:', err);
      if (err.message.includes('404')) {
        setError('API endpoint not found. Please check if your backend server is running on port 4000.');
      } else if (err.message.includes('Failed to fetch')) {
        setError('Cannot connect to server. Please check if your backend is running.');
      } else {
        setError(err.message || 'Failed to save technology ratings. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  // UPDATED: Get confidence level color - handle 0 rating
  const getConfidenceColor = (level) => {
    if (level === 0) return 'text-gray-500 bg-gray-100 border-2 border-dashed border-gray-300';
    if (level >= 8) return 'text-green-600 bg-green-100';
    if (level >= 6) return 'text-blue-600 bg-blue-100';
    if (level >= 4) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  // UPDATED: Get confidence level text - handle 0 rating
  const getConfidenceText = (level) => {
    if (level === 0) return 'Not Rated';
    if (level >= 8) return 'Expert';
    if (level >= 6) return 'Proficient';
    if (level >= 4) return 'Intermediate';
    return 'Beginner';
  };

  // Group technologies by category
  const groupedTechnologies = technologies.reduce((groups, tech) => {
    const category = tech.category || 'General';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(tech);
    return groups;
  }, {});

  // UPDATED: Calculate statistics excluding 0 ratings
  const getStatistics = () => {
    const ratedTechnologies = technologies.filter(t => t.confidenceLevel > 0);
    const unratedCount = technologies.filter(t => t.confidenceLevel === 0).length;
    
    return {
      total: technologies.length,
      rated: ratedTechnologies.length,
      unrated: unratedCount,
      expert: technologies.filter(t => t.confidenceLevel >= 8).length,
      proficient: technologies.filter(t => t.confidenceLevel >= 6 && t.confidenceLevel < 8).length,
      learning: technologies.filter(t => t.confidenceLevel > 0 && t.confidenceLevel < 6).length
    };
  };

  const stats = getStatistics();

  const renderRatingStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Rate Your Technology Confidence</h2>
        <p className="text-gray-600 text-lg">
          Rate your confidence level for each technology from 1 (beginner) to 10 (expert)
        </p>
        <div className="mt-4 flex justify-center">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <span className="text-blue-800 font-semibold">{technologies.length} technologies found</span>
          </div>
        </div>

        {/* ADDED: Progress indicator */}
        {stats.unrated > 0 && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 inline-block">
            <span className="text-yellow-800 font-medium">
              {stats.unrated} technology(ies) still need to be rated
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle />
            <span className="text-red-800 ml-2">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle />
            <span className="text-green-800 ml-2">{success}</span>
          </div>
        </div>
      )}

      {technologies.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 text-gray-400 mx-auto mb-4 flex items-center justify-center">
            <AlertCircle />
          </div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Technologies Found</h3>
          <p className="text-gray-500 mb-6">
            No technologies were extracted from your resume. Please go back and analyze your CV first.
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center mx-auto"
            >
              <ArrowLeft />
              <span className="ml-2">Back to CV Analysis</span>
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="max-h-96 overflow-y-auto bg-gray-50 p-4 rounded-lg">
            {Object.entries(groupedTechnologies).map(([category, techs]) => (
              <div key={category} className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 sticky top-0 bg-gray-50 py-2">
                  {category}
                </h3>
                <div className="space-y-3">
                  {techs.map((tech, techIndex) => {
                    const globalIndex = technologies.findIndex(t => t.name === tech.name);
                    return (
                      <div key={globalIndex} className={`flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow ${tech.confidenceLevel === 0 ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'}`}>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">{tech.name}</h4>
                          <div className="flex items-center mt-1">
                            <span className={`text-xs px-2 py-1 rounded-full ${getConfidenceColor(tech.confidenceLevel)}`}>
                              {getConfidenceText(tech.confidenceLevel)}
                            </span>
                            {tech.confidenceLevel === 0 && (
                              <span className="text-xs text-yellow-600 ml-2 font-medium">Please rate this technology</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-gray-500 font-medium">1</span>
                          <input
                            type="range"
                            min="0"
                            max="10"
                            value={tech.confidenceLevel}
                            onChange={(e) => handleRatingChange(globalIndex, e.target.value)}
                            className={`w-32 h-2 rounded-lg appearance-none cursor-pointer slider ${tech.confidenceLevel === 0 ? 'bg-yellow-200' : 'bg-gray-200'}`}
                          />
                          <span className="text-sm text-gray-500 font-medium">10</span>
                          <div className={`ml-3 px-3 py-1 rounded-lg font-bold text-lg min-w-[3rem] text-center ${getConfidenceColor(tech.confidenceLevel)}`}>
                            {tech.confidenceLevel === 0 ? '?' : tech.confidenceLevel}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-between items-center">
            {onBack && (
              <button
                onClick={onBack}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
              >
                <ArrowLeft />
                <span className="ml-2">Back to CV Analysis</span>
              </button>
            )}
            <div className="flex space-x-4">
              <div className="text-sm text-gray-600">
                <div className="flex items-center space-x-4">
                  <span>Expert (8-10): <strong>{stats.expert}</strong></span>
                  <span>Proficient (6-7): <strong>{stats.proficient}</strong></span>
                  <span>Learning (1-5): <strong>{stats.learning}</strong></span>
                  {stats.unrated > 0 && (
                    <span className="text-yellow-600">Unrated: <strong>{stats.unrated}</strong></span>
                  )}
                </div>
              </div>
              <button
                onClick={handleSaveRatings}
                disabled={saving || technologies.length === 0 || stats.unrated > 0}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold flex items-center"
              >
                {saving ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Saving Ratings...
                  </>
                ) : (
                  <>
                    <Star />
                    <span className="ml-2">
                      {stats.unrated > 0 ? `Rate ${stats.unrated} More` : 'Save Technology Ratings'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderSuccessStep = () => {
    // Recalculate stats for success page (excluding any remaining 0s)
    const ratedTechnologies = technologies.filter(t => t.confidenceLevel > 0);
    const averageConfidence = ratedTechnologies.length > 0 
      ? ratedTechnologies.reduce((sum, tech) => sum + tech.confidenceLevel, 0) / ratedTechnologies.length 
      : 0;

    return (
      <div className="space-y-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle />
        </div>
        
        <div>
          <h2 className="text-3xl font-bold text-green-600 mb-2">Ratings Saved Successfully!</h2>
          <p className="text-gray-600 text-lg">
            Your technology confidence ratings have been saved for {stats.rated} technologies
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp />
              <span className="font-bold text-green-800 ml-2">Expert Level</span>
            </div>
            <div className="text-3xl font-bold text-green-600 mb-1">
              {stats.expert}
            </div>
            <div className="text-sm text-green-700">Technologies (8-10)</div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-center mb-2">
              <Star />
              <span className="font-bold text-blue-800 ml-2">Proficient</span>
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {stats.proficient}
            </div>
            <div className="text-sm text-blue-700">Technologies (6-7)</div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-center justify-center mb-2">
              <AlertCircle />
              <span className="font-bold text-yellow-800 ml-2">Learning</span>
            </div>
            <div className="text-3xl font-bold text-yellow-600 mb-1">
              {stats.learning}
            </div>
            <div className="text-sm text-yellow-700">Technologies (1-5)</div>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 max-w-2xl mx-auto">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Rating Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Average Confidence:</span>
              <span className="font-bold text-gray-800 ml-2">
                {averageConfidence.toFixed(1)}/10
              </span>
            </div>
            <div>
              <span className="text-gray-600">Technologies Rated:</span>
              <span className="font-bold text-gray-800 ml-2">{stats.rated}</span>
            </div>
          </div>
        </div>

        <div className="flex space-x-4 justify-center">
          <button
            onClick={() => setStep('rating')}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
          >
            <ArrowLeft />
            <span className="ml-2">Update Ratings</span>
          </button>
          {onBack && (
            <button
              onClick={onBack}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to CV Analysis
            </button>
          )}
        </div>
      </div>
    );
  };

  if (!resumeHash || !extractedTechnologies || extractedTechnologies.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8">
          <div className="w-16 h-16 text-red-600 mx-auto mb-4 flex items-center justify-center">
            <AlertCircle />
          </div>
          <h2 className="text-2xl font-bold text-red-800 mb-4">
            {!resumeHash ? "Resume Analysis Required" : "No Technologies Found"}
          </h2>
          <p className="text-red-600 mb-6">
            {!resumeHash 
              ? "Please analyze your resume first to extract technologies for rating."
              : "No technologies were extracted from your resume. Please ensure your resume contains technical skills and try analyzing again."
            }
          </p>
          <div className="text-sm text-red-500 mb-4">
            Debug info: resumeHash={resumeHash ? 'present' : 'missing'}, 
            extractedTechnologies={extractedTechnologies?.length || 0} items
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center mx-auto"
            >
              <ArrowLeft />
              <span className="ml-2">Back to CV Analysis</span>
            </button>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .slider::-webkit-slider-track {
          height: 8px;
          border-radius: 4px;
          background: #e5e7eb;
        }
        .slider::-moz-range-track {
          height: 8px;
          border-radius: 4px;
          background: #e5e7eb;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
      
      {step === 'rating' && renderRatingStep()}
      {step === 'success' && renderSuccessStep()}
    </div>
  );
};

export default SWOTAnalysis;
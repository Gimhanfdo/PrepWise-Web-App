import React, { useState, useCallback } from "react";
import { CheckCircle, XCircle, AlertTriangle, Lightbulb, FileText, Layout, Target, BarChart3, ArrowLeft, Star, TrendingUp, Settings } from "lucide-react";

// Enhanced Skills Assessment Component (formerly SWOT)
const SkillsAssessment = ({ 
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

  // Simple icon components
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

  // Initialize technologies when extractedTechnologies prop changes
  React.useEffect(() => {
    if (extractedTechnologies && extractedTechnologies.length > 0) {
      const initializedTechnologies = extractedTechnologies.map(tech => ({
        name: tech.name,
        category: tech.category,
        confidenceLevel: tech.confidenceLevel || 5
      }));
      setTechnologies(initializedTechnologies);
    }
  }, [extractedTechnologies]);

  // Handle confidence rating changes
  const handleRatingChange = (techIndex, newRating) => {
    const updatedTechnologies = [...technologies];
    updatedTechnologies[techIndex].confidenceLevel = parseInt(newRating);
    setTechnologies(updatedTechnologies);
  };

  // Save technology ratings to backend
  const handleSaveRatings = async () => {
    if (!resumeHash) {
      setError('Resume hash is required. Please analyze your resume first.');
      return;
    }

    if (technologies.length === 0) {
      setError('No technologies to save. Please extract technologies first.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/swot/save-ratings', {
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save ratings');
      }

      setSuccess(data.message || 'Skill assessments saved successfully!');
      setStep('success');
      
    } catch (err) {
      console.error('Error saving ratings:', err);
      setError(err.message || 'Failed to save skill assessments. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Get confidence level color
  const getConfidenceColor = (level) => {
    if (level >= 8) return 'text-emerald-700 bg-emerald-100 border-emerald-200';
    if (level >= 6) return 'text-blue-700 bg-blue-100 border-blue-200';
    if (level >= 4) return 'text-amber-700 bg-amber-100 border-amber-200';
    return 'text-red-700 bg-red-100 border-red-200';
  };

  // Get confidence level text
  const getConfidenceText = (level) => {
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

  const renderInstructions = () => (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <Settings className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">How to Rate Your Skills</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p className="font-medium">Rate each technology based on your current confidence level:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <span><strong>1-3 (Beginner):</strong> Basic understanding, need guidance</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-400 rounded-full"></div>
                <span><strong>4-5 (Intermediate):</strong> Can work independently with some help</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                <span><strong>6-7 (Proficient):</strong> Confident, can mentor others</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-400 rounded-full"></div>
                <span><strong>8-10 (Expert):</strong> Deep expertise, can architect solutions</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRatingStep = () => (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
          <Star className="w-4 h-4" />
          Skills Assessment
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Rate Your Technical Skills</h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Help us understand your confidence level with each technology to provide better career insights
        </p>
        <div className="mt-6 inline-flex items-center gap-2 bg-gray-100 rounded-lg px-4 py-2">
          <BarChart3 className="w-5 h-5 text-gray-600" />
          <span className="text-gray-800 font-semibold">{technologies.length} technologies found</span>
        </div>
      </div>

      {/* Instructions */}
      {renderInstructions()}

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-emerald-600 mr-2" />
            <span className="text-emerald-800">{success}</span>
          </div>
        </div>
      )}

      {technologies.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 text-gray-400 mx-auto mb-6 flex items-center justify-center bg-gray-100 rounded-full">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-600 mb-3">No Technologies Found</h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            No technologies were extracted from your resume. Please go back and analyze your CV first.
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to CV Analysis
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Technologies Rating Grid */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Technology Skills</h2>
              <p className="text-gray-600 mt-1">Use the sliders to rate your confidence level for each technology</p>
            </div>
            
            <div className="max-h-[600px] overflow-y-auto">
              {Object.entries(groupedTechnologies).map(([category, techs]) => (
                <div key={category} className="border-b border-gray-100 last:border-0">
                  <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-800">{category}</h3>
                  </div>
                  <div className="p-6 space-y-6">
                    {techs.map((tech, techIndex) => {
                      const globalIndex = technologies.findIndex(t => t.name === tech.name);
                      return (
                        <div key={globalIndex} className="group">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <h4 className="text-lg font-medium text-gray-900">{tech.name}</h4>
                              <span className={`text-xs px-3 py-1 rounded-full border ${getConfidenceColor(tech.confidenceLevel)}`}>
                                {getConfidenceText(tech.confidenceLevel)}
                              </span>
                            </div>
                            <div className={`text-2xl font-bold px-4 py-2 rounded-lg ${getConfidenceColor(tech.confidenceLevel)}`}>
                              {tech.confidenceLevel}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500 font-medium w-8">1</span>
                            <div className="flex-1 relative">
                              <input
                                type="range"
                                min="1"
                                max="10"
                                value={tech.confidenceLevel}
                                onChange={(e) => handleRatingChange(globalIndex, e.target.value)}
                                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>Beginner</span>
                                <span>Intermediate</span>
                                <span>Proficient</span>
                                <span>Expert</span>
                              </div>
                            </div>
                            <span className="text-sm text-gray-500 font-medium w-8 text-right">10</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Action Bar */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              {/* Statistics */}
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  <span className="text-gray-600">Expert (8-10): <strong className="text-gray-900">{technologies.filter(t => t.confidenceLevel >= 8).length}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">Proficient (6-7): <strong className="text-gray-900">{technologies.filter(t => t.confidenceLevel >= 6 && t.confidenceLevel < 8).length}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  <span className="text-gray-600">Learning (&lt;6): <strong className="text-gray-900">{technologies.filter(t => t.confidenceLevel < 6).length}</strong></span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-4">
                {onBack && (
                  <button
                    onClick={onBack}
                    className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Analysis
                  </button>
                )}
                <button
                  onClick={handleSaveRatings}
                  disabled={saving || technologies.length === 0}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {saving ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Saving Assessment...
                    </>
                  ) : (
                    <>
                      <Star className="w-5 h-5" />
                      Save Skills Assessment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderSuccessStep = () => (
    <div className="space-y-8 text-center max-w-4xl mx-auto">
      <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-12 h-12 text-emerald-600" />
      </div>
      
      <div>
        <h1 className="text-4xl font-bold text-emerald-600 mb-4">Skills Assessment Complete!</h1>
        <p className="text-xl text-gray-600">
          Your skill assessments have been saved for {technologies.length} technologies
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
            <span className="font-bold text-emerald-800 text-lg">Expert Level</span>
          </div>
          <div className="text-4xl font-bold text-emerald-600 mb-2">
            {technologies.filter(t => t.confidenceLevel >= 8).length}
          </div>
          <div className="text-emerald-700">Technologies (8-10)</div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Star className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-blue-800 text-lg">Proficient</span>
          </div>
          <div className="text-4xl font-bold text-blue-600 mb-2">
            {technologies.filter(t => t.confidenceLevel >= 6 && t.confidenceLevel < 8).length}
          </div>
          <div className="text-blue-700">Technologies (6-7)</div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <BarChart3 className="w-6 h-6 text-amber-600" />
            <span className="font-bold text-amber-800 text-lg">Learning</span>
          </div>
          <div className="text-4xl font-bold text-amber-600 mb-2">
            {technologies.filter(t => t.confidenceLevel < 6).length}
          </div>
          <div className="text-amber-700">Technologies (&lt;6)</div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-6">Assessment Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {(technologies.reduce((sum, tech) => sum + tech.confidenceLevel, 0) / technologies.length).toFixed(1)}/10
            </div>
            <div className="text-gray-600">Average Confidence Level</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-1">{technologies.length}</div>
            <div className="text-gray-600">Technologies Assessed</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={() => setStep('rating')}
          className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Update Assessments
        </button>
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to CV Analysis
          </button>
        )}
      </div>
    </div>
  );

  // Enhanced validation check
  if (!resumeHash || !extractedTechnologies || extractedTechnologies.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-white border border-red-200 rounded-xl p-8 text-center">
            <div className="w-16 h-16 text-red-600 mx-auto mb-6 flex items-center justify-center bg-red-100 rounded-full">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-red-800 mb-4">
              {!resumeHash ? "Resume Analysis Required" : "No Technologies Found"}
            </h2>
            <p className="text-red-600 mb-6">
              {!resumeHash 
                ? "Please analyze your resume first to extract technologies for assessment."
                : "No technologies were extracted from your resume. Please ensure your resume contains technical skills and try analyzing again."
              }
            </p>
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to CV Analysis
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <style>{`
          .slider::-webkit-slider-thumb {
            appearance: none;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #4f46e5;
            cursor: pointer;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            transition: all 0.2s ease;
          }
          .slider::-webkit-slider-thumb:hover {
            background: #4338ca;
            transform: scale(1.1);
          }
          .slider::-moz-range-thumb {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #4f46e5;
            cursor: pointer;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
          }
          .slider::-webkit-slider-track {
            height: 12px;
            border-radius: 6px;
            background: #e5e7eb;
          }
          .slider::-moz-range-track {
            height: 12px;
            border-radius: 6px;
            background: #e5e7eb;
          }
          .slider:focus::-webkit-slider-track {
            background: #d1d5db;
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
    </div>
  );
};

// API Configuration
const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:4000';

const API_ENDPOINTS = {
  analyzeResume: `${API_BASE_URL}/api/analyze/analyze-resume`,
  saveAnalysis: `${API_BASE_URL}/api/analyze/save`,
  saveSWOTRatings: `${API_BASE_URL}/api/swot/save-ratings`,
};

// Enhanced Circular Progress Component
const CircularProgress = ({ percentage, label, colorIndex = 0 }) => {
  const colors = [
    { primary: "#4f46e5", secondary: "#e0e7ff" },
    { primary: "#059669", secondary: "#d1fae5" },
    { primary: "#d97706", secondary: "#fef3c7" },
    { primary: "#dc2626", secondary: "#fee2e2" },
    { primary: "#7c3aed", secondary: "#ede9fe" },
    { primary: "#0891b2", secondary: "#cffafe" },
  ];
  const color = colors[colorIndex % colors.length];
  const strokeDasharray = 2 * Math.PI * 50;
  const strokeDashoffset = strokeDasharray - (strokeDasharray * percentage) / 100;

  return (
    <div className="flex flex-col items-center p-6 bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="relative w-28 h-28 mb-4">
        <svg className="transform -rotate-90 w-28 h-28">
          <circle
            cx="56"
            cy="56"
            r="50"
            stroke={color.secondary}
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="56"
            cy="56"
            r="50"
            stroke={color.primary}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold" style={{ color: color.primary }}>
            {percentage}%
          </span>
        </div>
      </div>
      <span className="text-sm font-semibold text-gray-700">{label}</span>
    </div>
  );
};

// Enhanced Structured Recommendations Component
const StructuredRecommendations = ({ result, index }) => {
  const [activeTab, setActiveTab] = useState('strengths');

  if (result.isNonTechRole) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl">
        <div className="flex items-center mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mr-2" />
          <h3 className="font-semibold text-amber-800">Non-Technical Role Detected</h3>
        </div>
        <p className="text-amber-700">{result.message}</p>
      </div>
    );
  }

  const tabs = [
    { id: 'strengths', label: 'Strengths', icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
    { id: 'content', label: 'Content Issues', icon: FileText, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
    { id: 'structure', label: 'Structure Issues', icon: Layout, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
    { id: 'recommendations', label: 'Recommendations', icon: Lightbulb, color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' }
  ];

  const renderList = (items, icon, colorClass, bgClass) => {
    if (!items || items.length === 0) {
      return (
        <div className="text-gray-500 italic text-center py-8 bg-gray-50 rounded-lg">
          No items available for this category
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={idx} className={`flex items-start gap-4 p-4 ${bgClass} rounded-lg border border-gray-100`}>
            <icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${colorClass}`} />
            <span className="text-gray-700 leading-relaxed">{item}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderTabContent = () => {
    const activeTabData = tabs.find(tab => tab.id === activeTab);
    
    switch (activeTab) {
      case 'strengths':
        return renderList(result.strengths, CheckCircle, 'text-emerald-600', 'bg-emerald-50');
      case 'content':
        return renderList(result.contentWeaknesses, FileText, 'text-amber-600', 'bg-amber-50');
      case 'structure':
        return renderList(result.structureWeaknesses, Layout, 'text-red-600', 'bg-red-50');
      case 'recommendations':
        const allRecommendations = [
          ...(result.contentRecommendations || []).map(rec => ({ text: rec, type: 'content' })),
          ...(result.structureRecommendations || []).map(rec => ({ text: rec, type: 'structure' }))
        ];
        return (
          <div className="space-y-4">
            {allRecommendations.length === 0 ? (
              <div className="text-gray-500 italic text-center py-8 bg-gray-50 rounded-lg">
                No recommendations available
              </div>
            ) : (
              allRecommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-4 p-4 bg-indigo-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      rec.type === 'content' 
                        ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                        : 'bg-purple-100 text-purple-700 border border-purple-200'
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
    <div className="bg-white p-6 shadow-sm border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-800">Job Description {index + 1}</h3>
        <span
          className={`px-4 py-2 rounded-full text-sm font-semibold ${
            result.matchPercentage >= 80
              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
              : result.matchPercentage >= 60
              ? "bg-amber-100 text-amber-800 border border-amber-200"
              : "bg-red-100 text-red-800 border border-red-200"
          }`}
        >
          Match Score: {result.matchPercentage}%
        </span>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-8 bg-gray-100 p-2 rounded-xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? `bg-white ${tab.color} shadow-sm border ${tab.borderColor}`
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
  // State management
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescriptions, setJobDescriptions] = useState([""]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [resumeData, setResumeData] = useState(null);
  const [currentView, setCurrentView] = useState('analysis');
  const [savedIndices, setSavedIndices] = useState([]);

  // File validation
  const validateFile = (file) => {
    if (!file) return { valid: false, error: "No file selected" };

    if (file.type !== "application/pdf") {
      return { valid: false, error: "Only PDF files are allowed" };
    }

    if (file.size > 10 * 1024 * 1024) {
      return { valid: false, error: "File size must be less than 10MB" };
    }

    return { valid: true };
  };

  // Handle file selection
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

  // Drag handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  }, []);

  // Job description handlers
  const handleJDChange = (index, value) => {
    const updated = [...jobDescriptions];
    updated[index] = value;
    setJobDescriptions(updated);

    if (error && value.trim()) {
      setError(null);
    }
  };

  const addJD = () => {
    if (jobDescriptions.length < 5) {
      setJobDescriptions([...jobDescriptions, ""]);
    }
  };

  const removeJD = (index) => {
    if (jobDescriptions.length > 1) {
      setJobDescriptions(jobDescriptions.filter((_, i) => i !== index));
    }
  };

  // Form validation
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

  // Enhanced analyze function
  const handleAnalyze = async () => {
    setError(null);

    if (!validateForm()) return;

    setLoading(true);
    setResults([]);

    try {
      const formData = new FormData();
      formData.append('resume', resumeFile);
      formData.append('jobDescriptions', JSON.stringify(jobDescriptions.filter(jd => jd.trim())));

      const response = await fetch(API_ENDPOINTS.analyzeResume, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

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

      if (!responseText.trim()) {
        throw new Error('Server returned empty response');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Invalid JSON response from server');
      }
      
      if (!data || !data.analysis) {
        throw new Error('Invalid response format: missing analysis data');
      }
      
      const resumeHash = `resume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      setResumeData({
        resumeText: data.resumeText || `Resume: ${resumeFile.name}`,
        resumeHash: data.resumeHash || resumeHash,
        jobDescriptions: jobDescriptions.filter(jd => jd.trim()),
        extractedTechnologies: data.extractedTechnologies || [],
        metadata: {
          fileName: resumeFile.name,
          analysisDate: new Date().toISOString(),
          totalTechnologies: (data.extractedTechnologies || []).length
        }
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

  // Save individual analysis
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
        },
        credentials: 'include',
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

  // Navigate to Skills Assessment
  const handleNavigateToSkillsAssessment = () => {
    if (!resumeData) {
      setError("No resume analysis available for skills assessment. Please analyze your resume first.");
      return;
    }

    if (!resumeData.extractedTechnologies || resumeData.extractedTechnologies.length === 0) {
      setError("No technologies were extracted from your resume. Please ensure your resume contains technical skills and try analyzing again.");
      return;
    }

    setCurrentView('skills');
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

  // Handle back navigation
  const handleBackFromSkills = () => {
    setCurrentView('analysis');
  };

  // Render Skills Assessment view
  if (currentView === 'skills') {
    return (
      <SkillsAssessment 
        resumeHash={resumeData?.resumeHash}
        resumeText={resumeData?.resumeText}
        jobDescriptions={resumeData?.jobDescriptions || []}
        extractedTechnologies={resumeData?.extractedTechnologies || []}
        onBack={handleBackFromSkills}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto p-6 gap-8">
        {/* Left Sidebar */}
        <div className="w-full lg:w-1/3 space-y-8">
          {/* Header */}
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">CV Analyzer</h1>
            <p className="text-gray-600">Upload your resume and compare it against job descriptions</p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-4 rounded-xl">
              <div className="flex items-center">
                <XCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* File Upload */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block font-semibold mb-4 text-gray-800">
              Upload Resume (PDF only)
            </label>
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                dragActive
                  ? "border-indigo-400 bg-indigo-50"
                  : resumeFile
                  ? "border-emerald-400 bg-emerald-50"
                  : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
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
                <div className="space-y-3">
                  <div className="w-12 h-12 mx-auto text-emerald-600 bg-emerald-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-emerald-700">{resumeFile.name}</p>
                  <p className="text-sm text-emerald-600">
                    {(resumeFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-12 h-12 mx-auto text-gray-400">
                    <FileText className="w-12 h-12" />
                  </div>
                  <div>
                    <p className="text-gray-600">
                      <span className="font-semibold text-indigo-600">
                        Click to upload
                      </span>{" "}
                      or drag and drop
                    </p>
                    <p className="text-sm text-gray-500 mt-1">PDF files up to 10MB</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Job Descriptions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <label className="block font-semibold text-gray-800">
                Job Descriptions
              </label>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {jobDescriptions.length}/5
              </span>
            </div>

            <div className="space-y-4">
              {jobDescriptions.map((jd, index) => (
                <div key={index} className="relative">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <textarea
                        className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
                        rows="4"
                        placeholder={`Enter job description ${index + 1}...`}
                        value={jd}
                        onChange={(e) => handleJDChange(index, e.target.value)}
                      />
                      <div className="flex justify-between mt-2">
                        <span className="text-xs text-gray-500 font-medium">
                          JD {index + 1}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            jd.length < 50 ? "text-amber-600" : "text-emerald-600"
                          }`}
                        >
                          {jd.length} characters
                        </span>
                      </div>
                    </div>

                    {jobDescriptions.length > 1 && (
                      <button
                        onClick={() => removeJD(index)}
                        className="self-start mt-1 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove this job description"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {jobDescriptions.length < 5 && (
              <button
                onClick={addJD}
                className="w-full mt-4 p-3 text-sm bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
              >
                + Add Another Job Description
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleAnalyze}
              disabled={
                loading ||
                !resumeFile ||
                jobDescriptions.some((jd) => jd.trim() === "")
              }
              className={`w-full px-6 py-4 rounded-xl font-semibold transition-all text-lg ${
                loading ||
                !resumeFile ||
                jobDescriptions.some((jd) => jd.trim() === "")
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-lg hover:shadow-xl"
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Analyzing Resume...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Target className="w-5 h-5" />
                  Analyze Resume
                </div>
              )}
            </button>

            {(resumeFile || jobDescriptions.some((jd) => jd.trim())) && (
              <button
                onClick={handleClear}
                disabled={loading}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors disabled:opacity-50 font-medium"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Right Content Area */}
        <div className="w-full lg:w-2/3 space-y-8">
          {loading && (
            <div className="flex justify-center items-center py-32">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6"></div>
                <h3 className="text-xl font-semibold text-gray-700 mb-3">
                  Analyzing Your Resume
                </h3>
                <p className="text-gray-500">This may take a few moments...</p>
              </div>
            </div>
          )}

          {!loading && results.length > 0 && (
            <>
              {/* Match Scores */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <h2 className="text-2xl font-bold mb-6 text-gray-900">
                  Match Scores Overview
                </h2>
                <div className={`grid gap-6 ${
                  results.length > 2 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"
                }`}>
                  {results.map((res, idx) => (
                    <CircularProgress
                      key={idx}
                      percentage={res.matchPercentage || 0}
                      label={`Job Description ${idx + 1}`}
                      colorIndex={idx}
                    />
                  ))}
                </div>
              </div>

              {/* Skills Assessment Navigation */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 p-8 rounded-xl">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 rounded-xl">
                      <BarChart3 className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Skills Assessment</h3>
                      <p className="text-gray-600 mt-1">
                        Rate your confidence level for each extracted technology
                        {resumeData?.extractedTechnologies?.length > 0 && (
                          <span className="ml-1 text-indigo-600 font-semibold">
                            ({resumeData.extractedTechnologies.length} technologies found)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleNavigateToSkillsAssessment}
                    disabled={!resumeData || !resumeData.extractedTechnologies?.length}
                    className={`px-8 py-4 rounded-xl font-semibold transition-all ${
                      !resumeData || !resumeData.extractedTechnologies?.length
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-lg hover:shadow-xl"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5" />
                      Start Assessment
                    </div>
                  </button>
                </div>
              </div>

              {/* Detailed Analysis */}
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Detailed Analysis Results
                </h2>
                {results.map((res, idx) => (
                  <div key={idx} className="space-y-4">
                    <StructuredRecommendations result={res} index={idx} />
                    <div className="flex justify-end">
                      <button
                        className={`px-6 py-3 rounded-lg transition-all font-medium ${
                          savedIndices.includes(idx)
                            ? "bg-gray-600 cursor-not-allowed text-white"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg"
                        }`}
                        disabled={savedIndices.includes(idx)}
                        onClick={() => handleSaveIndividualAnalysis(idx)}
                      >
                        {savedIndices.includes(idx) ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            Analysis Saved
                          </div>
                        ) : (
                          "Save Analysis"
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && results.length === 0 && (
            <div className="text-center py-32 bg-white border border-gray-200 rounded-xl">
              <div className="w-20 h-20 mx-auto text-gray-400 mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                <FileText className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-700 mb-4">
                Ready to Analyze Your Resume
              </h3>
              <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
                Upload your resume and add job descriptions to get started with our comprehensive analysis.
                <br /><br />
                <span className="text-sm text-gray-400">
                  Pro tip: Include only relevant details in job descriptions for better analysis accuracy.
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CVAnalyzer;
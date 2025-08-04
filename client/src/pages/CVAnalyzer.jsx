import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, TrendingUp, TrendingDown, Target, Shield, Users, ArrowLeft } from 'lucide-react';

const SWOTAnalysis = ({ 
  resumeHash = null, 
  resumeText = "Sample resume text for demo purposes",
  jobDescriptions = [],
  onBack = null,
  apiBaseUrl = "/api" // Add API base URL prop
}) => {
  const [step, setStep] = useState('extract');
  const [extractedTechnologies, setExtractedTechnologies] = useState([]);
  const [swotResults, setSWOTResults] = useState(null);
  const [savedAnalyses, setSavedAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load saved analyses on component mount
  useEffect(() => {
    if (resumeHash) {
      loadSavedAnalyses();
    }
  }, [resumeHash]);

  // Auto-extract technologies when we have resume data
  useEffect(() => {
    if (step === 'extract' && resumeHash) {
      handleExtractTechnologies();
    }
  }, [step, resumeHash]);

  // API call to load saved SWOT analyses
  const loadSavedAnalyses = async () => {
    try {
      const token = localStorage.getItem('token'); // Adjust based on your auth implementation
      const response = await fetch(`${apiBaseUrl}/swot/saved?resumeHash=${resumeHash}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSavedAnalyses(data.analyses || []);
      }
    } catch (err) {
      console.error('Failed to load saved analyses:', err);
    }
  };

  const handleExtractTechnologies = async () => {
    if (!resumeHash) {
      setError('Resume analysis is required. Please analyze your resume first.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiBaseUrl}/swot/extract-technologies`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resumeHash })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setExtractedTechnologies(data.technologies || []);
        setStep('rating');
        if (data.technologies.length === 0) {
          setError('No technologies found in resume. You may need to add them manually.');
        }
      } else {
        setError(data.message || 'Failed to extract technologies');
      }
    } catch (err) {
      console.error('Technology extraction error:', err);
      setError('Failed to extract technologies. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRatingChange = (techIndex, newRating) => {
    const updatedTechnologies = [...extractedTechnologies];
    updatedTechnologies[techIndex].confidenceLevel = parseInt(newRating);
    setExtractedTechnologies(updatedTechnologies);
  };

  const handleGenerateSWOT = async () => {
    if (extractedTechnologies.length === 0) {
      setError('No technologies available for SWOT analysis.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      
      // First save the technology ratings
      const ratingsResponse = await fetch(`${apiBaseUrl}/swot/save-ratings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          technologies: extractedTechnologies,
          resumeHash
        })
      });

      if (!ratingsResponse.ok) {
        const ratingsError = await ratingsResponse.json();
        throw new Error(ratingsError.message || 'Failed to save technology ratings');
      }

      // Then generate SWOT analysis
      const swotResponse = await fetch(`${apiBaseUrl}/swot/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resumeHash,
          jobDescriptions
        })
      });

      const swotData = await swotResponse.json();

      if (swotResponse.ok && swotData.success) {
        setSWOTResults(swotData.swotAnalysis);
        setStep('results');
        
        // Refresh saved analyses
        await loadSavedAnalyses();
      } else {
        setError(swotData.message || 'Failed to generate SWOT analysis');
      }
    } catch (err) {
      console.error('SWOT generation error:', err);
      setError(err.message || 'Failed to generate SWOT analysis.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnalysis = async (id) => {
    if (!window.confirm('Are you sure you want to delete this SWOT analysis?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiBaseUrl}/swot/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setSavedAnalyses(prev => prev.filter(analysis => analysis._id !== id));
      } else {
        const error = await response.json();
        setError(error.message || 'Failed to delete analysis');
      }
    } catch (err) {
      console.error('Delete analysis error:', err);
      setError('Failed to delete analysis');
    }
  };

  const renderExtractStep = () => (
    <div className="space-y-6 text-center">
      <h2 className="text-3xl font-bold">Technology Skill Assessment</h2>
      <p className="text-gray-600">
        We'll extract technologies from your analyzed resume and ask you to rate your confidence level.
      </p>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {resumeHash ? (
        <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-blue-800 font-medium">Resume Analysis Found</div>
          <div className="text-sm text-blue-600 mt-1">Ready to extract technologies from your resume</div>
        </div>
      ) : (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800 font-medium">Resume Analysis Required</div>
          <div className="text-sm text-red-600 mt-1">Please analyze your resume first before rating technologies</div>
        </div>
      )}

      <div className="flex justify-center space-x-4">
        {onBack && (
          <button
            onClick={onBack}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to CV Analysis
          </button>
        )}
        <button
          onClick={handleExtractTechnologies}
          disabled={loading || !resumeHash}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
        >
          {loading ? 'Extracting Technologies...' : 'Extract Technologies'}
        </button>
      </div>
    </div>
  );

  const renderRatingStep = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Rate Your Confidence</h2>
        <span className="text-sm text-gray-500">
          {extractedTechnologies.length} technologies found
        </span>
      </div>
      
      <p className="text-gray-600 text-lg">
        Rate your confidence level for each technology from 1 (beginner) to 10 (expert).
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}
      
      <div className="grid gap-4 max-h-96 overflow-y-auto bg-gray-50 p-4 rounded-lg">
        {extractedTechnologies.map((tech, index) => (
          <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-gray-800">{tech.name}</h3>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">{tech.category}</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-500 font-medium">1</span>
              <input
                type="range"
                min="1"
                max="10"
                value={tech.confidenceLevel || 5}
                onChange={(e) => handleRatingChange(index, e.target.value)}
                className="w-40 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <span className="text-sm text-gray-500 font-medium">10</span>
              <div className="ml-3 bg-blue-600 text-white px-3 py-1 rounded-lg font-bold text-lg min-w-[3rem] text-center">
                {tech.confidenceLevel || 5}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex justify-between">
        <button
          onClick={() => setStep('extract')}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
        <button
          onClick={handleGenerateSWOT}
          disabled={loading}
          className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-lg font-semibold"
        >
          {loading ? 'Generating SWOT Analysis...' : 'Generate SWOT Analysis'}
        </button>
      </div>
    </div>
  );

  const renderResults = () => (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-green-600 mb-2">SWOT Analysis Complete!</h2>
        <p className="text-gray-600 text-lg">
          Based on your resume and {swotResults?.metadata?.technologiesAnalyzed || extractedTechnologies.length} technology confidence ratings
        </p>
      </div>

      {swotResults && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <TrendingUp className="w-6 h-6 text-green-600 mr-3" />
              <h3 className="text-xl font-bold text-green-800">Strengths</h3>
            </div>
            <ul className="space-y-3">
              {swotResults.strengths?.map((strength, index) => (
                <li key={index} className="text-green-700 flex items-start">
                  <span className="w-2 h-2 bg-green-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span className="text-sm leading-relaxed">{strength}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <TrendingDown className="w-6 h-6 text-red-600 mr-3" />
              <h3 className="text-xl font-bold text-red-800">Weaknesses</h3>
            </div>
            <ul className="space-y-3">
              {swotResults.weaknesses?.map((weakness, index) => (
                <li key={index} className="text-red-700 flex items-start">
                  <span className="w-2 h-2 bg-red-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span className="text-sm leading-relaxed">{weakness}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <Target className="w-6 h-6 text-blue-600 mr-3" />
              <h3 className="text-xl font-bold text-blue-800">Opportunities</h3>
            </div>
            <ul className="space-y-3">
              {swotResults.opportunities?.map((opportunity, index) => (
                <li key={index} className="text-blue-700 flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span className="text-sm leading-relaxed">{opportunity}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <Shield className="w-6 h-6 text-yellow-600 mr-3" />
              <h3 className="text-xl font-bold text-yellow-800">Threats</h3>
            </div>
            <ul className="space-y-3">
              {swotResults.threats?.map((threat, index) => (
                <li key={index} className="text-yellow-700 flex items-start">
                  <span className="w-2 h-2 bg-yellow-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span className="text-sm leading-relaxed">{threat}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex space-x-4 justify-center">
        <button
          onClick={() => setStep('rating')}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Update Ratings
        </button>
        <button
          onClick={() => setStep('saved')}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          View Saved Analyses
        </button>
      </div>
    </div>
  );

  const renderSavedAnalyses = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Saved SWOT Analyses</h2>
        <div className="space-x-2">
          <button
            onClick={() => setStep('results')}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Back to Results
          </button>
          <button
            onClick={() => {
              setStep('extract');
              setExtractedTechnologies([]);
              setSWOTResults(null);
              setError('');
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            New Analysis
          </button>
        </div>
      </div>

      {savedAnalyses.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Saved Analyses</h3>
          <p className="text-gray-500">Create your first SWOT analysis to see it here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {savedAnalyses.map((analysis, index) => (
            <div key={analysis._id || index} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Analysis #{index + 1}</h3>
                  <p className="text-sm text-gray-500">
                    {analysis.technologiesAnalyzed || 0} technologies • 
                    Created {new Date(analysis.analysisDate || analysis.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteAnalysis(analysis._id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Delete
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-green-50 p-3 rounded">
                  <div className="font-medium text-green-700 mb-1">Strengths</div>
                  <div className="text-gray-600">{analysis.strengths?.length || 0} items</div>
                </div>
                <div className="bg-red-50 p-3 rounded">
                  <div className="font-medium text-red-700 mb-1">Weaknesses</div>
                  <div className="text-gray-600">{analysis.weaknesses?.length || 0} items</div>
                </div>
                <div className="bg-blue-50 p-3 rounded">
                  <div className="font-medium text-blue-700 mb-1">Opportunities</div>
                  <div className="text-gray-600">{analysis.opportunities?.length || 0} items</div>
                </div>
                <div className="bg-yellow-50 p-3 rounded">
                  <div className="font-medium text-yellow-700 mb-1">Threats</div>
                  <div className="text-gray-600">{analysis.threats?.length || 0} items</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!resumeHash && step === 'extract') {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-800 mb-4">Resume Analysis Required</h2>
          <p className="text-red-600 mb-6">
            Please analyze your resume first before rating technologies.
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center mx-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to CV Analysis
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <style jsx>{`
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
      `}</style>
      
      {step === 'extract' && renderExtractStep()}
      {step === 'rating' && renderRatingStep()}
      {step === 'results' && renderResults()}
      {step === 'saved' && renderSavedAnalyses()}
    </div>
  );
};

export default SWOTAnalysis;
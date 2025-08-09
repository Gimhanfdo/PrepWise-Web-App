import React, { useState, useEffect, useContext } from 'react';
import { User, Mail, Lock, FileText, Brain, Crown, Settings, Save, Eye, EyeOff, Download, Trash2, ChevronDown, ChevronUp, Star, TrendingUp, Target, Award } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const UserProfile = () => {
  const navigate = useNavigate();
  const { backendUrl, userData, getUserData, isLoggedin, setIsLoggedin, setUserData } = useContext(AppContext);

  const [activeTab, setActiveTab] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [savedAnalyses, setSavedAnalyses] = useState([]);
  const [skillsAssessments, setSkillsAssessments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [expandedAnalysis, setExpandedAnalysis] = useState(null);
  const [expandedAssessment, setExpandedAssessment] = useState(null);

  // Local user state for editing
  const [localUser, setLocalUser] = useState(null);

  useEffect(() => {
    // Check if user is logged in
    if (!isLoggedin) {
      navigate('/login');
      return;
    }

    const initializeProfile = async () => {
      setPageLoading(true);
      try {
        // If no userData in context, fetch it
        if (!userData) {
          await getUserData();
        } else {
          setLocalUser({ ...userData });
        }

        // Fetch additional data
        await Promise.all([
          fetchSavedAnalyses(),
          fetchSkillsAssessments()
        ]);
      } catch (error) {
        console.error('Error initializing profile:', error);
        toast.error('Failed to load profile data');
      } finally {
        setPageLoading(false);
      }
    };

    initializeProfile();
  }, [isLoggedin, userData]);

  // Update local user when context userData changes
  useEffect(() => {
    if (userData) {
      setLocalUser({ ...userData });
    }
  }, [userData]);

 const fetchSavedAnalyses = async () => {
  try {
    // Use the correct endpoint from analysisRouter
    const { data } = await axios.get(backendUrl + '/api/analyze/saved');
    if (data.success) {
      // Transform the data to match what your UI expects
      const formattedAnalyses = data.data.map(analysis => {
        const results = analysis.results || [];
        const softwareRoles = results.filter(r => !r.isNonTechRole);
        
        // Calculate average match percentage
        const avgMatch = softwareRoles.length > 0 
          ? Math.round(softwareRoles.reduce((sum, r) => sum + (r.matchPercentage || 0), 0) / softwareRoles.length)
          : 0;

        // Get the best matching job (highest percentage)
        const bestMatch = softwareRoles.reduce((best, current) => 
          (current.matchPercentage || 0) > (best.matchPercentage || 0) ? current : best, 
          { matchPercentage: 0 }
        );

        // Extract job title and company from job description if available
        let jobTitle = 'Software Engineering Position';
        let company = 'Company';
        
        if (analysis.jobDescriptions && analysis.jobDescriptions.length > 0) {
          const firstJobDesc = analysis.jobDescriptions[0];
          // Simple extraction logic
          const titleMatch = firstJobDesc.match(/(?:position|role|title):\s*([^\n<]+)/i);
          const companyMatch = firstJobDesc.match(/(?:company|organization):\s*([^\n<]+)/i) || 
                             firstJobDesc.match(/<strong>([^<]+)<\/strong>/);
          
          if (titleMatch) jobTitle = titleMatch[1].trim();
          if (companyMatch) company = companyMatch[1].trim();
        }

        return {
          id: analysis._id,
          jobTitle,
          company,
          matchPercentage: avgMatch,
          totalJobs: results.length,
          softwareJobs: softwareRoles.length,
          createdAt: analysis.createdAt,
          updatedAt: analysis.updatedAt,
          strengths: bestMatch.strengths || [],
          recommendations: [
            ...(bestMatch.contentRecommendations || []),
            ...(bestMatch.structureRecommendations || [])
          ].slice(0, 5),
          hasMultipleJobs: results.length > 1
        };
      });
      
      setSavedAnalyses(formattedAnalyses);
    }
  } catch (error) {
    console.error('Error fetching saved analyses:', error);
  }
};

 const fetchSkillsAssessments = async () => {
  try {
    // Use the correct endpoint from skillAssessor
    const { data } = await axios.get(backendUrl + '/api/swot/ratings');
    if (data.success) {
      // Transform the data to match what your UI expects
      const formattedAssessments = data.data.map(assessment => {
        const technologies = assessment.technologies || [];
        const summary = assessment.summary || {};
        
        // Calculate overall score based on confidence levels
        const avgConfidence = summary.averageConfidence || 0;
        const score = Math.round((avgConfidence / 10) * 100);

        // Determine assessment type
        let assessmentType = 'Technical Skills Assessment';
        const techCategories = [...new Set(technologies.map(t => t.category))];
        if (techCategories.length > 0) {
          assessmentType = techCategories.join(', ') + ' Assessment';
        }

        // Determine level based on average confidence
        let level = 'Beginner';
        if (avgConfidence >= 8) level = 'Expert';
        else if (avgConfidence >= 6) level = 'Advanced';
        else if (avgConfidence >= 4) level = 'Intermediate';

        return {
          id: assessment._id,
          assessmentType,
          level,
          score,
          totalTechnologies: summary.totalTechnologies || technologies.length,
          averageConfidence: avgConfidence,
          expertCount: summary.expertCount || 0,
          proficientCount: summary.proficientCount || 0,
          learningCount: summary.learningCount || 0,
          completedAt: assessment.updatedAt,
          createdAt: assessment.createdAt,
          topTechnologies: technologies
            .sort((a, b) => b.confidenceLevel - a.confidenceLevel)
            .slice(0, 5)
            .map(t => ({ name: t.name, confidence: t.confidenceLevel })),
          isRecent: assessment.isRecent
        };
      });
      
      setSkillsAssessments(formattedAssessments);
    }
  } catch (error) {
    console.error('Error fetching skills assessments:', error);
  }
};

  const updateProfile = async () => {
    setLoading(true);
    try {
      const { data } = await axios.put(backendUrl + '/api/user/profile', {
        name: localUser.name,
        phoneNumber: localUser.phoneNumber,
        accountType: localUser.accountType
      });

      if (data.success) {
        // Update context with new data
        setUserData(data.data);
        toast.success('Profile updated successfully');
      } else {
        toast.error(data.message || 'Failed to update profile');
      }
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Failed to update profile';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (passwords.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.put(backendUrl + '/api/user/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });

      if (data.success) {
        toast.success('Password updated successfully');
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.error(data.message || 'Failed to update password');
      }
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Failed to update password';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const upgradeToPremium = async () => {
    setLoading(true);
    try {
      const { data } = await axios.put(backendUrl + '/api/user/upgrade-premium');

      if (data.success) {
        setLocalUser(prev => ({ ...prev, accountPlan: 'premium' }));
        // Update context
        await getUserData();
        toast.success('Account upgraded to Premium!');
      } else {
        toast.error(data.message || 'Failed to upgrade account');
      }
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Failed to upgrade account';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const downgradeToBasic = async () => {
    setLoading(true);
    try {
      const { data } = await axios.put(backendUrl + '/api/user/downgrade-basic');

      if (data.success) {
        setLocalUser(prev => ({ ...prev, accountPlan: 'basic' }));
        // Update context
        await getUserData();
        toast.success('Account downgraded to Basic');
      } else {
        toast.error(data.message || 'Failed to downgrade account');
      }
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Failed to downgrade account';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const deleteAnalysis = async (id) => {
  if (!window.confirm('Are you sure you want to delete this CV analysis?')) {
    return;
  }

  try {
    // Use the correct endpoint
    const { data } = await axios.delete(backendUrl + `/api/analyze/delete/${id}`);

    if (data.success) {
      setSavedAnalyses(prev => prev.filter(analysis => analysis.id !== id));
      toast.success('Analysis deleted successfully');
    } else {
      toast.error(data.message || 'Failed to delete analysis');
    }
  } catch (error) {
    const msg = error.response?.data?.message || error.message || 'Failed to delete analysis';
    toast.error(msg);
  }
};

const deleteAssessment = async (id) => {
  if (!window.confirm('Are you sure you want to delete this skills assessment?')) {
    return;
  }

  try {
    // Use the correct endpoint
    const { data } = await axios.delete(backendUrl + `/api/swot/delete/${id}`);

    if (data.success) {
      setSkillsAssessments(prev => prev.filter(assessment => assessment.id !== id));
      toast.success('Assessment deleted successfully');
    } else {
      toast.error(data.message || 'Failed to delete assessment');
    }
  } catch (error) {
    const msg = error.response?.data?.message || error.message || 'Failed to delete assessment';
    toast.error(msg);
  }
};

  const downloadAnalysis = async (id) => {
    try {
      // This would typically generate a PDF report
      toast.info('Download functionality coming soon!');
    } catch (error) {
      toast.error('Failed to download analysis');
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(backendUrl + '/api/auth/logout');
      setIsLoggedin(false);
      setUserData(null);
      navigate('/login');
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if request fails
      setIsLoggedin(false);
      setUserData(null);
      navigate('/login');
    }
  };

  const getMatchScoreColor = (percentage) => {
    if (percentage >= 80) return 'text-green-800 bg-green-100';
    if (percentage >= 60) return 'text-yellow-800 bg-yellow-100';
    if (percentage >= 40) return 'text-orange-800 bg-orange-100';
    return 'text-red-800 bg-red-100';
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-800 bg-green-100';
    if (score >= 70) return 'text-blue-800 bg-blue-100';
    if (score >= 50) return 'text-yellow-800 bg-yellow-100';
    return 'text-red-800 bg-red-100';
  };

  // Show loading spinner while page is loading
  if (pageLoading || !localUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const renderProfileTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <User className="mr-2" size={20} />
          Profile Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={localUser.name || ''}
              onChange={(e) => setLocalUser(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="text"
              value={localUser.phoneNumber || ''}
              onChange={(e) => setLocalUser(prev => ({ ...prev, phoneNumber: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={localUser.email || ''}
              disabled
              className="w-full p-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
            <select
              value={localUser.accountType || ''}
              onChange={(e) => setLocalUser(prev => ({ ...prev, accountType: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Fresher">Fresher</option>
              <option value="Trainer">Trainer</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Status</label>
            <div className="flex items-center">
              <span className={`px-2 py-1 rounded-full text-xs ${localUser.isAccountVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {localUser.isAccountVerified ? 'Verified' : 'Unverified'}
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={updateProfile}
          disabled={loading}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
        >
          <Save className="mr-2" size={16} />
          {loading ? 'Updating...' : 'Update Profile'}
        </button>
      </div>

      {/* Enhanced Saved CV Analysis Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <FileText className="mr-2" size={20} />
          Saved CV Analysis Results ({savedAnalyses.length})
        </h3>
        {savedAnalyses.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">No saved CV analyses found.</p>
            <p className="text-sm text-gray-500">Analyze your CV against job descriptions to see results here.</p>
            <button 
              onClick={() => navigate('/cv-analyzer')}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Start CV Analysis
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {savedAnalyses.map((analysis) => (
              <div key={analysis.id} className="border border-gray-200 rounded-lg">
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-lg text-gray-900">{analysis.jobTitle}</h4>
                        {analysis.hasMultipleJobs && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {analysis.totalJobs} jobs
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mb-2">{analysis.company}</p>
                      <p className="text-sm text-gray-500 mb-3">
                        Analyzed on {new Date(analysis.createdAt).toLocaleDateString()}
                        {analysis.updatedAt !== analysis.createdAt && (
                          <span> • Updated {new Date(analysis.updatedAt).toLocaleDateString()}</span>
                        )}
                      </p>
                      
                      <div className="flex items-center space-x-4 mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">Match Score: </span>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getMatchScoreColor(analysis.matchPercentage)}`}>
                            {analysis.matchPercentage}%
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {analysis.softwareJobs} software roles analyzed
                        </div>
                      </div>

                      {/* Quick preview of top recommendations */}
                      {analysis.recommendations && analysis.recommendations.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-1">Top Recommendations:</p>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {analysis.recommendations.slice(0, 2).map((rec, idx) => (
                              <li key={idx} className="flex items-start">
                                <Target className="mr-2 mt-1 flex-shrink-0" size={12} />
                                <span className="line-clamp-1">{rec}</span>
                              </li>
                            ))}
                            {analysis.recommendations.length > 2 && (
                              <li className="text-blue-600 cursor-pointer" 
                                  onClick={() => setExpandedAnalysis(expandedAnalysis === analysis.id ? null : analysis.id)}>
                                +{analysis.recommendations.length - 2} more recommendations
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <button 
                        onClick={() => setExpandedAnalysis(expandedAnalysis === analysis.id ? null : analysis.id)}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-md"
                        title="View Details"
                      >
                        {expandedAnalysis === analysis.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <button 
                        onClick={() => downloadAnalysis(analysis.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"
                        title="Download Report"
                      >
                        <Download size={16} />
                      </button>
                      <button 
                        onClick={() => deleteAnalysis(analysis.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                        title="Delete Analysis"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedAnalysis === analysis.id && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Strengths */}
                      {analysis.strengths && analysis.strengths.length > 0 && (
                        <div>
                          <h5 className="font-medium text-green-800 mb-2 flex items-center">
                            <Star className="mr-2" size={16} />
                            Key Strengths
                          </h5>
                          <ul className="space-y-1">
                            {analysis.strengths.slice(0, 5).map((strength, idx) => (
                              <li key={idx} className="text-sm text-gray-700 flex items-start">
                                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-2 flex-shrink-0"></div>
                                {strength}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* All Recommendations */}
                      {analysis.recommendations && analysis.recommendations.length > 0 && (
                        <div>
                          <h5 className="font-medium text-blue-800 mb-2 flex items-center">
                            <TrendingUp className="mr-2" size={16} />
                            Improvement Areas
                          </h5>
                          <ul className="space-y-1">
                            {analysis.recommendations.map((rec, idx) => (
                              <li key={idx} className="text-sm text-gray-700 flex items-start">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-2 flex-shrink-0"></div>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Analysis Stats */}
                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>Analysis ID: {analysis.id.slice(-8)}</span>
                        <span>Software Roles: {analysis.softwareJobs}/{analysis.totalJobs}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      {/* Change Password */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Lock className="mr-2" size={20} />
          Change Password
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwords.currentPassword}
                onChange={(e) => setPasswords(prev => ({ ...prev, currentPassword: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={passwords.newPassword}
              onChange={(e) => setPasswords(prev => ({ ...prev, newPassword: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords(prev => ({ ...prev, confirmPassword: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handlePasswordChange}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderSkillsTab = () => (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Brain className="mr-2" size={20} />
        Skills Assessment Results ({skillsAssessments.length})
      </h3>
      {skillsAssessments.length === 0 ? (
        <div className="text-center py-8">
          <Brain className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">No skills assessments completed yet.</p>
          <p className="text-sm text-gray-500">Complete a SWOT analysis to see your technology proficiency results here.</p>
          <button 
            onClick={() => navigate('/swot')}
            className="mt-3 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Start Skills Assessment
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {skillsAssessments.map((assessment) => (
            <div key={assessment.id} className="border border-gray-200 rounded-lg">
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium text-lg text-gray-900">{assessment.assessmentType}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        assessment.level === 'Expert' ? 'bg-purple-100 text-purple-800' :
                        assessment.level === 'Advanced' ? 'bg-blue-100 text-blue-800' :
                        assessment.level === 'Intermediate' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {assessment.level}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div className="text-center">
                        <div className={`text-lg font-bold ${getScoreColor(assessment.score)}`}>
                          {assessment.score}/100
                        </div>
                        <div className="text-xs text-gray-500">Overall Score</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900">{assessment.totalTechnologies}</div>
                        <div className="text-xs text-gray-500">Technologies</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">{assessment.expertCount}</div>
                        <div className="text-xs text-gray-500">Expert Level</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{assessment.proficientCount}</div>
                        <div className="text-xs text-gray-500">Proficient</div>
                      </div>
                    </div>

                    <p className="text-sm text-gray-500 mb-3">
                      Completed on {new Date(assessment.completedAt).toLocaleDateString()}
                      {assessment.isRecent && (
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Recent
                        </span>
                      )}
                    </p>

                    {/* Top Technologies Preview */}
                    {assessment.topTechnologies && assessment.topTechnologies.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Top Skills:</p>
                        <div className="flex flex-wrap gap-2">
                          {assessment.topTechnologies.slice(0, 5).map((tech, idx) => (
                            <div key={idx} className="flex items-center space-x-1 bg-gray-100 rounded-full px-3 py-1">
                              <span className="text-sm font-medium">{tech.name}</span>
                              <div className="flex">
                                {[...Array(10)].map((_, i) => (
                                  <Star 
                                    key={i} 
                                    size={10} 
                                    className={i < tech.confidence ? 'text-yellow-400 fill-current' : 'text-gray-300'} 
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-gray-600">{tech.confidence}/10</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2 ml-4">
                    <button 
                      onClick={() => setExpandedAssessment(expandedAssessment === assessment.id ? null : assessment.id)}
                      className="p-2 text-gray-600 hover:bg-gray-50 rounded-md"
                      title="View Details"
                    >
                      {expandedAssessment === assessment.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button 
                      onClick={() => downloadAnalysis(assessment.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"
                      title="Download Report"
                    >
                      <Download size={16} />
                    </button>
                    <button 
                      onClick={() => deleteAssessment(assessment.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                      title="Delete Assessment"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Assessment Details */}
              {expandedAssessment === assessment.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Confidence Distribution */}
                    <div>
                      <h5 className="font-medium text-gray-800 mb-3 flex items-center">
                        <TrendingUp className="mr-2" size={16} />
                        Confidence Distribution
                      </h5>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Expert (8-10)</span>
                          <span className="font-medium text-purple-600">{assessment.expertCount} skills</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Proficient (6-7)</span>
                          <span className="font-medium text-blue-600">{assessment.proficientCount} skills</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Learning (1-5)</span>
                          <span className="font-medium text-green-600">{assessment.learningCount} skills</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-sm font-medium text-gray-700">Average Confidence</span>
                          <span className="font-bold text-gray-900">{assessment.averageConfidence.toFixed(1)}/10</span>
                        </div>
                      </div>
                    </div>

                    {/* All Technologies */}
                    {assessment.topTechnologies && assessment.topTechnologies.length > 0 && (
                      <div>
                        <h5 className="font-medium text-gray-800 mb-3 flex items-center">
                          <Award className="mr-2" size={16} />
                          All Technologies ({assessment.totalTechnologies})
                        </h5>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {assessment.topTechnologies.map((tech, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border">
                              <span className="text-sm font-medium">{tech.name}</span>
                              <div className="flex items-center space-x-2">
                                <div className="flex">
                                  {[...Array(10)].map((_, i) => (
                                    <Star 
                                      key={i} 
                                      size={12} 
                                      className={i < tech.confidence ? 'text-yellow-400 fill-current' : 'text-gray-300'} 
                                    />
                                  ))}
                                </div>
                                <span className="text-xs text-gray-600 min-w-[30px]">{tech.confidence}/10</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Assessment Stats */}
                  <div className="mt-4 pt-4 border-t border-gray-300">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Assessment ID: {assessment.id.slice(-8)}</span>
                      <span>Overall Proficiency: {assessment.level}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSubscriptionTab = () => (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Crown className="mr-2" size={20} />
        Subscription Plan
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`border-2 rounded-lg p-6 ${localUser.accountPlan === 'basic' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
          <div className="text-center">
            <h4 className="text-xl font-semibold">Basic Plan</h4>
            <p className="text-3xl font-bold text-gray-900 mt-2">Free</p>
            <ul className="mt-4 space-y-2 text-sm text-left">
              <li>✓ 5 CV analyses per month</li>
              <li>✓ 1 job description per analysis</li>
              <li>✓ Basic skills assessment</li>
              <li>✓ Standard support</li>
              <li>✗ Multiple job comparison</li>
              <li>✗ Advanced analytics</li>
              <li>✗ Priority support</li>
            </ul>
            {localUser.accountPlan === 'basic' ? (
              <div className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md">
                Current Plan
              </div>
            ) : (
              <button 
                onClick={downgradeToBasic}
                disabled={loading}
                className="mt-4 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Downgrade'}
              </button>
            )}
          </div>
        </div>

        <div className={`border-2 rounded-lg p-6 ${localUser.accountPlan === 'premium' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200'}`}>
          <div className="text-center">
            <h4 className="text-xl font-semibold">Premium Plan</h4>
            <p className="text-3xl font-bold text-gray-900 mt-2">LKR 2,500<span className="text-sm font-normal">/month</span></p>
            <ul className="mt-4 space-y-2 text-sm text-left">
              <li>✓ Unlimited CV analyses</li>
              <li>✓ Compare against 5 job descriptions</li>
              <li>✓ Advanced skills assessment</li>
              <li>✓ Detailed analytics & insights</li>
              <li>✓ Priority support</li>
              <li>✓ Export reports to PDF</li>
              <li>✓ Job matching recommendations</li>
              <li>✓ Interview preparation tips</li>
            </ul>
            {localUser.accountPlan === 'premium' ? (
              <div className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md">
                Current Plan
              </div>
            ) : (
              <button 
                onClick={upgradeToPremium}
                disabled={loading}
                className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Upgrade Now'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Premium Features Highlight */}
      <div className="mt-6 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-yellow-800 mb-3">Premium Feature Highlight</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h5 className="font-medium text-gray-900 mb-2">Multi-Job Analysis</h5>
            <p className="text-gray-600">Upload your CV once and compare it against up to 5 different job descriptions simultaneously. Get match percentages and tailored recommendations for each position.</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h5 className="font-medium text-gray-900 mb-2">Smart Recommendations</h5>
            <p className="text-gray-600">Receive personalized suggestions on which job positions best match your skills and experience, plus actionable advice to improve your candidacy.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Settings className="mr-2" size={20} />
        Account Settings
      </h3>
      
      <div className="space-y-6">
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Account Actions</h4>
          <p className="text-sm text-gray-600 mb-4">Manage your account access and session.</p>
          <button 
            onClick={handleLogout}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'skills', label: 'Skills Assessment', icon: Brain },
    { id: 'subscription', label: 'Subscription', icon: Crown },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {localUser.name ? localUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{localUser.name}</h1>
                <p className="text-gray-600">{localUser.email}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    localUser.accountPlan === 'premium' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {localUser.accountPlan ? localUser.accountPlan.charAt(0).toUpperCase() + localUser.accountPlan.slice(1) : 'Basic'} Plan
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    localUser.accountType === 'Trainer' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {localUser.accountType}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex space-x-2">
              <button 
                onClick={() => navigate('/cv-analyzer')}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                CV Analyzer
              </button>
              <button 
                onClick={() => navigate('/swot')}
                className="px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Skills Assessment
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <nav className="bg-white rounded-lg shadow p-4">
              <ul className="space-y-2">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <li key={tab.id}>
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full text-left px-3 py-2 rounded-md flex items-center space-x-3 transition-colors ${
                          activeTab === tab.id 
                            ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-700' 
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon size={18} />
                        <span>{tab.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === 'profile' && renderProfileTab()}
            {activeTab === 'security' && renderSecurityTab()}
            {activeTab === 'skills' && renderSkillsTab()}
            {activeTab === 'subscription' && renderSubscriptionTab()}
            {activeTab === 'settings' && renderSettingsTab()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
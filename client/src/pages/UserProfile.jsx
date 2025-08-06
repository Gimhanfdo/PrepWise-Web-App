import React, { useState, useEffect, useContext } from 'react';
import { User, Mail, Lock, FileText, Brain, Crown, Settings, Save, Eye, EyeOff, Bell, Trash2, Download } from 'lucide-react';
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
  const [notifications, setNotifications] = useState({
    emailUpdates: true,
    cvAnalysisAlerts: true,
    skillsReminders: false
  });
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

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
          // Set notification preferences if they exist
          if (userData.notificationSettings) {
            setNotifications(userData.notificationSettings);
          }
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
      if (userData.notificationSettings) {
        setNotifications(userData.notificationSettings);
      }
    }
  }, [userData]);

  const fetchSavedAnalyses = async () => {
    try {
      const { data } = await axios.get(backendUrl + '/api/user/saved-analyses');
      if (data.success) {
        setSavedAnalyses(data.data);
      }
    } catch (error) {
      console.error('Error fetching saved analyses:', error);
    }
  };

  const fetchSkillsAssessments = async () => {
    try {
      const { data } = await axios.get(backendUrl + '/api/user/skills-assessments');
      if (data.success) {
        setSkillsAssessments(data.data);
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

  const updateNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await axios.put(backendUrl + '/api/user/notifications', notifications);

      if (data.success) {
        toast.success('Notification settings updated successfully');
        // Update userData in context
        await getUserData();
      } else {
        toast.error(data.message || 'Failed to update notifications');
      }
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Failed to update notifications';
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
    try {
      const { data } = await axios.delete(backendUrl + `/api/user/analysis/${id}`);

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
    try {
      const { data } = await axios.delete(backendUrl + `/api/user/assessment/${id}`);

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

  const renderSavedCVTab = () => (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <FileText className="mr-2" size={20} />
        Saved CV Analysis Feedback
      </h3>
      {savedAnalyses.length === 0 ? (
        <p className="text-gray-600">No saved CV analyses found.</p>
      ) : (
        <div className="space-y-4">
          {savedAnalyses.map((analysis) => (
            <div key={analysis.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium text-lg">{analysis.jobTitle}</h4>
                  <p className="text-gray-600">{analysis.company}</p>
                  <p className="text-sm text-gray-500">Analyzed on {new Date(analysis.createdAt).toLocaleDateString()}</p>
                  <div className="mt-2">
                    <span className="text-sm font-medium">Match Percentage: </span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      analysis.matchPercentage >= 80 ? 'bg-green-100 text-green-800' : 
                      analysis.matchPercentage >= 60 ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {analysis.matchPercentage}%
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                    <Download size={16} />
                  </button>
                  <button 
                    onClick={() => deleteAnalysis(analysis.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSkillsTab = () => (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Brain className="mr-2" size={20} />
        Skills Assessment Feedback
      </h3>
      {skillsAssessments.length === 0 ? (
        <p className="text-gray-600">No skills assessments completed yet.</p>
      ) : (
        <div className="space-y-4">
          {skillsAssessments.map((assessment) => (
            <div key={assessment.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium text-lg">{assessment.assessmentType}</h4>
                  <p className="text-gray-600">Level: {assessment.level}</p>
                  <p className="text-sm text-gray-500">Completed on {new Date(assessment.completedAt).toLocaleDateString()}</p>
                  <div className="mt-2">
                    <span className="text-sm font-medium">Score: </span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      assessment.score >= 90 ? 'bg-green-100 text-green-800' : 
                      assessment.score >= 70 ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {assessment.score}/100
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                    <Download size={16} />
                  </button>
                  <button 
                    onClick={() => deleteAssessment(assessment.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
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
              <li>✓ Basic skills assessment</li>
              <li>✓ Standard support</li>
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
            <p className="text-3xl font-bold text-gray-900 mt-2">$9.99<span className="text-sm font-normal">/month</span></p>
            <ul className="mt-4 space-y-2 text-sm text-left">
              <li>✓ Unlimited CV analyses</li>
              <li>✓ Advanced skills assessment</li>
              <li>✓ Detailed analytics & insights</li>
              <li>✓ Priority support</li>
              <li>✓ Export reports to PDF</li>
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
    </div>
  );

  const renderSettingsTab = () => (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Settings className="mr-2" size={20} />
        Notification Settings
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
          <div>
            <h4 className="font-medium">Email Updates</h4>
            <p className="text-sm text-gray-600">Receive updates about new features and tips</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.emailUpdates}
              onChange={(e) => setNotifications(prev => ({ ...prev, emailUpdates: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
          <div>
            <h4 className="font-medium">CV Analysis Alerts</h4>
            <p className="text-sm text-gray-600">Get notified when your CV analysis is complete</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.cvAnalysisAlerts}
              onChange={(e) => setNotifications(prev => ({ ...prev, cvAnalysisAlerts: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
          <div>
            <h4 className="font-medium">Skills Assessment Reminders</h4>
            <p className="text-sm text-gray-600">Weekly reminders to take skills assessments</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.skillsReminders}
              onChange={(e) => setNotifications(prev => ({ ...prev, skillsReminders: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <button
          onClick={updateNotifications}
          disabled={loading}
          className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Save Notification Settings'}
        </button>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-red-600 font-medium mb-2">Danger Zone</h4>
        <div className="space-y-2">
          <button 
            onClick={handleLogout}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 mr-2"
          >
            Logout
          </button>
          <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
            Delete Account
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-2">Account deletion cannot be undone. All your data will be permanently deleted.</p>
      </div>
    </div>
  );

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'cv-feedback', label: 'CV Feedback', icon: FileText },
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
            {activeTab === 'cv-feedback' && renderSavedCVTab()}
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
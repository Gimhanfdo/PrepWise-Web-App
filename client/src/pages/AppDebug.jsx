import React, { useContext, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import axios from 'axios';

// Temporary debugging component - add this to your app temporarily
const AuthDebugComponent = () => {
  const { isLoggedin, userData, backendUrl } = useContext(AppContext);

  useEffect(() => {
    const debugAuth = async () => {
      console.log('=== AUTH DEBUG INFO ===');
      console.log('isLoggedin:', isLoggedin);
      console.log('userData:', userData);
      console.log('backendUrl:', backendUrl);
      
      // Check cookies
      console.log('Document cookies:', document.cookie);
      
      // Check localStorage for token
      const localToken = localStorage.getItem('token');
      console.log('localStorage token:', localToken);
      
      // Check axios default headers
      console.log('Axios default headers:', axios.defaults.headers.common);
      
      // Try to make an authenticated request
      try {
        const response = await axios.get(backendUrl + '/api/user/profile');
        console.log('Profile API Response:', response.data);
      } catch (error) {
        console.error('Profile API Error:', error.response?.data || error.message);
        console.error('Error status:', error.response?.status);
        console.error('Error headers:', error.response?.headers);
      }
    };

    debugAuth();
  }, [isLoggedin, userData, backendUrl]);

  return (
    <div style={{ 
      position: 'fixed', 
      top: 10, 
      right: 10, 
      background: 'rgba(0,0,0,0.8)', 
      color: 'white', 
      padding: '10px', 
      borderRadius: '5px',
      fontSize: '12px',
      maxWidth: '300px',
      zIndex: 9999
    }}>
      <strong>Debug Info:</strong><br/>
      Logged In: {isLoggedin ? 'Yes' : 'No'}<br/>
      User: {userData?.name || 'None'}<br/>
      Email: {userData?.email || 'None'}<br/>
      <button 
        onClick={() => window.location.reload()}
        style={{ marginTop: '5px', padding: '2px 5px' }}
      >
        Refresh
      </button>
    </div>
  );
};

export default AuthDebugComponent;
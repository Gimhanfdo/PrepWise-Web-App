import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import EmailVerify from './pages/EmailVerify'
import ResetPassword from './pages/ResetPassword'
import {ToastContainer} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import TrainerDashboard from './pages/TrainerDashboard';
import FresherDashboard from './pages/FresherDashboard'
import ProfileSettings from './pages/ProfileSettings'
import CVAnalyzer from './pages/CVAnalyzer'
import SignUp from './pages/SignUp'
import SWOTAnalysis from './pages/SWOTAnalysis'

const App = () => {
  return (
    <div>
      <ToastContainer/>
      <Routes>
        {/* Authentication Routes */}
        <Route path='/' element={<Login/>}/>
        <Route path='/register' element={<SignUp/>}/>
        <Route path='/login' element={<Login/>}/>
        <Route path='/email-verify' element={<EmailVerify/>}/>
        <Route path='/reset-password' element={<ResetPassword/>}/>
        
        {/* Dashboard Routes */}
        <Route path='/trainer-dashboard' element={<TrainerDashboard/>}/>
        <Route path='/fresher-dashboard' element={<FresherDashboard/>}/>
        <Route path='/profile-settings' element={<ProfileSettings/>}/>
        
        {/* Feature Routes */}
        <Route path='/cv-analyzer' element={<CVAnalyzer/>}/>
        <Route path='/swot' element={<SWOTAnalysis/>}/>
        
        {/* Catch all route - redirect to login */}
        <Route path='*' element={<Login/>}/>
      </Routes>
    </div>
  )
}

export default App
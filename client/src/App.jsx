import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import EmailVerify from './pages/EmailVerify'
import ResetPassword from './pages/ResetPassword'
import Register from './pages/register'
import {ToastContainer} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import TrainerDashboard from './pages/TrainerDashboard';
import FresherDashboard from './pages/FresherDashboard'
import ProfileSettings from './pages/ProfileSettings'
import CVAnalyzer from './pages/CVAnalyzer'

const App = () => {
  return (
    <div>
      <ToastContainer/>
      <Routes>
        <Route path='/' element={<Login/>}/>
        <Route path='/register' element={<Register/>}/>
        <Route path='/login' element={<Login/>}/>
        <Route path='/email-verify' element={<EmailVerify/>}/>
        <Route path='/reset-password' element={<ResetPassword/>}/>
        <Route path='/trainer-dashboard' element={<TrainerDashboard/>}/>
        <Route path='/fresher-dashboard' element={<FresherDashboard/>}/>
        <Route path='/profile-settings' element={<ProfileSettings/>}/>
        <Route path='/cv-analyzer' element={<CVAnalyzer/>}/>
      </Routes>
    </div>
  )
}

export default App

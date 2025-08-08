import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  upgradeToPremium,
  downgradeToBasic,
  getSavedAnalyses,
  getSkillsAssessments,
  deleteAnalysis,
  deleteAssessment
} from "../controllers/userController.js";

// Import CV Analysis controller methods
import { 
  getSavedAnalyses, 
  deleteAnalysis, 
  getAllAnalyses, 
  getAnalysisStats 
} from '../controllers/cvAnalysiscontroller.js';

// Import Skills Assessment controller methods
import { 
  getRatings, 
  deleteRatings, 
  getRatingsStats,
  getRatingDetails 
} from '../controllers/skillAssessorController.js';


// CV Analysis routes
router.get('/saved-analyses', userAuth, getSavedAnalyses);
router.get('/all-analyses', userAuth, getAllAnalyses);
router.get('/analysis-stats', userAuth, getAnalysisStats);
router.delete('/analysis/:id', userAuth, deleteAnalysis);

// Skills Assessment routes  
router.get('/skills-assessments', userAuth, getRatings);
router.get('/skills-stats', userAuth, getRatingsStats);
router.get('/skills-assessment/:id', userAuth, getRatingDetails);
router.delete('/assessment/:id', userAuth, deleteRatings);

const userRouter = express.Router();

// All routes require authentication
userRouter.use(userAuth);

// Profile routes
userRouter.get('/profile', getUserProfile);
userRouter.put('/profile', updateUserProfile);
userRouter.put('/change-password', changePassword);

// Subscription routes
userRouter.put('/upgrade-premium', upgradeToPremium);
userRouter.put('/downgrade-basic', downgradeToBasic);

// Data routes
userRouter.get('/saved-analyses', getSavedAnalyses);
userRouter.get('/skills-assessments', getSkillsAssessments);
userRouter.delete('/analysis/:id', deleteAnalysis);
userRouter.delete('/assessment/:id', deleteAssessment);

export default userRouter;
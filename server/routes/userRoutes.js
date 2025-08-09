import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  upgradeToPremium,
  downgradeToBasic
} from "../controllers/userController.js";

// Import CV Analysis controller methods
import { 
  getSavedAnalysis, // Singular - matches the actual method name
  deleteAnalysis
} from '../controllers/cvAnalysiscontroller.js';

// Import Skills Assessment controller methods
import { 
  getRatings, 
  deleteRatings, 
  getRatingsStats,
  getRatingDetails 
} from '../controllers/skillAssessorController.js';

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

// CV Analysis routes
userRouter.get('/saved-analyses', getSavedAnalysis); // Uses singular method name
userRouter.delete('/analysis/:id', deleteAnalysis);

// Skills Assessment routes  
userRouter.get('/skills-assessments', getRatings);
userRouter.get('/skills-stats', getRatingsStats);
userRouter.get('/skills-assessment/:id', getRatingDetails);
userRouter.delete('/assessment/:id', deleteRatings);

export default userRouter;
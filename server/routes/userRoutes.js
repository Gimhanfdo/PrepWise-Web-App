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
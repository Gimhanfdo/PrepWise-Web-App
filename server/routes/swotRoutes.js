import express from 'express';
import {
  extractTechnologiesFromResume,
  saveTechnologyRatings,
  getTechnologyRatings,
  updateTechnologyRating,
  deleteTechnologyRatings,
  getTechnologyAnalytics,
  generateSWOTAnalysis,
  getSavedSWOTAnalyses,
  deleteSWOTAnalysis
} from '../controllers/swotcontroller.js';
import { authenticateUser } from '../middleware/userAuth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

// ============= TECHNOLOGY RATING ROUTES =============

// Route to extract technologies from resume using resumeHash
router.post('/technology-ratings/extract-technologies', extractTechnologiesFromResume);

// Route to save user's technology confidence ratings
router.post('/technology-ratings/save-ratings', saveTechnologyRatings);

// Route to get user's saved technology ratings
// Query param: ?resumeHash=abc123 (optional - if not provided, gets latest)
router.get('/technology-ratings/my-ratings', getTechnologyRatings);

// Route to update individual technology rating
router.patch('/technology-ratings/update-rating', updateTechnologyRating);

// Route to delete technology ratings
// Query param: ?resumeHash=abc123 (optional - if not provided, deletes all)
router.delete('/technology-ratings/delete-ratings', deleteTechnologyRatings);

// Route to get technology analytics and insights
// Query param: ?resumeHash=abc123 (optional - if not provided, gets latest)
router.get('/technology-ratings/analytics', getTechnologyAnalytics);

// ============= SWOT ANALYSIS ROUTES =============

// Route to generate SWOT analysis based on technology ratings
router.post('/swot/generate', generateSWOTAnalysis);

// Route to get saved SWOT analyses for the user
// Query param: ?resumeHash=abc123 (optional - if not provided, gets all)
router.get('/swot/saved', getSavedSWOTAnalyses);

// Route to delete a specific SWOT analysis
router.delete('/swot/delete/:id', deleteSWOTAnalysis);

export default router;
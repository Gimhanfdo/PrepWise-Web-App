import express from 'express';
import { 
  saveTechnologyRatings, 
  getTechnologyRatings, 
  updateTechnologyRating, 
  deleteTechnologyRatings,
  getAllUserTechnologyRatings
} from '../controllers/swotcontroller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// POST /api/swot/save-ratings - Save technology confidence ratings
router.post('/save-ratings', saveTechnologyRatings);

// GET /api/swot/ratings - Get technology ratings for a specific resume
// Query params: resumeHash (required)
router.get('/ratings', getTechnologyRatings);

// PUT /api/swot/update-rating - Update individual technology rating
router.put('/update-rating', updateTechnologyRating);

// DELETE /api/swot/ratings - Delete technology ratings for a specific resume
// Query params: resumeHash (required)
router.delete('/ratings', deleteTechnologyRatings);

// GET /api/swot/all-ratings - Get all technology ratings for the user
router.get('/all-ratings', getAllUserTechnologyRatings);

export default router;
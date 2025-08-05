// routes/swotRoutes.js - Production version
import express from 'express';
import { saveRatings, getRatings, deleteRatings, getRatingsStats } from '../controllers/swotcontroller.js';
import userAuth from '../middleware/userAuth.js';

const swotRouter = express.Router();

// Health check route (no auth required)
swotRouter.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'SWOT service is running',
    timestamp: new Date().toISOString()
  });
});

// Apply authentication middleware to all routes below this point
swotRouter.use(userAuth);

// Test route to verify auth is working
swotRouter.get('/test-auth', (req, res) => {
  res.json({
    success: true,
    message: 'SWOT authentication working!',
    user: {
      id: req.user.id
    },
    timestamp: new Date().toISOString()
  });
});

// POST /api/swot/save-ratings - Save technology confidence ratings
swotRouter.post('/save-ratings', saveRatings);

// GET /api/swot/ratings - Get all ratings for the authenticated user
swotRouter.get('/ratings', getRatings);

// GET /api/swot/stats - Get user statistics  
swotRouter.get('/stats', getRatingsStats);

// GET /api/swot/ratings/:resumeHash - Get ratings for a specific resume
// Important: This must come AFTER /ratings to avoid route conflicts
swotRouter.get('/ratings/:resumeHash', getRatings);

// DELETE /api/swot/delete/:id - Delete specific technology ratings
swotRouter.delete('/delete/:id', deleteRatings);

export default swotRouter;
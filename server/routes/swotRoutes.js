// swotRoutes.js - Express routes for SWOT technology ratings

import express from 'express';
import { saveRatings, getRatings, deleteRatings } from '../controllers/swotcontroller.js';
import { protect } from '../middleware/authMiddleware.js'; // Assuming you have auth middleware

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// POST /api/swot/save-ratings - Save technology confidence ratings
router.post('/save-ratings', saveRatings);

// GET /api/swot/ratings - Get all ratings for the authenticated user
router.get('/ratings', getRatings);

// GET /api/swot/ratings/:resumeHash - Get ratings for a specific resume
router.get('/ratings/:resumeHash', getRatings);

// DELETE /api/swot/delete/:id - Delete specific technology ratings
router.delete('/delete/:id', deleteRatings);

export default router;

/* 
Usage in your main app.js or server.js:

import swotRoutes from './routes/swotRoutes.js';

// Add this line with your other route configurations
app.use('/api/swot', swotRoutes);

This will create the following endpoints:
- POST /api/swot/save-ratings
- GET /api/swot/ratings
- GET /api/swot/ratings/:resumeHash
- DELETE /api/swot/delete/:id

Make sure you have the following middleware:
1. Authentication middleware (protect function)
2. JSON body parser (express.json())
3. CORS configuration if needed
*/
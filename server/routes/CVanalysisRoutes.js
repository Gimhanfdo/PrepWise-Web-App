import express from 'express';
import multer from 'multer';
import { analyzeResume, deleteAnalysis, getSavedAnalysis, saveAnalysis } from '../controllers/cvAnalysiscontroller.js';
import userAuth from '../middleware/userAuth.js';

const analysisRouter = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// POST /api/analyze/analyze-resume - Analyze resume against job descriptions
analysisRouter.post('/analyze-resume', userAuth, upload.single('resume'), analyzeResume);

// POST /api/analyze/save - Save analysis results
analysisRouter.post('/save', userAuth, saveAnalysis);

// GET /api/analyze/saved - Get all saved analyses for user
analysisRouter.get('/saved', userAuth, getSavedAnalysis);

// DELETE /api/analyze/delete/:id - Delete a specific saved analysis
analysisRouter.delete('/delete/:id', userAuth, deleteAnalysis);

export default analysisRouter;
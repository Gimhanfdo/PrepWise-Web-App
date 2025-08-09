import express from 'express';
import multer from 'multer';
import userAuth from '../middleware/userAuth.js';
import { 
  createInterview, 
  startInterview, 
  submitAnswer, 
  getNextQuestion, 
  completeInterview, 
  getInterviewFeedback,
  getUserInterviews,
  getInterview
} from '../controllers/interviewController.js';

const interviewRouter = express.Router();

// Configure multer for audio file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/') || 
        file.mimetype.includes('webm') || 
        file.mimetype.includes('wav') ||
        file.mimetype.includes('mpeg') ||
        file.mimetype.includes('mp4')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  }
});

// All interview routes require authentication
interviewRouter.use(userAuth);

// Interview CRUD operations
interviewRouter.post('/create', createInterview);
interviewRouter.get('/:interviewId', getInterview);
interviewRouter.put('/:interviewId/start', startInterview);
interviewRouter.post('/:interviewId/answer', upload.single('audio'), submitAnswer);
interviewRouter.get('/:interviewId/next-question', getNextQuestion);
interviewRouter.put('/:interviewId/complete', completeInterview);

// Feedback and analysis
interviewRouter.get('/:interviewId/feedback', getInterviewFeedback);

// User interview history
interviewRouter.get('/user/history', getUserInterviews);

// Error handling middleware for multer
interviewRouter.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size allowed is 10MB.'
      });
    }
  }
  
  if (error.message === 'Only audio files are allowed!') {
    return res.status(400).json({
      success: false,
      error: 'Invalid file type. Please upload audio files only.'
    });
  }
  
  next(error);
});

export default interviewRouter;
import express from 'express';
import multer from 'multer';
import { analyzeResume, deleteAnalysis, getSavedAnalysis, saveAnalysis } from '../controllers/cvAnalysiscontroller.js';
import userAuth from '../middleware/userAuth.js';

const analysisRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

analysisRouter.post('/analyze-resume', userAuth, upload.single('resume'), analyzeResume);
analysisRouter.post('/save', userAuth, saveAnalysis);
analysisRouter.get('/saved', userAuth, getSavedAnalysis);
analysisRouter.delete('/delete/:id', userAuth, deleteAnalysis);

export default analysisRouter;

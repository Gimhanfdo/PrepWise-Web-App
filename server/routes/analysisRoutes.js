import express from 'express';
import multer from 'multer';
import { analyzeResume } from '../controllers/analysiscontroller.js';
import userAuth from '../middleware/userAuth.js';

const analysisRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

analysisRouter.post('/analyze-resume', userAuth, upload.single('resume'), analyzeResume);

export default analysisRouter;

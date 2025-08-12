import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { spawn } from 'child_process';
import userAuth from '../middleware/userAuth.js';
import { 
  createInterview, 
  startInterview, 
  submitAnswer, 
  getNextQuestion, 
  completeInterview, 
  getInterviewFeedback,
  getUserInterviews,
  getInterview,
  analyzeResponse  // Added new import
} from '../controllers/interviewController.js';

const interviewRouter = express.Router();

// AssemblyAI configuration
const assemblyAIConfig = {
  baseUrl: "https://api.assemblyai.com",
  headers: {
    authorization: process.env.ASSEMBLYAI_API_KEY || "09e162bb0a7a4478bfb5092b53b53b58",
  }
};

// AssemblyAI transcription function
const transcribeWithAssemblyAI = async (audioPath) => {
  try {
    console.log('Starting AssemblyAI transcription for:', audioPath);

    // Step 1: Upload the audio file
    const audioData = fs.readFileSync(audioPath);
    const uploadResponse = await axios.post(
      `${assemblyAIConfig.baseUrl}/v2/upload`, 
      audioData, 
      { headers: assemblyAIConfig.headers }
    );
    
    const audioUrl = uploadResponse.data.upload_url;
    console.log('Audio uploaded to AssemblyAI:', audioUrl);

    // Step 2: Request transcription
    const transcriptionData = {
      audio_url: audioUrl,
      speech_model: "universal",
    };

    const transcriptionResponse = await axios.post(
      `${assemblyAIConfig.baseUrl}/v2/transcript`,
      transcriptionData,
      { headers: assemblyAIConfig.headers }
    );

    const transcriptId = transcriptionResponse.data.id;
    console.log('Transcription requested with ID:', transcriptId);

    // Step 3: Poll for completion
    const pollingEndpoint = `${assemblyAIConfig.baseUrl}/v2/transcript/${transcriptId}`;
    
    while (true) {
      console.log('Polling transcription status...');
      
      const pollingResponse = await axios.get(pollingEndpoint, {
        headers: assemblyAIConfig.headers,
      });
      
      const transcriptionResult = pollingResponse.data;
      
      if (transcriptionResult.status === "completed") {
        console.log('Transcription completed successfully');
        return {
          text: transcriptionResult.text,
          duration: transcriptionResult.audio_duration || null,
          confidence: transcriptionResult.confidence || null
        };
      } else if (transcriptionResult.status === "error") {
        throw new Error(`AssemblyAI transcription failed: ${transcriptionResult.error}`);
      } else {
        console.log(`Transcription status: ${transcriptionResult.status}, waiting...`);
        // Wait 3 seconds before polling again
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  } catch (error) {
    console.error('AssemblyAI transcription error:', error);
    throw error;
  }
};

// Local Whisper (Development only)
const transcribeWithLocalWhisper = async (audioPath) => {
  return new Promise((resolve, reject) => {
    const whisper = spawn('whisper', [
      audioPath,
      '--model', 'base',
      '--output_format', 'json',
      '--output_dir', path.dirname(audioPath),
      '--language', 'en'
    ]);

    let output = '';
    let error = '';

    whisper.stdout.on('data', (data) => {
      output += data.toString();
    });

    whisper.stderr.on('data', (data) => {
      error += data.toString();
    });

    whisper.on('close', (code) => {
      if (code === 0) {
        try {
          const jsonPath = audioPath.replace(path.extname(audioPath), '.json');
          if (fs.existsSync(jsonPath)) {
            const transcription = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            fs.unlinkSync(jsonPath);
            resolve({
              text: transcription.text,
              duration: null
            });
          } else {
            reject(new Error('Transcription file not found'));
          }
        } catch (parseError) {
          reject(parseError);
        }
      } else {
        reject(new Error(`Whisper process failed: ${error}`));
      }
    });

    whisper.on('error', (err) => {
      reject(err);
    });
  });
};

// Configure multer for audio file uploads with disk storage for transcription
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/audio';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `audio_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`);
  }
});

// Disk storage upload for transcription
const uploadToDisk = multer({
  storage: diskStorage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/m4a'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format'), false);
    }
  }
});

// Memory storage upload for other audio processing
const uploadToMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// Transcription endpoint
export const transcribeAudio = async (req, res) => {
  try {
    console.log('Transcription request received');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided'
      });
    }

    const audioFile = req.file;
    console.log('Audio file:', {
      filename: audioFile.filename,
      size: audioFile.size,
      mimetype: audioFile.mimetype
    });

    // Check if file exists and is readable
    if (!fs.existsSync(audioFile.path)) {
      return res.status(400).json({
        success: false,
        error: 'Audio file not found'
      });
    }

    try {
      // Use AssemblyAI for transcription
      const transcription = await transcribeWithAssemblyAI(audioFile.path);

      console.log('Transcription completed:', {
        text_length: transcription.text?.length || 0,
        text_preview: transcription.text?.substring(0, 100) || 'No text'
      });

      // Clean up uploaded file
      setTimeout(() => {
        try {
          if (fs.existsSync(audioFile.path)) {
            fs.unlinkSync(audioFile.path);
            console.log('Cleaned up temporary audio file');
          }
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      }, 5000); // Clean up after 5 seconds

      res.json({
        success: true,
        text: transcription.text,
        duration: transcription.duration || null,
        confidence: transcription.confidence || null
      });

    } catch (transcriptionError) {
      console.error('Transcription API error:', transcriptionError);
      
      // Clean up file on error
      if (fs.existsSync(audioFile.path)) {
        fs.unlinkSync(audioFile.path);
      }

      res.status(500).json({
        success: false,
        error: 'Transcription failed',
        details: process.env.NODE_ENV === 'development' ? transcriptionError.message : undefined
      });
    }

  } catch (error) {
    console.error('Transcription endpoint error:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: 'Server error during transcription',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Alternative transcription endpoint using mock transcription
const mockTranscribeAudio = async (req, res) => {
  try {
    const audioFile = req.file;
    
    if (!audioFile) {
      return res.status(400).json({
        success: false,
        error: 'Audio file is required'
      });
    }

    // Mock transcription - in production, integrate with speech-to-text service
    const mockTranscription = "Audio transcription is currently simulated. In production, this would use a speech-to-text service to convert the audio to text.";
    
    res.json({
      success: true,
      text: mockTranscription,
      duration: Math.floor(audioFile.size / 1000), // rough estimate
      confidence: 0.95
    });
    
  } catch (error) {
    console.error('Mock transcription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to transcribe audio'
    });
  }
};

// All interview routes require authentication
interviewRouter.use(userAuth);

// Transcription routes
interviewRouter.post('/transcribe', uploadToDisk.single('audio'), transcribeAudio);
interviewRouter.post('/transcribe-mock', uploadToMemory.single('audio'), mockTranscribeAudio);

// Interview CRUD operations
interviewRouter.post('/create', createInterview);
interviewRouter.get('/:interviewId', getInterview);
interviewRouter.put('/:interviewId/start', startInterview);
interviewRouter.post('/:interviewId/answer', uploadToDisk.single('audio'), submitAnswer);
interviewRouter.post('/:interviewId/submit-answer', uploadToMemory.single('audio'), submitAnswer);
interviewRouter.get('/:interviewId/next-question', getNextQuestion);
interviewRouter.put('/:interviewId/complete', completeInterview);

// Feedback and analysis
interviewRouter.get('/:interviewId/feedback', getInterviewFeedback);

// NEW: Enhanced analysis endpoint
interviewRouter.post('/analyze-response', analyzeResponse);

// User interview history
interviewRouter.get('/user/history', getUserInterviews);
interviewRouter.get('/history', getUserInterviews); // Alternative route for consistency

// Error handling middleware for multer
interviewRouter.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size allowed is 25MB.'
      });
    }
  }
  
  if (error.message === 'Invalid audio format' || error.message === 'Only audio files are allowed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid file type. Please upload audio files only.'
    });
  }
  
  next(error);
});

export default interviewRouter;
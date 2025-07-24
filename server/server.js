import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import connectDB from './config/mongodb.js';
import authRouter from './routes/authRoutes.js';
import userRouter from './routes/userRoutes.js';
import analysisRouter from './routes/analysisRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT || 4000

connectDB();

const allowedOrigins = [process.env.CLIENT_URL || 'http://localhost:5173']
app.use(express.json());
app.use(cookieParser());
app.use(cors({origin: allowedOrigins, credentials: true}));

//API Endpoints
app.get('/', (req, res) =>res.send("API Working"));
app.use('/api/auth', authRouter)
app.use('/api/user', userRouter)
app.use('/api/analyze', analysisRouter);

app.use(express.static(path.join(__dirname, '../client/dist')));

app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(port, ()=> console.log(`Server started on PORT: ${port}`));
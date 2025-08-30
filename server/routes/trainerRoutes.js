// routes/trainerRoutes.js
import express from "express";
import { registerTrainer, sendTrainerVerifyOtp } from "../controllers/trainerController.js";

const router = express.Router();

// Register new trainer
router.post("/register", registerTrainer);

// Send OTP for verification
router.post("/send-verify-otp", sendTrainerVerifyOtp);

export default router;
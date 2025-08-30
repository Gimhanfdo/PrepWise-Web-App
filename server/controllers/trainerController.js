// controllers/trainerController.js
import Trainer from "../models/trainerModel.js";
import { v4 as uuidv4 } from "uuid"; // to generate unique trainerId
import bcrypt from "bcryptjs";

// register a trainer
export const registerTrainer = async (req, res) => {
  try {
    const { name, email, password, contact, specializationSkills, experiences, education } = req.body;

    // check if email already exists
    const existing = await Trainer.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Trainer already exists with this email" });
    }

    const trainer = new Trainer({
      trainerId: uuidv4(),
      name,
      email,
      password, // will be hashed by pre-save hook
      contact,
      specializationSkills,
      experiences,
      education,
    });

    await trainer.save();

    res.status(201).json({
      message: "Trainer registered successfully",
      trainer: {
        trainerId: trainer.trainerId,
        name: trainer.name,
        email: trainer.email,
        contact: trainer.contact,
        specializationSkills: trainer.specializationSkills,
      },
    });
  } catch (error) {
    console.error("Error registering trainer:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// send OTP (mock example)
export const sendTrainerVerifyOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const trainer = await Trainer.findOne({ email });
    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    // 🔹 In production, generate & send OTP via email/SMS
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Here we just return OTP in response for demo
    res.status(200).json({
      message: "OTP sent successfully",
      otp,
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
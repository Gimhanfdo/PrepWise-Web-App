// routes/trainingRoute.js
import express from "express";

const trainingRouter = express.Router();

// Mock database (replace with MongoDB / MySQL later)
let trainingPrograms = [
  {
    id: 1,
    title: "JavaScript Fundamentals Bootcamp",
    category: "technical",
    skillType: "programming",
    targetSkill: "JavaScript",
    type: "group",
    duration: "5 sessions × 2 hours",
    groupSize: "5 participants",
    level: "Beginner to Intermediate",
    price: "LKR 25,000",
    instructor: "Kasun Silva",
    rating: 4.8,
    description: "Comprehensive JavaScript training covering ES6+, DOM manipulation, and modern practices.",
    features: ["Live coding", "Projects", "Code reviews"],
    schedule: [
      { date: "2024-09-01", time: "10:00 AM - 12:00 PM", available: true },
      { date: "2024-09-03", time: "10:00 AM - 12:00 PM", available: true },
      { date: "2024-09-05", time: "10:00 AM - 12:00 PM", available: false }
    ]
  },
  // Add more trainings like in your frontend mock data
];

// ✅ GET all training programs
trainingRouter.get("/", (req, res) => {
  res.json({
    success: true,
    data: trainingPrograms,
  });
});

// ✅ GET single training program by ID
trainingRouter.get("/:id", (req, res) => {
  const training = trainingPrograms.find(t => t.id === parseInt(req.params.id));
  if (!training) {
    return res.status(404).json({ success: false, message: "Training not found" });
  }
  res.json({ success: true, data: training });
});

// ✅ POST booking request
trainingRouter.post("/:id/book", (req, res) => {
  const { date, time, userId } = req.body;
  const training = trainingPrograms.find(t => t.id === parseInt(req.params.id));

  if (!training) {
    return res.status(404).json({ success: false, message: "Training not found" });
  }

  // find slot
  const slot = training.schedule.find(s => s.date === date && s.time === time);

  if (!slot || !slot.available) {
    return res.status(400).json({ success: false, message: "Slot not available" });
  }

  // Mark slot as booked
  slot.available = false;

  res.json({
    success: true,
    message: `Booking confirmed for ${training.title} on ${date} at ${time}`,
    booking: { trainingId: training.id, date, time, userId }
  });
});

export default trainingRouter;

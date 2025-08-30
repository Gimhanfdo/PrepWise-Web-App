// routes/noticesRoute.js
import express from 'express';
import { addNotice, getNotices } from '../controllers/noticesController.js';

const noticesRouter = express.Router();

// POST /api/notices - Add a new notice
noticesRouter.post('/admin/notices', addNotice);

// GET /api/notices - Get all notices (optional)
noticesRouter.get('/admin/notices', getNotices);

export default noticesRouter;



// import express from "express";
// import mongoose from "mongoose";

// // Create schema for Event Notice
// const eventNoticeSchema = new mongoose.Schema({
//   title: { type: String, required: true },
//   description: { type: String, required: true },
//   eventDate: { type: Date, required: true },
//   priority: {
//     type: String,
//     enum: ["Low", "Medium", "High"],
//     default: "Medium",
//   },
// }, { timestamps: true });

// const EventNotice = mongoose.model("EventNotice", eventNoticeSchema);

// const noticesRouter = express.Router();

// // @route   POST /api/notices
// // @desc    Add a new event notice
// noticesRouter.post("/", async (req, res) => {
//   try {
//     const { title, description, eventDate, priority } = req.body;
//     const newNotice = new EventNotice({ title, description, eventDate, priority });
//     const savedNotice = await newNotice.save();
//     res.status(201).json(savedNotice);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // @route   GET /api/notices
// // @desc    Get all event notices
// noticesRouter.get("/", async (req, res) => {
//   try {
//     const notices = await EventNotice.find().sort({ eventDate: 1 });
//     res.json(notices);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // @route   GET /api/notices/:id
// // @desc    Get a single event notice by ID
// noticesRouter.get("/:id", async (req, res) => {
//   try {
//     const notice = await EventNotice.findById(req.params.id);
//     if (!notice) return res.status(404).json({ message: "Notice not found" });
//     res.json(notice);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // @route   PUT /api/notices/:id
// // @desc    Update an event notice by ID
// noticesRouter.put("/:id", async (req, res) => {
//   try {
//     const updatedNotice = await EventNotice.findByIdAndUpdate(req.params.id, req.body, { new: true });
//     if (!updatedNotice) return res.status(404).json({ message: "Notice not found" });
//     res.json(updatedNotice);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // @route   DELETE /api/notices/:id
// // @desc    Delete an event notice by ID
// noticesRouter.delete("/:id", async (req, res) => {
//   try {
//     const deletedNotice = await EventNotice.findByIdAndDelete(req.params.id);
//     if (!deletedNotice) return res.status(404).json({ message: "Notice not found" });
//     res.json({ message: "Notice deleted successfully" });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// export default noticesRouter;

// routes/adminRoutes.js
import express from "express";
import Fresher from "../models/userModel.js";
import Trainer from "../models/trainerModel.js";
import Notice from "../models/noticesModel.js";

const adminRouter = express.Router();

/* ---------------- Freshers ---------------- */
// GET all freshers - works
adminRouter.get("/freshers", async (req, res) => {
  try {
    const freshers = await Fresher.find();
    res.json(freshers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE fresher - 
adminRouter.put("/freshers/:id", async (req, res) => {
  try {
    const fresher = await Fresher.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(fresher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DEACTIVATE fresher
adminRouter.put("/freshers/:id/deactivate", async (req, res) => {
  try {
    const fresher = await Fresher.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    res.json(fresher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- Trainers ---------------- */
adminRouter.get("/trainers", async (req, res) => {
  try {
    const trainers = await Trainer.find();
    res.json(trainers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.put("/trainers/:id", async (req, res) => {
  try {
    const trainer = await Trainer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(trainer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.put("/trainers/:id/deactivate", async (req, res) => {
  try {
    const trainer = await Trainer.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    res.json(trainer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- Notices ---------------- */
adminRouter.get("/notices", async (req, res) => {
  try {
    const notices = await Notice.find();
    res.json(notices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post("/notices", async (req, res) => {
  try {
    const notice = new Notice(req.body);
    await notice.save();
    res.status(201).json(notice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.put("/notices/:id", async (req, res) => {
  try {
    const notice = await Notice.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(notice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.delete("/notices/:id", async (req, res) => {
  try {
    await Notice.findByIdAndDelete(req.params.id);
    res.json({ message: "Notice deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default adminRouter;

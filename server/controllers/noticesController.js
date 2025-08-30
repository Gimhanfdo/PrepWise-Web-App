// controllers/noticesController.js
import Notice from "../models/noticesModel.js";

// Add a new notice
export const addNotice = async (req, res) => {
  try {
    const { title, description, eventDate, priority } = req.body;
    const newNotice = new Notice({ title, description, eventDate, priority });
    await newNotice.save();
    res.status(201).json({ message: 'Notice added successfully', notice: newNotice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all notices
export const getNotices = async (req, res) => {
  try {
    const notices = await Notice.find().sort({ eventDate: -1 });
    res.status(200).json(notices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

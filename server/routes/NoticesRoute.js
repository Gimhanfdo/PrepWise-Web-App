
import express from 'express';
import {
  addNotice,
  getNotices,
  getNoticesByDateRange,
  getUpcomingNotices,
  getNoticeById,
  updateNotice,
  deleteNotice,
  getEvents
} from '../controllers/noticesController.js';

const noticesRouter = express.Router();

// Main routes for notices (should come before parameter routes)
noticesRouter.get('/events', getEvents);                   // Get all events - MOVED TO TOP
noticesRouter.get('/upcoming', getUpcomingNotices);        // Get upcoming notices
noticesRouter.get('/search', getNoticesByDateRange);       // Get notices by date range
noticesRouter.get('/', getNotices);                        // Get all notices

// Admin routes
noticesRouter.post('/admin/notices', addNotice);           // Admin: Add new notice
noticesRouter.get('/admin/notices', getNotices);           // Admin: Get all notices

// CRUD operations
noticesRouter.post('/', addNotice);                        // Add new notice
noticesRouter.put('/:id', updateNotice);                   // Update notice by ID
noticesRouter.delete('/:id', deleteNotice);                // Delete notice by ID

// Parameter routes should come LAST to avoid conflicts
noticesRouter.get('/:id', getNoticeById);                  // Get single notice by ID

export default noticesRouter;
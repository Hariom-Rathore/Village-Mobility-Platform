const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification');
const { isLoggedIn } = require('../utils/middleware');

// Get notifications
router.get('/', isLoggedIn, notificationController.getUserNotifications);
router.get('/unread-count', isLoggedIn, notificationController.getUnreadCount);

// Mark notifications
router.put('/:notificationId/read', isLoggedIn, notificationController.markAsRead);
router.put('/mark-all-read', isLoggedIn, notificationController.markAllAsRead);

// Delete notification
router.delete('/:notificationId', isLoggedIn, notificationController.deleteNotification);

module.exports = router;

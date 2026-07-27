const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification');
const { isApiLoggedIn } = require('../utils/middleware');

router.get('/', isApiLoggedIn, notificationController.getUserNotifications);
router.get('/unread-count', isApiLoggedIn, notificationController.getUnreadCount);
router.put('/:notificationId/read', isApiLoggedIn, notificationController.markAsRead);
router.put('/mark-all-read', isApiLoggedIn, notificationController.markAllAsRead);
router.delete('/:notificationId', isApiLoggedIn, notificationController.deleteNotification);

module.exports = router;

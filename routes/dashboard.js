const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../utils/middleware');
const dashboardController = require('../controllers/dashboard');

// Owner dashboard
router.get('/owner', isLoggedIn, dashboardController.renderOwnerDashboard);

// User dashboard
router.get('/user', isLoggedIn, dashboardController.renderUserDashboard);

// Notifications
router.get('/notifications', isLoggedIn, dashboardController.renderNotifications);
router.post('/notifications/:notificationId/read', isLoggedIn, dashboardController.markNotificationRead);
router.post('/notifications/mark-all-read', isLoggedIn, dashboardController.markAllNotificationsRead);

module.exports = router;

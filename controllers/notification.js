const Notification = require('../models/notification');

// Get all notifications for a user
module.exports.getUserNotifications = async (req, res) => {
    try {
        const { unreadOnly } = req.query;
        const filter = { recipient: req.user._id };

        if (unreadOnly === 'true') {
            filter.isRead = false;
        }

        const notifications = await Notification.find(filter)
            .populate('relatedBooking')
            .populate('relatedVehicle')
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({
            recipient: req.user._id,
            isRead: false
        });

        return res.json({
            success: true,
            notifications,
            unreadCount
        });
    } catch (e) {
        console.error('Get user notifications error', e);
        return res.status(500).json({ success: false, error: 'Unable to fetch notifications' });
    }
};

// Get unread notification count
module.exports.getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            recipient: req.user._id,
            isRead: false
        });

        return res.json({
            success: true,
            unreadCount: count
        });
    } catch (e) {
        console.error('Get unread count error', e);
        return res.status(500).json({ success: false, error: 'Unable to fetch unread count' });
    }
};

// Mark notification as read
module.exports.markAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;

        const notification = await Notification.findOne({
            _id: notificationId,
            recipient: req.user._id
        });

        if (!notification) {
            return res.status(404).json({ success: false, error: 'Notification not found' });
        }

        notification.isRead = true;
        await notification.save();

        return res.json({
            success: true,
            message: 'Notification marked as read'
        });
    } catch (e) {
        console.error('Mark as read error', e);
        return res.status(500).json({ success: false, error: 'Unable to mark notification as read' });
    }
};

// Mark all notifications as read
module.exports.markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user._id, isRead: false },
            { isRead: true }
        );

        return res.json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (e) {
        console.error('Mark all as read error', e);
        return res.status(500).json({ success: false, error: 'Unable to mark all notifications as read' });
    }
};

// Delete notification
module.exports.deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;

        const notification = await Notification.findOne({
            _id: notificationId,
            recipient: req.user._id
        });

        if (!notification) {
            return res.status(404).json({ success: false, error: 'Notification not found' });
        }

        await Notification.deleteOne({ _id: notificationId });

        return res.json({
            success: true,
            message: 'Notification deleted'
        });
    } catch (e) {
        console.error('Delete notification error', e);
        return res.status(500).json({ success: false, error: 'Unable to delete notification' });
    }
};

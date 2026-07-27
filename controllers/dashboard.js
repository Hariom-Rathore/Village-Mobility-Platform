const Listing = require('../models/listing');
const Booking = require('../models/booking');
const notificationService = require('../services/notificationService');

module.exports.renderOwnerDashboard = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const vehicles = await Listing.find({ owner: ownerId });
    const bookings = await Booking.find({ ownerId })
      .populate('vehicleId')
      .populate('renterId')
      .sort({ bookingCreatedAt: -1 });

    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.bookingStatus === 'TRIP_COMPLETED').length;
    const pendingBookings = bookings.filter(b => ['PENDING', 'COUNTER_OFFER_SENT'].includes(b.bookingStatus)).length;
    const confirmedBookings = bookings.filter(b => ['ACCEPTED', 'COUNTER_OFFER_ACCEPTED', 'TRIP_STARTED'].includes(b.bookingStatus)).length;
    const cancelledBookings = bookings.filter(b => ['CANCELLED', 'REJECTED'].includes(b.bookingStatus)).length;
    const totalRevenue = bookings
      .filter(b => b.bookingStatus === 'TRIP_COMPLETED')
      .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    const upcomingBookings = bookings.filter(b =>
      ['ACCEPTED', 'COUNTER_OFFER_ACCEPTED'].includes(b.bookingStatus) &&
      b.pickupDate && new Date(b.pickupDate) > new Date()
    );

    const currentBookings = bookings.filter(b =>
      ['TRIP_STARTED'].includes(b.bookingStatus) ||
      (['ACCEPTED', 'COUNTER_OFFER_ACCEPTED'].includes(b.bookingStatus) &&
        b.pickupDate && b.returnDate &&
        new Date(b.pickupDate) <= new Date() && new Date(b.returnDate) >= new Date())
    );

    const unreadCount = await notificationService.getUnreadCount(ownerId);

    res.render('dashboard/owner', {
      vehicles, bookings, upcomingBookings, currentBookings,
      stats: { totalBookings, completedBookings, pendingBookings, confirmedBookings, cancelledBookings, totalRevenue },
      unreadCount
    });
  } catch (error) {
    console.error('Error rendering owner dashboard:', error);
    req.flash('error', 'Unable to load dashboard');
    res.redirect('/cars');
  }
};

module.exports.renderUserDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const bookings = await Booking.find({ renterId: userId })
      .populate('vehicleId')
      .populate('ownerId')
      .sort({ bookingCreatedAt: -1 });

    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.bookingStatus === 'TRIP_COMPLETED').length;
    const pendingBookings = bookings.filter(b => ['PENDING', 'COUNTER_OFFER_SENT'].includes(b.bookingStatus)).length;
    const confirmedBookings = bookings.filter(b => ['ACCEPTED', 'COUNTER_OFFER_ACCEPTED', 'TRIP_STARTED'].includes(b.bookingStatus)).length;
    const cancelledBookings = bookings.filter(b => ['CANCELLED', 'REJECTED'].includes(b.bookingStatus)).length;
    const totalSpent = bookings
      .filter(b => b.bookingStatus === 'TRIP_COMPLETED')
      .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    const upcomingRentals = bookings.filter(b =>
      ['ACCEPTED', 'COUNTER_OFFER_ACCEPTED'].includes(b.bookingStatus) &&
      b.pickupDate && new Date(b.pickupDate) > new Date()
    );

    const currentRentals = bookings.filter(b =>
      ['TRIP_STARTED'].includes(b.bookingStatus) ||
      (['ACCEPTED', 'COUNTER_OFFER_ACCEPTED'].includes(b.bookingStatus) &&
        b.pickupDate && b.returnDate &&
        new Date(b.pickupDate) <= new Date() && new Date(b.returnDate) >= new Date())
    );

    const pastRentals = bookings.filter(b => b.bookingStatus === 'TRIP_COMPLETED');
    const unreadCount = await notificationService.getUnreadCount(userId);

    res.render('dashboard/user', {
      bookings, upcomingRentals, currentRentals, pastRentals,
      stats: { totalBookings, completedBookings, pendingBookings, confirmedBookings, cancelledBookings, totalSpent },
      unreadCount
    });
  } catch (error) {
    console.error('Error rendering user dashboard:', error);
    req.flash('error', 'Unable to load dashboard');
    res.redirect('/cars');
  }
};

module.exports.renderNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const notifications = await notificationService.getUserNotifications(userId, false);
    const unreadCount = await notificationService.getUnreadCount(userId);
    res.render('dashboard/notifications', { notifications, unreadCount });
  } catch (error) {
    console.error('Error rendering notifications:', error);
    req.flash('error', 'Unable to load notifications');
    res.redirect('/cars');
  }
};

module.exports.markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const success = await notificationService.markAsRead(notificationId, req.user._id);
    if (success) res.json({ success: true });
    else res.status(404).json({ success: false, error: 'Notification not found' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: 'Unable to mark notification as read' });
  }
};

module.exports.markAllNotificationsRead = async (req, res) => {
  try {
    const success = await notificationService.markAllAsRead(req.user._id);
    if (success) res.json({ success: true });
    else res.status(500).json({ success: false, error: 'Unable to mark notifications as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, error: 'Unable to mark notifications as read' });
  }
};

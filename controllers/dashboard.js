const Listing = require('../models/listing');
const Booking = require('../models/booking');
const notificationService = require('../services/notificationService');

// Render owner dashboard
module.exports.renderOwnerDashboard = async (req, res) => {
  try {
    const ownerId = req.user._id;

    // Get owner's vehicles
    const vehicles = await Listing.find({ owner: ownerId });
    
    // Get all bookings for owner's vehicles
    const bookings = await Booking.find({ ownerId })
      .populate('vehicleId')
      .populate('renterId')
      .sort({ bookingCreatedAt: -1 });

    // Calculate statistics
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.bookingStatus === 'COMPLETED').length;
    const pendingBookings = bookings.filter(b => b.bookingStatus === 'PENDING').length;
    const confirmedBookings = bookings.filter(b => b.bookingStatus === 'CONFIRMED').length;
    const cancelledBookings = bookings.filter(b => b.bookingStatus === 'CANCELLED').length;
    
    const totalRevenue = bookings
      .filter(b => b.bookingStatus === 'COMPLETED')
      .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    // Get upcoming bookings
    const upcomingBookings = bookings.filter(b => 
      b.bookingStatus === 'CONFIRMED' && 
      b.pickupDate && 
      new Date(b.pickupDate) > new Date()
    );

    // Get current bookings
    const currentBookings = bookings.filter(b => 
      b.bookingStatus === 'CONFIRMED' && 
      b.pickupDate && 
      b.returnDate &&
      new Date(b.pickupDate) <= new Date() &&
      new Date(b.returnDate) >= new Date()
    );

    // Get unread notifications
    const unreadCount = await notificationService.getUnreadCount(ownerId);

    res.render('dashboard/owner', {
      vehicles,
      bookings,
      upcomingBookings,
      currentBookings,
      stats: {
        totalBookings,
        completedBookings,
        pendingBookings,
        confirmedBookings,
        cancelledBookings,
        totalRevenue
      },
      unreadCount
    });
  } catch (error) {
    console.error('Error rendering owner dashboard:', error);
    req.flash('error', 'Unable to load dashboard');
    res.redirect('/cars');
  }
};

// Render user dashboard
module.exports.renderUserDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user's bookings as renter
    const bookings = await Booking.find({ renterId: userId })
      .populate('vehicleId')
      .populate('ownerId')
      .sort({ bookingCreatedAt: -1 });

    // Calculate statistics
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.bookingStatus === 'COMPLETED').length;
    const pendingBookings = bookings.filter(b => b.bookingStatus === 'PENDING').length;
    const confirmedBookings = bookings.filter(b => b.bookingStatus === 'CONFIRMED').length;
    const cancelledBookings = bookings.filter(b => b.bookingStatus === 'CANCELLED').length;

    const totalSpent = bookings
      .filter(b => b.bookingStatus === 'COMPLETED')
      .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    // Get upcoming rentals
    const upcomingRentals = bookings.filter(b => 
      b.bookingStatus === 'CONFIRMED' && 
      b.pickupDate && 
      new Date(b.pickupDate) > new Date()
    );

    // Get current rentals
    const currentRentals = bookings.filter(b => 
      b.bookingStatus === 'CONFIRMED' && 
      b.pickupDate && 
      b.returnDate &&
      new Date(b.pickupDate) <= new Date() &&
      new Date(b.returnDate) >= new Date()
    );

    // Get past rentals
    const pastRentals = bookings.filter(b => b.bookingStatus === 'COMPLETED');

    // Get unread notifications
    const unreadCount = await notificationService.getUnreadCount(userId);

    res.render('dashboard/user', {
      bookings,
      upcomingRentals,
      currentRentals,
      pastRentals,
      stats: {
        totalBookings,
        completedBookings,
        pendingBookings,
        confirmedBookings,
        cancelledBookings,
        totalSpent
      },
      unreadCount
    });
  } catch (error) {
    console.error('Error rendering user dashboard:', error);
    req.flash('error', 'Unable to load dashboard');
    res.redirect('/cars');
  }
};

// Render notifications page
module.exports.renderNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const notifications = await notificationService.getUserNotifications(userId, false);
    const unreadCount = await notificationService.getUnreadCount(userId);

    res.render('dashboard/notifications', {
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error rendering notifications:', error);
    req.flash('error', 'Unable to load notifications');
    res.redirect('/cars');
  }
};

// Mark notification as read
module.exports.markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const success = await notificationService.markAsRead(notificationId, req.user._id);

    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Notification not found' });
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: 'Unable to mark notification as read' });
  }
};

// Mark all notifications as read
module.exports.markAllNotificationsRead = async (req, res) => {
  try {
    const success = await notificationService.markAllAsRead(req.user._id);

    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: 'Unable to mark notifications as read' });
    }
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, error: 'Unable to mark notifications as read' });
  }
};

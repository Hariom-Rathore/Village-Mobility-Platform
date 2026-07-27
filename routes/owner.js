const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../utils/middleware');
const Listing = require('../models/listing');
const Booking = require('../models/booking');
const Notification = require('../models/notification');

router.get('/dashboard', isLoggedIn, (req, res) => {
  res.render('owners/dashboard');
});

router.get('/my-vehicles', isLoggedIn, (req, res) => {
  res.render('owners/my-vehicles');
});

router.get('/bookings', isLoggedIn, (req, res) => {
  res.render('owners/bookings');
});

router.get('/api/stats', isLoggedIn, async (req, res) => {
  try {
    const ownerId = req.user._id;
    const vehicles = await Listing.find({ owner: ownerId });
    const bookings = await Booking.find({ ownerId });

    const totalVehicles = vehicles.length;
    const pendingBookings = bookings.filter(b =>
      ['PENDING', 'COUNTER_OFFER_SENT'].includes(b.bookingStatus)
    ).length;
    const upcomingTrips = bookings.filter(b =>
      ['ACCEPTED', 'COUNTER_OFFER_ACCEPTED', 'TRIP_STARTED'].includes(b.bookingStatus)
    ).length;
    const avgRating = req.user.averageRating || 0;

    res.json({
      success: true,
      stats: { totalVehicles, pendingBookings, upcomingTrips, averageRating: avgRating }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/api/vehicles', isLoggedIn, async (req, res) => {
  try {
    const vehicles = await Listing.find({ owner: req.user._id }).populate('owner').sort({ _id: -1 });
    res.json({ success: true, vehicles });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/api/unread-count', isLoggedIn, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    res.json({ success: true, unreadCount: count });
  } catch (e) {
    res.json({ success: true, unreadCount: 0 });
  }
});

module.exports = router;

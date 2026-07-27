const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../utils/middleware');
const Listing = require('../models/listing');
const Booking = require('../models/booking');
const Notification = require('../models/notification');

// Owner Dashboard
router.get('/dashboard', isLoggedIn, (req, res) => {
    res.render('owners/dashboard');
});

// Owner My Vehicles
router.get('/my-vehicles', isLoggedIn, (req, res) => {
    res.render('owners/my-vehicles');
});

// Owner Bookings
router.get('/bookings', isLoggedIn, (req, res) => {
    res.render('owners/bookings');
});

// API: Get owner dashboard stats
router.get('/api/stats', isLoggedIn, async (req, res) => {
    try {
        const ownerId = req.user._id;
        const vehicles = await Listing.find({ owner: ownerId });
        const bookings = await Booking.find({ ownerId });

        const totalVehicles = vehicles.length;
        const pendingBookings = bookings.filter(b => b.bookingStatus === 'PENDING' || b.bookingStatus === 'PENDING_OWNER_APPROVAL').length;
        const upcomingTrips = bookings.filter(b =>
            b.bookingStatus === 'ACCEPTED' || b.bookingStatus === 'CONFIRMED'
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

// API: Get owner's vehicles (JSON)
router.get('/api/vehicles', isLoggedIn, async (req, res) => {
    try {
        const vehicles = await Listing.find({ owner: req.user._id }).populate('owner').sort({ _id: -1 });
        res.json({ success: true, vehicles });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// API: Get unread notification count
router.get('/api/unread-count', isLoggedIn, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
        res.json({ success: true, unreadCount: count });
    } catch (e) {
        res.json({ success: true, unreadCount: 0 });
    }
});

module.exports = router;

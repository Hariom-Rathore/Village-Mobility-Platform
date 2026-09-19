const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../utils/middleware');
const Listing = require('../models/listing');
const Booking = require('../models/booking');
const Notification = require('../models/notification');
const Review = require('../models/review');

router.get ('/dashboard', isLoggedIn, (req, res) => {
  res.render('owners/dashboard');
});

router.get('/enhanced-dashboard', isLoggedIn, (req, res) => {
  res.render('owners/enhanced-dashboard');
});

router.get('/my-vehicles', isLoggedIn, (req, res) => {
  res.render('owners/my-vehicles');
});

router.get('/my-vehicles-enhanced', isLoggedIn, (req, res) => {
  res.render('owners/my-vehicles-enhanced');
});

router.get('/bookings', isLoggedIn, (req, res) => {
  res.render('owners/bookings');
});

// Enhanced dashboard stats API
router.get('/api/dashboard-stats', isLoggedIn, async (req, res) => {
  try {
    const ownerId = req.user._id;
    const vehicles = await Listing.find({ owner: ownerId });
    const bookings = await Booking.find({ ownerId });
    const reviews = await Review.find({ listingId: { $in: vehicles.map(v => v._id) } });

    const totalVehicles = vehicles.length;
    const pendingBookings = bookings.filter(b =>
      ['PENDING', 'PENDING_OWNER_APPROVAL', 'COUNTER_OFFER_SENT'].includes(b.bookingStatus)
    ).length;
    const completedTrips = bookings.filter(b =>
      ['COMPLETED', 'TRIP_COMPLETED'].includes(b.bookingStatus)
    ).length;
    const totalTrips = bookings.length;
    const totalRevenue = bookings
      .filter(b => ['COMPLETED', 'TRIP_COMPLETED'].includes(b.bookingStatus))
      .reduce((sum, b) => sum + (b.totalPrice || b.estimatedFare || 0), 0);
    
    // Calculate average rating
    const avgRating = reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length 
      : (req.user.averageRating || 0);

    const totalReviews = reviews.length;

    res.json({
      success: true,
      stats: {
        totalVehicles,
        pendingBookings,
        completedTrips,
        totalTrips,
        totalRevenue,
        averageRating: avgRating,
        totalReviews
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get bookings with status filter and limit
router.get('/api/bookings', isLoggedIn, async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { status, limit = 10 } = req.query;
    
    let query = { ownerId };
    if (status) {
      query.bookingStatus = status;
    }
    
    const bookings = await Booking.find(query)
      .populate('renterId', 'username email phone')
      .populate('vehicleId', 'title vehicleName brand model')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({ success: true, bookings });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get vehicles with limit
router.get('/api/vehicles', isLoggedIn, async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { limit = 10 } = req.query;
    
    const vehicles = await Listing.find({ owner: ownerId })
      .populate('owner', 'username email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({ success: true, vehicles });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get reviews with limit
router.get('/api/reviews', isLoggedIn, async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { limit = 10 } = req.query;
    
    const vehicles = await Listing.find({ owner: ownerId }).select('_id');
    const vehicleIds = vehicles.map(v => v._id);
    
    const reviews = await Review.find({ listingId: { $in: vehicleIds } })
      .populate('author', 'username')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({ success: true, reviews });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Accept booking
router.post('/api/bookings/:id/accept', isLoggedIn, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    
    if (booking.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    
    booking.bookingStatus = 'CONFIRMED';
    booking.acceptedAt = new Date();
    await booking.save();
    
    // Update vehicle availability
    if (booking.vehicleId) {
      await Listing.findByIdAndUpdate(booking.vehicleId, {
        availabilityStatus: 'BOOKED',
        currentBookingId: booking._id
      });
    }
    
    // Create notification for renter
    await Notification.create({
      recipient: booking.renterId,
      type: 'booking_accepted',
      title: 'Booking Accepted',
      message: `Your booking request has been accepted by the owner.`,
      relatedBooking: booking._id
    });
    
    res.json({ success: true, message: 'Booking accepted successfully' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Reject booking
router.post('/api/bookings/:id/reject', isLoggedIn, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    
    if (booking.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    
    booking.bookingStatus = 'REJECTED';
    booking.rejectionReason = reason || 'Rejected by owner';
    booking.rejectedAt = new Date();
    await booking.save();
    
    // Update vehicle availability
    if (booking.vehicleId) {
      await Listing.findByIdAndUpdate(booking.vehicleId, {
        availabilityStatus: 'AVAILABLE',
        currentBookingId: null
      });
    }
    
    // Create notification for renter
    await Notification.create({
      recipient: booking.renterId,
      type: 'booking_rejected',
      title: 'Booking Rejected',
      message: `Your booking request has been rejected. ${reason || ''}`,
      relatedBooking: booking._id
    });
    
    res.json({ success: true, message: 'Booking rejected successfully' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Complete booking
router.post('/api/bookings/:id/complete', isLoggedIn, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    
    if (booking.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    
    booking.bookingStatus = 'COMPLETED';
    booking.completedAt = new Date();
    await booking.save();
    
    // Update vehicle availability
    if (booking.vehicleId) {
      await Listing.findByIdAndUpdate(booking.vehicleId, {
        availabilityStatus: 'AVAILABLE',
        currentBookingId: null,
        $inc: { totalBookings: 1, totalRevenue: booking.totalPrice || booking.estimatedFare || 0 }
      });
    }
    
    // Create notification for renter
    await Notification.create({
      recipient: booking.renterId,
      type: 'booking_completed',
      title: 'Trip Completed',
      message: `Your trip has been completed successfully.`,
      relatedBooking: booking._id
    });
    
    res.json({ success: true, message: 'Booking completed successfully' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
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

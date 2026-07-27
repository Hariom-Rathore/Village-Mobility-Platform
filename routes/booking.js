const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking');
const { isLoggedIn } = require('../utils/middleware');

// Customer Booking Flow
router.post('/request/:id', isLoggedIn, bookingController.createBookingRequest);
router.post('/counter-offer/:bookingId/respond', isLoggedIn, bookingController.respondToCounterOffer);

// Owner Booking Management
router.put('/accept/:bookingId', isLoggedIn, bookingController.acceptBooking);
router.put('/reject/:bookingId', isLoggedIn, bookingController.rejectBooking);
router.post('/counter-offer/:bookingId', isLoggedIn, bookingController.sendCounterOffer);

// Booking Management
router.get('/user', isLoggedIn, bookingController.getUserBookings);
router.get('/owner', isLoggedIn, bookingController.getOwnerBookings);
router.delete('/:bookingId', isLoggedIn, bookingController.cancelBooking);
router.put('/:bookingId/complete', isLoggedIn, bookingController.completeBooking);

// Availability
router.get('/check/:id', bookingController.checkAvailability);
router.get('/calendar/:id', bookingController.getCalendar);

module.exports = router;

const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking');
const { isApiLoggedIn, isBookingOwner, isBookingCustomer, validateBookingRequest, validateCounterOffer, validateRejectBooking, validateCancelBooking } = require('../utils/middleware');

// --- Customer Booking Flow ---
router.post('/request/:id', isApiLoggedIn, validateBookingRequest, bookingController.createBookingRequest);
router.post('/counter-offer/:bookingId/respond', isApiLoggedIn, isBookingCustomer, bookingController.respondToCounterOffer);

// --- Owner Booking Management ---
router.put('/accept/:bookingId', isApiLoggedIn, isBookingOwner, bookingController.acceptBooking);
router.put('/reject/:bookingId', isApiLoggedIn, isBookingOwner, validateRejectBooking, bookingController.rejectBooking);
router.post('/counter-offer/:bookingId', isApiLoggedIn, isBookingOwner, validateCounterOffer, bookingController.sendCounterOffer);

// --- Trip Management ---
router.put('/start/:bookingId', isApiLoggedIn, isBookingOwner, bookingController.startTrip);
router.put('/complete/:bookingId', isApiLoggedIn, isBookingOwner, bookingController.completeTrip);

// --- General Booking Management ---
router.delete('/:bookingId', isApiLoggedIn, validateCancelBooking, bookingController.cancelBooking);

// --- GET APIs ---
router.get('/user', isApiLoggedIn, bookingController.getUserBookings);
router.get('/owner', isApiLoggedIn, bookingController.getOwnerBookings);
router.get('/:bookingId/timeline', isApiLoggedIn, bookingController.getBookingTimeline);
router.get('/:bookingId/details', isApiLoggedIn, bookingController.getBookingDetails);

// --- Dashboard ---
router.get('/owner/dashboard', isApiLoggedIn, bookingController.getOwnerDashboardData);
router.get('/customer/dashboard', isApiLoggedIn, bookingController.getCustomerDashboardData);

// --- Availability (public) ---
router.get('/check/:id', bookingController.checkAvailability);
router.get('/calendar/:id', bookingController.getCalendar);

module.exports = router;

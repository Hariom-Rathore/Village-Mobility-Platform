const express = require("express");
const router = express.Router();
const { isLoggedIn, isApiLoggedIn, isOwner, validateListing, validateBookingRequest } = require("../utils/middleware.js");
const listings = require("../controllers/listing.js");
const bookingController = require("../controllers/booking.js");

const multer = require('multer');
const { storage } = require("../cloudconfig.js");
const upload = multer({ storage });
const uploadMultiple = multer({ storage: storage }).fields([
    { name: 'frontImage', maxCount: 1 }, { name: 'rearImage', maxCount: 1 },
    { name: 'leftImage', maxCount: 1 }, { name: 'rightImage', maxCount: 1 },
    { name: 'interiorImage', maxCount: 1 }, { name: 'dashboardImage', maxCount: 1 },
    { name: 'vehicleRC', maxCount: 1 }, { name: 'insurance', maxCount: 1 },
    { name: 'pollutionCertificate', maxCount: 1 }, { name: 'fitnessCertificate', maxCount: 1 },
    { name: 'ownerDrivingLicense', maxCount: 1 }, { name: 'driverDrivingLicense', maxCount: 1 },
    { name: 'aadhaar', maxCount: 1 }, { name: 'driverPhoto', maxCount: 1 }
]);

router
    .route("/")
    .get(listings.index)
    .post(isLoggedIn, upload.single("listing[image]"), validateListing, listings.createListing);

router.post("/new-step", isLoggedIn, uploadMultiple, validateListing, listings.createListing);

router.get("/geocode", listings.geocode);
router.get("/reverse-geocode", listings.reverseGeocode);
router.get("/autocomplete", listings.autocomplete);

router.get("/new", isLoggedIn, listings.renderNewForm);
router.get("/new-step", isLoggedIn, listings.renderNewStepForm);

// Legacy booking routes (from /cars routes)
router.get('/book/:id', bookingController.renderBooking);
router.get('/:id/book', bookingController.renderBooking);
router.post('/book/:id/order', isLoggedIn, bookingController.createOrder);
router.post('/book/:id/confirm', isLoggedIn, bookingController.confirmPayment);

// Legacy booking request route
router.post('/book/:id/request', isApiLoggedIn, validateBookingRequest, bookingController.createBookingRequest);

// Legacy owner booking actions
router.post('/bookings/:bookingId/accept', isLoggedIn, bookingController.acceptBooking);
router.post('/bookings/:bookingId/reject', isLoggedIn, bookingController.rejectBooking);
router.post('/bookings/:bookingId/counter', isLoggedIn, bookingController.sendCounterOffer);
router.post('/bookings/:bookingId/counter/respond', isLoggedIn, bookingController.respondToCounterOffer);

// Legacy availability and management
router.get('/:id/availability', bookingController.checkAvailability);
router.get('/:id/calendar', bookingController.getCalendar);
router.post('/bookings/:bookingId/cancel', isLoggedIn, bookingController.cancelBooking);
router.post('/bookings/:bookingId/complete', isLoggedIn, bookingController.completeTrip);
router.get('/bookings/my', isLoggedIn, bookingController.getUserBookings);
router.get('/bookings/owner', isLoggedIn, bookingController.getOwnerBookings);

router
    .route("/:id")
    .put(isLoggedIn, isOwner, uploadMultiple, validateListing, listings.updateListing)
    .delete(isLoggedIn, isOwner, listings.deleteListing)
    .get(listings.showListing);

router.get("/:id/edit", isLoggedIn, isOwner, listings.renderEditForm);

module.exports = router;

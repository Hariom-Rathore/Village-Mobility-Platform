//Use export router method because the make code understandable

const express = require("express");
const router = express.Router();  //express router
const { isLoggedIn,isOwner,validateListing, validateBookingRequest } = require("../utils/middleware.js");
const listings = require("../controllers/listing.js");
const bookingController = require("../controllers/booking.js");

// Debug: log requests hitting this router
router.use((req, res, next) => {
	console.log('CAR ROUTER =>', req.method, req.path);
	next();
});

//multer is use for upload any file 
 const multer =require('multer');
 const {storage}=require("../cloudconfig.js");
 const upload=multer({storage}); //data ko upload namm ke folder me storrre kara dega ek baar ke liye but now we use cloudinaryy so now store into this
 const uploadMultiple = multer({ storage: storage }).fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'rearImage', maxCount: 1 },
    { name: 'leftImage', maxCount: 1 },
    { name: 'rightImage', maxCount: 1 },
    { name: 'interiorImage', maxCount: 1 },
    { name: 'dashboardImage', maxCount: 1 },
    { name: 'vehicleRC', maxCount: 1 },
    { name: 'insurance', maxCount: 1 },
    { name: 'pollutionCertificate', maxCount: 1 },
    { name: 'fitnessCertificate', maxCount: 1 },
    { name: 'ownerDrivingLicense', maxCount: 1 },
    { name: 'driverDrivingLicense', maxCount: 1 },
    { name: 'aadhaar', maxCount: 1 },
    { name: 'driverPhoto', maxCount: 1 }
 ]); 

//use of router.route for same path becoze same path ko baar baar define na karna pade
 
router
	.route("/")
	.get(listings.index)
	.post(isLoggedIn, upload.single("listing[image]"),validateListing,  listings.createListing);

// New route for step-based form with multiple image uploads
router.post("/new-step", isLoggedIn, uploadMultiple, validateListing, listings.createListing);

router.get("/geocode", listings.geocode);
router.get("/reverse-geocode", listings.reverseGeocode);
router.get("/autocomplete", listings.autocomplete);
   

router.get("/new", isLoggedIn, listings.renderNewForm);
router.get("/new-step", isLoggedIn, listings.renderNewStepForm);

// Booking routes (define before the generic id route to avoid accidental matching)
// Booking routes (use /book/:id to avoid conflicting with generic '/:id' route)
router.get('/book/:id', bookingController.renderBooking);
// also accept the legacy /:id/book pattern to be tolerant
router.get('/:id/book', bookingController.renderBooking);
router.post('/book/:id/order', isLoggedIn, bookingController.createOrder);
router.post('/book/:id/confirm', isLoggedIn, bookingController.confirmPayment);

// New Trip Flow Booking Request API
router.post('/book/:id/request', isLoggedIn, validateBookingRequest, bookingController.createBookingRequest);
router.post('/bookings/:bookingId/accept', isLoggedIn, bookingController.acceptBooking);
router.post('/bookings/:bookingId/reject', isLoggedIn, bookingController.rejectBooking);
router.post('/bookings/:bookingId/counter', isLoggedIn, bookingController.sendCounterOffer);
router.post('/bookings/:bookingId/counter/respond', isLoggedIn, bookingController.respondToCounterOffer);

// Production booking APIs
router.get('/:id/availability', bookingController.checkAvailability);
router.get('/:id/calendar', bookingController.getCalendar);
router.post('/bookings/:bookingId/cancel', isLoggedIn, bookingController.cancelBooking);
router.post('/bookings/:bookingId/complete', isLoggedIn, bookingController.completeBooking);
router.get('/bookings/my', isLoggedIn, bookingController.getUserBookings);
router.get('/bookings/owner', isLoggedIn, bookingController.getOwnerBookings);

router
.route("/:id")
.put(isLoggedIn, isOwner, uploadMultiple, validateListing, listings.updateListing)
.delete( isLoggedIn, isOwner, listings.deleteListing)
.get( listings.showListing); 


// edit route
router.get("/:id/edit", isLoggedIn,isOwner, listings.renderEditForm);


module.exports = router;

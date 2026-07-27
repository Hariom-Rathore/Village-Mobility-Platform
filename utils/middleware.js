const Listing = require("../models/listing.js");
const Review = require("../models/review");
const { listingSchema, reviewSchema, bookingRequestSchema, counterOfferSchema, rejectBookingSchema, cancelBookingSchema } = require("../schema.js");
const ExpressError = require("../utils/ExpressError.js");

const emptyListing = {
  title: "",
  description: "",
  image: { url: "", filename: "listingimage" },
  price: "",
  country: "",
  location: "",
  ratePerKm: "",
  whatsappNumber: "",
};

const buildListingData = (incomingListing = {}) => ({
  ...emptyListing,
  ...incomingListing,
  image: { ...emptyListing.image, ...(incomingListing.image || {}) },
});

const isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "You must be logged in to create listing");
    return res.redirect("/users/login");
  }
  next();
};

const isApiLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ success: false, error: "You must be logged in" });
  }
  next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
  }
  next();
};

module.exports.isOwner = async (req, res, next) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing not found");
    return res.redirect("/cars");
  }
  if (!req.user || !listing.owner || !listing.owner.equals(req.user._id)) {
    req.flash("error", "you are not owner of this listing");
    return res.redirect(`/cars/${id}`);
  }
  next();
};

module.exports.validateListing = (req, res, next) => {
  const { error } = listingSchema.validate(req.body, {
    allowUnknown: true,
    abortEarly: false,
  });
  if (error) {
    const errMsg = error.details.map((el) => el.message).join(",");
    const err = new ExpressError(400, errMsg);
    err.viewData = { listing: buildListingData(req.body.listing) };
    throw err;
  }
  next();
};

module.exports.validateReview = (req, res, next) => {
  let { error } = reviewSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

module.exports.isReviewAuthor = async (req, res, next) => {
  const { id, reviewId } = req.params;
  const review = await Review.findById(reviewId);
  if (!review) {
    req.flash("error", "Review not found");
    return res.redirect(`/cars/${id}`);
  }
  if (!req.user || !review.author.equals(req.user._id)) {
    req.flash("error", "you did not create this review");
    return res.redirect(`/cars/${id}`);
  }
  next();
};

module.exports.validateBookingRequest = (req, res, next) => {
  let { error } = bookingRequestSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    console.error("Booking validation error:", errMsg);
    return res.status(400).json({ success: false, error: errMsg });
  }
  next();
};

module.exports.validateCounterOffer = (req, res, next) => {
  let { error } = counterOfferSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    return res.status(400).json({ success: false, error: errMsg });
  }
  next();
};

module.exports.validateRejectBooking = (req, res, next) => {
  let { error } = rejectBookingSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    return res.status(400).json({ success: false, error: errMsg });
  }
  next();
};

module.exports.validateCancelBooking = (req, res, next) => {
  let { error } = cancelBookingSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    return res.status(400).json({ success: false, error: errMsg });
  }
  next();
};

module.exports.isBookingOwner = async (req, res, next) => {
  const Booking = require("../models/booking.js");
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return res.status(404).json({ success: false, error: "Booking not found" });
  }
  if (!req.user || !booking.ownerId || !booking.ownerId.equals(req.user._id)) {
    return res.status(403).json({ success: false, error: "Not authorized" });
  }
  req.booking = booking;
  next();
};

module.exports.isBookingCustomer = async (req, res, next) => {
  const Booking = require("../models/booking.js");
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return res.status(404).json({ success: false, error: "Booking not found" });
  }
  if (!req.user || !booking.customerId || !booking.customerId.equals(req.user._id)) {
    return res.status(403).json({ success: false, error: "Not authorized" });
  }
  req.booking = booking;
  next();
};

module.exports.isLoggedIn = isLoggedIn;
module.exports.isApiLoggedIn = isApiLoggedIn;

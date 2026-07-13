const Review = require("../models/review.js");
const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");
const ExpressError = require("../utils/ExpressError.js");
const bookingService = require("../services/bookingService");
const notificationService = require("../services/notificationService");

// Create review
module.exports.createReview = async (req, res, next) => {
  try {
    let listing = await Listing.findById(req.params.id);
    
    // Check if user has completed a booking for this vehicle
    const completedBooking = await Booking.findOne({
      vehicleId: listing._id,
      renterId: req.user._id,
      bookingStatus: 'COMPLETED'
    });

    if (!completedBooking) {
      req.flash("error", "You can only review vehicles after completing a booking.");
      return res.redirect(`/cars/${listing._id}`);
    }

    // Check if user has already reviewed this vehicle
    const existingReview = await Review.findOne({
      author: req.user._id,
      _id: { $in: listing.reviews }
    });

    if (existingReview) {
      req.flash("error", "You have already reviewed this vehicle.");
      return res.redirect(`/cars/${listing._id}`);
    }

    let newReview = new Review(req.body.review);
    newReview.author = req.user._id;
    listing.reviews.push(newReview);

    await newReview.save();
    await listing.save();

    // Update vehicle rating
    await bookingService.updateVehicleRating(listing._id);

    // Send notification to owner
    await notificationService.notifyReviewReceived(listing._id, req.user._id);

    req.flash("success", "Review Created Successfully!");
    res.redirect(`/cars/${listing._id}`);
  } catch (err) {
    next(new ExpressError(400, err.message));
  }
};

// Delete review
module.exports.deleteReview = async (req, res, next) => {
  try {
    let { id, reviewId } = req.params;

    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);

    req.flash("success", "Review Deleted!");
    res.redirect(`/cars/${id}`);
  } catch (err) {
    next(new ExpressError(404, err.message));
  }
};

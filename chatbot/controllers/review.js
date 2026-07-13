const Review = require("../models/review.js");
const Listing = require("../models/listing.js");
const ExpressError = require("../utils/ExpressError.js");

// Create review
module.exports.createReview = async (req, res, next) => {
  try {
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review);
    newReview.author = req.user._id;
    listing.reviews.push(newReview);

    await newReview.save();
    await listing.save();

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

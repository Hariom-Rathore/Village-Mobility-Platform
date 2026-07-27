//this file make for authenticate the user that user is login h ya nahi 
const Listing = require("../models/listing.js");
const Review= require("../models/review");
const { listingSchema, reviewSchema } = require("../schema.js");
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
    image: {
        ...emptyListing.image,
        ...(incomingListing.image || {}),
    },
});

const isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) { //this function predefined into the passport
    //redirectUrl save becoze after the changes or some work this is come on the same page
    req.session.redirectUrl=req.originalUrl;
        req.flash("error", "You must be logged in to create listing");
        return res.redirect("/users/login");
    }
    next();
};

module.exports = { isLoggedIn };


//redirecturl is not a
module.exports.saveRedirectUrl=(req,res,next)=>{
    if(req.session.redirectUrl){
        res.locals.redirectUrl=req.session.redirectUrl;
    }
    next();
};

//for edit and delete only owner
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
    let{error}=reviewSchema.validate(req.body);
    if(error){
        let errMsg =error.details.map((el)=>el.message).join(",");
        throw new ExpressError(400,errMsg);
        }else{
          next();
        }   
     };

     module.exports.isReviewAuthor= async (req, res, next) => {
    const { id,reviewId } = req.params;
    const review= await Review.findById(reviewId);

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

const { bookingRequestSchema } = require("../schema.js");
module.exports.validateBookingRequest = (req, res, next) => {
    let { error } = bookingRequestSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        console.error("Booking validation error:", errMsg);
        return res.status(400).json({ success: false, error: errMsg });
    } else {
        next();
    }
};
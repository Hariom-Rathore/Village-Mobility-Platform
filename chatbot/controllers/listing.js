const Listing = require("../models/listing.js");
const ExpressError = require("../utils/ExpressError.js");

const emptyListing = {
    title: "",
    description: "",
    image: { url: "", filename: "listingimage" },
    price: "",
    country: "",
    location: "",
};

const buildListingData = (incomingListing = {}) => ({
    ...emptyListing,
    ...incomingListing,
    image: {
        ...emptyListing.image,
        ...(incomingListing.image || {}),
    },
});

module.exports.index = async (req, res) => {
    console.log("Fetching all listings...");
    const alllistings = await Listing.find({}).populate("owner");
    console.log("Found listings:", alllistings.length, alllistings);
    res.render("listings/index.ejs", { alllistings });
};

module.exports.renderNewForm = (req, res) => {
    res.render("listings/new.ejs", {
        listing: emptyListing,
        errorMsg: null,
    });
};

module.exports.createListing = async (req, res) => {
    console.log("Creating listing with data:", req.body.listing);
    console.log("File upload:", req.file);

    const listingData = buildListingData(req.body.listing);

    if (req.file) {
        listingData.image = {
            url: req.file.path,
            filename: req.file.filename,
        };
        console.log("Image set from upload:", listingData.image);
    }

    const listing = new Listing(listingData);
    listing.owner = req.user._id;
    // if a file was uploaded, `listingData.image` was set above; do not overwrite with undefined vars

    console.log("Listing before save:", listing);
    await listing.save();
    console.log("Listing saved with ID:", listing._id);
    req.flash("success", "New listing created!");
    res.redirect(`/cars/${listing._id}`);
};

module.exports.showListing = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id)
        .populate("owner")
        .populate({ path: "reviews", populate: { path: "author" } });

    if (!listing) {
        throw new ExpressError(404, "Listing not found!");
    }

    res.render("listings/show.ejs", { listing });
};

module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        throw new ExpressError(404, "Listing not found!");
    }

    let originalImageUrl = listing.image.url;
    originalImageUrl = originalImageUrl.replace("/upload", "/upload/h_150,w_150");
    res.render("listings/edit.ejs", { listing, originalImageUrl });
};

module.exports.updateListing = async (req, res) => {
    const { id } = req.params;
    const listingData = buildListingData(req.body.listing);

    if (req.file) {
        listingData.image = {
             url: req.file.path,
            filename: req.file.filename,
        };
    }

    const listing = await Listing.findByIdAndUpdate(id, listingData, {
        runValidators: true,
        new: true,
    });

    if (!listing) {
        throw new ExpressError(404, "Listing not found!");
    }

    req.flash("success", "Listing updated successfully!");
    res.redirect(`/cars/${listing._id}`);
};

module.exports.deleteListing = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findByIdAndDelete(id);

    if (!listing) {
        throw new ExpressError(404, "Listing not found!");
    }

    req.flash("success", "Listing deleted successfully!");
    res.redirect("/cars");
};
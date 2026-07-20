const Listing = require("../models/listing.js");
const ExpressError = require("../utils/ExpressError.js");

const escapeRegExp = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const DEFAULT_OWNER_WHATSAPP_NUMBER = process.env.OWNER_WHATSAPP_NUMBER || "";

module.exports.index = async (req, res) => {
    const { category = "all", type, seats, search } = req.query;
    const filter = { websiteSource: "car-rental" };

    if (seats) {
        const seatsNum = Number(seats);
        if ([4, 6, 10].includes(seatsNum)) filter.seats = seatsNum;
    } else if (type) {
        filter.carType = type;
    } else if (category && category !== "all") {
        filter.category = category;
    }

    if (search && search.trim()) {
        const searchRegex = new RegExp(escapeRegExp(search.trim()), "i");
        filter.$or = [
            { title: searchRegex },
            { location: searchRegex },
            { country: searchRegex },
            { description: searchRegex },
            { category: searchRegex },
        ];
    }

    const alllistings = await Listing.find(filter).sort({ _id: -1 }).populate("owner");
    res.render("listings/index.ejs", { alllistings, currentCategory: category, currentType: type, currentSeats: seats, currentSearch: search || "" });
};

module.exports.geocode = async (req, res) => {
    const query = (req.query.q || "").trim();

    if (!query) {
        return res.json([]);
    }

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url, {
            headers: {
                Accept: "application/json",
                "Accept-Language": "en",
                "User-Agent": "PROJECT_CAR_DELTA/1.0"
            }
        });

        if (!response.ok) {
            return res.json([]);
        }

        const results = await response.json();
        return res.json(results);
    } catch (error) {
        console.error("Geocode lookup failed", error);
        return res.json([]);
    }
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
    listingData.category = listingData.category || "trending";
    listingData.whatsappNumber = (listingData.whatsappNumber || DEFAULT_OWNER_WHATSAPP_NUMBER || "").trim();
    listingData.websiteSource = "car-rental";

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
    req.flash("success", "New listing created and shown on home page!");
    res.redirect("/cars");
};

module.exports.showListing = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findOne({ _id: id, websiteSource: "car-rental" })
        .populate("owner")
        .populate({ path: "reviews", populate: { path: "author" } });

    if (!listing) {
        throw new ExpressError(404, "Listing not found!");
    }

    res.render("listings/show.ejs", { listing });
};

module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findOne({ _id: id, websiteSource: "car-rental" });

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
    listingData.whatsappNumber = (listingData.whatsappNumber || DEFAULT_OWNER_WHATSAPP_NUMBER || "").trim();

    if (req.file) {
        listingData.image = {
             url: req.file.path,
            filename: req.file.filename,
        };
    }

    const listing = await Listing.findOneAndUpdate({ _id: id, websiteSource: "car-rental" }, listingData, {
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
    const listing = await Listing.findOneAndDelete({ _id: id, websiteSource: "car-rental" });

    if (!listing) {
        throw new ExpressError(404, "Listing not found!");
    }

    req.flash("success", "Listing deleted successfully!");
    res.redirect("/cars");
};

module.exports.reverseGeocode = async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return res.status(400).json({ display_name: "" });
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;

    try {
        const response = await fetch(url, {
            headers: {
                Accept: "application/json",
                "Accept-Language": "en",
                "User-Agent": "PROJECT_CAR_DELTA/1.0"
            }
        });

        if (!response.ok) {
            return res.json({ display_name: "" });
        }

        const result = await response.json();
        return res.json({ display_name: result.display_name || "" });
    } catch (error) {
        console.error("Reverse geocode lookup failed", error);
        return res.json({ display_name: "" });
    }
};

module.exports.autocomplete = async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const searchRegex = new RegExp(escapeRegExp(q), 'i');
    const results = await Listing.find({ title: searchRegex })
        .limit(10)
        .select('title price image');
    // return minimal info for suggestions
    const suggestions = results.map(r => ({ id: r._id, title: r.title, price: r.price, image: r.image && (r.image.url || r.image) }));
    res.json(suggestions);
};
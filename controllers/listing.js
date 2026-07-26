const Listing = require("../models/listing.js");
const ExpressError = require("../utils/ExpressError.js");

const escapeRegExp = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const emptyListing = {
    title: "",
    description: "",
    image: { url: "", filename: "listingimage" },
    images: [],
    price: "",
    country: "",
    location: "",
    ratePerKm: "",
    whatsappNumber: "",
    // New fields
    baseFare: 0,
    pricePerKm: 0,
    minimumTripFare: 0,
    nightCharge: 0,
    locationCoordinates: { type: "Point", coordinates: [0, 0] },
    village: "",
    area: "",
    city: "",
    district: "",
    state: "",
    serviceRadius: null,
    vehicleName: "",
    brand: "",
    model: "",
    year: "",
    vehicleNumber: "",
    vehicleType: "",
    fuelType: "other",
    transmission: "manual",
    acAvailable: true,
    musicSystem: false,
    luggageCapacity: "medium",
    driverType: "owner",
    driverName: "",
    driverExperience: "",
    driverPhoneNumber: "",
    driverLicenseNumber: "",
    availableTripTypes: [],
    bookingRules: {
        minimumBookingAmount: 0,
        maximumPassengers: 4,
        smokingAllowed: false,
        petsAllowed: false,
        luggageAllowed: true,
        nightDriving: true,
    },
    paymentMethods: [],
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

module.exports.renderNewStepForm = (req, res) => {
    res.render("listings/new-step.ejs", {
        listing: emptyListing,
        errorMsg: null,
    });
};

module.exports.createListing = async (req, res) => {
    console.log("Creating listing with data:", req.body.listing);
    console.log("File upload:", req.file);
    console.log("Multiple files:", req.files);

    const listingData = buildListingData(req.body.listing);
    listingData.category = listingData.category || "trending";
    listingData.whatsappNumber = (listingData.whatsappNumber || DEFAULT_OWNER_WHATSAPP_NUMBER || "").trim();
    listingData.websiteSource = "car-rental";

    // Handle single image upload (legacy support)
    if (req.file) {
        listingData.image = {
            url: req.file.path,
            filename: req.file.filename,
        };
        console.log("Image set from upload:", listingData.image);
    }

    // Handle multiple image uploads
    if (req.files) {
        const images = [];
        const fieldMapping = {
            'frontImage': 'front',
            'rearImage': 'rear', 
            'leftImage': 'left',
            'rightImage': 'right',
            'interiorImage': 'interior',
            'dashboardImage': 'dashboard'
        };
        
        Object.keys(req.files).forEach(fieldName => {
            if (req.files[fieldName] && req.files[fieldName].length > 0) {
                const file = req.files[fieldName][0];
                // Check if this is a vehicle image or document
                if (fieldMapping[fieldName]) {
                    images.push({
                        url: file.path,
                        filename: file.filename,
                        type: fieldMapping[fieldName]
                    });
                }
            }
        });
        
        if (images.length > 0) {
            listingData.images = images;
            console.log("Multiple images set from upload:", listingData.images);
        }
        
        // Handle document uploads
        const documentMapping = {
            'vehicleRC': 'vehicleRC',
            'insurance': 'insurance',
            'pollutionCertificate': 'pollutionCertificate',
            'fitnessCertificate': 'fitnessCertificate',
            'ownerDrivingLicense': 'ownerDrivingLicense',
            'driverDrivingLicense': 'driverDrivingLicense',
            'aadhaar': 'aadhaar'
        };
        
        if (!listingData.documents) {
            listingData.documents = {};
        }
        
        Object.keys(req.files).forEach(fieldName => {
            if (req.files[fieldName] && req.files[fieldName].length > 0 && documentMapping[fieldName]) {
                const file = req.files[fieldName][0];
                listingData.documents[documentMapping[fieldName]] = {
                    url: file.path,
                    filename: file.filename,
                    verificationStatus: 'pending'
                };
            }
        });
        
        console.log("Documents set from upload:", listingData.documents);
        
        // Handle driver photo upload
        if (req.files['driverPhoto'] && req.files['driverPhoto'].length > 0) {
            const driverPhoto = req.files['driverPhoto'][0];
            listingData.driverPhoto = {
                url: driverPhoto.path,
                filename: driverPhoto.filename
            };
            console.log("Driver photo set from upload:", listingData.driverPhoto);
        }
    }

    // Parse location coordinates if provided
    if (req.body.listing.locationCoordinates) {
        try {
            const coords = JSON.parse(req.body.listing.locationCoordinates);
            listingData.locationCoordinates = coords;
        } catch (e) {
            console.error("Error parsing location coordinates:", e);
        }
    }

    // Parse booking rules if provided
    if (req.body.listing.bookingRules) {
        try {
            if (typeof req.body.listing.bookingRules === 'string') {
                listingData.bookingRules = JSON.parse(req.body.listing.bookingRules);
            }
        } catch (e) {
            console.error("Error parsing booking rules:", e);
        }
    }

    // Parse trip types if provided as string
    if (req.body.listing.availableTripTypes) {
        if (typeof req.body.listing.availableTripTypes === 'string') {
            listingData.availableTripTypes = req.body.listing.availableTripTypes.split(',').map(t => t.trim());
        }
    }

    // Parse payment methods if provided as string
    if (req.body.listing.paymentMethods) {
        if (typeof req.body.listing.paymentMethods === 'string') {
            listingData.paymentMethods = req.body.listing.paymentMethods.split(',').map(m => m.trim());
        }
    }

    const listing = new Listing(listingData);
    listing.owner = req.user._id;

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

    let originalImageUrl = listing.image.url || "https://images.pexels.com/photos/11129937/pexels-photo-11129937.jpeg";
    // Add Cloudinary optimization parameters if it's a Cloudinary URL
    if (originalImageUrl.includes('cloudinary.com')) {
        originalImageUrl = originalImageUrl.replace('/upload/', '/upload/q_auto,f_auto,w_150,h_150,c_limit/');
    }
    // Add Unsplash optimization parameters if it's an Unsplash URL
    else if (originalImageUrl.includes('unsplash.com')) {
        if (!originalImageUrl.includes('?')) {
            originalImageUrl += '?auto=format&fit=crop&w=150&q=80';
        }
    }
    res.render("listings/edit.ejs", { listing, originalImageUrl });
};

module.exports.updateListing = async (req, res) => {
    const { id } = req.params;
    const listingData = buildListingData(req.body.listing);
    listingData.whatsappNumber = (listingData.whatsappNumber || DEFAULT_OWNER_WHATSAPP_NUMBER || "").trim();

    // Handle single image upload (legacy support)
    if (req.file) {
        listingData.image = {
            url: req.file.path,
            filename: req.file.filename,
        };
    }

    // Handle multiple image uploads
    if (req.files) {
        const images = [];
        const fieldMapping = {
            'frontImage': 'front',
            'rearImage': 'rear', 
            'leftImage': 'left',
            'rightImage': 'right',
            'interiorImage': 'interior',
            'dashboardImage': 'dashboard'
        };
        
        Object.keys(req.files).forEach(fieldName => {
            if (req.files[fieldName] && req.files[fieldName].length > 0) {
                const file = req.files[fieldName][0];
                // Check if this is a vehicle image or document
                if (fieldMapping[fieldName]) {
                    images.push({
                        url: file.path,
                        filename: file.filename,
                        type: fieldMapping[fieldName]
                    });
                }
            }
        });
        
        if (images.length > 0) {
            listingData.images = images;
        }
        
        // Handle document uploads
        const documentMapping = {
            'vehicleRC': 'vehicleRC',
            'insurance': 'insurance',
            'pollutionCertificate': 'pollutionCertificate',
            'fitnessCertificate': 'fitnessCertificate',
            'ownerDrivingLicense': 'ownerDrivingLicense',
            'driverDrivingLicense': 'driverDrivingLicense',
            'aadhaar': 'aadhaar'
        };
        
        if (!listingData.documents) {
            listingData.documents = {};
        }
        
        Object.keys(req.files).forEach(fieldName => {
            if (req.files[fieldName] && req.files[fieldName].length > 0 && documentMapping[fieldName]) {
                const file = req.files[fieldName][0];
                listingData.documents[documentMapping[fieldName]] = {
                    url: file.path,
                    filename: file.filename,
                    verificationStatus: 'pending'
                };
            }
        });
        
        // Handle driver photo upload
        if (req.files['driverPhoto'] && req.files['driverPhoto'].length > 0) {
            const driverPhoto = req.files['driverPhoto'][0];
            listingData.driverPhoto = {
                url: driverPhoto.path,
                filename: driverPhoto.filename
            };
        }
    }

    // Parse location coordinates if provided
    if (req.body.listing.locationCoordinates) {
        try {
            const coords = JSON.parse(req.body.listing.locationCoordinates);
            listingData.locationCoordinates = coords;
        } catch (e) {
            console.error("Error parsing location coordinates:", e);
        }
    }

    // Parse booking rules if provided
    if (req.body.listing.bookingRules) {
        try {
            if (typeof req.body.listing.bookingRules === 'string') {
                listingData.bookingRules = JSON.parse(req.body.listing.bookingRules);
            }
        } catch (e) {
            console.error("Error parsing booking rules:", e);
        }
    }

    // Parse trip types if provided as string
    if (req.body.listing.availableTripTypes) {
        if (typeof req.body.listing.availableTripTypes === 'string') {
            listingData.availableTripTypes = req.body.listing.availableTripTypes.split(',').map(t => t.trim());
        }
    }

    // Parse payment methods if provided as string
    if (req.body.listing.paymentMethods) {
        if (typeof req.body.listing.paymentMethods === 'string') {
            listingData.paymentMethods = req.body.listing.paymentMethods.split(',').map(m => m.trim());
        }
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
const Joi = require("joi");

module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().trim().required(),
    description: Joi.string().trim().required(),
    vehicleName: Joi.string().trim().allow("").optional(),
    brand: Joi.string().trim().allow("").optional(),
    model: Joi.string().trim().allow("").optional(),
    year: Joi.number().min(1900).max(new Date().getFullYear() + 1).allow(null, "").optional(),
    vehicleNumber: Joi.string().trim().allow("").optional(),
    vehicleType: Joi.string().trim().allow("").optional(),
    fuelType: Joi.string().trim().valid("petrol", "diesel", "electric", "hybrid", "cng", "other").allow("", null).optional(),
    transmission: Joi.string().trim().valid("manual", "automatic").allow("", null).optional(),
    seats: Joi.number().valid(4, 5, 6, 7, 10).allow(null, "").optional(),
    acAvailable: Joi.boolean().allow(null, "").optional(),
    musicSystem: Joi.boolean().allow(null, "").optional(),
    luggageCapacity: Joi.string().trim().valid("small", "medium", "large", "extra-large").allow("", null).optional(),
    baseFare: Joi.number().min(0).allow(null, "").optional(),
    pricePerKm: Joi.number().min(0).allow(null, "").optional(),
    minimumTripFare: Joi.number().min(0).allow(null, "").optional(),
    nightCharge: Joi.number().min(0).allow(null, "").optional(),
    price: Joi.number().integer().min(0).allow(null, "").optional(),
    ratePerKm: Joi.number().min(0).allow(null, "").optional(),
    location: Joi.string().trim().allow("", null).optional(),
    country: Joi.string().trim().allow("", null).optional(),
    locationCoordinates: Joi.alternatives().try(
      Joi.object({ type: Joi.string().valid("Point").optional(), coordinates: Joi.array().items(Joi.number()).optional() }),
      Joi.string().allow("", null), Joi.allow(null)
    ).optional(),
    village: Joi.string().trim().allow("", null).optional(),
    area: Joi.string().trim().allow("", null).optional(),
    city: Joi.string().trim().allow("", null).optional(),
    district: Joi.string().trim().allow("", null).optional(),
    state: Joi.string().trim().allow("", null).optional(),
    serviceRadius: Joi.alternatives().try(Joi.number().valid(20, 50, 100), Joi.string().valid("null").allow(null), Joi.allow(null, "")).optional(),
    driverType: Joi.string().trim().valid("owner", "dedicated-driver").allow("", null).optional(),
    driverName: Joi.string().trim().allow("", null).optional(),
    driverExperience: Joi.alternatives().try(Joi.number().min(0), Joi.string().allow("", null), Joi.allow(null, "")).optional(),
    driverPhoneNumber: Joi.string().trim().allow("", null).optional(),
    driverLicenseNumber: Joi.string().trim().allow("", null).optional(),
    carType: Joi.string().trim().valid("electric", "petrol", "diesel", "hybrid", "other").allow("", null).optional(),
    availableTripTypes: Joi.alternatives().try(
      Joi.array().items(Joi.string().valid("local", "outstation", "airport-pickup", "railway-pickup", "wedding", "family-function", "temple-visit", "tourism", "corporate")),
      Joi.string().allow("", null), Joi.allow(null, "")
    ).optional(),
    bookingRules: Joi.alternatives().try(
      Joi.object({
        minimumBookingAmount: Joi.number().min(0).allow(null, "").optional(),
        maximumPassengers: Joi.number().min(1).allow(null, "").optional(),
        smokingAllowed: Joi.boolean().allow(null, "").optional(),
        petsAllowed: Joi.boolean().allow(null, "").optional(),
        luggageAllowed: Joi.boolean().allow(null, "").optional(),
        nightDriving: Joi.boolean().allow(null, "").optional(),
      }),
      Joi.string().allow("", null), Joi.allow(null, "")
    ).optional(),
    paymentMethods: Joi.alternatives().try(
      Joi.array().items(Joi.string().valid("cash", "upi", "online", "all")),
      Joi.string().allow("", null), Joi.allow(null, "")
    ).optional(),
    whatsappNumber: Joi.string().trim().min(8).max(20).allow("", null).optional(),
    category: Joi.string().trim().allow("", null).optional(),
    image: Joi.object({ url: Joi.string().trim().allow("", null), filename: Joi.string().trim().allow("", null) }).default({}).allow(null),
    images: Joi.alternatives().try(
      Joi.array().items(Joi.object({ url: Joi.string().trim().allow("", null), filename: Joi.string().trim().allow("", null), type: Joi.string().trim().valid("front", "rear", "left", "right", "interior", "dashboard").allow("", null).optional() })),
      Joi.allow(null, "")
    ).optional(),
  }).required(),
});

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().required(),
  }).required()
});

module.exports.bookingRequestSchema = Joi.object({
  booking: Joi.object({
    pickupLocation: Joi.string().trim().required().messages({ 'any.required': 'Pickup location is required' }),
    pickupCoordinates: Joi.array().items(Joi.number()).length(2).optional(),
    destination: Joi.string().trim().required().messages({ 'any.required': 'Destination is required' }),
    destinationCoordinates: Joi.array().items(Joi.number()).length(2).optional(),
    travelDate: Joi.date().iso().required().messages({ 'any.required': 'Travel date is required' }),
    pickupDate: Joi.date().iso().optional(),
    pickupTime: Joi.string().pattern(/^([01]\d|2[0-3]):?([0-5]\d)$/).required().messages({ 'any.required': 'Pickup time is required' }),
    passengerCount: Joi.number().integer().min(1).required().messages({ 'any.required': 'Passenger count is required' }),
    passengers: Joi.number().integer().min(1).optional(),
    tripType: Joi.string().valid('local', 'outstation', 'airport-pickup', 'railway-pickup', 'wedding', 'family-function', 'temple-visit', 'tourism', 'corporate', 'other').required(),
    specialNote: Joi.string().trim().allow("", null).optional(),
    specialInstructions: Joi.string().trim().allow("", null).optional(),
    distanceKm: Joi.number().min(0).optional(),
    estimatedDistance: Joi.number().min(0).optional(),
    estimatedDuration: Joi.string().allow("", null).optional(),
    estimatedFare: Joi.number().min(0).optional(),
    basePrice: Joi.number().min(0).optional(),
    pricePerKM: Joi.number().min(0).optional(),
    customerName: Joi.string().trim().optional(),
    customerPhone: Joi.string().trim().optional(),
    customerEmail: Joi.string().email().allow("", null).optional(),
    emergencyContact: Joi.string().trim().allow("", null).optional(),
    paymentMethod: Joi.string().valid('cash', 'upi', 'online', 'cod', 'razorpay').default('cash'),
    tripDays: Joi.number().integer().min(1).max(30).optional().default(1),
    nightStay: Joi.string().valid('yes', 'no', '').optional().default(''),
    pickupLat: Joi.number().optional(),
    pickupLng: Joi.number().optional(),
    destLat: Joi.number().optional(),
    destLng: Joi.number().optional()
  }).required()
});

module.exports.counterOfferSchema = Joi.object({
  finalFare: Joi.number().min(1).required(),
  message: Joi.string().trim().allow("", null).optional()
});

module.exports.rejectBookingSchema = Joi.object({
  reason: Joi.string().trim().valid(
    'Vehicle unavailable',
    'Driver unavailable',
    'Personal emergency',
    'Outside service area',
    'Other'
  ).required(),
  customReason: Joi.string().trim().allow("", null).optional()
});

module.exports.cancelBookingSchema = Joi.object({
  reason: Joi.string().trim().allow("", null).optional()
});

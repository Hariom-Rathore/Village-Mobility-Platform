const Booking = require('../models/booking');
const Listing = require('../models/listing');
const Review = require('../models/review');

/**
 * Check if vehicle is available for given date range
 * @param {string} vehicleId - Vehicle ID
 * @param {Date} pickupDate - Pickup date
 * @param {Date} returnDate - Return date
 * @returns {Promise<boolean>} - True if available
 */
async function checkAvailability(vehicleId, pickupDate, returnDate) {
  if (!pickupDate || !returnDate) {
    return true;
  }

  const conflictingBookings = await Booking.find({
    vehicleId,
    bookingStatus: { $in: ['CONFIRMED', 'RESERVED'] },
    $or: [
      {
        pickupDate: { $lte: returnDate },
        returnDate: { $gte: pickupDate }
      }
    ]
  });

  return conflictingBookings.length === 0;
}

/**
 * Validate booking request
 * @param {Object} bookingData - Booking data
 * @returns {Object} - { valid: boolean, error: string }
 */
async function validateBooking(bookingData) {
  const { vehicleId, pickupDate, returnDate, userId, amount } = bookingData;

  // Check if vehicle exists
  const vehicle = await Listing.findById(vehicleId);
  if (!vehicle) {
    return { valid: false, error: 'Vehicle not found' };
  }

  // Check if vehicle is available (not hidden or under maintenance)
  if (vehicle.availabilityStatus === 'HIDDEN') {
    return { valid: false, error: 'Vehicle is not available for booking' };
  }

  if (vehicle.maintenanceMode) {
    return { valid: false, error: 'Vehicle is under maintenance' };
  }

  // Check if user is trying to book their own vehicle
  if (vehicle.owner && vehicle.owner.toString() === userId) {
    return { valid: false, error: 'You cannot book your own vehicle' };
  }

  // Validate amount
  if (!amount || amount <= 0) {
    return { valid: false, error: 'Invalid booking amount' };
  }

  if (amount > 1000000) {
    return { valid: false, error: 'Booking amount is too high' };
  }

  // Validate dates
  if (pickupDate && returnDate) {
    const now = new Date();
    const pickup = new Date(pickupDate);
    const returnD = new Date(returnDate);

    if (pickup < now) {
      return { valid: false, error: 'Pickup date cannot be in the past' };
    }

    if (returnD <= pickup) {
      return { valid: false, error: 'Return date must be after pickup date' };
    }

    // Check if booking period is too long (max 30 days)
    const daysDiff = Math.ceil((returnD - pickup) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
      return { valid: false, error: 'Maximum booking period is 30 days' };
    }

    // Check for overlapping bookings
    const isAvailable = await checkAvailability(vehicleId, pickup, returnD);
    if (!isAvailable) {
      return { valid: false, error: 'Vehicle is not available for the selected dates' };
    }
  }

  return { valid: true };
}

/**
 * Update vehicle availability status based on bookings
 * @param {string} vehicleId - Vehicle ID
 */
async function updateVehicleAvailability(vehicleId) {
  const vehicle = await Listing.findById(vehicleId);
  if (!vehicle) return;

  const now = new Date();
  
  // Find active bookings
  const activeBooking = await Booking.findOne({
    vehicleId,
    bookingStatus: 'CONFIRMED',
    pickupDate: { $lte: now },
    returnDate: { $gte: now }
  });

  // Find next upcoming booking
  const nextBooking = await Booking.findOne({
    vehicleId,
    bookingStatus: { $in: ['CONFIRMED', 'RESERVED'] },
    pickupDate: { $gt: now }
  }).sort({ pickupDate: 1 });

  if (activeBooking) {
    vehicle.availabilityStatus = 'BOOKED';
    vehicle.currentBookingId = activeBooking._id;
    vehicle.nextAvailableAt = activeBooking.returnDate;
  } else if (nextBooking) {
    vehicle.availabilityStatus = 'AVAILABLE';
    vehicle.currentBookingId = null;
    vehicle.nextAvailableAt = nextBooking.pickupDate;
  } else {
    vehicle.availabilityStatus = 'AVAILABLE';
    vehicle.currentBookingId = null;
    vehicle.nextAvailableAt = null;
  }

  await vehicle.save();
}

/**
 * Get vehicle availability calendar
 * @param {string} vehicleId - Vehicle ID
 * @param {Date} startDate - Start date for calendar
 * @param {Date} endDate - End date for calendar
 * @returns {Promise<Array>} - Array of availability data
 */
async function getAvailabilityCalendar(vehicleId, startDate, endDate) {
  const bookings = await Booking.find({
    vehicleId,
    bookingStatus: { $in: ['CONFIRMED', 'RESERVED'] },
    $or: [
      { pickupDate: { $lte: endDate }, returnDate: { $gte: startDate } }
    ]
  }).select('pickupDate returnDate bookingStatus');

  const calendar = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const dateObj = new Date(current);
    
    // Check if this date is booked
    const isBooked = bookings.some(booking => {
      const pickup = new Date(booking.pickupDate);
      const returnD = new Date(booking.returnDate);
      return dateObj >= pickup && dateObj <= returnD;
    });

    calendar.push({
      date: dateStr,
      available: !isBooked,
      status: isBooked ? 'BOOKED' : 'AVAILABLE'
    });

    current.setDate(current.getDate() + 1);
  }

  return calendar;
}

/**
 * Calculate booking price
 * @param {Object} vehicle - Vehicle document
 * @param {number} days - Number of days
 * @param {number} distanceKm - Distance in km
 * @returns {number} - Total price
 */
function calculatePrice(vehicle, days, distanceKm = 0) {
  const basePrice = vehicle.price || 0;
  const ratePerKm = vehicle.ratePerKm || 0;
  
  const dailyCharge = basePrice * days;
  const distanceCharge = distanceKm * ratePerKm;
  
  return Math.ceil(dailyCharge + distanceCharge);
}

/**
 * Update vehicle statistics after booking
 * @param {string} vehicleId - Vehicle ID
 * @param {number} amount - Booking amount
 */
async function updateVehicleStats(vehicleId, amount) {
  const vehicle = await Listing.findById(vehicleId);
  if (!vehicle) return;

  vehicle.totalBookings = (vehicle.totalBookings || 0) + 1;
  vehicle.totalRevenue = (vehicle.totalRevenue || 0) + amount;
  
  await vehicle.save();
}

/**
 * Update vehicle rating after review
 * @param {string} vehicleId - Vehicle ID
 */
async function updateVehicleRating(vehicleId) {
  const vehicle = await Listing.findById(vehicleId);
  if (!vehicle) return;

  const reviews = await Review.find({ _id: { $in: vehicle.reviews } });
  
  if (reviews.length > 0) {
    const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    vehicle.averageRating = totalRating / reviews.length;
    vehicle.totalReviews = reviews.length;
  }

  await vehicle.save();
}

module.exports = {
  checkAvailability,
  validateBooking,
  updateVehicleAvailability,
  getAvailabilityCalendar,
  calculatePrice,
  updateVehicleStats,
  updateVehicleRating
};

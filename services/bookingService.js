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
  const { vehicleId, pickupDate, returnDate, pickupTime, returnTime, userId, amount } = bookingData;

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

  // Validate dates and times
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

    // Validate times if provided
    if (pickupTime && returnTime) {
      // If same day, return time must be after pickup time
      if (pickup.toDateString() === returnD.toDateString()) {
        if (pickupTime >= returnTime) {
          return { valid: false, error: 'Return time must be after pickup time on the same day' };
        }
      }
    }

    // Create combined datetime for availability check
    let pickupDateTime = new Date(pickup);
    let returnDateTime = new Date(returnD);
    
    if (pickupTime) {
      const [hours, minutes] = pickupTime.split(':');
      pickupDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }
    
    if (returnTime) {
      const [hours, minutes] = returnTime.split(':');
      returnDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    // Check for overlapping bookings using combined datetime
    const isAvailable = await checkAvailability(vehicleId, pickupDateTime, returnDateTime);
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
 * Calculate booking price with platform fee and tax
 * @param {Object} vehicle - Vehicle document
 * @param {number} days - Number of days
 * @param {number} distanceKm - Distance in km
 * @returns {Object} - Price breakdown object
 */
function calculatePrice(vehicle, days, distanceKm = 0) {
  const basePrice = vehicle.price || 0;
  const ratePerKm = vehicle.ratePerKm || 0;
  
  const dailyCharge = basePrice * days;
  const distanceCharge = distanceKm * ratePerKm;
  const baseTotal = Math.ceil(dailyCharge + distanceCharge);
  
  // Platform fee (5% of base total, minimum ₹50)
  const platformFee = Math.max(50, Math.ceil(baseTotal * 0.05));
  
  // Tax (18% GST on base total + platform fee)
  const taxableAmount = baseTotal + platformFee;
  const tax = Math.ceil(taxableAmount * 0.18);
  
  // Grand total
  const grandTotal = baseTotal + platformFee + tax;
  
  return {
    basePrice: baseTotal,
    platformFee,
    tax,
    totalPrice: grandTotal,
    breakdown: {
      dailyRate: basePrice,
      days,
      dailyCharge,
      distanceRate: ratePerKm,
      distanceKm,
      distanceCharge,
      platformFeeRate: '5%',
      taxRate: '18%'
    }
  };
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

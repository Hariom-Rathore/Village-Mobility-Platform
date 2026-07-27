const Booking = require('../models/booking');
const Listing = require('../models/listing');
const VehicleAvailability = require('../models/vehicleAvailability');

async function checkAvailability(vehicleId, startDate, endDate, excludeBookingId = null) {
  if (!startDate || !endDate) return true;

  const filter = {
    vehicle: vehicleId,
    status: 'booked',
    $or: [
      { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
    ]
  };

  if (excludeBookingId) {
    filter.booking = { $ne: excludeBookingId };
  }

  const conflicting = await VehicleAvailability.find(filter);
  return conflicting.length === 0;
}

async function validateBooking(bookingData) {
  const { vehicleId, pickupDate, returnDate, pickupTime, userId, amount } = bookingData;

  const vehicle = await Listing.findById(vehicleId);
  if (!vehicle) return { valid: false, error: 'Vehicle not found' };

  if (vehicle.availabilityStatus === 'HIDDEN') {
    return { valid: false, error: 'Vehicle is not available for booking' };
  }

  if (vehicle.maintenanceMode) {
    return { valid: false, error: 'Vehicle is under maintenance' };
  }

  if (vehicle.owner && vehicle.owner.toString() === userId) {
    return { valid: false, error: 'You cannot book your own vehicle' };
  }

  if (!amount || amount <= 0) {
    return { valid: false, error: 'Invalid booking amount' };
  }

  if (amount > 1000000) {
    return { valid: false, error: 'Booking amount is too high' };
  }

  if (pickupDate) {
    const now = new Date();
    const pickup = new Date(pickupDate);
    if (pickup < now) {
      return { valid: false, error: 'Pickup date cannot be in the past' };
    }
  }

  if (pickupDate && returnDate) {
    const pickup = new Date(pickupDate);
    const returnD = new Date(returnDate);
    if (returnD <= pickup) {
      return { valid: false, error: 'Return date must be after pickup date' };
    }
    const daysDiff = Math.ceil((returnD - pickup) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
      return { valid: false, error: 'Maximum booking period is 30 days' };
    }
  }

  if (pickupDate) {
    const startDateTime = new Date(pickupDate);
    if (pickupTime) {
      const [hours, minutes] = pickupTime.split(':');
      startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }
    const endDateTime = returnDate ? new Date(returnDate) : new Date(startDateTime);
    endDateTime.setHours(23, 59, 0, 0);

    const isAvailable = await checkAvailability(vehicleId, startDateTime, endDateTime);
    if (!isAvailable) {
      return { valid: false, error: 'Vehicle is not available for the selected date and time' };
    }
  }

  return { valid: true };
}

async function blockVehicleAvailability(vehicleId, bookingId, startDate, endDate, startTime = null) {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (startTime) {
      const [hours, minutes] = startTime.split(':');
      start.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    const availability = new VehicleAvailability({
      vehicle: vehicleId,
      booking: bookingId,
      startDate: start,
      endDate: end,
      startTime: startTime,
      status: 'booked'
    });
    await availability.save();

    await Listing.findByIdAndUpdate(vehicleId, {
      availabilityStatus: 'BOOKED',
      currentBookingId: bookingId,
      nextAvailableAt: end
    });

    return availability;
  } catch (error) {
    console.error('Error blocking vehicle availability:', error);
  }
}

async function releaseVehicleAvailability(bookingId) {
  try {
    const record = await VehicleAvailability.findOne({ booking: bookingId });
    if (record) {
      await VehicleAvailability.deleteOne({ booking: bookingId });
    }

    const booking = await Booking.findById(bookingId);
    if (booking) {
      const vehicleId = booking.vehicleId;
      const activeBlock = await VehicleAvailability.findOne({
        vehicle: vehicleId,
        status: 'booked',
        endDate: { $gte: new Date() }
      });

      if (!activeBlock) {
        await Listing.findByIdAndUpdate(vehicleId, {
          availabilityStatus: 'AVAILABLE',
          currentBookingId: null,
          nextAvailableAt: null
        });
      }
    }
  } catch (error) {
    console.error('Error releasing vehicle availability:', error);
  }
}

async function getAvailabilityCalendar(vehicleId, startDate, endDate) {
  const blocks = await VehicleAvailability.find({
    vehicle: vehicleId,
    status: 'booked',
    $or: [
      { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
    ]
  }).select('startDate endDate status');

  const calendar = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const dateObj = new Date(current);

    const isBooked = blocks.some(block => {
      const blockStart = new Date(block.startDate);
      const blockEnd = new Date(block.endDate);
      blockEnd.setHours(23, 59, 59, 999);
      return dateObj >= blockStart && dateObj <= blockEnd;
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

function calculatePrice(vehicle, days, distanceKm = 0) {
  const baseFare = Number(vehicle.baseFare || vehicle.price || 0);
  const ratePerKm = Number(vehicle.pricePerKm || vehicle.ratePerKm || 0);

  const dailyCharge = baseFare * days;
  const distanceCharge = distanceKm * ratePerKm;
  const baseTotal = Math.ceil(dailyCharge + distanceCharge);

  const platformFee = Math.max(50, Math.ceil(baseTotal * 0.05));
  const taxableAmount = baseTotal + platformFee;
  const tax = Math.ceil(taxableAmount * 0.18);
  const grandTotal = baseTotal + platformFee + tax;

  return {
    basePrice: baseTotal,
    platformFee,
    tax,
    totalPrice: grandTotal,
    breakdown: {
      dailyRate: baseFare,
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

async function updateVehicleStats(vehicleId, amount) {
  const vehicle = await Listing.findById(vehicleId);
  if (!vehicle) return;
  vehicle.totalBookings = (vehicle.totalBookings || 0) + 1;
  vehicle.totalRevenue = (vehicle.totalRevenue || 0) + amount;
  await vehicle.save();
}

module.exports = {
  checkAvailability,
  validateBooking,
  blockVehicleAvailability,
  releaseVehicleAvailability,
  getAvailabilityCalendar,
  calculatePrice,
  updateVehicleStats
};

const Notification = require('../models/notification');
const Listing = require('../models/listing');
const Booking = require('../models/booking');
const { emitToUser } = require('../utils/socket');

async function createNotification(recipientId, type, title, message, relatedBooking = null, relatedVehicle = null, data = null) {
  try {
    const notification = new Notification({
      recipient: recipientId,
      type,
      title,
      message,
      relatedBooking,
      relatedVehicle,
      data,
      isRead: false
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

async function notifyNewBookingRequest(bookingId, io) {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('vehicleId')
      .populate('customerId')
      .populate('ownerId');
    if (!booking) return;

    const vehicle = booking.vehicleId;
    const customer = booking.customerId;
    const ownerId = booking.ownerId;

    const title = '🔔 New Booking Request';
    const message = `${customer?.username || 'A customer'} wants to book ${vehicle?.title || 'your vehicle'}.\nPickup: ${booking.pickupLocation || booking.pickup || 'N/A'}\nDestination: ${booking.destination || 'N/A'}\nDate: ${booking.pickupDate ? new Date(booking.pickupDate).toLocaleDateString('en-IN') : 'N/A'}\nTime: ${booking.pickupTime || 'N/A'}\nPassengers: ${booking.passengers || 'N/A'}\nEstimated Fare: ₹${booking.estimatedFare || 0}`;

    const notification = await createNotification(
      ownerId,
      'NEW_BOOKING_REQUEST',
      title,
      message,
      bookingId,
      booking.vehicleId,
      {
        customerName: customer?.username,
        customerRating: customer?.averageRating,
        vehicleName: vehicle?.title,
        pickup: booking.pickupLocation || booking.pickup,
        destination: booking.destination,
        pickupDate: booking.pickupDate,
        pickupTime: booking.pickupTime,
        passengers: booking.passengers,
        estimatedFare: booking.estimatedFare,
        distanceKm: booking.distanceKm,
        estimatedDuration: booking.estimatedDuration,
        specialNote: booking.specialNote || booking.specialInstructions,
        expiresAt: booking.expiresAt
      }
    );

    if (io) {
      emitToUser(io, ownerId, 'notification:new', {
        _id: notification._id,
        type: 'NEW_BOOKING_REQUEST',
        title,
        message,
        relatedBooking: bookingId,
        relatedVehicle: booking.vehicleId,
        data: notification.data,
        createdAt: notification.createdAt,
        isRead: false
      });
    }
  } catch (error) {
    console.error('Error in notifyNewBookingRequest:', error);
  }
}

async function notifyBookingAccepted(bookingId, io) {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('vehicleId')
      .populate('ownerId');
    if (!booking) return;

    const vehicle = booking.vehicleId;
    const owner = booking.ownerId;
    const info = booking.acceptedInfo || {};

    const message = `✅ Your booking for ${vehicle?.title || 'vehicle'} has been accepted by ${owner?.username || 'the owner'}.\nDriver: ${info.driverName || 'Owner will drive'}\nVehicle No: ${info.vehicleNumber || 'N/A'}\nEstimated Pickup Time: ${booking.pickupTime || 'N/A'}\nPlease complete advance payment to confirm your trip.`;

    const notification = await createNotification(
      booking.customerId,
      'BOOKING_ACCEPTED',
      '✅ Booking Accepted',
      message,
      bookingId,
      booking.vehicleId,
      {
        ownerName: info.ownerName || owner?.username,
        ownerPhone: info.ownerPhone || owner?.phoneNumber,
        driverName: info.driverName,
        driverPhone: info.driverPhone,
        vehicleNumber: info.vehicleNumber
      }
    );

    if (io) {
      emitToUser(io, booking.customerId, 'booking:accepted', {
        bookingId,
        status: 'ACCEPTED',
        notification,
        acceptedInfo: booking.acceptedInfo
      });
      emitToUser(io, booking.customerId, 'notification:new', {
        _id: notification._id,
        type: 'BOOKING_ACCEPTED',
        title: '✅ Booking Accepted',
        message,
        relatedBooking: bookingId,
        relatedVehicle: booking.vehicleId,
        data: notification.data,
        createdAt: notification.createdAt,
        isRead: false
      });
    }
  } catch (error) {
    console.error('Error in notifyBookingAccepted:', error);
  }
}

async function notifyBookingRejected(bookingId, reason, io) {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('vehicleId');
    if (!booking) return;

    const vehicle = booking.vehicleId;
    const message = reason
      ? `Sorry, your booking request for ${vehicle?.title || 'vehicle'} was declined.\nReason: ${reason}\nPlease choose another nearby vehicle.`
      : `Sorry, your booking request for ${vehicle?.title || 'vehicle'} was declined.\nPlease choose another nearby vehicle.`;

    const notification = await createNotification(
      booking.customerId,
      'BOOKING_REJECTED',
      '❌ Booking Declined',
      message,
      bookingId,
      booking.vehicleId,
      { reason }
    );

    if (io) {
      emitToUser(io, booking.customerId, 'booking:rejected', {
        bookingId,
        status: 'REJECTED',
        reason,
        notification
      });
      emitToUser(io, booking.customerId, 'notification:new', {
        _id: notification._id,
        type: 'BOOKING_REJECTED',
        title: '❌ Booking Declined',
        message,
        relatedBooking: bookingId,
        relatedVehicle: booking.vehicleId,
        createdAt: notification.createdAt,
        isRead: false
      });
    }
  } catch (error) {
    console.error('Error in notifyBookingRejected:', error);
  }
}

async function notifyBookingExpired(bookingId, io) {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('vehicleId')
      .populate('customerId')
      .populate('ownerId');
    if (!booking) return;

    const vehicle = booking.vehicleId;
    const customer = booking.customerId;

    const customerMsg = `⏰ Your booking request for ${vehicle?.title || 'vehicle'} has expired. The owner did not respond in time. Please choose another nearby vehicle.`;
    const ownerMsg = `⏰ Booking request from ${customer?.username || 'customer'} for ${vehicle?.title || 'vehicle'} has expired — you didn't respond in time.`;

    await createNotification(
      booking.customerId,
      'BOOKING_EXPIRED',
      '⏰ Booking Request Expired',
      customerMsg,
      bookingId,
      booking.vehicleId
    );

    await createNotification(
      booking.ownerId,
      'BOOKING_EXPIRED',
      '⏰ Booking Request Expired',
      ownerMsg,
      bookingId,
      booking.vehicleId
    );

    if (io) {
      emitToUser(io, booking.customerId, 'booking:expired', { bookingId, status: 'EXPIRED', message: customerMsg });
      emitToUser(io, booking.ownerId, 'booking:expired', { bookingId, status: 'EXPIRED', message: ownerMsg });
    }
  } catch (error) {
    console.error('Error in notifyBookingExpired:', error);
  }
}

async function notifyCounterOfferSent(bookingId, io) {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('vehicleId')
      .populate('ownerId');
    if (!booking) return;

    const vehicle = booking.vehicleId;
    const owner = booking.ownerId;
    const counter = booking.counterOffer || {};

    const message = `${owner?.username || 'Owner'} sent a counter offer for ${vehicle?.title || 'your booking'}.\nOriginal: ₹${counter.originalFare || booking.estimatedFare || 0}\nNew: ₹${counter.finalFare || 0}${counter.message ? '\nMessage: ' + counter.message : ''}`;

    const notification = await createNotification(
      booking.customerId,
      'COUNTER_OFFER_SENT',
      '💬 Counter Offer Received',
      message,
      bookingId,
      booking.vehicleId,
      {
        originalFare: counter.originalFare || booking.estimatedFare,
        newFare: counter.finalFare,
        ownerMessage: counter.message
      }
    );

    if (io) {
      emitToUser(io, booking.customerId, 'booking:counterOffer', {
        bookingId,
        status: 'COUNTER_OFFER_SENT',
        counterOffer: counter,
        notification
      });
      emitToUser(io, booking.customerId, 'notification:new', {
        _id: notification._id,
        type: 'COUNTER_OFFER_SENT',
        title: '💬 Counter Offer Received',
        message,
        relatedBooking: bookingId,
        relatedVehicle: booking.vehicleId,
        data: { originalFare: counter.originalFare, newFare: counter.finalFare, ownerMessage: counter.message },
        createdAt: notification.createdAt,
        isRead: false
      });
    }
  } catch (error) {
    console.error('Error in notifyCounterOfferSent:', error);
  }
}

async function notifyCounterOfferAccepted(bookingId, io) {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('vehicleId')
      .populate('customerId');
    if (!booking) return;

    const vehicle = booking.vehicleId;
    const customer = booking.customerId;
    const counter = booking.counterOffer || {};

    const message = `${customer?.username || 'Customer'} accepted your counter offer of ₹${counter.finalFare || booking.estimatedFare || 0}. Booking confirmed!`;

    const notification = await createNotification(
      booking.ownerId,
      'COUNTER_OFFER_ACCEPTED',
      '✅ Counter Offer Accepted',
      message,
      bookingId,
      booking.vehicleId,
      { finalFare: counter.finalFare }
    );

    if (io) {
      emitToUser(io, booking.ownerId, 'booking:accepted', { bookingId, status: 'COUNTER_OFFER_ACCEPTED', notification });
      emitToUser(io, booking.ownerId, 'notification:new', {
        _id: notification._id,
        type: 'COUNTER_OFFER_ACCEPTED',
        title: '✅ Counter Offer Accepted',
        message,
        relatedBooking: bookingId,
        relatedVehicle: booking.vehicleId,
        createdAt: notification.createdAt,
        isRead: false
      });
    }
  } catch (error) {
    console.error('Error in notifyCounterOfferAccepted:', error);
  }
}

async function notifyBookingCancelled(bookingId, cancelledBy, io) {
  try {
    const booking = await Booking.findById(bookingId).populate('vehicleId');
    if (!booking) return;

    const vehicle = booking.vehicleId;
    const recipientId = cancelledBy === 'customer' ? booking.ownerId : booking.customerId;

    const message = `Booking for ${vehicle?.title || 'vehicle'} has been cancelled by the ${cancelledBy}.`;

    const notification = await createNotification(
      recipientId,
      'BOOKING_CANCELLED',
      'Booking Cancelled',
      message,
      bookingId,
      booking.vehicleId
    );

    if (io) {
      emitToUser(io, recipientId, 'booking:cancelled', { bookingId, status: 'CANCELLED', cancelledBy, notification });
      emitToUser(io, recipientId, 'notification:new', {
        _id: notification._id,
        type: 'BOOKING_CANCELLED',
        title: 'Booking Cancelled',
        message,
        relatedBooking: bookingId,
        relatedVehicle: booking.vehicleId,
        createdAt: notification.createdAt,
        isRead: false
      });
    }
  } catch (error) {
    console.error('Error in notifyBookingCancelled:', error);
  }
}

async function notifyBookingConfirmed(bookingId) {
  try {
    const booking = await Booking.findById(bookingId).populate('vehicleId').populate('ownerId');
    if (!booking) return;
    const vehicle = booking.vehicleId;
    const owner = booking.ownerId;
    const message = `Your booking for ${vehicle?.title || 'vehicle'} has been confirmed.`;
    await createNotification(booking.customerId, 'BOOKING_ACCEPTED', '✅ Booking Confirmed', message, bookingId, booking.vehicleId);
  } catch (error) {
    console.error('Error in notifyBookingConfirmed:', error);
  }
}

async function notifyPaymentReceived(bookingId) {
  try {
    const booking = await Booking.findById(bookingId).populate('vehicleId');
    if (!booking) return;
    const vehicle = booking.vehicleId;
    const message = `Payment received for booking of ${vehicle?.title || 'vehicle'}. Amount: ₹${booking.estimatedFare || 0}`;
    await createNotification(booking.ownerId, 'PAYMENT_RECEIVED', 'Payment Received', message, bookingId, booking.vehicleId);
  } catch (error) {
    console.error('Error in notifyPaymentReceived:', error);
  }
}

async function notifyTripCompleted(bookingId, io) {
  try {
    const booking = await Booking.findById(bookingId).populate('vehicleId');
    if (!booking) return;

    const vehicle = booking.vehicleId;
    const customerMessage = `Your trip in ${vehicle?.title || 'vehicle'} has been completed. Thank you for choosing RideLocal!`;
    await createNotification(booking.customerId, 'TRIP_COMPLETED', '🏁 Trip Completed', customerMessage, bookingId, booking.vehicleId);

    const ownerMessage = `Trip for ${vehicle?.title || 'vehicle'} has been completed. Vehicle is now available for new bookings.`;
    const ownerNotification = await createNotification(booking.ownerId, 'TRIP_COMPLETED', '🏁 Trip Completed', ownerMessage, bookingId, booking.vehicleId);

    if (io) {
      emitToUser(io, booking.customerId, 'notification:new', { type: 'TRIP_COMPLETED', title: '🏁 Trip Completed', message: customerMessage, relatedBooking: bookingId });
      emitToUser(io, booking.ownerId, 'notification:new', { _id: ownerNotification?._id, type: 'TRIP_COMPLETED', title: '🏁 Trip Completed', message: ownerMessage, relatedBooking: bookingId });
    }
  } catch (error) {
    console.error('Error in notifyTripCompleted:', error);
  }
}

async function getUserNotifications(userId, unreadOnly = false) {
  try {
    const filter = { recipient: userId };
    if (unreadOnly) filter.isRead = false;
    return await Notification.find(filter)
      .populate('relatedVehicle')
      .populate('relatedBooking')
      .sort({ createdAt: -1 })
      .limit(50);
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return [];
  }
}

async function markAsRead(notificationId, userId) {
  try {
    const notification = await Notification.findById(notificationId);
    if (!notification) return false;
    if (notification.recipient.toString() !== userId.toString()) return false;
    notification.isRead = true;
    await notification.save();
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

async function markAllAsRead(userId) {
  try {
    await Notification.updateMany({ recipient: userId, isRead: false }, { isRead: true });
    return true;
  } catch (error) {
    console.error('Error marking all as read:', error);
    return false;
  }
}

async function getUnreadCount(userId) {
  try {
    return await Notification.countDocuments({ recipient: userId, isRead: false });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

module.exports = {
  createNotification,
  notifyNewBookingRequest,
  notifyBookingAccepted,
  notifyBookingRejected,
  notifyBookingExpired,
  notifyCounterOfferSent,
  notifyCounterOfferAccepted,
  notifyBookingCancelled,
  notifyBookingConfirmed,
  notifyPaymentReceived,
  notifyTripCompleted,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount
};

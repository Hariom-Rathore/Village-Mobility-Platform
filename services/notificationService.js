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

    const title = 'New Booking Request';
    const message = `${customer?.username || 'A customer'} wants to book ${vehicle?.title || 'your vehicle'}. Pickup: ${booking.pickupLocation || booking.pickup || 'N/A'}, Destination: ${booking.destination || 'N/A'}. Fare: ₹${booking.estimatedFare || 0}`;

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
        specialNote: booking.specialNote || booking.specialInstructions
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

    const message = `Your booking for ${vehicle?.title || 'vehicle'} has been accepted by ${owner?.username || 'the owner'}.`;
    const notification = await createNotification(
      booking.customerId,
      'BOOKING_ACCEPTED',
      'Booking Accepted',
      message,
      bookingId,
      booking.vehicleId
    );

    if (io) {
      emitToUser(io, booking.customerId, 'booking:accepted', {
        bookingId,
        status: 'ACCEPTED',
        notification
      });
      emitToUser(io, booking.customerId, 'notification:new', {
        _id: notification._id,
        type: 'BOOKING_ACCEPTED',
        title: 'Booking Accepted',
        message,
        relatedBooking: bookingId,
        relatedVehicle: booking.vehicleId,
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
      ? `Your booking request for ${vehicle?.title || 'vehicle'} was declined. Reason: ${reason}`
      : `Your booking request for ${vehicle?.title || 'vehicle'} was declined. Please choose another nearby vehicle.`;

    const notification = await createNotification(
      booking.customerId,
      'BOOKING_REJECTED',
      'Booking Declined',
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
        title: 'Booking Declined',
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

async function notifyCounterOfferSent(bookingId, io) {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('vehicleId')
      .populate('ownerId');
    if (!booking) return;

    const vehicle = booking.vehicleId;
    const owner = booking.ownerId;
    const counter = booking.counterOffer || {};

    const message = `${owner?.username || 'Owner'} sent a counter offer for ${vehicle?.title || 'your booking'}. Original: ₹${counter.originalFare || booking.estimatedFare || 0}, New: ₹${counter.finalFare || 0}. ${counter.message ? 'Message: ' + counter.message : ''}`;

    const notification = await createNotification(
      booking.customerId,
      'COUNTER_OFFER_SENT',
      'Counter Offer Received',
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
        title: 'Counter Offer Received',
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
      'Counter Offer Accepted',
      message,
      bookingId,
      booking.vehicleId,
      { finalFare: counter.finalFare }
    );

    if (io) {
      emitToUser(io, booking.ownerId, 'booking:accepted', {
        bookingId,
        status: 'COUNTER_OFFER_ACCEPTED',
        notification
      });
      emitToUser(io, booking.ownerId, 'notification:new', {
        _id: notification._id,
        type: 'COUNTER_OFFER_ACCEPTED',
        title: 'Counter Offer Accepted',
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

    const message = `Booking for ${vehicle?.title || 'vehicle'} has been cancelled.`;

    const notification = await createNotification(
      recipientId,
      'BOOKING_CANCELLED',
      'Booking Cancelled',
      message,
      bookingId,
      booking.vehicleId
    );

    if (io) {
      emitToUser(io, recipientId, 'booking:cancelled', {
        bookingId,
        status: 'CANCELLED',
        cancelledBy,
        notification
      });
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

async function notifyTripCompleted(bookingId, io) {
  try {
    const booking = await Booking.findById(bookingId).populate('vehicleId');
    if (!booking) return;

    const vehicle = booking.vehicleId;

    const customerMessage = `Your trip in ${vehicle?.title || 'vehicle'} has been completed. Please leave a review.`;
    await createNotification(
      booking.customerId,
      'TRIP_COMPLETED',
      'Trip Completed',
      customerMessage,
      bookingId,
      booking.vehicleId
    );

    const ownerMessage = `Trip for ${vehicle?.title || 'vehicle'} has been completed. Vehicle is now available.`;
    const ownerNotification = await createNotification(
      booking.ownerId,
      'TRIP_COMPLETED',
      'Trip Completed',
      ownerMessage,
      bookingId,
      booking.vehicleId
    );

    if (io) {
      emitToUser(io, booking.customerId, 'notification:new', {
        type: 'TRIP_COMPLETED',
        title: 'Trip Completed',
        message: customerMessage,
        relatedBooking: bookingId,
        relatedVehicle: booking.vehicleId
      });
      emitToUser(io, booking.ownerId, 'notification:new', {
        _id: ownerNotification._id,
        type: 'TRIP_COMPLETED',
        title: 'Trip Completed',
        message: ownerMessage,
        relatedBooking: bookingId,
        relatedVehicle: booking.vehicleId
      });
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
    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true }
    );
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
  notifyCounterOfferSent,
  notifyCounterOfferAccepted,
  notifyBookingCancelled,
  notifyTripCompleted,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount
};

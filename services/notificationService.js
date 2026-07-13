const Notification = require('../models/notification');
const Listing = require('../models/listing');
const Booking = require('../models/booking');

/**
 * Create a notification for a user
 * @param {string} recipientId - User ID to receive notification
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} relatedBooking - Related booking ID (optional)
 * @param {string} relatedVehicle - Related vehicle ID (optional)
 */
async function createNotification(recipientId, type, title, message, relatedBooking = null, relatedVehicle = null) {
  try {
    const notification = new Notification({
      recipient: recipientId,
      type,
      title,
      message,
      relatedBooking,
      relatedVehicle,
      isRead: false
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

/**
 * Notify booking confirmation
 * @param {string} bookingId - Booking ID
 */
async function notifyBookingConfirmed(bookingId) {
  try {
    const booking = await Booking.findById(bookingId).populate('vehicleId').populate('renterId');
    if (!booking) return;

    const vehicle = booking.vehicleId;
    const renter = booking.renterId;

    // Notify owner
    await createNotification(
      booking.ownerId,
      'BOOKING_CONFIRMED',
      'New Booking Confirmed',
      `Your vehicle "${vehicle.title}" has been booked by ${renter.username || renter.email}.`,
      bookingId,
      vehicle._id
    );

    // Notify renter
    await createNotification(
      renter._id,
      'BOOKING_CONFIRMED',
      'Booking Confirmed',
      `Your booking for "${vehicle.title}" has been confirmed.`,
      bookingId,
      vehicle._id
    );
  } catch (error) {
    console.error('Error notifying booking confirmed:', error);
  }
}

/**
 * Notify booking cancellation
 * @param {string} bookingId - Booking ID
 */
async function notifyBookingCancelled(bookingId) {
  try {
    const booking = await Booking.findById(bookingId).populate('vehicleId').populate('renterId');
    if (!booking) return;

    const vehicle = booking.vehicleId;
    const renter = booking.renterId;

    // Notify owner
    await createNotification(
      booking.ownerId,
      'BOOKING_CANCELLED',
      'Booking Cancelled',
      `Booking for "${vehicle.title}" has been cancelled.`,
      bookingId,
      vehicle._id
    );

    // Notify renter
    await createNotification(
      renter._id,
      'BOOKING_CANCELLED',
      'Booking Cancelled',
      `Your booking for "${vehicle.title}" has been cancelled.`,
      bookingId,
      vehicle._id
    );
  } catch (error) {
    console.error('Error notifying booking cancelled:', error);
  }
}

/**
 * Notify booking completion
 * @param {string} bookingId - Booking ID
 */
async function notifyBookingCompleted(bookingId) {
  try {
    const booking = await Booking.findById(bookingId).populate('vehicleId').populate('renterId');
    if (!booking) return;

    const vehicle = booking.vehicleId;
    const renter = booking.renterId;

    // Notify owner
    await createNotification(
      booking.ownerId,
      'BOOKING_COMPLETED',
      'Booking Completed',
      `Booking for "${vehicle.title}" has been completed. Vehicle is now available.`,
      bookingId,
      vehicle._id
    );

    // Notify renter
    await createNotification(
      renter._id,
      'BOOKING_COMPLETED',
      'Booking Completed',
      `Your booking for "${vehicle.title}" has been completed. Please leave a review.`,
      bookingId,
      vehicle._id
    );
  } catch (error) {
    console.error('Error notifying booking completed:', error);
  }
}

/**
 * Notify vehicle available again
 * @param {string} vehicleId - Vehicle ID
 */
async function notifyVehicleAvailable(vehicleId) {
  try {
    const vehicle = await Listing.findById(vehicleId);
    if (!vehicle) return;

    // Notify owner
    await createNotification(
      vehicle.owner,
      'VEHICLE_AVAILABLE',
      'Vehicle Available',
      `Your vehicle "${vehicle.title}" is now available for booking.`,
      null,
      vehicleId
    );
  } catch (error) {
    console.error('Error notifying vehicle available:', error);
  }
}

/**
 * Notify review received
 * @param {string} vehicleId - Vehicle ID
 * @param {string} reviewerId - Reviewer ID
 */
async function notifyReviewReceived(vehicleId, reviewerId) {
  try {
    const vehicle = await Listing.findById(vehicleId);
    if (!vehicle) return;

    // Notify owner
    await createNotification(
      vehicle.owner,
      'REVIEW_RECEIVED',
      'New Review Received',
      `Your vehicle "${vehicle.title}" has received a new review.`,
      null,
      vehicleId
    );
  } catch (error) {
    console.error('Error notifying review received:', error);
  }
}

/**
 * Notify payment received
 * @param {string} bookingId - Booking ID
 */
async function notifyPaymentReceived(bookingId) {
  try {
    const booking = await Booking.findById(bookingId).populate('vehicleId');
    if (!booking) return;

    const vehicle = booking.vehicleId;

    // Notify owner
    await createNotification(
      booking.ownerId,
      'PAYMENT_RECEIVED',
      'Payment Received',
      `Payment of ₹${booking.totalPrice} received for booking of "${vehicle.title}".`,
      bookingId,
      vehicle._id
    );
  } catch (error) {
    console.error('Error notifying payment received:', error);
  }
}

/**
 * Get user notifications
 * @param {string} userId - User ID
 * @param {boolean} unreadOnly - Get only unread notifications
 * @returns {Promise<Array>} - Array of notifications
 */
async function getUserNotifications(userId, unreadOnly = false) {
  try {
    const filter = { recipient: userId };
    if (unreadOnly) {
      filter.isRead = false;
    }

    const notifications = await Notification.find(filter)
      .populate('relatedVehicle')
      .populate('relatedBooking')
      .sort({ createdAt: -1 })
      .limit(50);

    return notifications;
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return [];
  }
}

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for authorization)
 */
async function markAsRead(notificationId, userId) {
  try {
    const notification = await Notification.findById(notificationId);
    if (!notification) return false;

    if (notification.recipient.toString() !== userId.toString()) {
      return false;
    }

    notification.isRead = true;
    await notification.save();
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 */
async function markAllAsRead(userId) {
  try {
    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true }
    );
    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
}

/**
 * Get unread notification count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Unread count
 */
async function getUnreadCount(userId) {
  try {
    const count = await Notification.countDocuments({
      recipient: userId,
      isRead: false
    });
    return count;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

module.exports = {
  createNotification,
  notifyBookingConfirmed,
  notifyBookingCancelled,
  notifyBookingCompleted,
  notifyVehicleAvailable,
  notifyReviewReceived,
  notifyPaymentReceived,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount
};

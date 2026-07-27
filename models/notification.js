const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'BOOKING_SUBMITTED',
      'BOOKING_ACCEPTED',
      'BOOKING_REJECTED',
      'COUNTER_OFFER',
      'TRIP_REMINDER',
      'TRIP_COMPLETED',
      'BOOKING_CANCELLED',
      'BOOKING_COMPLETED',
      'VEHICLE_AVAILABLE',
      'REVIEW_RECEIVED',
      'PAYMENT_RECEIVED'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedBooking: {
    type: Schema.Types.ObjectId,
    ref: 'Booking'
  },
  relatedVehicle: {
    type: Schema.Types.ObjectId,
    ref: 'Listing'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);

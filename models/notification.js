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
      'NEW_BOOKING_REQUEST',
      'BOOKING_ACCEPTED',
      'BOOKING_REJECTED',
      'COUNTER_OFFER_SENT',
      'COUNTER_OFFER_ACCEPTED',
      'COUNTER_OFFER_REJECTED',
      'BOOKING_CANCELLED',
      'TRIP_STARTED',
      'TRIP_COMPLETED',
      'PAYMENT_RECEIVED',
      'REVIEW_RECEIVED',
      'VEHICLE_AVAILABLE'
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  relatedBooking: { type: Schema.Types.ObjectId, ref: 'Booking' },
  relatedVehicle: { type: Schema.Types.ObjectId, ref: 'Listing' },
  isRead: { type: Boolean, default: false },
  data: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);

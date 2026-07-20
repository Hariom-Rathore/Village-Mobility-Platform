const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BookingSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
  pickup: { type: String },
  destination: { type: String },
  purpose: { type: String },
  distanceKm: { type: Number },
  amountPaid: { type: Number },
  paymentMethod: { type: String, enum: ['razorpay', 'cod'], default: 'razorpay' },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  ownerWhatsappNumber: { type: String },
  // Production booking fields
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Listing' },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
  renterId: { type: Schema.Types.ObjectId, ref: 'User' },
  bookingStatus: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REJECTED', 'EXPIRED'],
    default: 'PENDING'
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
    default: 'PENDING'
  },
  pickupDate: { type: Date },
  returnDate: { type: Date },
  pickupTime: { type: String },
  returnTime: { type: String },
  pickupDateTime: { type: Date }, // Combined pickup date and time
  returnDateTime: { type: Date }, // Combined return date and time
  totalDays: { type: Number, default: 1 },
  totalPrice: { type: Number, required: true },
  basePrice: { type: Number }, // Price before fees and taxes
  platformFee: { type: Number, default: 0 }, // Platform service fee
  tax: { type: Number, default: 0 }, // Tax amount
  securityDeposit: { type: Number, default: 0 },
  cancellationReason: { type: String },
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  bookingCreatedAt: { type: Date, default: Date.now },
  bookingUpdatedAt: { type: Date, default: Date.now },
  bookingCompletedAt: { type: Date },
  vehicleConditionBefore: { type: String },
  vehicleConditionAfter: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', BookingSchema);

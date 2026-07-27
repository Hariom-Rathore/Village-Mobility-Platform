const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BookingSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },

  // Legacy fields (kept for backward compatibility)
  purpose: { type: String },
  amountPaid: { type: Number },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  ownerWhatsappNumber: { type: String },

  // Core Booking Info
  bookingId: { type: String, unique: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Listing' },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
  renterId: { type: Schema.Types.ObjectId, ref: 'User' },
  customerId: { type: Schema.Types.ObjectId, ref: 'User' },

  // Trip Details
  pickup: { type: String },
  pickupLocation: { type: String },
  pickupAddress: { type: String },
  pickupCoordinates: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] }
  },
  destination: { type: String },
  destinationAddress: { type: String },
  destinationCoordinates: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] }
  },
  pickupDate: { type: Date },
  pickupTime: { type: String },
  returnDate: { type: Date },
  returnTime: { type: String },
  pickupDateTime: { type: Date },
  returnDateTime: { type: Date },

  tripType: {
    type: String,
    enum: ['local', 'outstation', 'airport-pickup', 'railway-pickup', 'wedding', 'family-function', 'temple-visit', 'tourism', 'corporate', 'other']
  },
  passengers: { type: Number, min: 1 },
  specialInstructions: { type: String },
  specialNote: { type: String },
  driverType: { type: String, enum: ['owner', 'dedicated-driver', ''] },

  // Distance & Price
  distanceKm: { type: Number },
  estimatedDuration: { type: String },
  basePrice: { type: Number },
  pricePerKM: { type: Number },
  totalPrice: { type: Number },
  estimatedFare: { type: Number },
  platformFee: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  totalDays: { type: Number, default: 1 },
  tripDays: { type: Number, default: 1 },
  nightStay: { type: Boolean, default: false },
  nightStayCharge: { type: Number, default: 0 },
  securityDeposit: { type: Number, default: 0 },

  paymentMethod: { type: String, enum: ['razorpay', 'cod', 'cash', 'upi', 'online'], default: 'cash' },

  // Booking Statuses
  bookingStatus: {
    type: String,
    enum: [
      'PENDING', 'ACCEPTED', 'REJECTED', 'COUNTER_OFFER_SENT',
      'COUNTER_OFFER_ACCEPTED', 'CANCELLED', 'TRIP_STARTED', 'TRIP_COMPLETED'
    ],
    default: 'PENDING'
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
    default: 'PENDING'
  },

  // Counter Offer
  counterOffer: {
    finalFare: { type: Number },
    originalFare: { type: Number },
    message: { type: String },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED', ''] }
  },

  // Rejection
  rejectionReason: { type: String },
  rejectionReasonCustom: { type: String },

  // Accepted details
  acceptedInfo: {
    driverName: { type: String },
    driverPhone: { type: String },
    vehicleNumber: { type: String },
    ownerName: { type: String },
    otp: { type: String }
  },

  // Metadata
  cancellationReason: { type: String },
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  bookingCreatedAt: { type: Date, default: Date.now },
  bookingUpdatedAt: { type: Date, default: Date.now },
  bookingCompletedAt: { type: Date },
  vehicleConditionBefore: { type: String },
  vehicleConditionAfter: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Indexes for performance
BookingSchema.index({ pickupCoordinates: "2dsphere" });
BookingSchema.index({ destinationCoordinates: "2dsphere" });
BookingSchema.index({ bookingId: 1 }, { unique: true });
BookingSchema.index({ ownerId: 1, bookingStatus: 1, createdAt: -1 });
BookingSchema.index({ customerId: 1, bookingStatus: 1, createdAt: -1 });
BookingSchema.index({ vehicleId: 1, bookingStatus: 1 });
BookingSchema.index({ vehicleId: 1, pickupDateTime: 1, bookingStatus: 1 });
BookingSchema.index({ bookingStatus: 1, createdAt: -1 });

BookingSchema.pre('save', function (next) {
  if (!this.bookingId) {
    const prefix = 'BK';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.bookingId = `${prefix}-${timestamp}-${random}`;
  }
  if (this.renterId && !this.customerId) this.customerId = this.renterId;
  if (this.customerId && !this.renterId) this.renterId = this.customerId;
  if (this.totalPrice && !this.estimatedFare) this.estimatedFare = this.totalPrice;
  if (this.estimatedFare && !this.totalPrice) this.totalPrice = this.estimatedFare;
  if (this.pickupLocation && !this.pickupAddress) this.pickupAddress = this.pickupLocation;
  if (this.pickupAddress && !this.pickupLocation) this.pickupLocation = this.pickupAddress;
  if (this.destination && !this.destinationAddress) this.destinationAddress = this.destination;
  if (this.destinationAddress && !this.destination) this.destination = this.destinationAddress;
  if (this.pickup && !this.pickupLocation) this.pickupLocation = this.pickup;
  if (this.pickupLocation && !this.pickup) this.pickup = this.pickupLocation;
  if (this.specialInstructions && !this.specialNote) this.specialNote = this.specialInstructions;
  if (this.specialNote && !this.specialInstructions) this.specialInstructions = this.specialNote;
  this.bookingUpdatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Booking', BookingSchema);

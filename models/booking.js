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
  bookingId: { type: String, unique: true }, // Optional external booking ID
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Listing' },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
  renterId: { type: Schema.Types.ObjectId, ref: 'User' },
  customerId: { type: Schema.Types.ObjectId, ref: 'User' }, // Alias for renterId
  
  // Trip Details (Step 1)
  pickup: { type: String },
  pickupLocation: { type: String },
  pickupCoordinates: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] } // [longitude, latitude]
  },
  destination: { type: String },
  destinationCoordinates: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] } // [longitude, latitude]
  },
  pickupDate: { type: Date },
  pickupTime: { type: String },
  returnDate: { type: Date }, // Optional for some trips
  returnTime: { type: String }, // Optional
  pickupDateTime: { type: Date }, 
  returnDateTime: { type: Date },
  
  tripType: { 
    type: String, 
    enum: ['local', 'outstation', 'airport-pickup', 'railway-pickup', 'wedding', 'family-function', 'temple-visit', 'tourism', 'corporate', 'other'] 
  },
  passengers: { type: Number, min: 1 },
  specialInstructions: { type: String },
  driverType: { type: String, enum: ['owner', 'dedicated-driver', ''] },

  // Distance & Price (Step 2)
  distanceKm: { type: Number },
  estimatedDuration: { type: String }, // e.g. "1h 30m"
  basePrice: { type: Number },
  pricePerKM: { type: Number },
  totalPrice: { type: Number, required: true }, // also estimatedFare
  estimatedFare: { type: Number },
  platformFee: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  totalDays: { type: Number, default: 1 },
  securityDeposit: { type: Number, default: 0 },
  
  // Payment Options
  paymentMethod: { type: String, enum: ['razorpay', 'cod', 'cash', 'upi', 'online'], default: 'cash' },
  
  // Statuses
  bookingStatus: {
    type: String,
    enum: ['PENDING', 'PENDING_OWNER_APPROVAL', 'COUNTER_OFFERED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REJECTED', 'EXPIRED'],
    default: 'PENDING_OWNER_APPROVAL'
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
    default: 'PENDING'
  },
  
  // Counter Offer
  counterOffer: {
    baseFare: { type: Number },
    totalFare: { type: Number },
    message: { type: String },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED', ''] }
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

// Create 2dsphere indexes for coordinates
BookingSchema.index({ pickupCoordinates: "2dsphere" });
BookingSchema.index({ destinationCoordinates: "2dsphere" });

// Pre-save middleware to generate bookingId if missing
BookingSchema.pre('save', function(next) {
  if (!this.bookingId) {
    this.bookingId = 'BK-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
  // Keep legacy fields in sync
  if (this.renterId && !this.customerId) this.customerId = this.renterId;
  if (this.customerId && !this.renterId) this.renterId = this.customerId;
  if (this.totalPrice && !this.estimatedFare) this.estimatedFare = this.totalPrice;
  if (this.estimatedFare && !this.totalPrice) this.totalPrice = this.estimatedFare;
  if (this.distanceKm) this.distance = this.distanceKm;
  
  this.bookingUpdatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Booking', BookingSchema);

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VehicleAvailabilitySchema = new Schema({
  vehicle: { 
    type: Schema.Types.ObjectId, 
    ref: 'Listing', 
    required: true 
  },
  booking: { 
    type: Schema.Types.ObjectId, 
    ref: 'Booking',
    required: true
  },
  startDate: { 
    type: Date, 
    required: true 
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  startTime: {
    type: String
  },
  endTime: {
    type: String
  },
  status: {
    type: String,
    enum: ['booked', 'blocked', 'available'],
    default: 'booked'
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Compound index for efficient availability checks
VehicleAvailabilitySchema.index({ vehicle: 1, startDate: 1, endDate: 1 });
VehicleAvailabilitySchema.index({ vehicle: 1, status: 1 });
VehicleAvailabilitySchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('VehicleAvailability', VehicleAvailabilitySchema);

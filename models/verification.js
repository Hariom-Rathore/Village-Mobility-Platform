const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VerificationSchema = new Schema({
  user: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  vehicle: { 
    type: Schema.Types.ObjectId, 
    ref: 'Listing',
    required: true
  },
  documentType: {
    type: String,
    enum: ['vehicleRC', 'insurance', 'pollutionCertificate', 'fitnessCertificate', 'ownerDrivingLicense', 'driverDrivingLicense', 'aadhaar', 'driverPhoto'],
    required: true
  },
  documentUrl: {
    type: String,
    required: true
  },
  documentFilename: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
VerificationSchema.index({ user: 1, status: 1 });
VerificationSchema.index({ vehicle: 1, status: 1 });
VerificationSchema.index({ documentType: 1, status: 1 });

module.exports = mongoose.model('Verification', VerificationSchema);

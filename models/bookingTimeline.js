const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BookingTimelineSchema = new Schema({
  booking: { 
    type: Schema.Types.ObjectId, 
    ref: 'Booking', 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['PENDING', 'PENDING_OWNER_APPROVAL', 'COUNTER_OFFERED', 'ACCEPTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REJECTED', 'EXPIRED'],
    required: true 
  },
  changedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  changedByRole: {
    type: String,
    enum: ['customer', 'owner', 'system'],
    required: true
  },
  notes: { 
    type: String 
  },
  metadata: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index for efficient queries
BookingTimelineSchema.index({ booking: 1, createdAt: -1 });
BookingTimelineSchema.index({ changedBy: 1, createdAt: -1 });

module.exports = mongoose.model('BookingTimeline', BookingTimelineSchema);

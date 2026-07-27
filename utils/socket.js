// Socket.IO helper functions for real-time notifications

/**
 * Emit notification to a specific user
 * @param {Object} io - Socket.IO instance
 * @param {String} userId - User ID to receive notification
 * @param {String} eventType - Type of event (e.g., 'new_notification', 'booking_update')
 * @param {Object} data - Notification data
 */
function emitToUser(io, userId, eventType, data) {
    if (!io || !userId) return;
    try {
        io.to(userId.toString()).emit(eventType, data);
    } catch (error) {
        console.error('Error emitting to user:', error);
    }
}

/**
 * Emit booking update to both customer and owner
 * @param {Object} io - Socket.IO instance
 * @param {String} customerId - Customer user ID
 * @param {String} ownerId - Owner user ID
 * @param {String} eventType - Type of booking event
 * @param {Object} data - Booking data
 */
function emitBookingUpdate(io, customerId, ownerId, eventType, data) {
    if (!io) return;
    
    // Emit to customer
    if (customerId) {
        emitToUser(io, customerId, eventType, { ...data, recipientType: 'customer' });
    }
    
    // Emit to owner
    if (ownerId && ownerId.toString() !== customerId?.toString()) {
        emitToUser(io, ownerId, eventType, { ...data, recipientType: 'owner' });
    }
}

/**
 * Emit notification to all connected users (for system-wide announcements)
 * @param {Object} io - Socket.IO instance
 * @param {String} eventType - Type of event
 * @param {Object} data - Event data
 */
function emitToAll(io, eventType, data) {
    if (!io) return;
    try {
        io.emit(eventType, data);
    } catch (error) {
        console.error('Error emitting to all:', error);
    }
}

module.exports = {
    emitToUser,
    emitBookingUpdate,
    emitToAll
};

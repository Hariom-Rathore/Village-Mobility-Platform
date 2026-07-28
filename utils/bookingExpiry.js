/**
 * Booking Expiry Job
 * Runs every 60 seconds and auto-expires PENDING bookings
 * whose expiresAt timestamp has passed.
 */

const Booking = require('../models/booking');
const BookingTimeline = require('../models/bookingTimeline');
const Notification = require('../models/notification');
const { emitToUser } = require('./socket');

const EXPIRY_INTERVAL_MS = 60 * 1000; // every 60 seconds

async function expireOverdueBookings(io) {
    try {
        const now = new Date();

        // Find all PENDING bookings where expiresAt has passed
        const overdueBookings = await Booking.find({
            bookingStatus: 'PENDING',
            expiresAt: { $lte: now }
        }).populate('vehicleId', 'title vehicleName').populate('customerId', 'username').populate('ownerId', 'username');

        if (overdueBookings.length === 0) return;

        for (const booking of overdueBookings) {
            try {
                // Update status to EXPIRED
                booking.bookingStatus = 'EXPIRED';
                booking.bookingUpdatedAt = now;
                await booking.save();

                // Add timeline entry
                const timeline = new BookingTimeline({
                    booking: booking._id,
                    status: 'EXPIRED',
                    changedBy: null,
                    changedByRole: 'system',
                    notes: 'Booking expired — owner did not respond in time',
                    metadata: { expiredAt: now }
                });
                await timeline.save();

                const vehicleName = booking.vehicleId?.title || booking.vehicleId?.vehicleName || 'Vehicle';
                const customerName = booking.customerId?.username || 'Customer';

                // Notify customer
                const customerMsg = `Your booking request for ${vehicleName} has expired. The owner did not respond in time. Please choose another nearby vehicle.`;
                const customerNotif = new Notification({
                    recipient: booking.customerId,
                    type: 'BOOKING_EXPIRED',
                    title: '⏰ Booking Request Expired',
                    message: customerMsg,
                    relatedBooking: booking._id,
                    relatedVehicle: booking.vehicleId?._id || booking.vehicleId,
                    isRead: false
                });
                await customerNotif.save();

                // Notify owner
                const ownerMsg = `Booking request from ${customerName} for ${vehicleName} has expired — you didn't respond in time. The slot is now available.`;
                const ownerNotif = new Notification({
                    recipient: booking.ownerId,
                    type: 'BOOKING_EXPIRED',
                    title: '⏰ Booking Request Expired',
                    message: ownerMsg,
                    relatedBooking: booking._id,
                    relatedVehicle: booking.vehicleId?._id || booking.vehicleId,
                    isRead: false
                });
                await ownerNotif.save();

                // Emit real-time events via Socket.IO
                if (io) {
                    // Notify customer
                    emitToUser(io, booking.customerId, 'booking:expired', {
                        bookingId: booking._id,
                        status: 'EXPIRED',
                        message: customerMsg
                    });
                    emitToUser(io, booking.customerId, 'notification:new', {
                        _id: customerNotif._id,
                        type: 'BOOKING_EXPIRED',
                        title: '⏰ Booking Request Expired',
                        message: customerMsg,
                        relatedBooking: booking._id,
                        createdAt: customerNotif.createdAt,
                        isRead: false
                    });

                    // Notify owner
                    emitToUser(io, booking.ownerId, 'booking:expired', {
                        bookingId: booking._id,
                        status: 'EXPIRED',
                        message: ownerMsg
                    });
                    emitToUser(io, booking.ownerId, 'notification:new', {
                        _id: ownerNotif._id,
                        type: 'BOOKING_EXPIRED',
                        title: '⏰ Booking Request Expired',
                        message: ownerMsg,
                        relatedBooking: booking._id,
                        createdAt: ownerNotif.createdAt,
                        isRead: false
                    });
                }

                console.log(`[BookingExpiry] Expired booking ${booking.bookingId} for vehicle ${vehicleName}`);
            } catch (err) {
                console.error(`[BookingExpiry] Error expiring booking ${booking._id}:`, err.message);
            }
        }

        if (overdueBookings.length > 0) {
            console.log(`[BookingExpiry] Expired ${overdueBookings.length} booking(s)`);
        }
    } catch (err) {
        console.error('[BookingExpiry] Job error:', err.message);
    }
}

/**
 * Start the background expiry job
 * @param {Object} io - Socket.IO server instance
 */
function startBookingExpiryJob(io) {
    console.log('[BookingExpiry] Background expiry job started (interval: 60s)');
    // Run immediately on start, then every interval
    expireOverdueBookings(io);
    setInterval(() => expireOverdueBookings(io), EXPIRY_INTERVAL_MS);
}

module.exports = { startBookingExpiryJob, expireOverdueBookings };

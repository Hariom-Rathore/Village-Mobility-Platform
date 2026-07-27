const Razorpay = require('razorpay');
const crypto = require('crypto');
const Listing = require('../models/listing');
const Booking = require('../models/booking');
const BookingTimeline = require('../models/bookingTimeline');
const Notification = require('../models/notification');
const VehicleAvailability = require('../models/vehicleAvailability');
const bookingService = require('../services/bookingService');
const notificationService = require('../services/notificationService');
const { emitBookingUpdate, emitToUser } = require('../utils/socket');

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const MAX_BOOKING_AMOUNT_INR = Number(process.env.MAX_BOOKING_AMOUNT_INR || 500000);

function normalizeWhatsAppNumber(value = '') {
    return String(value).replace(/\D/g, '');
}

function safeValue(value, fallback = 'N/A') {
    if (value === undefined || value === null) return fallback;
    const text = String(value).trim();
    return text || fallback;
}

function getRazorpayInstance() {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) return null;
    return new Razorpay({ key_id, key_secret });
}

async function sendWhatsAppTextMessage(phoneNumber, message) {
    const normalized = normalizeWhatsAppNumber(phoneNumber);
    if (!normalized) return { sent: false, reason: 'missing-recipient-number' };
    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) return { sent: false, reason: 'whatsapp-api-not-configured' };
    try {
        const response = await fetch(`https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: normalized, type: 'text', text: { body: message } }),
        });
        if (!response.ok) return { sent: false, reason: `whatsapp-api-error-${response.status}`, details: await response.text() };
        return { sent: true };
    } catch { return { sent: false, reason: 'whatsapp-request-failed' }; }
}

// -----------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------
async function createBookingTimeline(bookingId, status, userId, role, notes = '', metadata = {}) {
    try {
        const timeline = new BookingTimeline({ booking: bookingId, status, changedBy: userId, changedByRole: role, notes, metadata });
        await timeline.save();
        return timeline;
    } catch (error) { console.error('Error creating booking timeline:', error); }
}

async function createNotification(recipientId, type, title, message, relatedBooking = null, relatedVehicle = null, data = null) {
    try {
        const notification = new Notification({ recipient: recipientId, type, title, message, relatedBooking, relatedVehicle, data });
        await notification.save();
        return notification;
    } catch (error) { console.error('Error creating notification:', error); }
}

async function checkVehicleAvailability(vehicleId, startDate, endDate) {
    try {
        const bookingIds = (await Booking.find({
            vehicleId, bookingStatus: { $in: ['ACCEPTED', 'COUNTER_OFFER_ACCEPTED', 'TRIP_STARTED'] },
            pickupDateTime: { $lte: endDate },
            $or: [{ returnDate: { $gte: startDate } }, { pickupDateTime: { $gte: startDate } }]
        }, { _id: 1 })).map(b => b._id);

        const availRecords = await VehicleAvailability.find({
            vehicle: vehicleId, status: 'booked',
            $or: [
                { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
                { startDate: { $gte: startDate, $lte: endDate } },
                { endDate: { $gte: startDate, $lte: endDate } }
            ]
        });
        return bookingIds.length === 0 && availRecords.length === 0;
    } catch (error) { console.error('Error checking vehicle availability:', error); return false; }
}

async function removeVehicleAvailability(bookingId) {
    try { await VehicleAvailability.deleteOne({ booking: bookingId }); } catch (error) { console.error('Error removing vehicle availability:', error); }
}

async function blockVehicleAvailability(vehicleId, bookingId, startDate, endDate) {
    try {
        await VehicleAvailability.findOneAndUpdate(
            { vehicle: vehicleId, booking: bookingId },
            { vehicle: vehicleId, booking: bookingId, startDate, endDate, status: 'booked' },
            { upsert: true, new: true }
        );
    } catch (error) { console.error('Error blocking vehicle availability:', error); }
}

// -----------------------------------------------------------------------
// Legacy: Render booking page
// -----------------------------------------------------------------------
module.exports.renderBooking = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) return res.redirect(`/cars/${id}`);

    const searchParams = {
        pickup: req.query.pickup || '', destination: req.query.destination || '',
        pickupLat: req.query.pickupLat || '', pickupLng: req.query.pickupLng || '',
        destLat: req.query.destLat || '', destLng: req.query.destLng || '',
        distance: req.query.distance || '', fare: req.query.fare || '',
        date: req.query.date || '', time: req.query.time || '', passengers: req.query.passengers || ''
    };

    res.render('listings/book.ejs', {
        listing, razorpayKey: process.env.RAZORPAY_KEY_ID || '',
        orsKey: process.env.ORS_API_KEY || '', ownerWhatsappNumber: listing.whatsappNumber || '', searchParams
    });
};

// -----------------------------------------------------------------------
// Legacy: Create Razorpay order
// -----------------------------------------------------------------------
module.exports.createOrder = async (req, res) => {
    try {
        const rp = getRazorpayInstance();
        if (!rp) return res.status(500).json({ success: false, error: 'Razorpay API keys not configured on server' });
        const { amount } = req.body;
        const payAmount = Math.max(1, Math.round(Number(amount) || 0));
        if (payAmount > MAX_BOOKING_AMOUNT_INR) return res.status(400).json({ success: false, error: `Booking amount is too high. Please keep total up to Rs ${MAX_BOOKING_AMOUNT_INR.toLocaleString('en-IN')}.` });
        const order = await rp.orders.create({ amount: payAmount * 100, currency: 'INR', receipt: `rcpt_${Date.now()}` });
        return res.json({ success: true, order });
    } catch (e) { console.error('Razorpay create order error', e); return res.status(500).json({ success: false, error: 'Unable to create order' }); }
};

// -----------------------------------------------------------------------
// Legacy: Confirm payment (Razorpay & COD)
// -----------------------------------------------------------------------
module.exports.confirmPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, pickup, destination, purpose, distanceKm, amount, paymentMethod, pickupDate, returnDate, pickupTime, returnTime } = req.body;

        const listing = await Listing.findById(id);
        if (!listing) return res.status(404).json({ success: false, error: 'Listing not found' });

        let totalDays = 1;
        if (pickupDate && returnDate) {
            const p = new Date(pickupDate), r = new Date(returnDate);
            totalDays = Math.ceil((r - p) / (1000 * 60 * 60 * 24)) || 1;
        }

        const priceCalculation = bookingService.calculatePrice(listing, totalDays, Number(distanceKm) || 0);
        const validation = await bookingService.validateBooking({
            vehicleId: id, pickupDate: pickupDate ? new Date(pickupDate) : null, returnDate: returnDate ? new Date(returnDate) : null,
            pickupTime, returnTime, userId: req.user._id, amount: priceCalculation.totalPrice
        });
        if (!validation.valid) return res.status(400).json({ success: false, error: validation.error });

        let pickupDateTime = null, returnDateTime = null;
        if (pickupDate) {
            pickupDateTime = new Date(pickupDate);
            if (pickupTime) { const [h, m] = pickupTime.split(':'); pickupDateTime.setHours(parseInt(h), parseInt(m), 0, 0); }
        }
        if (returnDate) {
            returnDateTime = new Date(returnDate);
            if (returnTime) { const [h, m] = returnTime.split(':'); returnDateTime.setHours(parseInt(h), parseInt(m), 0, 0); }
        }

        const ownerWhatsAppNumber = normalizeWhatsAppNumber(listing.whatsappNumber || '');
        const bookingData = {
            user: req.user._id, listing: id, vehicleId: id, ownerId: listing.owner, renterId: req.user._id, customerId: req.user._id,
            pickup: pickup || '', destination: destination || '', purpose: purpose || '', distanceKm: Number(distanceKm) || 0,
            amountPaid: priceCalculation.totalPrice, totalPrice: priceCalculation.totalPrice, estimatedFare: priceCalculation.totalPrice,
            basePrice: priceCalculation.basePrice, platformFee: priceCalculation.platformFee, tax: priceCalculation.tax, totalDays,
            pickupDate: pickupDate ? new Date(pickupDate) : null, returnDate: returnDate ? new Date(returnDate) : null,
            pickupTime: pickupTime || '', returnTime: returnTime || '', pickupDateTime, returnDateTime,
            ownerWhatsappNumber
        };

        if (paymentMethod === 'cod') {
            const booking = new Booking({ ...bookingData, paymentMethod: 'cod', paymentStatus: 'PENDING', bookingStatus: 'ACCEPTED' });
            await booking.save();
            await bookingService.updateVehicleStats(id, priceCalculation.totalPrice);
            await blockVehicleAvailability(id, booking._id, pickupDateTime || new Date(), returnDateTime || pickupDateTime || new Date());
            await notificationService.notifyBookingConfirmed(booking._id);
            const whatsappDelivery = await sendWhatsAppTextMessage(ownerWhatsAppNumber, `New COD booking confirmed for ${listing.title}. Booking ID: ${booking._id}`);
            return res.json({ success: true, bookingId: booking._id, whatsappSent: whatsappDelivery.sent, paymentMethod: 'cod', priceBreakdown: priceCalculation.breakdown });
        }

        const key_secret = process.env.RAZORPAY_KEY_SECRET;
        if (!key_secret) return res.status(500).json({ success: false, error: 'Razorpay secret not configured' });
        const generated_signature = crypto.createHmac('sha256', key_secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
        if (generated_signature !== razorpay_signature) return res.status(400).json({ success: false, error: 'Invalid signature' });

        const booking = new Booking({
            ...bookingData, paymentMethod: 'razorpay', paymentStatus: 'PAID', bookingStatus: 'ACCEPTED',
            razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature
        });
        await booking.save();
        await bookingService.updateVehicleStats(id, priceCalculation.totalPrice);
        await blockVehicleAvailability(id, booking._id, pickupDateTime || new Date(), returnDateTime || pickupDateTime || new Date());
        await notificationService.notifyBookingConfirmed(booking._id);
        await notificationService.notifyPaymentReceived(booking._id);
        const whatsappDelivery = await sendWhatsAppTextMessage(ownerWhatsAppNumber, `New booking confirmed for ${listing.title}. Booking ID: ${booking._id}, Amount: ₹${priceCalculation.totalPrice}`);
        return res.json({ success: true, bookingId: booking._id, whatsappSent: whatsappDelivery.sent, paymentMethod: 'razorpay', priceBreakdown: priceCalculation.breakdown });
    } catch (e) { console.error('Payment confirmation error', e); return res.status(500).json({ success: false, error: 'Unable to confirm payment' }); }
};

// -----------------------------------------------------------------------
// PRODUCTION BOOKING FLOW
// -----------------------------------------------------------------------

// 1. Customer creates a booking request
module.exports.createBookingRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { booking } = req.body;

        const listing = await Listing.findById(id);
        if (!listing) return res.status(404).json({ success: false, error: 'Vehicle not found' });
        if (!listing.owner || listing.owner.equals(req.user._id)) return res.status(400).json({ success: false, error: 'Cannot book your own vehicle' });

        let totalDays = Number(booking.tripDays) || 1;
        if (booking.pickupDate && booking.returnDate) {
            const p = new Date(booking.pickupDate), r = new Date(booking.returnDate);
            totalDays = Math.max(1, Math.ceil((r - p) / (1000 * 60 * 60 * 24)));
        }

        let pickupDateTime = new Date(booking.pickupDate || booking.travelDate);
        if (booking.pickupTime) {
            const [h, m] = booking.pickupTime.split(':');
            pickupDateTime.setHours(parseInt(h), parseInt(m), 0, 0);
        }

        const endDate = booking.returnDate ? new Date(booking.returnDate) : pickupDateTime;
        const isAvailable = await checkVehicleAvailability(id, pickupDateTime, endDate);
        if (!isAvailable) return res.status(400).json({ success: false, error: 'Vehicle is not available for the selected date and time' });

        const distanceKm = Number(booking.distanceKm || booking.estimatedDistance || 0);
        const ratePerKm = Number(listing.pricePerKm || listing.ratePerKm || 0);
        const baseDaily = Number(listing.baseFare || listing.price || 0);
        const nightCharge = Number(listing.nightCharge || 0);
        const distanceCharge = distanceKm * ratePerKm;
        const timeCharge = baseDaily * totalDays;
        const nightStayCharge = (booking.nightStay === 'yes' && nightCharge > 0) ? nightCharge * Math.max(0, totalDays - 1) : 0;
        const basePrice = Math.ceil(timeCharge + distanceCharge + nightStayCharge);
        const platformFee = Math.max(50, Math.ceil(basePrice * 0.05));
        const tax = Math.ceil((basePrice + platformFee) * 0.18);
        const estimatedFare = basePrice + platformFee + tax;

        const ownerWhatsAppNumber = normalizeWhatsAppNumber(listing.whatsappNumber || '');

        const newBooking = new Booking({
            user: req.user._id, listing: id, vehicleId: id, ownerId: listing.owner,
            renterId: req.user._id, customerId: req.user._id,
            pickup: booking.pickupLocation || booking.pickupAddress,
            pickupLocation: booking.pickupLocation || booking.pickupAddress,
            pickupAddress: booking.pickupAddress || booking.pickupLocation,
            pickupCoordinates: booking.pickupCoordinates ? { type: 'Point', coordinates: booking.pickupCoordinates } : (booking.pickupLat && booking.pickupLng ? { type: 'Point', coordinates: [parseFloat(booking.pickupLng), parseFloat(booking.pickupLat)] } : undefined),
            destination: booking.destination || booking.destinationAddress,
            destinationAddress: booking.destinationAddress || booking.destination,
            destinationCoordinates: booking.destinationCoordinates ? { type: 'Point', coordinates: booking.destinationCoordinates } : (booking.destLat && booking.destLng ? { type: 'Point', coordinates: [parseFloat(booking.destLng), parseFloat(booking.destLat)] } : undefined),
            pickupDate: new Date(booking.pickupDate || booking.travelDate),
            pickupTime: booking.pickupTime, pickupDateTime,
            tripType: booking.tripType,
            passengers: booking.passengers || booking.passengerCount,
            specialInstructions: booking.specialInstructions || booking.specialNote || '',
            specialNote: booking.specialNote || booking.specialInstructions || '',
            driverType: booking.driverType || 'dedicated-driver',
            distanceKm, estimatedDuration: booking.estimatedDuration || '',
            basePrice, pricePerKM: ratePerKm, totalPrice: estimatedFare, estimatedFare,
            platformFee, tax, totalDays, tripDays: totalDays,
            nightStay: booking.nightStay === 'yes', nightStayCharge,
            paymentMethod: booking.paymentMethod || 'cash', bookingStatus: 'PENDING', paymentStatus: 'PENDING',
            ownerWhatsappNumber
        });

        await newBooking.save();

        await createBookingTimeline(newBooking._id, 'PENDING', req.user._id, 'customer', 'Booking request submitted');

        const io = req.app.get('io');

        // Use notification service for proper notification
        await notificationService.notifyNewBookingRequest(newBooking._id, io);

        // Emit real-time booking event
        if (io) {
            emitBookingUpdate(io, req.user._id, listing.owner, 'booking:new', {
                bookingId: newBooking._id, status: 'PENDING',
                customerId: req.user._id, ownerId: listing.owner,
                vehicleName: listing.title || listing.vehicleName,
                pickup: newBooking.pickupLocation, destination: newBooking.destination,
                pickupDate: newBooking.pickupDate, pickupTime: newBooking.pickupTime,
                passengers: newBooking.passengers, estimatedFare: newBooking.estimatedFare
            });
        }

        return res.json({ success: true, bookingId: newBooking._id, message: 'Booking request sent successfully! The owner will review your request.' });
    } catch (e) { console.error('Create booking request error', e); return res.status(500).json({ success: false, error: 'Unable to create booking request' }); }
};

// 2. Owner accepts booking
module.exports.acceptBooking = async (req, res) => {
    try {
        const booking = req.booking || await Booking.findById(req.params.bookingId);
        if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
        if (booking.bookingStatus !== 'PENDING') return res.status(400).json({ success: false, error: 'Booking is not in PENDING status' });

        const previousStatus = booking.bookingStatus;
        booking.bookingStatus = 'ACCEPTED';
        booking.bookingUpdatedAt = Date.now();

        const listing = await Listing.findById(booking.vehicleId);
        if (listing) {
            booking.acceptedInfo = {
                driverName: listing.driverName || '',
                driverPhone: listing.driverPhoneNumber || '',
                vehicleNumber: listing.vehicleNumber || '',
                ownerName: listing.owner?.username || req.user?.username || ''
            };
        }
        await booking.save();

        // Block vehicle availability
        if (booking.pickupDateTime) {
            const endDate = booking.returnDate || booking.pickupDate || booking.pickupDateTime;
            await blockVehicleAvailability(booking.vehicleId, booking._id, booking.pickupDateTime, new Date(endDate));
        }

        await createBookingTimeline(booking._id, 'ACCEPTED', req.user._id, 'owner', 'Booking request accepted');

        const io = req.app.get('io');
        await notificationService.notifyBookingAccepted(booking._id, io);

        if (io) {
            emitBookingUpdate(io, booking.customerId, booking.ownerId, 'booking:accepted', {
                bookingId: booking._id, status: 'ACCEPTED',
                customerId: booking.customerId, ownerId: booking.ownerId,
                acceptedInfo: booking.acceptedInfo
            });
        }

        return res.json({ success: true, message: 'Booking accepted successfully', booking });
    } catch (e) { console.error('Accept booking error', e); return res.status(500).json({ success: false, error: 'Failed to accept booking' }); }
};

// 3. Owner rejects booking
module.exports.rejectBooking = async (req, res) => {
    try {
        const booking = req.booking || await Booking.findById(req.params.bookingId);
        if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
        if (booking.bookingStatus !== 'PENDING') return res.status(400).json({ success: false, error: 'Booking is not in PENDING status' });

        const { reason, customReason } = req.body;
        booking.bookingStatus = 'REJECTED';
        booking.rejectionReason = reason || '';
        booking.rejectionReasonCustom = customReason || '';
        booking.bookingUpdatedAt = Date.now();
        await booking.save();

        await createBookingTimeline(booking._id, 'REJECTED', req.user._id, 'owner', reason || 'Booking rejected', { customReason });

        const io = req.app.get('io');
        await notificationService.notifyBookingRejected(booking._id, reason, io);

        if (io) {
            emitBookingUpdate(io, booking.customerId, booking.ownerId, 'booking:rejected', {
                bookingId: booking._id, status: 'REJECTED', reason
            });
        }

        return res.json({ success: true, message: 'Booking rejected successfully' });
    } catch (e) { console.error('Reject booking error', e); return res.status(500).json({ success: false, error: 'Failed to reject booking' }); }
};

// 4. Owner sends counter offer
module.exports.sendCounterOffer = async (req, res) => {
    try {
        const booking = req.booking || await Booking.findById(req.params.bookingId);
        if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
        if (booking.bookingStatus !== 'PENDING') return res.status(400).json({ success: false, error: 'Booking is not in PENDING status' });

        const { finalFare, message } = req.body;
        const originalFare = booking.estimatedFare || 0;

        if (Number(finalFare) <= 0) return res.status(400).json({ success: false, error: 'Fare must be greater than 0' });

        booking.bookingStatus = 'COUNTER_OFFER_SENT';
        booking.counterOffer = { finalFare: Number(finalFare), originalFare, message: message || '', status: 'PENDING' };
        booking.bookingUpdatedAt = Date.now();
        await booking.save();

        await createBookingTimeline(booking._id, 'COUNTER_OFFER_SENT', req.user._id, 'owner', message || 'Counter offer sent', { originalFare, newFare: finalFare });

        const io = req.app.get('io');
        await notificationService.notifyCounterOfferSent(booking._id, io);

        if (io) {
            emitBookingUpdate(io, booking.customerId, booking.ownerId, 'booking:counterOffer', {
                bookingId: booking._id, status: 'COUNTER_OFFER_SENT',
                counterOffer: { finalFare: Number(finalFare), originalFare, message: message || '' }
            });
        }

        return res.json({ success: true, message: 'Counter offer sent to customer', counterOffer: { finalFare: Number(finalFare), originalFare, message: message || '' } });
    } catch (e) { console.error('Counter offer error', e); return res.status(500).json({ success: false, error: 'Failed to send counter offer' }); }
};

// 5. Customer responds to counter offer
module.exports.respondToCounterOffer = async (req, res) => {
    try {
        const booking = req.booking || await Booking.findById(req.params.bookingId);
        if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
        if (booking.bookingStatus !== 'COUNTER_OFFER_SENT') return res.status(400).json({ success: false, error: 'No pending counter offer' });
        if (booking.counterOffer.status !== 'PENDING') return res.status(400).json({ success: false, error: 'Counter offer has already been responded to' });

        const { action } = req.body;
        if (!['accept', 'reject'].includes(action)) return res.status(400).json({ success: false, error: 'Invalid action. Use "accept" or "reject"' });

        const io = req.app.get('io');

        if (action === 'accept') {
            booking.counterOffer.status = 'ACCEPTED';
            booking.bookingStatus = 'COUNTER_OFFER_ACCEPTED';
            booking.estimatedFare = booking.counterOffer.finalFare;
            booking.totalPrice = booking.counterOffer.finalFare;
            booking.bookingUpdatedAt = Date.now();
            await booking.save();

            if (booking.pickupDateTime) {
                const endDate = booking.returnDate || booking.pickupDate || booking.pickupDateTime;
                await blockVehicleAvailability(booking.vehicleId, booking._id, booking.pickupDateTime, new Date(endDate));
            }

            await createBookingTimeline(booking._id, 'COUNTER_OFFER_ACCEPTED', req.user._id, 'customer', 'Customer accepted counter offer', { newFare: booking.counterOffer.finalFare });
            await notificationService.notifyCounterOfferAccepted(booking._id, io);

            if (io) {
                emitBookingUpdate(io, booking.customerId, booking.ownerId, 'booking:accepted', {
                    bookingId: booking._id, status: 'COUNTER_OFFER_ACCEPTED', counterOffer: booking.counterOffer
                });
            }

            return res.json({ success: true, message: `Counter offer accepted! Trip confirmed at ₹${booking.counterOffer.finalFare}.`, booking });
        } else {
            booking.counterOffer.status = 'REJECTED';
            booking.bookingStatus = 'REJECTED';
            booking.rejectionReason = 'Customer rejected counter offer';
            booking.bookingUpdatedAt = Date.now();
            await booking.save();

            await createBookingTimeline(booking._id, 'REJECTED', req.user._id, 'customer', 'Customer rejected counter offer');
            await notificationService.notifyBookingRejected(booking._id, 'Customer rejected counter offer', io);

            if (io) {
                emitBookingUpdate(io, booking.customerId, booking.ownerId, 'booking:rejected', {
                    bookingId: booking._id, status: 'REJECTED', reason: 'Customer rejected counter offer'
                });
            }

            return res.json({ success: true, message: 'Counter offer rejected. Booking has been cancelled.' });
        }
    } catch (e) { console.error('Respond to counter offer error', e); return res.status(500).json({ success: false, error: 'Failed to respond to counter offer' }); }
};

// 6. Cancel booking
module.exports.cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId);
        if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

        const isCustomer = booking.customerId && booking.customerId.equals(req.user._id);
        const isOwner = booking.ownerId && booking.ownerId.equals(req.user._id);
        if (!isCustomer && !isOwner) return res.status(403).json({ success: false, error: 'Not authorized to cancel this booking' });

        if (['CANCELLED', 'TRIP_COMPLETED'].includes(booking.bookingStatus)) return res.status(400).json({ success: false, error: 'Cannot cancel this booking' });

        const { reason } = req.body;
        booking.bookingStatus = 'CANCELLED';
        booking.cancellationReason = reason || '';
        booking.cancelledBy = req.user._id;
        booking.bookingUpdatedAt = new Date();
        await booking.save();

        await removeVehicleAvailability(booking._id);

        const role = isCustomer ? 'customer' : 'owner';
        await createBookingTimeline(booking._id, 'CANCELLED', req.user._id, role, reason || 'Booking cancelled');

        const recipientId = isCustomer ? booking.ownerId : booking.customerId;
        const io = req.app.get('io');
        await notificationService.notifyBookingCancelled(booking._id, role, io);

        if (io) {
            emitToUser(io, recipientId, 'booking:cancelled', { bookingId: booking._id, status: 'CANCELLED', cancelledBy: role });
        }

        return res.json({ success: true, message: 'Booking cancelled successfully' });
    } catch (e) { console.error('Cancel booking error', e); return res.status(500).json({ success: false, error: 'Unable to cancel booking' }); }
};

// 7. Start trip
module.exports.startTrip = async (req, res) => {
    try {
        const booking = req.booking || await Booking.findById(req.params.bookingId);
        if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
        if (!['ACCEPTED', 'COUNTER_OFFER_ACCEPTED'].includes(booking.bookingStatus)) return res.status(400).json({ success: false, error: 'Booking must be accepted first' });

        booking.bookingStatus = 'TRIP_STARTED';
        booking.bookingUpdatedAt = Date.now();
        await booking.save();

        await createBookingTimeline(booking._id, 'TRIP_STARTED', req.user._id, 'owner', 'Trip started');

        const io = req.app.get('io');
        if (io) {
            emitBookingUpdate(io, booking.customerId, booking.ownerId, 'booking:tripStarted', { bookingId: booking._id, status: 'TRIP_STARTED' });
            emitToUser(io, booking.customerId, 'notification:new', { type: 'TRIP_STARTED', title: 'Trip Started', message: 'Your trip has started!', relatedBooking: booking._id });
        }

        return res.json({ success: true, message: 'Trip started successfully' });
    } catch (e) { console.error('Start trip error', e); return res.status(500).json({ success: false, error: 'Failed to start trip' }); }
};

// 8. Complete trip
module.exports.completeTrip = async (req, res) => {
    try {
        const booking = req.booking || await Booking.findById(req.params.bookingId);
        if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
        if (booking.bookingStatus !== 'TRIP_STARTED') return res.status(400).json({ success: false, error: 'Trip must be started before completing' });

        booking.bookingStatus = 'TRIP_COMPLETED';
        booking.bookingCompletedAt = new Date();
        booking.bookingUpdatedAt = new Date();
        await booking.save();

        await removeVehicleAvailability(booking._id);

        await createBookingTimeline(booking._id, 'TRIP_COMPLETED', req.user._id, 'owner', 'Trip completed');

        const io = req.app.get('io');
        await notificationService.notifyTripCompleted(booking._id, io);

        if (io) {
            emitBookingUpdate(io, booking.customerId, booking.ownerId, 'booking:completed', { bookingId: booking._id, status: 'TRIP_COMPLETED' });
        }

        return res.json({ success: true, message: 'Trip completed successfully' });
    } catch (e) { console.error('Complete trip error', e); return res.status(500).json({ success: false, error: 'Failed to complete trip' }); }
};

// -----------------------------------------------------------------------
// GET APIs
// -----------------------------------------------------------------------

// Get user (customer) bookings
module.exports.getUserBookings = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = { customerId: req.user._id };
        if (status) {
            const statuses = status.split(',').map(s => s.trim().toUpperCase());
            filter.bookingStatus = statuses.length === 1 ? statuses[0] : { $in: statuses };
        }
        const bookings = await Booking.find(filter)
            .populate({ path: 'vehicleId', select: 'title vehicleName images image brand model vehicleNumber' })
            .populate({ path: 'ownerId', select: 'username email phoneNumber averageRating profilePhoto' })
            .sort({ bookingCreatedAt: -1 });
        return res.json({ success: true, bookings });
    } catch (e) { console.error('Get user bookings error', e); return res.status(500).json({ success: false, error: 'Unable to fetch bookings' }); }
};

// Get owner bookings
module.exports.getOwnerBookings = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = { ownerId: req.user._id };
        if (status) {
            const statuses = status.split(',').map(s => s.trim().toUpperCase());
            filter.bookingStatus = statuses.length === 1 ? statuses[0] : { $in: statuses };
        }
        const bookings = await Booking.find(filter)
            .populate({ path: 'vehicleId', select: 'title vehicleName images image brand model vehicleNumber driverName driverPhoneNumber' })
            .populate({ path: 'customerId', select: 'username email phoneNumber averageRating profilePhoto' })
            .sort({ bookingCreatedAt: -1 });
        return res.json({ success: true, bookings });
    } catch (e) { console.error('Get owner bookings error', e); return res.status(500).json({ success: false, error: 'Unable to fetch bookings' }); }
};

// Get booking timeline
module.exports.getBookingTimeline = async (req, res) => {
    try {
        const timeline = await BookingTimeline.find({ booking: req.params.bookingId })
            .populate({ path: 'changedBy', select: 'username role' })
            .sort({ createdAt: 1 });
        return res.json({ success: true, timeline });
    } catch (e) { console.error('Get timeline error', e); return res.status(500).json({ success: false, error: 'Unable to fetch timeline' }); }
};

// Get single booking details
module.exports.getBookingDetails = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId)
            .populate({ path: 'vehicleId', select: 'title vehicleName images image brand model year vehicleNumber driverName driverPhoneNumber ratePerKm pricePerKm baseFare price' })
            .populate({ path: 'ownerId', select: 'username email phoneNumber averageRating totalReviews profilePhoto' })
            .populate({ path: 'customerId', select: 'username email phoneNumber averageRating profilePhoto' });
        if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

        const isCustomer = booking.customerId && booking.customerId._id.toString() === req.user._id.toString();
        const isOwner = booking.ownerId && booking.ownerId._id.toString() === req.user._id.toString();
        if (!isCustomer && !isOwner) return res.status(403).json({ success: false, error: 'Not authorized' });

        return res.json({ success: true, booking });
    } catch (e) { console.error('Get booking details error', e); return res.status(500).json({ success: false, error: 'Unable to fetch booking details' }); }
};

// -----------------------------------------------------------------------
// Availability APIs
// -----------------------------------------------------------------------
module.exports.checkAvailability = async (req, res) => {
    try {
        const { id } = req.params;
        const { pickupDate, returnDate } = req.query;
        const listing = await Listing.findById(id);
        if (!listing) return res.status(404).json({ success: false, error: 'Vehicle not found' });
        if (!pickupDate || !returnDate) return res.json({ success: true, available: true, message: 'Dates not provided' });
        const isAvailable = await bookingService.checkAvailability(id, new Date(pickupDate), new Date(returnDate));
        return res.json({ success: true, available: isAvailable, vehicle: { id: listing._id, title: listing.title, availabilityStatus: listing.availabilityStatus, nextAvailableAt: listing.nextAvailableAt, maintenanceMode: listing.maintenanceMode } });
    } catch (e) { console.error('Availability check error', e); return res.status(500).json({ success: false, error: 'Unable to check availability' }); }
};

module.exports.getCalendar = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;
        const listing = await Listing.findById(id);
        if (!listing) return res.status(404).json({ success: false, error: 'Vehicle not found' });
        const start = startDate ? new Date(startDate) : new Date();
        const end = endDate ? new Date(endDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        const calendar = await bookingService.getAvailabilityCalendar(id, start, end);
        return res.json({ success: true, calendar, vehicle: { id: listing._id, title: listing.title, availabilityStatus: listing.availabilityStatus, nextAvailableAt: listing.nextAvailableAt } });
    } catch (e) { console.error('Calendar fetch error', e); return res.status(500).json({ success: false, error: 'Unable to fetch calendar' }); }
};

// -----------------------------------------------------------------------
// Dashboard data
// -----------------------------------------------------------------------
module.exports.getOwnerDashboardData = async (req, res) => {
    try {
        const ownerId = req.user._id;
        const [pendingBookings, acceptedBookings, totalBookings, recentBookings] = await Promise.all([
            Booking.countDocuments({ ownerId, bookingStatus: 'PENDING' }),
            Booking.countDocuments({ ownerId, bookingStatus: { $in: ['ACCEPTED', 'COUNTER_OFFER_ACCEPTED', 'TRIP_STARTED'] } }),
            Booking.countDocuments({ ownerId }),
            Booking.find({ ownerId }).sort({ bookingCreatedAt: -1 }).limit(5).populate('customerId', 'username').populate('vehicleId', 'title vehicleName')
        ]);
        return res.json({ success: true, stats: { pendingBookings, acceptedBookings, totalBookings }, recentBookings });
    } catch (e) { console.error('Dashboard data error', e); return res.status(500).json({ success: false, error: 'Unable to fetch dashboard data' }); }
};

module.exports.getCustomerDashboardData = async (req, res) => {
    try {
        const customerId = req.user._id;
        const [upcomingTrips, completedTrips, totalTrips, recentTrips] = await Promise.all([
            Booking.countDocuments({ customerId, bookingStatus: { $in: ['PENDING', 'ACCEPTED', 'COUNTER_OFFER_SENT', 'COUNTER_OFFER_ACCEPTED', 'TRIP_STARTED'] } }),
            Booking.countDocuments({ customerId, bookingStatus: 'TRIP_COMPLETED' }),
            Booking.countDocuments({ customerId }),
            Booking.find({ customerId }).sort({ bookingCreatedAt: -1 }).limit(5).populate('vehicleId', 'title vehicleName images image')
        ]);
        return res.json({ success: true, stats: { upcomingTrips, completedTrips, totalTrips }, recentTrips });
    } catch (e) { console.error('Customer dashboard error', e); return res.status(500).json({ success: false, error: 'Unable to fetch dashboard data' }); }
};

module.exports.getOwnerPendingBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({
            ownerId: req.user._id,
            bookingStatus: { $in: ['PENDING', 'COUNTER_OFFER_SENT'] }
        })
            .populate({ path: 'vehicleId', select: 'title vehicleName images image brand model' })
            .populate({ path: 'renterId', select: 'username email phoneNumber averageRating' })
            .sort({ bookingCreatedAt: -1 });
        return res.json({ success: true, bookings });
    } catch (e) { console.error('Get owner pending bookings error', e); return res.status(500).json({ success: false, error: 'Unable to fetch pending bookings' }); }
};

module.exports.getBookingDetail = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId)
            .populate({ path: 'vehicleId', select: 'title vehicleName images image brand model year vehicleNumber driverName driverPhoneNumber ratePerKm pricePerKm baseFare price' })
            .populate({ path: 'ownerId', select: 'username email phoneNumber averageRating totalReviews profilePhoto' })
            .populate({ path: 'renterId', select: 'username email phoneNumber averageRating profilePhoto' })
            .populate({ path: 'customerId', select: 'username email phoneNumber averageRating profilePhoto' });
        if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

        const timeline = await BookingTimeline.find({ booking: req.params.bookingId }).sort({ createdAt: -1 });

        return res.json({ success: true, booking, timeline });
    } catch (e) { console.error('Get booking detail error', e); return res.status(500).json({ success: false, error: 'Unable to fetch booking detail' }); }
};

module.exports.completeBooking = module.exports.completeTrip;

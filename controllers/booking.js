const Razorpay = require('razorpay');
const crypto = require('crypto');
const Listing = require('../models/listing');
const Booking = require('../models/booking');
const bookingService = require('../services/bookingService');
const notificationService = require('../services/notificationService');

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

function buildWhatsAppMessage({ listing, booking, user }) {
    const customerName = user?.username || user?.email || 'Guest';
    const customerEmail = user?.email || 'N/A';
    const customerPhone = user?.phone || user?.mobile || user?.phoneNumber || 'N/A';
    return [
        'New car booking confirmed',
        `Car: ${listing.title}`,
        `Booking ID: ${booking._id}`,
        '',
        'Customer Details:',
        `Name: ${safeValue(customerName)}`,
        `Email: ${safeValue(customerEmail)}`,
        `Phone: ${safeValue(customerPhone)}`,
        `User ID: ${safeValue(user?._id)}`,
        '',
        'Trip Details:',
        `Pickup: ${safeValue(booking.pickup)}`,
        `Destination: ${safeValue(booking.destination)}`,
        `Purpose: ${safeValue(booking.purpose)}`,
        `Distance: ${booking.distanceKm || 0} km`,
        `Amount Paid: ₹${booking.amountPaid || 0}`,
        `Razorpay Payment ID: ${booking.razorpayPaymentId}`,
    ].join('\n');
}

function buildWhatsAppUrl(phoneNumber, message) {
    const normalized = normalizeWhatsAppNumber(phoneNumber);
    if (!normalized) return '';
    return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function getRazorpayInstance() {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) return null;
    return new Razorpay({ key_id, key_secret });
}

async function sendWhatsAppTextMessage(phoneNumber, message) {
    const normalized = normalizeWhatsAppNumber(phoneNumber);
    if (!normalized) {
        return { sent: false, reason: 'missing-recipient-number' };
    }

    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
        return { sent: false, reason: 'whatsapp-api-not-configured' };
    }

    const response = await fetch(`https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: normalized,
            type: 'text',
            text: { body: message },
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        return {
            sent: false,
            reason: `whatsapp-api-error-${response.status}`,
            details: errorBody,
        };
    }

    return { sent: true };
}

module.exports.renderBooking = async (req, res) => {
    console.log('bookingController.renderBooking called, params:', req.params);
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        return res.redirect(`/cars/${id}`);
    }
    res.render('listings/book.ejs', {
        listing,
        razorpayKey: process.env.RAZORPAY_KEY_ID || '',
        orsKey: process.env.ORS_API_KEY || '',
        ownerWhatsappNumber: listing.whatsappNumber || '',
    });
};

module.exports.createOrder = async (req, res) => {
    try {
        const rp = getRazorpayInstance();
        if (!rp) {
            return res.status(500).json({ success: false, error: 'Razorpay API keys not configured on server' });
        }
        const { amount } = req.body; // amount in INR rupees
        const payAmount = Math.max(1, Math.round(Number(amount) || 0));
        if (payAmount > MAX_BOOKING_AMOUNT_INR) {
            return res.status(400).json({
                success: false,
                error: `Booking amount is too high. Please keep total up to Rs ${MAX_BOOKING_AMOUNT_INR.toLocaleString('en-IN')}.`,
            });
        }
        const options = {
            amount: payAmount * 100, // paisa
            currency: 'INR',
            receipt: `rcpt_${Date.now()}`,
        };
        const order = await rp.orders.create(options);
        return res.json({ success: true, order });
    } catch (e) {
        console.error('Razorpay create order error', e);
        return res.status(500).json({ success: false, error: 'Unable to create order' });
    }
};

module.exports.confirmPayment = async (req, res) => {
    try {
        const { id } = req.params; // listing id
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, pickup, destination, purpose, distanceKm, amount, paymentMethod, pickupDate, returnDate, pickupTime, returnTime } = req.body;

        const listing = await Listing.findById(id);
        if (!listing) {
            return res.status(404).json({ success: false, error: 'Listing not found' });
        }

        // Calculate total days
        let totalDays = 1;
        if (pickupDate && returnDate) {
            const pickup = new Date(pickupDate);
            const returnD = new Date(returnDate);
            totalDays = Math.ceil((returnD - pickup) / (1000 * 60 * 60 * 24)) || 1;
        }

        // Calculate price breakdown
        const priceCalculation = bookingService.calculatePrice(listing, totalDays, Number(distanceKm) || 0);

        // Validate booking
        const validation = await bookingService.validateBooking({
            vehicleId: id,
            pickupDate: pickupDate ? new Date(pickupDate) : null,
            returnDate: returnDate ? new Date(returnDate) : null,
            pickupTime,
            returnTime,
            userId: req.user._id,
            amount: priceCalculation.totalPrice
        });

        if (!validation.valid) {
            return res.status(400).json({ success: false, error: validation.error });
        }

        // Create combined datetime
        let pickupDateTime = null;
        let returnDateTime = null;
        
        if (pickupDate) {
            pickupDateTime = new Date(pickupDate);
            if (pickupTime) {
                const [hours, minutes] = pickupTime.split(':');
                pickupDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            }
        }
        
        if (returnDate) {
            returnDateTime = new Date(returnDate);
            if (returnTime) {
                const [hours, minutes] = returnTime.split(':');
                returnDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            }
        }

        // For COD, skip Razorpay verification
        if (paymentMethod === 'cod') {
            const ownerWhatsAppNumber = normalizeWhatsAppNumber(listing.whatsappNumber || '');

            const booking = new Booking({
                user: req.user._id,
                listing: id,
                vehicleId: id,
                ownerId: listing.owner,
                renterId: req.user._id,
                pickup: pickup || '',
                destination: destination || '',
                purpose: purpose || '',
                distanceKm: Number(distanceKm) || 0,
                amountPaid: priceCalculation.totalPrice,
                totalPrice: priceCalculation.totalPrice,
                basePrice: priceCalculation.basePrice,
                platformFee: priceCalculation.platformFee,
                tax: priceCalculation.tax,
                totalDays,
                paymentMethod: 'cod',
                paymentStatus: 'PENDING',
                bookingStatus: 'CONFIRMED',
                pickupDate: pickupDate ? new Date(pickupDate) : null,
                returnDate: returnDate ? new Date(returnDate) : null,
                pickupTime: pickupTime || '',
                returnTime: returnTime || '',
                pickupDateTime,
                returnDateTime,
                ownerWhatsappNumber: ownerWhatsAppNumber,
            });
            await booking.save();

            // Update vehicle stats and availability
            await bookingService.updateVehicleStats(id, priceCalculation.totalPrice);
            await bookingService.updateVehicleAvailability(id);

            // Send notifications
            await notificationService.notifyBookingConfirmed(booking._id);

            const whatsappNumber = ownerWhatsAppNumber;
            const whatsappMessage = buildWhatsAppMessage({ listing, booking, user: req.user });
            const whatsappUrl = buildWhatsAppUrl(whatsappNumber, whatsappMessage);
            const whatsappDelivery = await sendWhatsAppTextMessage(whatsappNumber, whatsappMessage);

            if (!whatsappDelivery.sent) {
                console.warn('Owner WhatsApp auto-send failed:', whatsappDelivery.reason, whatsappDelivery.details || '');
            }

            return res.json({
                success: true,
                bookingId: booking._id,
                whatsappSent: whatsappDelivery.sent,
                whatsappReason: whatsappDelivery.sent ? 'sent' : whatsappDelivery.reason,
                whatsappUrl,
                whatsappNumber: normalizeWhatsAppNumber(whatsappNumber),
                paymentMethod: 'cod',
                priceBreakdown: priceCalculation.breakdown
            });
        }

        // For Razorpay payment
        const key_secret = process.env.RAZORPAY_KEY_SECRET;
        if (!key_secret) return res.status(500).json({ success: false, error: 'Razorpay secret not configured' });

        const generated_signature = crypto.createHmac('sha256', key_secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({ success: false, error: 'Invalid signature' });
        }

        // Save booking
        const ownerWhatsAppNumber = normalizeWhatsAppNumber(listing.whatsappNumber || '');

        const booking = new Booking({
            user: req.user._id,
            listing: id,
            vehicleId: id,
            ownerId: listing.owner,
            renterId: req.user._id,
            pickup: pickup || '',
            destination: destination || '',
            purpose: purpose || '',
            distanceKm: Number(distanceKm) || 0,
            amountPaid: priceCalculation.totalPrice,
            totalPrice: priceCalculation.totalPrice,
            basePrice: priceCalculation.basePrice,
            platformFee: priceCalculation.platformFee,
            tax: priceCalculation.tax,
            totalDays,
            paymentMethod: 'razorpay',
            paymentStatus: 'PAID',
            bookingStatus: 'CONFIRMED',
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            pickupDate: pickupDate ? new Date(pickupDate) : null,
            returnDate: returnDate ? new Date(returnDate) : null,
            pickupTime: pickupTime || '',
            returnTime: returnTime || '',
            pickupDateTime,
            returnDateTime,
            ownerWhatsappNumber: ownerWhatsAppNumber,
        });
        await booking.save();

        // Update vehicle stats and availability
        await bookingService.updateVehicleStats(id, priceCalculation.totalPrice);
        await bookingService.updateVehicleAvailability(id);

        // Send notifications
        await notificationService.notifyBookingConfirmed(booking._id);
        await notificationService.notifyPaymentReceived(booking._id);

        const whatsappNumber = ownerWhatsAppNumber;
        const whatsappMessage = buildWhatsAppMessage({ listing, booking, user: req.user });
        const whatsappUrl = buildWhatsAppUrl(whatsappNumber, whatsappMessage);
        const whatsappDelivery = await sendWhatsAppTextMessage(whatsappNumber, whatsappMessage);

        if (!whatsappDelivery.sent) {
            console.warn('Owner WhatsApp auto-send failed:', whatsappDelivery.reason, whatsappDelivery.details || '');
        }

        return res.json({
            success: true,
            bookingId: booking._id,
            whatsappSent: whatsappDelivery.sent,
            whatsappReason: whatsappDelivery.sent ? 'sent' : whatsappDelivery.reason,
            whatsappUrl,
            whatsappNumber: normalizeWhatsAppNumber(whatsappNumber),
            paymentMethod: 'razorpay',
            priceBreakdown: priceCalculation.breakdown
        });
    } catch (e) {
        console.error('Payment confirmation error', e);
        return res.status(500).json({ success: false, error: 'Unable to confirm payment' });
    }
};

// Check availability API
module.exports.checkAvailability = async (req, res) => {
    try {
        const { id } = req.params;
        const { pickupDate, returnDate } = req.query;

        const listing = await Listing.findById(id);
        if (!listing) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        if (!pickupDate || !returnDate) {
            return res.json({ success: true, available: true, message: 'Dates not provided' });
        }

        const isAvailable = await bookingService.checkAvailability(
            id,
            new Date(pickupDate),
            new Date(returnDate)
        );

        return res.json({
            success: true,
            available: isAvailable,
            vehicle: {
                id: listing._id,
                title: listing.title,
                availabilityStatus: listing.availabilityStatus,
                nextAvailableAt: listing.nextAvailableAt,
                maintenanceMode: listing.maintenanceMode
            }
        });
    } catch (e) {
        console.error('Availability check error', e);
        return res.status(500).json({ success: false, error: 'Unable to check availability' });
    }
};

// Get availability calendar API
module.exports.getCalendar = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const listing = await Listing.findById(id);
        if (!listing) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        const start = startDate ? new Date(startDate) : new Date();
        const end = endDate ? new Date(endDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

        const calendar = await bookingService.getAvailabilityCalendar(id, start, end);

        return res.json({
            success: true,
            calendar,
            vehicle: {
                id: listing._id,
                title: listing.title,
                availabilityStatus: listing.availabilityStatus,
                nextAvailableAt: listing.nextAvailableAt
            }
        });
    } catch (e) {
        console.error('Calendar fetch error', e);
        return res.status(500).json({ success: false, error: 'Unable to fetch calendar' });
    }
};

// Cancel booking API
module.exports.cancelBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { reason } = req.body;

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        // Check if user is authorized (owner or renter)
        if (booking.renterId.toString() !== req.user._id.toString() && 
            booking.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, error: 'Not authorized to cancel this booking' });
        }

        // Check if booking can be cancelled
        if (booking.bookingStatus === 'CANCELLED' || booking.bookingStatus === 'COMPLETED') {
            return res.status(400).json({ success: false, error: 'Cannot cancel this booking' });
        }

        booking.bookingStatus = 'CANCELLED';
        booking.cancellationReason = reason || '';
        booking.cancelledBy = req.user._id;
        booking.bookingUpdatedAt = new Date();

        await booking.save();

        // Update vehicle availability
        await bookingService.updateVehicleAvailability(booking.vehicleId);

        // Send notifications
        await notificationService.notifyBookingCancelled(bookingId);

        return res.json({
            success: true,
            booking: {
                id: booking._id,
                bookingStatus: booking.bookingStatus,
                cancellationReason: booking.cancellationReason
            }
        });
    } catch (e) {
        console.error('Booking cancellation error', e);
        return res.status(500).json({ success: false, error: 'Unable to cancel booking' });
    }
};

// Complete booking API
module.exports.completeBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { vehicleConditionAfter } = req.body;

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        // Only owner can complete booking
        if (booking.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, error: 'Not authorized to complete this booking' });
        }

        // Check if booking can be completed
        if (booking.bookingStatus !== 'CONFIRMED') {
            return res.status(400).json({ success: false, error: 'Booking cannot be completed' });
        }

        booking.bookingStatus = 'COMPLETED';
        booking.vehicleConditionAfter = vehicleConditionAfter || '';
        booking.bookingCompletedAt = new Date();
        booking.bookingUpdatedAt = new Date();

        await booking.save();

        // Update vehicle availability
        await bookingService.updateVehicleAvailability(booking.vehicleId);

        // Send notifications
        await notificationService.notifyBookingCompleted(bookingId);

        return res.json({
            success: true,
            booking: {
                id: booking._id,
                bookingStatus: booking.bookingStatus,
                bookingCompletedAt: booking.bookingCompletedAt
            }
        });
    } catch (e) {
        console.error('Booking completion error', e);
        return res.status(500).json({ success: false, error: 'Unable to complete booking' });
    }
};

// Get user bookings API
module.exports.getUserBookings = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = { renterId: req.user._id };

        if (status) {
            filter.bookingStatus = status.toUpperCase();
        }

        const bookings = await Booking.find(filter)
            .populate('vehicleId')
            .populate('ownerId')
            .sort({ bookingCreatedAt: -1 });

        return res.json({
            success: true,
            bookings
        });
    } catch (e) {
        console.error('Get user bookings error', e);
        return res.status(500).json({ success: false, error: 'Unable to fetch bookings' });
    }
};

// Get owner bookings API
module.exports.getOwnerBookings = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = { ownerId: req.user._id };

        if (status) {
            filter.bookingStatus = status.toUpperCase();
        }

        const bookings = await Booking.find(filter)
            .populate('vehicleId')
            .populate('renterId')
            .sort({ bookingCreatedAt: -1 });

        return res.json({
            success: true,
            bookings
        });
    } catch (e) {
        console.error('Get owner bookings error', e);
        return res.status(500).json({ success: false, error: 'Unable to fetch bookings' });
    }
};

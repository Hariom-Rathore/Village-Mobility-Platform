const mongoose = require('mongoose');
const Listing = require('../models/listing');
const Booking = require('../models/booking');
const Review = require('../models/review');

require('dotenv').config();

const MONGO_URL = process.env.ATLASDB_URL || 'mongodb://127.0.0.1:27017/wanderlust';

async function migrateDatabase() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log('Connected to MongoDB for migration');

    // Migrate Listings
    console.log('\n--- Migrating Listings ---');
    const listings = await Listing.find({});
    let listingCount = 0;

    for (const listing of listings) {
      let needsUpdate = false;

      // Add new fields with defaults if missing
      if (!listing.availabilityStatus) {
        listing.availabilityStatus = 'AVAILABLE';
        needsUpdate = true;
      }

      if (listing.maintenanceMode === undefined) {
        listing.maintenanceMode = false;
        needsUpdate = true;
      }

      if (listing.totalBookings === undefined) {
        listing.totalBookings = 0;
        needsUpdate = true;
      }

      if (listing.totalRevenue === undefined) {
        listing.totalRevenue = 0;
        needsUpdate = true;
      }

      if (listing.averageRating === undefined) {
        listing.averageRating = 0;
        needsUpdate = true;
      }

      if (listing.totalReviews === undefined) {
        listing.totalReviews = 0;
        needsUpdate = true;
      }

      // Calculate average rating from existing reviews
      if (listing.reviews && listing.reviews.length > 0) {
        const reviews = await Review.find({ _id: { $in: listing.reviews } });
        if (reviews.length > 0) {
          const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
          listing.averageRating = totalRating / reviews.length;
          listing.totalReviews = reviews.length;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await listing.save();
        listingCount++;
      }
    }

    console.log(`Updated ${listingCount} listings`);

    // Migrate Bookings
    console.log('\n--- Migrating Bookings ---');
    const bookings = await Booking.find({});
    let bookingCount = 0;

    for (const booking of bookings) {
      let needsUpdate = false;

      // Set vehicleId and ownerId from existing listing reference
      if (!booking.vehicleId) {
        booking.vehicleId = booking.listing;
        needsUpdate = true;
      }

      if (!booking.ownerId && booking.listing) {
        const listing = await Listing.findById(booking.listing);
        if (listing) {
          booking.ownerId = listing.owner;
          needsUpdate = true;
        }
      }

      if (!booking.renterId) {
        booking.renterId = booking.user;
        needsUpdate = true;
      }

      // Set default booking status
      if (!booking.bookingStatus) {
        booking.bookingStatus = 'CONFIRMED';
        needsUpdate = true;
      }

      // Set payment status based on payment method
      if (!booking.paymentStatus) {
        if (booking.paymentMethod === 'razorpay' && booking.razorpayPaymentId) {
          booking.paymentStatus = 'PAID';
        } else if (booking.paymentMethod === 'cod') {
          booking.paymentStatus = 'PENDING';
        } else {
          booking.paymentStatus = 'PENDING';
        }
        needsUpdate = true;
      }

      // Set total price from amount paid
      if (!booking.totalPrice && booking.amountPaid) {
        booking.totalPrice = booking.amountPaid;
        needsUpdate = true;
      }

      // Set booking timestamps
      if (!booking.bookingCreatedAt) {
        booking.bookingCreatedAt = booking.createdAt;
        needsUpdate = true;
      }

      if (!booking.bookingUpdatedAt) {
        booking.bookingUpdatedAt = booking.createdAt;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await booking.save();
        bookingCount++;
      }
    }

    console.log(`Updated ${bookingCount} bookings`);

    // Create MongoDB indexes for performance
    console.log('\n--- Creating Indexes ---');
    
    await Listing.collection.createIndex({ availabilityStatus: 1 });
    await Listing.collection.createIndex({ owner: 1 });
    await Listing.collection.createIndex({ category: 1 });
    await Listing.collection.createIndex({ carType: 1 });
    await Listing.collection.createIndex({ seats: 1 });
    
    await Booking.collection.createIndex({ vehicleId: 1, bookingStatus: 1 });
    await Booking.collection.createIndex({ ownerId: 1, bookingStatus: 1 });
    await Booking.collection.createIndex({ renterId: 1, bookingStatus: 1 });
    await Booking.collection.createIndex({ pickupDate: 1, returnDate: 1 });
    await Booking.collection.createIndex({ listing: 1 });
    
    console.log('Indexes created successfully');

    console.log('\n--- Migration Complete ---');
    process.exit(0);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateDatabase();

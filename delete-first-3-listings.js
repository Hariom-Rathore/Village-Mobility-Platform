const mongoose = require("mongoose");
require("dotenv").config();

const Listing = require("./models/listing.js");
const User = require("./models/user.js");

const dbUrl = process.env.ATLASDB_URL;

async function deleteFirst3Listings() {
    try {
        await mongoose.connect(dbUrl);
        console.log("Database connected");

        // Find first 3 listings
        const listings = await Listing.find().sort({ _id: 1 }).limit(3);
        
        console.log(`Found ${listings.length} listings to delete`);
        
        const ownerIds = new Set();
        
        for (const listing of listings) {
            console.log(`Deleting listing: ${listing.title} (ID: ${listing._id})`);
            ownerIds.add(listing.owner.toString());
            await Listing.findByIdAndDelete(listing._id);
        }
        
        console.log(`Deleting ${ownerIds.size} associated users`);
        
        for (const ownerId of ownerIds) {
            console.log(`Deleting user ID: ${ownerId}`);
            await User.findByIdAndDelete(ownerId);
        }
        
        console.log("Successfully deleted first 3 listings and their owners");
        
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.connection.close();
        console.log("Database connection closed");
    }
}

deleteFirst3Listings();

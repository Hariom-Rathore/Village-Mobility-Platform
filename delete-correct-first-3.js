const mongoose = require("mongoose");
require("dotenv").config();

const Listing = require("./models/listing.js");
const User = require("./models/user.js");

const dbUrl = process.env.ATLASDB_URL;

async function deleteCorrectFirst3Listings() {
    try {
        await mongoose.connect(dbUrl);
        console.log("Database connected");

        // Find first 3 listings as shown on website (sorted by _id descending)
        const listings = await Listing.find({ websiteSource: "car-rental" }).sort({ _id: -1 }).limit(3);
        
        console.log(`Found ${listings.length} listings to delete (as shown on website):`);
        
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

deleteCorrectFirst3Listings();

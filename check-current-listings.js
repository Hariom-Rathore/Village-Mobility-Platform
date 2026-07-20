const mongoose = require("mongoose");
require("dotenv").config();

const Listing = require("./models/listing.js");

const dbUrl = process.env.ATLASDB_URL;

async function checkCurrentListings() {
    try {
        await mongoose.connect(dbUrl);
        console.log("Database connected");

        // Get current listings sorted by _id descending (as shown on website)
        const listings = await Listing.find({ websiteSource: "car-rental" }).sort({ _id: -1 });
        
        console.log(`\nCurrent listings on website (${listings.length} total):`);
        listings.forEach((listing, index) => {
            console.log(`${index + 1}. ${listing.title} (ID: ${listing._id})`);
        });
        
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.connection.close();
        console.log("\nDatabase connection closed");
    }
}

checkCurrentListings();

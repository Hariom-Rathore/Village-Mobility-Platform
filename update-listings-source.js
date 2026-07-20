const mongoose = require("mongoose");
require("dotenv").config();

const Listing = require("./models/listing.js");

const dbUrl = process.env.ATLASDB_URL;

async function updateListingsSource() {
    try {
        await mongoose.connect(dbUrl);
        console.log("Database connected");

        // Update all existing listings to have websiteSource as "car-rental"
        const result = await Listing.updateMany(
            { websiteSource: { $exists: false } },
            { $set: { websiteSource: "car-rental" } }
        );
        
        console.log(`Updated ${result.modifiedCount} listings to websiteSource: "car-rental"`);
        
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.connection.close();
        console.log("Database connection closed");
    }
}

updateListingsSource();

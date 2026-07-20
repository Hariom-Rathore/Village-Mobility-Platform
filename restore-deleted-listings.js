const mongoose = require("mongoose");
require("dotenv").config();

const Listing = require("./models/listing.js");
const User = require("./models/user.js");
const { data: sampleListings } = require("./init/data.js");

const dbUrl = process.env.ATLASDB_URL;

async function restoreDeletedListings() {
    try {
        await mongoose.connect(dbUrl);
        console.log("Database connected");

        // Restore the 3 deleted listings
        const listingsToRestore = [
            "Desert Rally Jeep",
            "Family MPV Comfort", 
            "Vintage Classic Coupe"
        ];

        // Create a default owner user
        const DEFAULT_OWNER_ID = "69df2651aaefb65557b7339c";
        const DEFAULT_OWNER_WHATSAPP_NUMBER = process.env.OWNER_WHATSAPP_NUMBER || "919876543210";

        // Check if default owner exists, if not create it
        let owner = await User.findById(DEFAULT_OWNER_ID);
        if (!owner) {
            console.log("Creating default owner user...");
            owner = new User({
                _id: DEFAULT_OWNER_ID,
                email: "owner@carrental.com",
                username: "owner"
            });
            await owner.save();
            console.log("Default owner created");
        }

        let restoredCount = 0;

        for (const listingData of sampleListings) {
            if (listingsToRestore.includes(listingData.title)) {
                // Check if already exists
                const existing = await Listing.findOne({ title: listingData.title });
                if (existing) {
                    console.log(`Listing "${listingData.title}" already exists, skipping...`);
                    continue;
                }

                const newListing = new Listing({
                    ...listingData,
                    websiteSource: "car-rental",
                    owner: DEFAULT_OWNER_ID,
                    whatsappNumber: DEFAULT_OWNER_WHATSAPP_NUMBER.trim(),
                    category: "trending"
                });

                await newListing.save();
                console.log(`Restored listing: ${listingData.title}`);
                restoredCount++;
            }
        }

        console.log(`Successfully restored ${restoredCount} listings`);
        
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.connection.close();
        console.log("Database connection closed");
    }
}

restoreDeletedListings();

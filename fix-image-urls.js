const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
require("dotenv").config();

async function main() {
    try {
        const dbUrl = process.env.ATLASDB_URL;
        await mongoose.connect(dbUrl);
        console.log("Database connected");

        // Find all listings with image URLs
        const listings = await Listing.find({ "image.url": { $exists: true, $ne: "" } });
        console.log(`Found ${listings.length} listings with images`);

        let updatedCount = 0;

        for (const listing of listings) {
            const originalUrl = listing.image.url;
            
            // Check if it's a Cloudinary URL and doesn't already have optimization parameters
            if (originalUrl.includes('cloudinary.com') && !originalUrl.includes('/upload/q_auto')) {
                // Add optimization parameters
                const optimizedUrl = originalUrl.replace('/upload/', '/upload/q_auto,f_auto,w_1200,h_800,c_limit/');
                
                // Update the listing
                await Listing.findByIdAndUpdate(listing._id, {
                    $set: { "image.url": optimizedUrl }
                });
                
                console.log(`Updated listing ${listing._id}: ${listing.title}`);
                console.log(`  Old: ${originalUrl}`);
                console.log(`  New: ${optimizedUrl}`);
                updatedCount++;
            }
        }

        console.log(`Successfully updated ${updatedCount} listings with optimized image URLs`);
        
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.connection.close();
        console.log("Database connection closed");
    }
}

main();

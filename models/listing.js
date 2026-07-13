const mongoose= require("mongoose");
const review = require("./review");
const Schema=mongoose.Schema;  //ek variable bana lenge joo baar use nahi karna pade
const Review = require("./review.js");

const listingSchema = new Schema({
    title:{
       type:String,
       required:true,
    },
    description: String,
    image: {
      filename: {
        type: String,
      },
      url: {
        type: String,
      },
    },
    price:{
      type:Number,
      required:true,
      min:0,
    },
    ratePerKm: {
      type: Number,
      min: 0,
      default: 0,
    },
    location:String,
    country:String,
    whatsappNumber: {
      type: String,
      required: true,
      trim: true,
    },
    carType: {
      type: String,
      enum: ["electric", "petrol", "diesel", "hybrid", "other"],
      default: "other",
    },
    seats: {
      type: Number,
      enum: [4, 6, 10],
      default: 4,
    },
    category:{
      type:String,
      default:"trending",
    },
    reviews:[
      {
        type:Schema.Types.ObjectId,
        ref:"Review",
      },
    ],
    owner:{
      type:Schema.Types.ObjectId,
      ref:"User", 
      required:true,
    },
    // Production booking fields
    availabilityStatus: {
      type: String,
      enum: ["AVAILABLE", "BOOKED", "RESERVED", "UNDER_MAINTENANCE", "HIDDEN"],
      default: "AVAILABLE"
    },
    nextAvailableAt: {
      type: Date,
      default: null
    },
    maintenanceMode: {
      type: Boolean,
      default: false
    },
    currentBookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      default: null
    },
    totalBookings: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalReviews: {
      type: Number,
      default: 0
    }
});

listingSchema.post("findOneAndDelete",async(listing)=>{
  if(listing){
    await review.deleteMany({_id:{$in:listing.reviews}});
  }
}); 



const Listing=mongoose.model("Listing",listingSchema);
module.exports=Listing;

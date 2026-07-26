const mongoose= require("mongoose");
const review = require("./review");
const Schema=mongoose.Schema;  //ek variable bana lenge joo baar use nahi karna pade
const Review = require("./review.js");

const listingSchema = new Schema({
    websiteSource: {
      type: String,
      enum: ["car-rental", "airbnb"],
      default: "car-rental",
      required: true
    },
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
    // Multiple images support
    images: [{
      filename: {
        type: String,
      },
      url: {
        type: String,
      },
      type: {
        type: String,
        enum: ["front", "rear", "left", "right", "interior", "dashboard"],
      }
    }],
    // Legacy pricing field (kept for backward compatibility)
    price:{
      type:Number,
      required:false,
      min:0,
    },
    ratePerKm: {
      type: Number,
      min: 0,
      default: 0,
    },
    // New pricing structure for trip booking
    baseFare: {
      type: Number,
      required: false,
      min: 0,
      default: 0
    },
    pricePerKm: {
      type: Number,
      required: false,
      min: 0,
      default: 0
    },
    minimumTripFare: {
      type: Number,
      required: false,
      min: 0,
      default: 0
    },
    nightCharge: {
      type: Number,
      required: false,
      min: 0,
      default: 0
    },
    // Location with coordinates
    location: String,
    country: String,
    locationCoordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: [0, 0]
      }
    },
    village: String,
    area: String,
    city: String,
    district: String,
    state: String,
    // Service radius for pickup
    serviceRadius: {
      type: Number,
      enum: [20, 50, 100, null],
      default: null
    },
    // Legacy whatsapp number (kept for backward compatibility, not publicly exposed)
    whatsappNumber: {
      type: String,
      required: false,
      trim: true,
    },
    // Vehicle information
    carType: {
      type: String,
      enum: ["electric", "petrol", "diesel", "hybrid", "other"],
      default: "other",
    },
    vehicleName: String,
    brand: String,
    model: String,
    year: {
      type: Number,
      min: 1900,
      max: new Date().getFullYear() + 1
    },
    vehicleNumber: String,
    vehicleType: String,
    fuelType: {
      type: String,
      enum: ["petrol", "diesel", "electric", "hybrid", "cng", "other"],
      default: "other"
    },
    transmission: {
      type: String,
      enum: ["manual", "automatic"],
      default: "manual"
    },
    seats: {
      type: Number,
      enum: [4, 5, 6, 7, 10],
      default: 4,
    },
    acAvailable: {
      type: Boolean,
      default: true
    },
    musicSystem: {
      type: Boolean,
      default: false
    },
    luggageCapacity: {
      type: String,
      enum: ["small", "medium", "large", "extra-large"],
      default: "medium"
    },
    // Driver information
    driverType: {
      type: String,
      enum: ["owner", "dedicated-driver"],
      default: "owner"
    },
    driverName: String,
    driverExperience: {
      type: Number,
      min: 0
    },
    driverPhoneNumber: String,
    driverLicenseNumber: String,
    driverPhoto: {
      filename: String,
      url: String
    },
    // Trip types
    availableTripTypes: [{
      type: String,
      enum: ["local", "outstation", "airport-pickup", "railway-pickup", "wedding", "family-function", "temple-visit", "tourism", "corporate"]
    }],
    // Vehicle documents
    documents: {
      vehicleRC: {
        url: String,
        filename: String,
        verificationStatus: {
          type: String,
          enum: ["pending", "verified", "rejected"],
          default: "pending"
        }
      },
      insurance: {
        url: String,
        filename: String,
        verificationStatus: {
          type: String,
          enum: ["pending", "verified", "rejected"],
          default: "pending"
        }
      },
      pollutionCertificate: {
        url: String,
        filename: String,
        verificationStatus: {
          type: String,
          enum: ["pending", "verified", "rejected"],
          default: "pending"
        }
      },
      fitnessCertificate: {
        url: String,
        filename: String,
        verificationStatus: {
          type: String,
          enum: ["pending", "verified", "rejected"],
          default: "pending"
        }
      },
      ownerDrivingLicense: {
        url: String,
        filename: String,
        verificationStatus: {
          type: String,
          enum: ["pending", "verified", "rejected"],
          default: "pending"
        }
      },
      driverDrivingLicense: {
        url: String,
        filename: String,
        verificationStatus: {
          type: String,
          enum: ["pending", "verified", "rejected"],
          default: "pending"
        }
      },
      aadhaar: {
        url: String,
        filename: String,
        verificationStatus: {
          type: String,
          enum: ["pending", "verified", "rejected"],
          default: "pending"
        }
      }
    },
    // Booking rules
    bookingRules: {
      minimumBookingAmount: {
        type: Number,
        min: 0,
        default: 0
      },
      maximumPassengers: {
        type: Number,
        min: 1,
        default: 4
      },
      smokingAllowed: {
        type: Boolean,
        default: false
      },
      petsAllowed: {
        type: Boolean,
        default: false
      },
      luggageAllowed: {
        type: Boolean,
        default: true
      },
      nightDriving: {
        type: Boolean,
        default: true
      }
    },
    // Payment settings
    paymentMethods: [{
      type: String,
      enum: ["cash", "upi", "online", "all"]
    }],
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

// Create 2dsphere index for location-based queries
listingSchema.index({ locationCoordinates: "2dsphere" }); 



const Listing=mongoose.model("Listing",listingSchema);
module.exports=Listing;

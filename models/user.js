//This file for the make a scheam for user login information

const mongoose= require("mongoose");
const Schema=mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose").default;

const userSchema= new Schema({
    email:{
        type:String,
        required:true
    },
    role: {
        type: String,
        enum: ["customer", "owner"],
        default: "customer",
        required: true
    },
    username: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        trim: true
    },
    address: {
        type: String,
        trim: true
    },
    profilePhoto: {
        url: String,
        filename: String
    },
    isVerified: {
        type: Boolean,
        default: false
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
    },
    // Owner specific fields
    totalVehicles: {
        type: Number,
        default: 0
    },
    totalBookings: {
        type: Number,
        default: 0
    },
    totalRevenue: {
        type: Number,
        default: 0
    },
    // Customer specific fields
    totalTrips: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
})

userSchema.plugin(passportLocalMongoose);  //its automaticlay store hashed password and salt value into the username

module.exports=mongoose.model("User",userSchema);
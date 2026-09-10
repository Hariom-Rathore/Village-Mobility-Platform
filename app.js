if(process.env.NODE_ENV != "production"){
require("dotenv").config();
}
//this is use if we in the production phase and we deploye our project or abhi jese hum production phase me nahi h to hum env file ko use kar sakte h



const express=require("express");
const app=express();
const mongoose= require("mongoose");
//const dburl="mongodb://127.0.0.1:27017/wanderlust";  //THIS IS add for mongodb database and databse name is wanderlust

const dbUrl=process.env.ATLASDB_URL;
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && (!dbUrl || dbUrl.includes("127.0.0.1") || dbUrl.includes("localhost"))) {
    throw new Error("ATLASDB_URL must point to MongoDB Atlas in production.");
}

const path =require("path");
const Listing=require("./models/listing.js");
const { data: sampleListings } = require("./init/data.js");
const DEFAULT_OWNER_ID = "69df2651aaefb65557b7339c";
const DEFAULT_OWNER_WHATSAPP_NUMBER = process.env.OWNER_WHATSAPP_NUMBER || "";

const ejsMate=require("ejs-mate");  
const ExpressError=require("./utils/ExpressError.js");                                               //this is usefor when some template are same for all router(pages) like a navbar

const methodOverride=require("method-override");
const session = require("express-session");
const MongoStore=require('connect-mongo').default;//as a session
const flash = require("connect-flash");
 


const listings= require("./routes/listing.js"); //this is router
const reviews=require("./routes/review.js");
const userRouter=require("./routes/user.js");
const dashboardRouter=require("./routes/dashboard.js");
const bookingRouter=require("./routes/booking.js");
const notificationRouter=require("./routes/notification.js");
const customerRouter=require("./routes/customer.js");
const ownerRouter=require("./routes/owner.js");
const aiRouter=require("./routes/ai.js");

const passport=require("passport");
const localStrategy=require("passport-local");
const User= require("./models/user.js");
const http = require('http');
const { spawn } = require('child_process');
const { Server } = require('socket.io');

//session(user ke bare me ki user kitni der baad aaya website pe vesi information) ki inforamtion abb atlas me store hogi jiska dburl le liya h because express sessison me some time data leak ho jata h
const store=new MongoStore({
    mongoUrl:dbUrl,
    crypto:{
        secret:process.env.SECRET,

    },
    touchAfter:24*3600,
});

store.on("error",(err)=>{
    console.log("error in mongo store",err);
})

const sessionOptions = {
    store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
};




const emptyListing = {
    title: "",
    description: "",
    image: { url: "", filename: "listingimage" },
    price: "",
    country: "",
    location: "",
    category: "trending",
    whatsappNumber: "",
};

const buildListingData = (incomingListing = {}) => ({
    ...emptyListing,
    ...incomingListing,
    image: {
        ...emptyListing.image,
        ...(incomingListing.image || {}),
    },
});

const resolveSampleCategory = (listing) => {
    const title = `${listing.title || ""} ${listing.location || ""}`.toLowerCase();

    if (title.includes("beach") || title.includes("pool") || title.includes("villa")) {
        return "amazing-pools";
    }

    if (title.includes("room") || title.includes("loft") || title.includes("apartment")) {
        return "rooms";
    }

    if (title.includes("city") || title.includes("downtown") || title.includes("new york") || title.includes("miami") || title.includes("tokyo") || title.includes("amsterdam") || title.includes("boston")) {
        return "iconic-cities";
    }

    if (title.includes("mountain") || title.includes("aspen") || title.includes("banff") || title.includes("swiss")) {
        return "mountains";
    }

    if (title.includes("castle") || title.includes("villa") || title.includes("historic")) {
        return "castles";
    }

    if (title.includes("camp") || title.includes("cabin") || title.includes("treehouse")) {
        return "camping";
    }

    if (title.includes("farm") || title.includes("cottage") || title.includes("log cabin")) {
        return "farms";
    }

    if (title.includes("boat") || title.includes("island") || title.includes("canal")) {
        return "boats";
    }

    if (title.includes("snow") || title.includes("arctic") || title.includes("scotland") || title.includes("switzerland")) {
        return "arctic";
    }

    return "trending";
};

async function seedSampleListingsIfNeeded() {
    const ownerId = process.env.OWNER_ID || DEFAULT_OWNER_ID;

    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
        throw new Error(`Invalid OWNER_ID: ${ownerId}`);
    }

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    let insertedCount = 0;

    for (const listing of sampleListings) {
        const category = resolveSampleCategory(listing);

        await Listing.findOneAndUpdate(
            { title: listing.title },
            {
                $set: {
                    ...listing,
                    category,
                    owner: ownerObjectId,
                    whatsappNumber: (listing.whatsappNumber || DEFAULT_OWNER_WHATSAPP_NUMBER || "").trim(),
                },
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        if (category) {
            insertedCount += 1;
        }
    }

    console.log(`Seeded ${insertedCount} sample listings.`);
}

async function backfillListingWhatsAppNumbers() {
    if (!DEFAULT_OWNER_WHATSAPP_NUMBER) {
        return;
    }

    await Listing.updateMany(
        {
            $or: [
                { whatsappNumber: { $exists: false } },
                { whatsappNumber: "" },
                { whatsappNumber: null },
            ],
        },
        { $set: { whatsappNumber: DEFAULT_OWNER_WHATSAPP_NUMBER.trim() } }
    );
}


//make according to joi for  server side all things work systematically and i am use on teh router only this function name

async function main() {
    await mongoose.connect(dbUrl);
    console.log("Database connected");
}

main()
    .then(async () => {

        if (process.env.NODE_ENV !== "production") {
            // await seedSampleListingsIfNeeded(); // Disabled to prevent re-seeding deleted demo cars
        }

        await backfillListingWhatsAppNumbers();
    })
    .catch((err) => {
        console.log(err);
    });

app.set("view engine","ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.urlencoded({extended:true}));  //data ko pars karne ke liye
app.use(methodOverride("_method"));

app.use(express.static(path.join(__dirname,"/public"))); 
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.engine('ejs',ejsMate);  //for ejs mate templeting

app.use(session(sessionOptions));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());//ek session me kam hona chahiye isliye use karte h
passport.use(new localStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser()); //ek baar session start kar diya too baar bar login karna nahi padega
passport.deserializeUser(User.deserializeUser());//ek session khatam hote hi remove karne ke liye

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    res.locals.req = req;
    next();
});

app.get("/", (req, res) => {
    if (req.user && req.user.role === "owner") return res.redirect("/owners/dashboard");
    res.redirect("/customers/home");
});

//make a demo user for checking all things works 
// app.get("/demouser",async(req,res)=>{
//     let fakeUser=new User({
//     email:"student@gmail.com",
//     username:"college-student" //this automaticlay invoked by the mongoose package

// })
// let registeredUser=await User.register(fakeUser,"helloworld"); //username and password
// res.send(registeredUser);
// });

app.use("/cars",listings);//cars and /cars/:id/reviews this is common part into the all router so this fixed first and after place of this use only /
app.use("/cars/:id/reviews",reviews);
app.use("/users",userRouter);
app.use("/dashboard",dashboardRouter);
app.use("/bookings",bookingRouter);
app.use("/notifications",notificationRouter);
app.use("/customers",customerRouter);
app.use("/owners",ownerRouter);
app.use("/api/ai", aiRouter);


app.all(/.*/,(req,res,next)=>{
    next(new ExpressError(404,"Page not found!"));
});

//error handler middleware
app.use((err,req,res,next)=>{
    const statusCode = err.statusCode || 500;
    const errorMsg = err.message || "Something went wrong!";

    // show form errors on add/edit listing pages
    if (req.path === "/cars" && req.method === "POST") {
        return res.status(statusCode).render("listings/new.ejs", {
            listing: (err.viewData && err.viewData.listing) || emptyListing,
            errorMsg,
        });
    }

    if (req.path.match(/^\/cars\/[^/]+$/) && req.method === "PUT") {
        return res.status(statusCode).render("listings/edit.ejs", {
            listing: {
                ...(err.viewData && err.viewData.listing ? err.viewData.listing : emptyListing),
                _id: req.params.id,
            },
            errorMsg,
        });
    }

    return res.status(statusCode).render("error.ejs", { statusCode, errorMsg });
});

// Socket.IO setup
const server = http.createServer(app);
const io = new Server(server);

// Make io accessible to routes
app.set('io', io);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join user's personal room
    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their room`);
    });

    // Leave user's personal room
    socket.on('leave', (userId) => {
        socket.leave(userId);
        console.log(`User ${userId} left their room`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start the background booking expiry job
const { startBookingExpiryJob } = require('./utils/bookingExpiry');
startBookingExpiryJob(io);

const PORT = process.env.PORT || 8081;

async function startLocalAIService() {
    if (process.env.NODE_ENV === "production") {
        return;
    }

    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
    const autoStartAI = process.env.AI_AUTOSTART !== "false";

    if (!autoStartAI || !/^https?:\/\/(localhost|127\.0\.0\.1):8000\/?$/.test(aiServiceUrl)) {
        return;
    }

    try {
        const response = await fetch(`${aiServiceUrl}/health`, {
            signal: AbortSignal.timeout(1000),
        });
        if (response.ok) {
            console.log("AI service is already running.");
            return;
        }
    } catch (err) {
        // Start the bundled service when the local health check is unavailable.
    }

    const pythonExecutable = process.platform === "win32"
        ? path.join(__dirname, "ai-agent", "venv", "Scripts", "python.exe")
        : path.join(__dirname, "ai-agent", "venv", "bin", "python");

    const aiAgentDirectory = path.join(__dirname, "ai-agent");
    const aiProcess = spawn(pythonExecutable, [
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
    ], {
        cwd: aiAgentDirectory,
        env: {
            ...process.env,
            PYTHONPATH: aiAgentDirectory,
        },
        stdio: "inherit",
        windowsHide: true,
    });

    aiProcess.once("error", (error) => {
        console.error(`Unable to start the AI service: ${error.message}`);
    });
    aiProcess.once("spawn", () => {
        console.log("AI service is starting on port 8000.");
    });
    aiProcess.once("exit", (code, signal) => {
        if (code !== 0 && signal !== "SIGTERM") {
            console.error(`AI service stopped unexpectedly (code ${code}, signal ${signal || "none"}).`);
        }
    });

    const stopAIService = () => {
        if (!aiProcess.killed) aiProcess.kill();
    };
    process.once("SIGINT", stopAIService);
    process.once("SIGTERM", stopAIService);
}

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Kill existing process with:`);
        console.error(`  taskkill /PID $(netstat -ano | findstr :${PORT} | findstr LISTENING | awk '{print $5}') /F`);
        process.exit(1);
    }
});
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startLocalAIService();
});

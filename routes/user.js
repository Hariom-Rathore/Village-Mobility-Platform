const express = require("express");
const router = express.Router();
const passport = require("passport");
const { saveRedirectUrl, isLoggedIn } = require("../utils/middleware.js");
const users = require("../controllers/user.js");

router
   .route("/signup")
   .get(users.renderSignup)
   .post(users.signup);

router
   .route("/login")
   .get(users.renderLogin)
   .post(

      saveRedirectUrl,
      passport.authenticate("local", {
         failureRedirect: "/users/login",
         failureFlash: true,
      }),
      users.loginRedirect
   );

//this is for logedout and its pr
router.get("/logout", users.logout);

// Profile page
router.get("/profile", isLoggedIn, (req, res) => {
    res.render("users/profile");
});

// Profile update
const multer = require('multer');
const { storage } = require("../cloudconfig.js");
const profileUpload = multer({ storage });
router.post("/profile", isLoggedIn, profileUpload.single("profilePhoto"), users.updateProfile);

module.exports = router;
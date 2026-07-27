const User = require("../models/user.js");
const ExpressError = require("../utils/ExpressError.js");

// Render signup form
module.exports.renderSignup = (req, res) => {
  res.render("users/signup.ejs");
};

// Sign up user
module.exports.signup = async (req, res, next) => {
  try {
    let { username, email, password, role } = req.body;
    const newUser = new User({ email, username, role: role || "customer" });
    const registeredUser = await User.register(newUser, password);

    req.login(registeredUser, (err) => {
      if (err) return next(err);
      req.flash("success", "User registered Successfully!");
      if (registeredUser.role === "owner") {
        res.redirect("/owners/dashboard");
      } else {
        res.redirect("/customers/home");
      }
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/users/signup");
  }
};

// Render login form
module.exports.renderLogin = (req, res) => {
  res.render("users/login.ejs");
};

// Login redirect
module.exports.loginRedirect = (req, res) => {
  req.flash("success", `Welcome back ${req.user.username}!`);
  let redirectUrl = res.locals.redirectUrl || (req.user.role === "owner" ? "/owners/dashboard" : "/customers/home");
  res.redirect(redirectUrl);
};

// Logout
module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "You are logged out!");
    res.redirect("/");
  });
};

// Profile update
module.exports.updateProfile = async (req, res) => {
  try {
    const { phoneNumber, address } = req.body;
    const updateData = {};
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (address !== undefined) updateData.address = address;
    if (req.file) {
      updateData.profilePhoto = {
        url: req.file.path,
        filename: req.file.filename
      };
    }
    await User.findByIdAndUpdate(req.user._id, updateData);
    req.flash("success", "Profile updated successfully!");
    res.redirect("/users/profile");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/users/profile");
  }
};

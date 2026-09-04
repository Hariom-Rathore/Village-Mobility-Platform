const User = require("../models/user.js");
const ExpressError = require("../utils/ExpressError.js");

// Render signup form
module.exports.renderSignup = (req, res) => {
  res.render("users/signup.ejs");
};

// Sign up user
module.exports.signup = async (req, res, next) => {
  try {
    let { username, email, password } = req.body;
    const newUser = new User({ email, username });
    const registeredUser = await User.register(newUser, password);

    req.login(registeredUser, (err) => {
      if (err) return next(err);
      req.flash("success", "User registered Successfully!");
      res.redirect("/cars");
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
  let redirectUrl = res.locals.redirectUrl || "/cars";
  res.redirect(redirectUrl);
};

// Logout
module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "You are logged out!");
    res.redirect("/cars");
  });
};

const express = require("express")
const app = express()
const path = require("path")
const ejsMate = require("ejs-mate")
const mongoose = require("mongoose")
const mongo_url = "mongodb://127.0.0.1:27017/IITR"
const flash = require("connect-flash")

const ExpressError = require("./utils/ExpressError.js")
const session = require("express-session")
const passport = require("passport")
const localStrategy = require("passport-local")
const User=require("./models/user.js")
const Job=require("./models/job.js")
const Checkpoint = require('./models/checkpoint.js');
const wrapAsync = require("./utils/wrapAsync.js")
main()
    .then(() => {
        console.log("connected to db")
    })
    .catch((err) => {
        console.log(err)
    })

async function main() {
    await mongoose.connect(mongo_url)
}

app.listen(8080, () => {
    console.log("server is listning on port 8080")
})

app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, "/public")))
app.engine("ejs", ejsMate)

const sessionOptions = {
    
    secret:"mysupersecretcode",
    resave: false,
    saveUninitialized: true

}

app.use(session(sessionOptions));
app.use(flash())


app.use(passport.initialize())
app.use(passport.session())
passport.use(new localStrategy(User.authenticate()))
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use((req, res, next) => {
    res.locals.error = req.flash("error")
    res.locals.sucess = req.flash("sucess")
    res.locals.currUser = req.user;
    next()
})

app.get("/", wrapAsync(async(req, res) => {
    const jobs = await Job.find({}) .populate('postedBy', 'username') // Populate the poster's username
    .sort({ createdAt: -1 });
    res.render("listings/index.ejs", { jobs });
}));

app.get("/payment", (req, res) => {
    res.render("listings/payment.ejs")
})

app.get("/admin", (req, res) => {

    res.render("listings/admin.ejs")
})


app.post("/signup", wrapAsync(async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        
        // Create user using passport-local-mongoose's register method
        const registeredUser = await User.register(
            { username, email }, // Plain object, not User instance
            password
        );

        console.log("Registered user:", registeredUser); // Add this for debugging
        
        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Welcome to GreenApp!");
            res.redirect("/");
        });
    } catch (e) {
        console.error("Registration error:", e);
        req.flash("error", e.message);
        res.redirect("/");
    }
}));



app.post("/login", 
    passport.authenticate("local", { 
      failureRedirect: '/login',
      failureFlash: true,
      successRedirect: '/',
      successFlash: "Welcome back!"
    })
  );

  app.post("/logout", (req, res, next) => {
    req.logOut((err) => {
        if (err) {
            return next(err)
        }
        req.flash("sucess", "Logout sucessfull")
        res.redirect("/")
    })
})  
app.all("*", (req, res, next) => {
    next(new ExpressError(404, "page not found"))
})
app.use((err, req, res, next) => {
    let { statusCode = 500, message = "something went wrong" } = err
    // res.status(statusCode).send(message)
    res.render("listings/error.ejs", { statusCode, message })
})

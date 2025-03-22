const express = require("express")
const app = express()
const path = require("path")
const ejsMate = require("ejs-mate")
const mongoose = require("mongoose")
const mongo_url = "mongodb://127.0.0.1:27017/IITR"
const flash = require("connect-flash")
const session = require("express-session")
const passport = require("passport")
const localStrategy = require("passport-local")
const User=require("./models/user.js")
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

app.get("/", (req, res) => {

    res.render("listings/index.ejs")
})

app.get("/payment", (req, res) => {

    res.render("listings/payment.ejs")
})

app.get("/admin", (req, res) => {

    res.render("listings/admin.ejs")
})

app.post("/signup", wrapAsync(async (req, res) => {
        console.log(req.body)
        try {
            let { username, email, password } = req.body
            const newuser = new User({ email, username })
            const registereduser = await User.register(newuser, password)

            req.login(registereduser, (err) => {
                if (err) {
                    
                    return next()
                }
                req.flash("sucess", "welcome to freelancer")
                res.redirect("/")
            })
        }
        catch (e) {
            console.log(e)
            req.flash("error", e.message)
            res.redirect("/")
        }
}))
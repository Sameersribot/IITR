const express = require("express")
const app = express()
const path = require("path")
const ejsMate = require("ejs-mate")
const mongoose = require("mongoose")
const mongo_url = "mongodb+srv://admin:lGLO2T8SYL57vJFL@cluster0.yj83q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster"
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

app.post('/jobs', wrapAsync(async (req, res) => {
    try {
        const { title, description, category, budget, deadline, experienceLevel } = req.body;
        
        const newJob = new Job({
            title,
            description,
            category,
            budget: parseFloat(budget),
            deadline: new Date(deadline),
            experienceLevel,
            postedBy: req.user._id
        });

        await newJob.save();
        
        req.flash('success', 'Job posted successfully!');
        res.redirect('/');
    } catch (error) {
        req.flash('error', error.message);
        res.redirect('/postjob');
    }
}));

app.get("/checkpoint/:id",isLoggedin, async (req, res) => {
    const job = await Job.findById(req.params.id)
        .populate('postedBy', 'username email createdAt')
        .populate('checkpoints'); // Add this population

    if (!job) {
        req.flash('error', 'Job not found');
        return res.redirect('/');
    }
    
    // Get available checkpoints (optional)
    const availableCheckpoints = await Checkpoint.find({
        jobId: req.params.id,
        _id: { $nin: job.checkpoints.map(cp => cp._id) }
    });
    
    res.render("listings/checkpoint.ejs", {
        job,
        availableCheckpoints
    });
});
// Add these routes after your existing checkpoints routes

// Edit Checkpoint Route (GET - For fetching checkpoint data)
app.get("/checkpoints/:id", wrapAsync(async (req, res) => {
    const checkpoint = await Checkpoint.findById(req.params.id);
    res.json(checkpoint);
}));

// Update Checkpoint Route (PUT)
app.put("/checkpoints/:id", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { name, type, description, price, commitDependencies = [], jobId } = req.body;
    
    const updatedCheckpoint = await Checkpoint.findByIdAndUpdate(id, {
        name,
        type,
        description,
        price: parseFloat(price),
        commitDependencies: Array.isArray(commitDependencies) ? commitDependencies : [commitDependencies]
    }, { new: true });

    req.flash('success', 'Checkpoint updated successfully!');
    res.redirect(`/checkpoint/${jobId}`);
}));

// Delete Checkpoint Route (DELETE)
// Improved Delete Route
app.delete("/checkpoints/:id", wrapAsync(async (req, res) => {
    try {
        const { id } = req.params;
        const checkpoint = await Checkpoint.findByIdAndDelete(id);
        
        if (!checkpoint) {
            return res.status(404).json({ message: 'Checkpoint not found' });
        }

        await Job.findByIdAndUpdate(checkpoint.jobId, {
            $pull: { checkpoints: id }
        });

        res.status(200).json({ 
            message: 'Checkpoint deleted successfully',
            deletedId: id
        });
        
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ 
            message: 'Server error during deletion',
            error: error.message 
        });
    }
}));
app.post("/jobs/:id/refresh-checkpoints", wrapAsync(async (req, res) => {
    const job = await Job.findById(req.params.id).populate('checkpoints');
    res.json(job.checkpoints);
}));
app.post("/submitcheckpoints", wrapAsync(async (req, res) => {
    const { name, type, description, price, jobId } = req.body;
    const commitDependencies = Array.isArray(req.body.commitDependencies) 
        ? req.body.commitDependencies 
        : [req.body.commitDependencies];

    // Validation
    if (!name || !type || !price || !jobId) {
        throw new ExpressError(400, 'Missing required fields');
    }

    const newCheckpoint = new Checkpoint({
        name,
        type,
        description,
        price: parseFloat(price),
        commitDependencies: commitDependencies.filter(Boolean),
        jobId
    });

    const job = await Job.findById(jobId);
    if (newCheckpoint.price > job.budget) {
        throw new ExpressError(400, `Price exceeds job budget of $${job.budget}`);
    }

    await newCheckpoint.save();
    await Job.findByIdAndUpdate(jobId, { $push: { checkpoints: newCheckpoint._id } });

    req.flash('success', 'Checkpoint created successfully!');
    res.redirect(`/checkpoint/${jobId}`);
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

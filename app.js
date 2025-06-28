const express = require("express")
const path = require("path")
const ejsMate = require("ejs-mate")
const mongoose = require("mongoose")
const mongo_url = "mongodb+srv://admin:lGLO2T8SYL57vJFL@cluster0.yj83q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster"
const session = require("express-session")
const MongoStore = require('connect-mongo');
const flash = require("connect-flash")
const { isLoggedin } = require("./middleware.js")
const ExpressError = require("./utils/ExpressError.js")
const passport = require("passport")
const localStrategy = require("passport-local")
const User=require("./models/user.js")
const Job=require("./models/job.js")
const Checkpoint = require('./models/checkpoint.js');
const wrapAsync = require("./utils/wrapAsync.js")
const app = express()
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

const store = MongoStore.create({
  mongoUrl: mongo_url,
  collectionName: 'sessions',
  crypto: {
    secret: "mysupersecretcode"
  },
  touchAfter: 24 * 3600
});
store.on("err",()=>{
    console.log("some error occured")
})

const sessionOptions = {
  store,
  
  secret: "mysupersecretcode",
  resave: false,
  saveUninitialized: false, 
  
};

app.use(session(sessionOptions))


app.use(passport.initialize())
app.use(passport.session())
app.use(flash())

passport.use(new localStrategy(User.authenticate()))
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use((req, res, next) => {
    res.locals.success = req.flash("success")
    res.locals.error = req.flash("error")
    res.locals.currUser = req.user;
    next()
})

app.get("/", wrapAsync(async(req, res) => {
    const jobs = await Job.find({}) .populate('postedBy', 'username') 
    .sort({ createdAt: -1 });
    
    res.render("listings/index.ejs", { jobs });
}));



app.get("/payment/:id", async(req, res) => {
    try {
        const jobId = req.params.id;
        
        // Fetch checkpoints for this specific job ID
        const checkpoints = await Checkpoint.find({ jobId: jobId })
            .populate('dependencies')
            .populate('jobId');
            
        res.render("listings/payment.ejs", { checkpoints });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
})
app.get("/postedjob", async (req, res) => {
    const jobs = await Job.find({}) .populate('postedBy', 'username') 
    .sort({ createdAt: -1 });
    
    res.render("listings/posted.ejs", { jobs });
});
app.get("/postjob", isLoggedin, (req, res) => {
    const user=req.user.username
    console.log(user)
    res.render("listings/admin.ejs",{user});
});

// View Single Job Route
app.get("/jobs/:id", wrapAsync(async (req, res) => {
    const job = await Job.findById(req.params.id)
        .populate('postedBy', 'username email createdAt');
    const checkpoints = await Checkpoint.find()
    .populate('dependencies')
    .populate('jobId');
    if (!job) {
        req.flash('error', 'Job not found');
        return res.redirect('/');
    }
    
    res.render("listings/view.ejs", { job,checkpoints });
}));

app.post('/checkpoints',  async (req, res) => {
    try {
      const checkpoint = new Checkpoint(req.body);
      await checkpoint.save();
      res.status(201).send(checkpoint);
    } catch (error) {
      res.status(400).send(error);
    }
  });
app.post("/signup", wrapAsync(async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        
        
        const registeredUser = await User.register(
            { username, email }, 
            password
        );

        
        
        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Welcome to workly!");
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
        .populate('checkpoints'); 

    if (!job) {
        req.flash('error', 'Job not found');
        return res.redirect('/');
    }
    
   
    const availableCheckpoints = await Checkpoint.find({
        jobId: req.params.id,
        _id: { $nin: job.checkpoints.map(cp => cp._id) }
    });
    
    res.render("listings/checkpoint.ejs", {
        job,
        availableCheckpoints
    });
});


app.get("/checkpoints/:id", wrapAsync(async (req, res) => {
    const checkpoint = await Checkpoint.findById(req.params.id);
    res.json(checkpoint);
}));


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
    
    const { name, type, description, price, jobId, giturl } = req.body;
    
   
    if (!giturl || !giturl.match(/https:\/\/github.com\/.*\/commit\/[a-f0-9]{40}/)) {
        throw new ExpressError(400, 'Valid GitHub commit URL is required');
    }

  
    const commitDependencies = Array.isArray(req.body.commitDependencies) 
        ? req.body.commitDependencies 
        : [req.body.commitDependencies];

    const newCheckpoint = new Checkpoint({
        name,
        type,
        description,
        price: parseFloat(price),
        giturl, 
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
app.post("/login", passport.authenticate("local", { 
  failureRedirect: '/',
  successRedirect: '/',
  failureFlash: 'Invalid credentials', 
  successFlash: 'Welcome to workly!'   
}));

app.post("/logout", (req, res, next) => {
    req.logOut((err) => {
        if (err) {
            return next(err)
        }
        req.flash("success", "Logout sucessfull")
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

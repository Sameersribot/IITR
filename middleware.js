

module.exports.isLoggedin=(req,res,next)=>{
    
    if(!req.isAuthenticated()){
        req.session.redirectUrl=req.originalUrl
        req.flash("error","you need to be logged in to EnroL")
        return res.redirect("/")
    }
    next()
}
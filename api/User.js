const express = require('express')
const router = express.Router();

// mongoDB userSchema
const User = require('../models/UserSchema');

// mongoDB userVerificationSchema
const UserVerification = require('../models/UserVerification');

// email handler
const nodemailer = require('nodemailer');

// unique string
const { v4: uuidv4 } = require('uuid');

// env variables
require('dotenv').config();

// password handler
const bcrypt = require('bcryptjs');

// path for static verified page
const path = require("path");

// nodemailer 
let transporter = nodemailer.createTransport({
    service: 'gmail',
    secure: true,
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASS
    }
})

// trasporter testing
transporter.verify((error, success) => {
    if(error) {
        console.log("False:", error);
    } else {
        console.log("Ready for Msessages");
        console.log("success:", success);
    }
})


//Signup api
router.post("/signup", (req, res) => {
    let { name, email, password, dateOfBirth } = req.body;

    // validation
    if(name == "" || email == "" || password == "" || dateOfBirth == "") {
        return res.status(403).json({ message: "Cannot be Empty" })
    } 
    // else if(!/^[a-zA-z]*$/.test(name)) {
    //     return res.status(403).json({ message: "Invalid Name" })
    // } else if(!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    //     return res.status(403).json({ message: "Invalid Email" })
    // } else if(!new Date(dateOfBirth).getTime()) {
    //     return res.status(403).json({ message: "Invalid DOB" })
    // } else if(password.length < 8) {
    //     return res.status(403).json({ message: "Password length should be atleast 8 characters" })
    // } 
    else {
        // checking if user already exists
        User.find({ email })
            .then((result) => {
                if(result.length) {
                    // user already exists
                    return res.status(403).json({ message: "User Already Exists" })
                } else {
                    // try to create new user

                    //password hashing
                    const saltRounds = 10;
                    bcrypt
                        .hash(password, saltRounds)
                        .then((hashedPassword) => {
                            // creating new user
                            const newUser = new User({
                                name,
                                email,
                                password: hashedPassword,
                                dateOfBirth,
                                verified: false
                            });

                            newUser
                                .save()
                                .then((result) => {
                                    // return res.status(200).json({ 
                                    //     message: "Signup Successful",
                                    //     data: result
                                    // })
                                    sendVerificationEmail(result, res);
                                })
                                .catch((err) => {
                                    return res.status(403).json({ message: "An error occured while saving user account!" })
                                })
                        })
                        .catch((err) => {
                            return res.status(403).json({ message: "An error ocuured while hashing password!" })
                        })
                }
            })
            .catch((err) => {
                console.log(err);
                res.status(403).json({ message: "An error occured while checking for existing user!" })
            })
    }
});


// send verification email
// destructuring id & email in place of req
// _id is MONGODB id of users
const sendVerificationEmail = ({ _id, email }, res) => {
    // url to be used in the email
    const currentUrl = 'http://localhost:8000/';

    // combine user id with uuid
    const uniqueString = uuidv4() + _id;

    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to : email,
        subject: "verify Your Email",
        html: 
        `   <p>Verify you email address to  complete the signup and login to your account</p>
            <p>This links expires in <b>6 hours</b></p>
            <p>Click <a href=${currentUrl + 'user/verify/' + _id + "/" + uniqueString}>here</a> to proceed.</p>
        `
    };

    // hash the uniqueString
    const saltRounds = 10;
    bcrypt
        .hash(uniqueString, saltRounds)
        .then((hashedUniqueString) => {
            // set values in userVerification collection
            const newVerification = new UserVerification({
                userId: _id,
                uniqueString: hashedUniqueString,
                createdAt: Date.now(),
                expiresAt: Date.now() + 21600000
            });

            newVerification
                .save()
                .then(() => {
                    transporter
                        .sendMail(mailOptions)
                        .then(() => {
                            // email sent and verification record saved 
                            return res.status(200).json({ message: "Verification email sent" })
                        })
                        .catch((err) => {
                            console.log(err);
                            return res.status(403).json({ message: "Verification email failed" })
                        })
                })
                .catch((err) => {
                    console.log(err);
                    return res.status(403).json({ message: "Couldn't save verification email data!" })
                })
        })
        .catch(() => {
            return res.status(403).json({ message: "An error occured while hashing email data!" })
        })
}

// verify email
router.get("/verify/:userId/:uniqueString", (req, res) => {
    let { userId, uniqueString } = req.params;

    UserVerification
        .find({ userId })
        .then((result) => {
            if(result.length > 0) {
                // user verification record exists so we proceed
                const { expiresAt } = result[0];
                const hashedUniqueString = result[0].uniqueString;

                // checking for expired unique string
                if(expiresAt < Date.now()) {
                    // record has expired so we delete it
                    UserVerification
                        .deleteOne({ userId })
                        .then(result => {
                            // when user verification done, delete the record
                            User
                                .deleteOne({ _id: userId })
                                .then(() => {
                                    let message = "Link has expired. Please sign up again!";
                                    res.redirect(`/user/verified/error=true&message=${message}`)
                                })
                                .catch((error => {
                                    let message = "Clearing user with expired unique string failed!";
                                    res.redirect(`/user/verified/error=true&message=${message}`)
                                }))
                        })
                        .catch((error) => {
                            console.log(error);
                            let message = "An error occured while clearing expired user verification record!";
                            res.redirect(`/user/verified/error=true&message=${message}`)
                        })
                } else {
                    // valid record exists so we validate the user string
                    // First compare the hashed unique string
                    bcrypt
                        .compare(uniqueString, hashedUniqueString)
                        .then(result => {
                            if(result) {
                                // strings match
                                User
                                    .updateOne({ _id: userId }, { verified: true })
                                    .then(() => {
                                        UserVerification
                                        .deleteOne({ userId })
                                        .then(() => {
                                            res.sendFile(path.join(__dirname, "./../views/verified.html"))
                                        })
                                        .catch((error) => {
                                            console.log(error);
                                            let message = "An error occured while finalizing successful verification!";
                                            res.redirect(`/user/verified/error=true&message=${message}`)
                                        })
                                    })
                                    .catch((error) => {
                                        console.log(error);
                                        let message = "An error occured while updating user record to show verified!";
                                        res.redirect(`/user/verified/error=true&message=${message}`)
                                    })

                            } else {
                                // existing record but incorrect verification details passed
                                let message = "Invalid verification details passed! Check your inbox.";
                                res.redirect(`/user/verified/error=true&message=${message}`)
                            }
                        })
                        .catch((error) => {
                            let message = "An error occured while comparing unique strings!";
                            res.redirect(`/user/verified/error=true&message=${message}`)
                        })
                }

            } else {
                // user verification record doesn't exist
                let message = "Account record doesn't exist or has been verified already. Please sign up or log in!";
                res.redirect(`/user/verified/error=true&message=${message}`)
            }
        })
        .catch((error) => {
            console.log(error);
            let message = "An error occured while checking for existing user verification record!";
            res.redirect(`/user/verified/error=true&message=${message}`)
        })
})

// verified page route
router.get("/verified", (req, res) => {
    res.sendFile(path.join(__dirname, "./../views/verified.html"));
})

// signin api
router.post("/signin", (req, res) => {
    let { email, password } = req.body;

    // if(email == "" || password == "") {
    //     return res.status(403).json({ message: "Cannot be Empty" })
    // } else {
        // check if user exist
        User.find({ email })
            .then((data) => {
                if(data.length) {
                    //user exists

                    // check if user is verified
                    if(!data[0].verified) {
                        return res.status(403).json({ message: "Email hasn't been verified yet! Check your inbox to verify" })
                    } else {
                        const hashedPassword = data[0].password;
                        bcrypt
                            .compare(password, hashedPassword)
                            .then((result) => {
                                if(result) {
                                    // password match
                                    return res.status(200).json({ 
                                        message: "Signin Successful",
                                        data: data
                                    })
                                } else {
                                    return res.status(403).json({ message: "Invalid password!" })
                                }
                            })
                            .catch((error) => {
                                return res.status(403).json({ message: "An error occured while comparing password! " })
                            })
                    }
                    
                } else {
                    return res.status(403).json({ message: "Invalid Credentials!" })
                }
            })
            .catch(((err) => {
                console.log(err);
                return res.status(403).json({ message: "An error occured while checking for existing user!" })
            }))
    // }

})


module.exports = router;
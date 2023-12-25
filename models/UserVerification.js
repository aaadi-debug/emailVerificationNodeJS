const mongoose = require('mongoose')
const Schema = mongoose.Schema;

const UserVerificationSchema = new Schema({
    userId: {        //automatically generated ID of user
        type: String,
        required: true
    },
    uniqueString: {  //random string for particular user
        type: String,
        required: true
    },
    createdAt: {     //time
        type: Date,
        required: true
    },
    expiresAt: {     //time
        type: Date,
        required: true
    }
})

const UserVerification = mongoose.model("UserVerification", UserVerificationSchema);
module.exports = UserVerification;
const mongoose = require('mongoose')
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, {
    useNewUrlParser : true,
}).then(() => {
    console.log(`Database is Connected...`)
}).catch((err) => {
    console.log(`Database not Connected!`, err)
})

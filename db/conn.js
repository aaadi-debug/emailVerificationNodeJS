const mongoose = require('mongoose')

mongoose.connect('mongodb+srv://admin:d9uIFcDuK2dg0qpJ@cluster0.3zyabef.mongodb.net/EmailVerification?retryWrites=true&w=majority', {
    useNewUrlParser : true,
}).then(() => {
    console.log(`Database is Connected...`)
}).catch((err) => {
    console.log(`Database not Connected!`, err)
})

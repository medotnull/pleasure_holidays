const express = require('express');

// instance of express app
const app = express(); 

// Import routes
const authRoutes = require('./routes/auth');
//const packageRoutes = require('./routes/packages');
//const bookingRoutes = require('./routes/bookings');

// middlewares
app.use(express.json());

app.listen(3000, ()=> {
    console.log("Server is running at port 3000")
})

module.exports = app;
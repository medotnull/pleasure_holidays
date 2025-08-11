require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./db');

//Importing middlewares
const { authenticate, adminOnly } = require('./middlewares/auth');
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const {
  apiLimiter,
  authLimiter,
  paymentLimiter,
  adminLimiter,
  uploadLimiter
} = require('./middlewares/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const packageRoutes = require('./routes/packages');
const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const TransportOption = require('./routes/transport_option');



// instance of express app
const app = express(); 

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
app.use('/api/', apiLimiter);

app.listen(3000, ()=> {
    console.log("Server is running at port 3000")
})

// Error handling



module.exports = app;
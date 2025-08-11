require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Connect to MongoDB and register models
 */
const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI ;

  try {
    mongoose.set('strictQuery', true);

    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ MongoDB connected');

    // Optionally preload models so they are registered once on startup
    // Only require models that exist to avoid runtime errors
    try { require('./models/User'); } catch (_) {}
    try { require('./models/Package'); } catch (_) {}
    try { require('./models/Booking'); } catch (_) {}
    try { require('./models/Review'); } catch (_) {}
    try { require('./models/TransportOption'); } catch (_) {}

  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
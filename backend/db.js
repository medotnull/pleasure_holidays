const mongoose = require("mongoose");

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const userSchema = new Schema({
    _id: ObjectId,
    name: String,
    email: String,
    password: String (hashed),
    role: String, // 'customer' | 'agent' | 'admin'
    contact: {
      phone: String,
      address: String
    },
    preferences: Object,
    bookings: [ObjectId], // references Booking
    createdAt: Date,
    updatedAt: Date,
    isActive: Boolean
  })

const packageSchema = new Schema({
    _id: ObjectId,
    name: String,
    description: String,
    destinations: [String],
    images: [String],
    pricing: [{
      type: String, // 'hotel' | 'flight' | 'train'
      rate: Number,
      currency: String
    }],
    inventory: Number,
    customizableOptions: Object,
    reviews: [ObjectId], // references Review
    createdBy: ObjectId, // references User (admin/agent)
    createdAt: Date,
    updatedAt: Date
  })

  const bookingSchema = new Schema({
    _id: ObjectId,
    user: ObjectId, // references User
    agent: ObjectId, // references User (optional)
    package: ObjectId, // references Package
    status: String, // 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed'
    travelDates: {
      start: Date,
      end: Date
    },
    payment: {
      status: String, // 'pending' | 'paid' | 'failed'
      razorpayOrderId: String,
      razorpayPaymentId: String,
      amount: Number,
      currency: String
    },
    createdAt: Date,
    updatedAt: Date
  })

  const reviewSchema = new Schema({
    _id: ObjectId,
    user: ObjectId, // references User
    package: ObjectId, // references Package
    rating: Number,
    comment: String,
    createdAt: Date
  })

  module.exports = {
    userSchema,
    packageSchema,
    bookingSchema,
    reviewSchema
  }
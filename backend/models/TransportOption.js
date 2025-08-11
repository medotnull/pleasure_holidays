const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  departureDate: { type: Date, required: true },
  arrivalDate: { type: Date },
  availableSeats: { type: Number, min: 0, default: 0 },
  totalSeats: { type: Number, min: 0, default: 0 },
  durationMinutes: { type: Number, min: 0 },
  price: { type: Number, min: 0 },
  currency: { type: String, default: 'INR', enum: ['INR', 'USD', 'EUR', 'GBP'] },
});

const routeSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  distanceKm: { type: Number, min: 0 },
  durationMinutes: { type: Number, min: 0 },
});

const pricingSchema = new mongoose.Schema({
  basePrice: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR', enum: ['INR', 'USD', 'EUR', 'GBP'] },
  classPricing: [{
    name: { type: String }, // e.g. economy, business
    multiplier: { type: Number, min: 0.5, max: 5, default: 1 }
  }],
});

const transportOptionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, required: true, enum: ['flight', 'train', 'bus', 'car', 'boat', 'other'] },
  description: { type: String },

  routes: [routeSchema],
  schedules: [scheduleSchema],
  pricing: pricingSchema,

  amenities: [{ type: String }],
  policies: [{ type: String }],
  images: [{ url: { type: String, required: true }, caption: String }],

  isActive: { type: Boolean, default: true },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

transportOptionSchema.index({ type: 1, isActive: 1 });
transportOptionSchema.index({ 'routes.from': 1, 'routes.to': 1 });
transportOptionSchema.index({ 'pricing.basePrice': 1 });

module.exports = mongoose.model('TransportOption', transportOptionSchema); 
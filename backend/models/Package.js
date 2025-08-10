const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Package name is required'],
    trim: true,
    maxlength: [100, 'Package name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Package description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [200, 'Short description cannot exceed 200 characters']
  },
  destination: {
    country: {
      type: String,
      required: [true, 'Country is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    region: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  duration: {
    days: {
      type: Number,
      required: [true, 'Duration in days is required'],
      min: [1, 'Duration must be at least 1 day']
    },
    nights: {
      type: Number,
      required: [true, 'Duration in nights is required'],
      min: [0, 'Nights cannot be negative']
    }
  },
  pricing: {
    basePrice: {
      type: Number,
      required: [true, 'Base price is required'],
      min: [0, 'Price cannot be negative']
    },
    discountedPrice: {
      type: Number,
      min: [0, 'Discounted price cannot be negative']
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR', 'GBP']
    },
    pricePerPerson: {
      type: Boolean,
      default: true
    },
    seasonalPricing: [{
      season: {
        type: String,
        enum: ['peak', 'shoulder', 'off-peak']
      },
      multiplier: {
        type: Number,
        min: 0.5,
        max: 3.0
      },
      startDate: Date,
      endDate: Date
    }]
  },
  inclusions: {
    accommodation: {
      type: String,
      enum: ['hotel', 'resort', 'guesthouse', 'homestay', 'camping'],
      required: true
    },
    meals: [{
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'all-inclusive']
    }],
    transportation: [{
      type: String,
      enum: ['flight', 'train', 'bus', 'car', 'boat', 'none']
    }],
    activities: [String],
    transfers: {
      type: Boolean,
      default: true
    },
    guide: {
      type: Boolean,
      default: false
    },
    insurance: {
      type: Boolean,
      default: false
    }
  },
  exclusions: [String],
  itinerary: [{
    day: {
      type: Number,
      required: true
    },
    title: String,
    description: String,
    activities: [String],
    meals: [String],
    accommodation: String
  }],
  images: [{
    url: {
      type: String,
      required: true
    },
    caption: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  category: {
    type: String,
    enum: ['adventure', 'cultural', 'beach', 'mountain', 'wildlife', 'luxury', 'budget', 'honeymoon', 'family'],
    required: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'moderate', 'challenging', 'expert'],
    default: 'easy'
  },
  groupSize: {
    min: {
      type: Number,
      default: 1,
      min: 1
    },
    max: {
      type: Number,
      default: 20,
      min: 1
    }
  },
  availability: {
    totalSlots: {
      type: Number,
      required: true,
      min: 1
    },
    bookedSlots: {
      type: Number,
      default: 0,
      min: 0
    },
    availableDates: [{
      startDate: Date,
      endDate: Date,
      availableSlots: Number
    }],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  tags: [String],
  highlights: [String],
  terms: [String],
  cancellationPolicy: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
packageSchema.index({ 'destination.country': 1, 'destination.city': 1 });
packageSchema.index({ category: 1 });
packageSchema.index({ 'pricing.basePrice': 1 });
packageSchema.index({ isApproved: 1, isActive: 1 });
packageSchema.index({ tags: 1 });

// Virtual for available slots
packageSchema.virtual('availableSlots').get(function() {
  return this.availability.totalSlots - this.availability.bookedSlots;
});

// Virtual for price after discount
packageSchema.virtual('currentPrice').get(function() {
  return this.pricing.discountedPrice || this.pricing.basePrice;
});

// Method to check if package is available
packageSchema.methods.isAvailable = function() {
  return this.availability.isActive && 
         this.isApproved && 
         this.availability.bookedSlots < this.availability.totalSlots;
};

// Method to update availability
packageSchema.methods.updateAvailability = function(bookedSlots) {
  this.availability.bookedSlots = bookedSlots;
  return this.save();
};

// Method to calculate seasonal price
packageSchema.methods.getSeasonalPrice = function(date) {
  const seasonalPricing = this.pricing.seasonalPricing.find(sp => 
    date >= sp.startDate && date <= sp.endDate
  );
  
  if (seasonalPricing) {
    return this.pricing.basePrice * seasonalPricing.multiplier;
  }
  
  return this.pricing.basePrice;
};

module.exports = mongoose.model('Package', packageSchema); 
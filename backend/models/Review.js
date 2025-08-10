const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: true,
    maxlength: [100, 'Review title cannot exceed 100 characters']
  },
  comment: {
    type: String,
    required: true,
    maxlength: [1000, 'Review comment cannot exceed 1000 characters']
  },
  categories: {
    service: {
      type: Number,
      min: 1,
      max: 5
    },
    value: {
      type: Number,
      min: 1,
      max: 5
    },
    cleanliness: {
      type: Number,
      min: 1,
      max: 5
    },
    location: {
      type: Number,
      min: 1,
      max: 5
    },
    food: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  images: [{
    url: String,
    caption: String
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  isApproved: {
    type: Boolean,
    default: true
  },
  helpful: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    helpful: {
      type: Boolean,
      required: true
    }
  }],
  reported: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['inappropriate', 'spam', 'fake', 'other']
    },
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }],
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
reviewSchema.index({ package: 1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ isApproved: 1 });
reviewSchema.index({ createdAt: -1 });

// Virtual for helpful count
reviewSchema.virtual('helpfulCount').get(function() {
  return this.helpful.filter(h => h.helpful).length;
});

// Virtual for unhelpful count
reviewSchema.virtual('unhelpfulCount').get(function() {
  return this.helpful.filter(h => !h.helpful).length;
});

// Method to add helpful vote
reviewSchema.methods.addHelpfulVote = function(userId, isHelpful) {
  const existingVote = this.helpful.find(h => h.user.toString() === userId.toString());
  
  if (existingVote) {
    existingVote.helpful = isHelpful;
  } else {
    this.helpful.push({ user: userId, helpful: isHelpful });
  }
  
  return this.save();
};

// Method to report review
reviewSchema.methods.reportReview = function(userId, reason) {
  const existingReport = this.reported.find(r => r.user.toString() === userId.toString());
  
  if (!existingReport) {
    this.reported.push({
      user: userId,
      reason,
      reportedAt: new Date()
    });
  }
  
  return this.save();
};

// Method to calculate average category rating
reviewSchema.methods.getAverageCategoryRating = function() {
  const categories = Object.values(this.categories).filter(rating => rating);
  if (categories.length === 0) return this.rating;
  
  return categories.reduce((sum, rating) => sum + rating, 0) / categories.length;
};

module.exports = mongoose.model('Review', reviewSchema); 
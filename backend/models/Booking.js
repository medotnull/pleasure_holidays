const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true
  },
  travelDetails: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    numberOfTravelers: {
      adults: {
        type: Number,
        required: true,
        min: 1
      },
      children: {
        type: Number,
        default: 0,
        min: 0
      },
      infants: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    specialRequests: String,
    dietaryRequirements: [String],
    accessibilityNeeds: [String]
  },
  pricing: {
    basePrice: {
      type: Number,
      required: true
    },
    discount: {
      type: Number,
      default: 0
    },
    taxes: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'INR'
    },
    pricePerPerson: {
      type: Boolean,
      default: true
    }
  },
  payment: {
    method: {
      type: String,
      enum: ['razorpay', 'card', 'bank_transfer', 'cash'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    transactionId: String,
    razorpayOrderId: String,
    razorpayPaymentId: String,
    paidAt: Date,
    refundAmount: {
      type: Number,
      default: 0
    },
    refundReason: String,
    refundedAt: Date
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'approved', 'rejected', 'cancelled', 'completed'],
    default: 'pending'
  },
  approval: {
    requestedAt: {
      type: Date,
      default: Date.now
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectedAt: Date,
    rejectionReason: String,
    notes: String
  },
  cancellation: {
    requestedAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancelledAt: Date,
    cancellationReason: String,
    refundPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  documents: [{
    type: {
      type: String,
      enum: ['passport', 'visa', 'id_proof', 'medical_certificate', 'insurance', 'other']
    },
    name: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  reviews: [{
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  notifications: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'push']
    },
    title: String,
    message: String,
    sentAt: {
      type: Date,
      default: Date.now
    },
    isRead: {
      type: Boolean,
      default: false
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
bookingSchema.index({ bookingId: 1 });
bookingSchema.index({ customer: 1 });
bookingSchema.index({ agent: 1 });
bookingSchema.index({ package: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ 'payment.status': 1 });
bookingSchema.index({ 'travelDetails.startDate': 1 });
bookingSchema.index({ createdAt: 1 });

// Generate unique booking ID
bookingSchema.pre('save', async function(next) {
  if (this.isNew && !this.bookingId) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.bookingId = `PH${year}${month}${day}${random}`;
  }
  next();
});

// Virtual for total travelers
bookingSchema.virtual('totalTravelers').get(function() {
  return this.travelDetails.numberOfTravelers.adults + 
         this.travelDetails.numberOfTravelers.children + 
         this.travelDetails.numberOfTravelers.infants;
});

// Virtual for booking status
bookingSchema.virtual('isConfirmed').get(function() {
  return this.status === 'confirmed' || this.status === 'approved';
});

// Virtual for payment status
bookingSchema.virtual('isPaid').get(function() {
  return this.payment.status === 'completed';
});

// Method to calculate total amount
bookingSchema.methods.calculateTotal = function() {
  const baseAmount = this.pricing.basePrice * this.totalTravelers;
  const discountAmount = (baseAmount * this.pricing.discount) / 100;
  const finalAmount = baseAmount - discountAmount + this.pricing.taxes;
  return finalAmount;
};

// Method to update payment status
bookingSchema.methods.updatePaymentStatus = function(status, transactionId = null) {
  this.payment.status = status;
  if (transactionId) {
    this.payment.transactionId = transactionId;
  }
  if (status === 'completed') {
    this.payment.paidAt = new Date();
  }
  return this.save();
};

// Method to approve booking
bookingSchema.methods.approve = function(adminId) {
  this.status = 'approved';
  this.approval.approvedBy = adminId;
  this.approval.approvedAt = new Date();
  return this.save();
};

// Method to reject booking
bookingSchema.methods.reject = function(adminId, reason) {
  this.status = 'rejected';
  this.approval.rejectedBy = adminId;
  this.approval.rejectedAt = new Date();
  this.approval.rejectionReason = reason;
  return this.save();
};

// Method to cancel booking
bookingSchema.methods.cancel = function(userId, reason) {
  this.status = 'cancelled';
  this.cancellation.requestedAt = new Date();
  this.cancellation.cancelledBy = userId;
  this.cancellation.cancelledAt = new Date();
  this.cancellation.cancellationReason = reason;
  return this.save();
};

// Method to add review
bookingSchema.methods.addReview = function(userId, rating, comment) {
  this.reviews.push({
    reviewer: userId,
    rating,
    comment
  });
  return this.save();
};

module.exports = mongoose.model('Booking', bookingSchema); 
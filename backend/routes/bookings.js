const express = require('express');
const Booking = require('../models/Booking');
const Package = require('../models/Package');
const { authenticate, customerOrAgentOrAdmin, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { paymentLimiter } = require('../middleware/rateLimiter');
const Razorpay = require('razorpay');

const router = express.Router();

//initialize Razorpay instance

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// @route   POST /api/bookings
// @desc    Create new booking
// @access  Private
router.post('/', authenticate, paymentLimiter, asyncHandler(async (req, res) => {
  const {
    packageId,
    travelDetails,
    specialRequests,
    dietaryRequirements,
    accessibilityNeeds
  } = req.body;

  // Validate package exists and is available
  const package = await Package.findById(packageId);
  if (!package) {
    return res.status(404).json({
      success: false,
      message: 'Package not found'
    });
  }

  if (!package.isAvailable()) {
    return res.status(400).json({
      success: false,
      message: 'Package is not available for booking'
    });
  }

  // Calculate pricing
  const totalTravelers = travelDetails.numberOfTravelers.adults + 
                        travelDetails.numberOfTravelers.children + 
                        travelDetails.numberOfTravelers.infants;
  
  const basePrice = package.pricing.basePrice * totalTravelers;
  const discount = 0; // Can be calculated based on user preferences or promotions
  const taxes = basePrice * 0.18; // 18% GST
  const totalAmount = basePrice - discount + taxes;

  // Create booking
  const booking = await Booking.create({
    customer: req.user._id,
    package: packageId,
    travelDetails: {
      ...travelDetails,
      specialRequests,
      dietaryRequirements,
      accessibilityNeeds
    },
    pricing: {
      basePrice,
      discount,
      taxes,
      totalAmount,
      currency: package.pricing.currency
    },
    payment: {
      method: 'razorpay'
    }
  });

  // Update package availability
  await package.updateAvailability(package.availability.bookedSlots + totalTravelers);

  res.status(201).json({
    success: true,
    message: 'Booking created successfully',
    data: {
      booking
    }
  });
}));

// @route   GET /api/bookings
// @desc    Get user bookings
// @access  Private
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  const query = {};
  
  // Filter by user role
  if (req.user.role === 'customer') {
    query.customer = req.user._id;
  } else if (req.user.role === 'agent') {
    query.agent = req.user._id;
  }

  if (status) {
    query.status = status;
  }

  const bookings = await Booking.find(query)
    .populate('package', 'name destination duration pricing images')
    .populate('customer', 'firstName lastName email phone')
    .populate('agent', 'firstName lastName email phone')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await Booking.countDocuments(query);

  res.json({
    success: true,
    data: {
      bookings,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalBookings: total
      }
    }
  });
}));

// @route   GET /api/bookings/:id
// @desc    Get single booking
// @access  Private
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('package')
    .populate('customer', 'firstName lastName email phone')
    .populate('agent', 'firstName lastName email phone')
    .populate('approval.approvedBy', 'firstName lastName')
    .populate('approval.rejectedBy', 'firstName lastName');

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Check if user can access this booking
  if (req.user.role === 'customer' && booking.customer.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  res.json({
    success: true,
    data: {
      booking
    }
  });
}));

// @route   POST /api/bookings/:id/payment/create-order
// @desc    Create Razorpay order for payment
// @access  Private
router.post('/:id/payment/create-order', authenticate, paymentLimiter, asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  if (booking.payment.status === 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Payment already completed'
    });
  }

  // Create Razorpay order
  const options = {
    amount: Math.round(booking.pricing.totalAmount * 100), // Convert to paise
    currency: booking.pricing.currency,
    receipt: booking.bookingId,
    notes: {
      bookingId: booking.bookingId,
      packageName: booking.package.name
    }
  };

  try {
    const order = await razorpay.orders.create(options);
    
    // Update booking with order ID
    booking.payment.razorpayOrderId = order.id;
    await booking.save();

    res.json({
      success: true,
      message: 'Payment order created successfully',
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order'
    });
  }
}));

// @route   POST /api/bookings/:id/payment/verify
// @desc    Verify Razorpay payment
// @access  Private
router.post('/:id/payment/verify', authenticate, paymentLimiter, asyncHandler(async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Verify payment signature
  const text = razorpay_order_id + '|' + razorpay_payment_id;
  const crypto = require('crypto');
  const signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(text)
    .digest('hex');

  if (signature !== razorpay_signature) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payment signature'
    });
  }

  // Update booking payment status
  booking.payment.status = 'completed';
  booking.payment.razorpayPaymentId = razorpay_payment_id;
  booking.payment.paidAt = new Date();
  booking.status = 'confirmed';
  await booking.save();

  res.json({
    success: true,
    message: 'Payment verified successfully',
    data: {
      booking
    }
  });
}));

// @route   POST /api/bookings/:id/approve
// @desc    Approve booking (Admin only)
// @access  Private
router.post('/:id/approve', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  if (booking.status === 'approved') {
    return res.status(400).json({
      success: false,
      message: 'Booking is already approved'
    });
  }

  await booking.approve(req.user._id);

  res.json({
    success: true,
    message: 'Booking approved successfully',
    data: {
      booking
    }
  });
}));

// @route   POST /api/bookings/:id/reject
// @desc    Reject booking (Admin only)
// @access  Private
router.post('/:id/reject', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  if (booking.status === 'rejected') {
    return res.status(400).json({
      success: false,
      message: 'Booking is already rejected'
    });
  }

  await booking.reject(req.user._id, reason);

  res.json({
    success: true,
    message: 'Booking rejected successfully',
    data: {
      booking
    }
  });
}));

// @route   POST /api/bookings/:id/cancel
// @desc    Cancel booking
// @access  Private
router.post('/:id/cancel', authenticate, asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  if (booking.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      message: 'Booking is already cancelled'
    });
  }

  // Check if user can cancel this booking
  if (req.user.role === 'customer' && booking.customer.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only cancel your own bookings'
    });
  }

  await booking.cancel(req.user._id, reason);

  res.json({
    success: true,
    message: 'Booking cancelled successfully',
    data: {
      booking
    }
  });
}));

// @route   GET /api/bookings/pending/approval
// @desc    Get pending bookings for approval (Admin only)
// @access  Private
router.get('/pending/approval', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const bookings = await Booking.find({ status: 'pending' })
    .populate('package', 'name destination')
    .populate('customer', 'firstName lastName email')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await Booking.countDocuments({ status: 'pending' });

  res.json({
    success: true,
    data: {
      bookings,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalBookings: total
      }
    }
  });
}));

// @route   POST /api/bookings/:id/review
// @desc    Add review to booking
// @access  Private
router.post('/:id/review', authenticate, asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Check if user can review this booking
  if (booking.customer.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only review your own bookings'
    });
  }

  if (booking.status !== 'completed') {
    return res.status(400).json({
      success: false,
      message: 'You can only review completed bookings'
    });
  }

  await booking.addReview(req.user._id, rating, comment);

  res.json({
    success: true,
    message: 'Review added successfully',
    data: {
      booking
    }
  });
}));

module.exports = router; 
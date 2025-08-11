const express = require('express');
const { authenticate, adminOnly } = require('../middlewares/auth');
const { asyncHandler } = require('../middlewares/errorHandler');
const { adminLimiter } = require('../middlewares/rateLimiter');
const User = require('../models/User');
const Package = require('../models/Package');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const TransportOption = require('../models/TransportOption');


const router = express.Router();

// Apply admin rate limiting to all admin routes
router.use(adminLimiter);

// ==================== USER MANAGEMENT ====================

// @route   GET /api/admin/users
// @desc    Get all users with pagination and filtering
// @access  Private/Admin
router.get('/users', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, search, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  if (role) query.role = role;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const users = await User.find(query)
    .select('-password')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort(sortOptions);

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        limit: parseInt(limit)
      }
    }
  });
}));

// @route   GET /api/admin/users/:id
// @desc    Get specific user details
// @access  Private/Admin
router.get('/users/:id', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    data: { user }
  });
}));

// @route   PUT /api/admin/users/:id
// @desc    Update user (admin can update role, status, etc.)
// @access  Private/Admin
router.put('/users/:id', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { role, isActive, isEmailVerified, firstName, lastName, phone, address } = req.body;

  const updateData = {};
  if (role !== undefined) updateData.role = role;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (isEmailVerified !== undefined) updateData.isEmailVerified = isEmailVerified;
  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  if (phone) updateData.phone = phone;
  if (address) updateData.address = address;

  const user = await User.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    message: 'User updated successfully',
    data: { user }
  });
}));

// @route   DELETE /api/admin/users/:id
// @desc    Deactivate user (soft delete)
// @access  Private/Admin
router.delete('/users/:id', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  ).select('-password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    message: 'User deactivated successfully',
    data: { user }
  });
}));

// ==================== PACKAGE MANAGEMENT (STANDARD PACKAGES) ====================

// @route   GET /api/admin/packages
// @desc    Get all packages with admin details
// @access  Private/Admin
router.get('/packages', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { destination: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const packages = await Package.find(query)
    .populate('createdBy', 'firstName lastName email')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort(sortOptions);

  const total = await Package.countDocuments(query);

  res.json({
    success: true,
    data: {
      packages,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalPackages: total,
        limit: parseInt(limit)
      }
    }
  });
}));

// @route   PUT /api/admin/packages/:id/status
// @desc    Update package status (approve/reject)
// @access  Private/Admin
router.put('/packages/:id/status', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body;

  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status. Must be pending, approved, or rejected'
    });
  }

  const package = await Package.findByIdAndUpdate(
    req.params.id,
    { 
      status,
      adminNotes,
      reviewedBy: req.user._id,
      reviewedAt: new Date()
    },
    { new: true, runValidators: true }
  ).populate('createdBy', 'firstName lastName email');

  if (!package) {
    return res.status(404).json({
      success: false,
      message: 'Package not found'
    });
  }

  res.json({
    success: true,
    message: `Package ${status} successfully`,
    data: { package }
  });
}));

// ==================== BOOKING MANAGEMENT ====================

// @route   GET /api/admin/bookings
// @desc    Get all bookings with admin details
// @access  Private/Admin
router.get('/bookings', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, search, dateFrom, dateTo, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { bookingId: { $regex: search, $options: 'i' } },
      { 'customer.firstName': { $regex: search, $options: 'i' } },
      { 'customer.lastName': { $regex: search, $options: 'i' } },
      { 'customer.email': { $regex: search, $options: 'i' } }
    ];
  }
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const bookings = await Booking.find(query)
    .populate('customer', 'firstName lastName email phone')
    .populate('package', 'name destination')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort(sortOptions);

  const total = await Booking.countDocuments(query);

  res.json({
    success: true,
    data: {
      bookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBookings: total,
        limit: parseInt(limit)
      }
    }
  });
}));

// @route   PUT /api/admin/bookings/:id/status
// @desc    Update booking status
// @access  Private/Admin
router.put('/bookings/:id/status', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body;

  if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status. Must be pending, confirmed, cancelled, or completed'
    });
  }

  const booking = await Booking.findByIdAndUpdate(
    req.params.id,
    { 
      status,
      adminNotes,
      updatedBy: req.user._id,
      updatedAt: new Date()
    },
    { new: true, runValidators: true }
  ).populate('customer', 'firstName lastName email phone')
   .populate('package', 'name destination');

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  res.json({
    success: true,
    message: `Booking ${status} successfully`,
    data: { booking }
  });
}));

// ==================== REVIEW MANAGEMENT ====================

// @route   GET /api/admin/reviews
// @desc    Get all reviews with admin details
// @access  Private/Admin
router.get('/reviews', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, rating, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  if (status) query.status = status;
  if (rating) query.rating = parseInt(rating);
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { comment: { $regex: search, $options: 'i' } }
    ];
  }

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const reviews = await Review.find(query)
    .populate('user', 'firstName lastName email')
    .populate('package', 'name destination')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort(sortOptions);

  const total = await Review.countDocuments(query);

  res.json({
    success: true,
    data: {
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalReviews: total,
        limit: parseInt(limit)
      }
    }
  });
}));

// @route   PUT /api/admin/reviews/:id/status
// @desc    Update review status (approve/reject)
// @access  Private/Admin
router.put('/reviews/:id/status', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body;

  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status. Must be pending, approved, or rejected'
    });
  }

  const review = await Review.findByIdAndUpdate(
    req.params.id,
    { 
      status,
      adminNotes,
      reviewedBy: req.user._id,
      reviewedAt: new Date()
    },
    { new: true, runValidators: true }
  ).populate('user', 'firstName lastName email')
   .populate('package', 'name destination');

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found'
    });
  }

  res.json({
    success: true,
    message: `Review ${status} successfully`,
    data: { review }
  });
}));



// ==================== TRANSPORT OPTION MANAGEMENT ====================

// @route   GET /api/admin/transport-options
// @desc    Get all transport options with admin details
// @access  Private/Admin
router.get('/transport-options', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, isActive, type, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  if (type) query.type = type;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { 'routes.from': { $regex: search, $options: 'i' } },
      { 'routes.to': { $regex: search, $options: 'i' } }
    ];
  }

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const transportOptions = await TransportOption.find(query)
    .populate('createdBy', 'firstName lastName email')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort(sortOptions);

  const total = await TransportOption.countDocuments(query);

  res.json({
    success: true,
    data: {
      transportOptions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalOptions: total,
        limit: parseInt(limit)
      }
    }
  });
}));

// @route   PUT /api/admin/transport-options/:id/active
// @desc    Activate/deactivate transport option
// @access  Private/Admin
router.put('/transport-options/:id/active', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  const transportOption = await TransportOption.findByIdAndUpdate(
    req.params.id,
    { isActive },
    { new: true, runValidators: true }
  );

  if (!transportOption) {
    return res.status(404).json({ success: false, message: 'Transport option not found' });
  }

  res.json({ success: true, message: `Transport option ${isActive ? 'activated' : 'deactivated'} successfully`, data: { transportOption } });
}));

// @route   PUT /api/admin/transport-options/:id/schedules
// @desc    Replace schedules for a transport option
// @access  Private/Admin
router.put('/transport-options/:id/schedules', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { schedules } = req.body;

  const transportOption = await TransportOption.findByIdAndUpdate(
    req.params.id,
    { schedules },
    { new: true, runValidators: true }
  );

  if (!transportOption) {
    return res.status(404).json({ success: false, message: 'Transport option not found' });
  }

  res.json({ success: true, message: 'Schedules updated successfully', data: { transportOption } });
}));

// @route   PUT /api/admin/transport-options/:id/pricing
// @desc    Update pricing for a transport option
// @access  Private/Admin
router.put('/transport-options/:id/pricing', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { pricing } = req.body;

  const transportOption = await TransportOption.findByIdAndUpdate(
    req.params.id,
    { pricing },
    { new: true, runValidators: true }
  );

  if (!transportOption) {
    return res.status(404).json({ success: false, message: 'Transport option not found' });
  }

  res.json({ success: true, message: 'Pricing updated successfully', data: { transportOption } });
}));

// ==================== DASHBOARD & ANALYTICS ====================

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private/Admin
router.get('/dashboard', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  // User statistics
  const totalUsers = await User.countDocuments();
  const newUsersThisMonth = await User.countDocuments({ createdAt: { $gte: startOfMonth } });
  const newUsersThisYear = await User.countDocuments({ createdAt: { $gte: startOfYear } });

  // Package statistics
  const totalPackages = await Package.countDocuments();
  const pendingPackages = await Package.countDocuments({ status: 'pending' });
  const approvedPackages = await Package.countDocuments({ status: 'approved' });

  // Booking statistics
  const totalBookings = await Booking.countDocuments();
  const bookingsThisMonth = await Booking.countDocuments({ createdAt: { $gte: startOfMonth } });
  const totalRevenue = await Booking.aggregate([
    { $match: { status: 'confirmed' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);

  // Review statistics
  const totalReviews = await Review.countDocuments();
  const pendingReviews = await Review.countDocuments({ status: 'pending' });
  const averageRating = await Review.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: null, average: { $avg: '$rating' } } }
  ]);

  // Recent activities
  const recentBookings = await Booking.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('customer', 'firstName lastName')
    .populate('package', 'name destination');

  const recentUsers = await User.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select('firstName lastName email role createdAt');

  res.json({
    success: true,
    data: {
      statistics: {
        users: {
          total: totalUsers,
          newThisMonth: newUsersThisMonth,
          newThisYear: newUsersThisYear
        },
        packages: {
          total: totalPackages,
          pending: pendingPackages,
          approved: approvedPackages
        },
        bookings: {
          total: totalBookings,
          thisMonth: bookingsThisMonth,
          totalRevenue: totalRevenue[0]?.total || 0
        },
        reviews: {
          total: totalReviews,
          pending: pendingReviews,
          averageRating: Math.round((averageRating[0]?.average || 0) * 10) / 10
        }
      },
      recentActivities: {
        bookings: recentBookings,
        users: recentUsers
      }
    }
  });
}));

// ==================== SYSTEM OPERATIONS ====================

// @route   GET /api/admin/system/health
// @desc    Get system health information
// @access  Private/Admin
router.get('/system/health', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const systemInfo = {
    nodeVersion: process.version,
    platform: process.platform,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  };

  res.json({
    success: true,
    data: { systemInfo }
  });
}));

// @route   POST /api/admin/system/backup
// @desc    Trigger system backup (placeholder for future implementation)
// @access  Private/Admin
router.post('/system/backup', authenticate, adminOnly, asyncHandler(async (req, res) => {
  // This is a placeholder for future backup functionality
  res.json({
    success: true,
    message: 'Backup request received. This feature is under development.'
  });
}));

module.exports = router;

const express = require('express');
const Package = require('../models/Package');
const { authenticate, adminOnly, agentOrAdmin } = require('../middlewares/auth');
const { asyncHandler } = require('../middlewares/errorHandler');
const { apiLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// @route   GET /api/packages
// @desc    Get all packages with filtering and pagination
// @access  Public
router.get('/', apiLimiter, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    category,
    destination,
    minPrice,
    maxPrice,
    duration,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const query = { isApproved: true, 'availability.isActive': true };

  // Filter by category
  if (category) {
    query.category = category;
  }

  // Filter by destination
  if (destination) {
    query.$or = [
      { 'destination.country': { $regex: destination, $options: 'i' } },
      { 'destination.city': { $regex: destination, $options: 'i' } }
    ];
  }

  // Filter by price range
  if (minPrice || maxPrice) {
    query['pricing.basePrice'] = {};
    if (minPrice) query['pricing.basePrice'].$gte = Number(minPrice);
    if (maxPrice) query['pricing.basePrice'].$lte = Number(maxPrice);
  }

  // Filter by duration
  if (duration) {
    query['duration.days'] = { $lte: Number(duration) };
  }

  // Search functionality
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { 'destination.country': { $regex: search, $options: 'i' } },
      { 'destination.city': { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const packages = await Package.find(query)
    .populate('createdBy', 'firstName lastName')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort(sortOptions);

  const total = await Package.countDocuments(query);

  res.json({
    success: true,
    data: {
      packages,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalPackages: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    }
  });
}));

// @route   GET /api/packages/:id
// @desc    Get single package by ID
// @access  Public
router.get('/:id', apiLimiter, asyncHandler(async (req, res) => {
  const package = await Package.findById(req.params.id)
    .populate('createdBy', 'firstName lastName')
    .populate('approvedBy', 'firstName lastName');

  if (!package) {
    return res.status(404).json({
      success: false,
      message: 'Package not found'
    });
  }

  res.json({
    success: true,
    data: {
      package
    }
  });
}));

// @route   POST /api/packages
// @desc    Create new package (Admin/Agent only)
// @access  Private
router.post('/', authenticate, agentOrAdmin, asyncHandler(async (req, res) => {
  const packageData = {
    ...req.body,
    createdBy: req.user._id
  };

  const newPackage = await Package.create(packageData);

  // Auto-approve if created by admin
  if (req.user.role === 'admin') {
    newPackage.isApproved = true;
    newPackage.approvedBy = req.user._id;
    newPackage.approvedAt = new Date();
    await newPackage.save();
  }

  res.status(201).json({
    success: true,
    message: 'Package created successfully',
    data: {
      package: newPackage
    }
  });
}));

// @route   PUT /api/packages/:id
// @desc    Update package (Admin/Agent only)
// @access  Private
router.put('/:id', authenticate, agentOrAdmin, asyncHandler(async (req, res) => {
  const package = await Package.findById(req.params.id);

  if (!package) {
    return res.status(404).json({
      success: false,
      message: 'Package not found'
    });
  }

  // Check if user can edit this package
  if (req.user.role === 'agent' && package.createdBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only edit packages created by you'
    });
  }

  const updatedPackage = await Package.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('createdBy', 'firstName lastName');

  res.json({
    success: true,
    message: 'Package updated successfully',
    data: {
      package: updatedPackage
    }
  });
}));

// @route   DELETE /api/packages/:id
// @desc    Delete package (Admin only)
// @access  Private
router.delete('/:id', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const package = await Package.findById(req.params.id);

  if (!package) {
    return res.status(404).json({
      success: false,
      message: 'Package not found'
    });
  }

  await Package.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Package deleted successfully'
  });
}));

// @route   POST /api/packages/:id/approve
// @desc    Approve package (Admin only)
// @access  Private
router.post('/:id/approve', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const package = await Package.findById(req.params.id);

  if (!package) {
    return res.status(404).json({
      success: false,
      message: 'Package not found'
    });
  }

  if (package.isApproved) {
    return res.status(400).json({
      success: false,
      message: 'Package is already approved'
    });
  }

  package.isApproved = true;
  package.approvedBy = req.user._id;
  package.approvedAt = new Date();
  await package.save();

  res.json({
    success: true,
    message: 'Package approved successfully',
    data: {
      package
    }
  });
}));

// @route   POST /api/packages/:id/reject
// @desc    Reject package (Admin only)
// @access  Private
router.post('/:id/reject', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const package = await Package.findById(req.params.id);

  if (!package) {
    return res.status(404).json({
      success: false,
      message: 'Package not found'
    });
  }

  if (!package.isApproved && package.approvedBy) {
    return res.status(400).json({
      success: false,
      message: 'Package is already rejected'
    });
  }

  package.isApproved = false;
  package.approvedBy = req.user._id;
  package.approvedAt = new Date();
  await package.save();

  res.json({
    success: true,
    message: 'Package rejected successfully',
    data: {
      package
    }
  });
}));

// @route   GET /api/packages/pending/approval
// @desc    Get pending packages for approval (Admin only)
// @access  Private
router.get('/pending/approval', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const packages = await Package.find({ isApproved: false })
    .populate('createdBy', 'firstName lastName')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await Package.countDocuments({ isApproved: false });

  res.json({
    success: true,
    data: {
      packages,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalPackages: total
      }
    }
  });
}));

// @route   GET /api/packages/categories
// @desc    Get all package categories
// @access  Public
router.get('/categories', apiLimiter, asyncHandler(async (req, res) => {
  const categories = await Package.distinct('category');
  
  res.json({
    success: true,
    data: {
      categories
    }
  });
}));

// @route   GET /api/packages/destinations
// @desc    Get all destinations
// @access  Public
router.get('/destinations', apiLimiter, asyncHandler(async (req, res) => {
  const destinations = await Package.aggregate([
    { $match: { isApproved: true } },
    {
      $group: {
        _id: {
          country: '$destination.country',
          city: '$destination.city'
        }
      }
    },
    { $sort: { '_id.country': 1, '_id.city': 1 } }
  ]);

  res.json({
    success: true,
    data: {
      destinations: destinations.map(d => ({
        country: d._id.country,
        city: d._id.city
      }))
    }
  });
}));

// @route   GET /api/packages/featured
// @desc    Get featured packages
// @access  Public
router.get('/featured', apiLimiter, asyncHandler(async (req, res) => {
  const { limit = 6 } = req.query;

  const packages = await Package.find({
    isApproved: true,
    'availability.isActive': true
  })
    .sort({ 'ratings.average': -1, 'ratings.count': -1 })
    .limit(Number(limit))
    .populate('createdBy', 'firstName lastName');

  res.json({
    success: true,
    data: {
      packages
    }
  });
}));

module.exports = router; 
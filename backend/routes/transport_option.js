const express = require('express');
const TransportOption = require('../models/TransportOption');
const { authenticate, adminOnly, agentOrAdmin } = require('../middlewares/auth');
const { asyncHandler } = require('../middlewares/errorHandler');
const { apiLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// @route   GET /api/transport-options
// @desc    Get all transport options with filtering
// @access  Public
router.get('/', apiLimiter, asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    type, 
    destination, 
    search, 
    sortBy = 'name', 
    sortOrder = 'asc' 
  } = req.query;

  const query = { isActive: true };

  // Filter by transport type
  if (type) {
    query.type = type;
  }

  // Filter by destination
  if (destination) {
    query.$or = [
      { 'routes.from': { $regex: destination, $options: 'i' } },
      { 'routes.to': { $regex: destination, $options: 'i' } }
    ];
  }

  // Search functionality
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

// @route   GET /api/transport-options/:id
// @desc    Get single transport option by ID
// @access  Public
router.get('/:id', apiLimiter, asyncHandler(async (req, res) => {
  const transportOption = await TransportOption.findById(req.params.id);

  if (!transportOption || !transportOption.isActive) {
    return res.status(404).json({
      success: false,
      message: 'Transport option not found'
    });
  }

  res.json({
    success: true,
    data: { transportOption }
  });
}));

// @route   GET /api/transport-options/type/:type
// @desc    Get transport options by type
// @access  Public
router.get('/type/:type', apiLimiter, asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const transportOptions = await TransportOption.find({ 
    type, 
    isActive: true 
  })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ name: 1 });

  const total = await TransportOption.countDocuments({ type, isActive: true });

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

// @route   GET /api/transport-options/route/search
// @desc    Search transport options by route
// @access  Public
router.get('/route/search', apiLimiter, asyncHandler(async (req, res) => {
  const { from, to, date, passengers = 1 } = req.query;

  if (!from || !to) {
    return res.status(400).json({
      success: false,
      message: 'From and To locations are required'
    });
  }

  const query = {
    isActive: true,
    $or: [
      {
        'routes.from': { $regex: from, $options: 'i' },
        'routes.to': { $regex: to, $options: 'i' }
      },
      {
        'routes.from': { $regex: to, $options: 'i' },
        'routes.to': { $regex: from, $options: 'i' }
      }
    ]
  };

  // Filter by date if provided
  if (date) {
    const searchDate = new Date(date);
    query.$or.push({
      'schedules': {
        $elemMatch: {
          departureDate: { $gte: searchDate },
          availableSeats: { $gte: parseInt(passengers) }
        }
      }
    });
  }

  const transportOptions = await TransportOption.find(query)
    .sort({ 'pricing.basePrice': 1 });

  res.json({
    success: true,
    data: { transportOptions }
  });
}));

// ==================== ADMIN/AGENT ROUTES ====================

// @route   POST /api/transport-options
// @desc    Create new transport option
// @access  Private/Admin/Agent
router.post('/', authenticate, agentOrAdmin, asyncHandler(async (req, res) => {
  const {
    name,
    type,
    description,
    routes,
    schedules,
    pricing,
    amenities,
    policies,
    images
  } = req.body;

  const transportOption = await TransportOption.create({
    name,
    type,
    description,
    routes,
    schedules,
    pricing,
    amenities,
    policies,
    images,
    createdBy: req.user._id
  });

  res.status(201).json({
    success: true,
    message: 'Transport option created successfully',
    data: { transportOption }
  });
}));

// @route   PUT /api/transport-options/:id
// @desc    Update transport option
// @access  Private/Admin/Agent
router.put('/:id', authenticate, agentOrAdmin, asyncHandler(async (req, res) => {
  const transportOption = await TransportOption.findById(req.params.id);

  if (!transportOption) {
    return res.status(404).json({
      success: false,
      message: 'Transport option not found'
    });
  }

  // Check if user can edit this transport option
  if (req.user.role === 'agent' && transportOption.createdBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only edit transport options you created'
    });
  }

  const updatedTransportOption = await TransportOption.findByIdAndUpdate(
    req.params.id,
    {
      ...req.body,
      updatedBy: req.user._id,
      updatedAt: new Date()
    },
    { new: true, runValidators: true }
  );

  res.json({
    success: true,
    message: 'Transport option updated successfully',
    data: { transportOption: updatedTransportOption }
  });
}));

// @route   DELETE /api/transport-options/:id
// @desc    Deactivate transport option (soft delete)
// @access  Private/Admin/Agent
router.delete('/:id', authenticate, agentOrAdmin, asyncHandler(async (req, res) => {
  const transportOption = await TransportOption.findById(req.params.id);

  if (!transportOption) {
    return res.status(404).json({
      success: false,
      message: 'Transport option not found'
    });
  }

  // Check if user can delete this transport option
  if (req.user.role === 'agent' && transportOption.createdBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only delete transport options you created'
    });
  }

  const updatedTransportOption = await TransportOption.findByIdAndUpdate(
    req.params.id,
    { 
      isActive: false,
      updatedBy: req.user._id,
      updatedAt: new Date()
    },
    { new: true }
  );

  res.json({
    success: true,
    message: 'Transport option deactivated successfully',
    data: { transportOption: updatedTransportOption }
  });
}));

// ==================== SCHEDULE MANAGEMENT ====================

// @route   POST /api/transport-options/:id/schedules
// @desc    Add new schedule to transport option
// @access  Private/Admin/Agent
router.post('/:id/schedules', authenticate, agentOrAdmin, asyncHandler(async (req, res) => {
  const { schedules } = req.body;

  const transportOption = await TransportOption.findById(req.params.id);

  if (!transportOption) {
    return res.status(404).json({
      success: false,
      message: 'Transport option not found'
    });
  }

  // Check if user can modify this transport option
  if (req.user.role === 'agent' && transportOption.createdBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only modify transport options you created'
    });
  }

  transportOption.schedules.push(...schedules);
  await transportOption.save();

  res.json({
    success: true,
    message: 'Schedules added successfully',
    data: { transportOption }
  });
}));

// @route   PUT /api/transport-options/:id/schedules/:scheduleId
// @desc    Update specific schedule
// @access  Private/Admin/Agent
router.put('/:id/schedules/:scheduleId', authenticate, agentOrAdmin, asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;
  const updateData = req.body;

  const transportOption = await TransportOption.findById(req.params.id);

  if (!transportOption) {
    return res.status(404).json({
      success: false,
      message: 'Transport option not found'
    });
  }

  // Check if user can modify this transport option
  if (req.user.role === 'agent' && transportOption.createdBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only modify transport options you created'
    });
  }

  const scheduleIndex = transportOption.schedules.findIndex(
    schedule => schedule._id.toString() === scheduleId
  );

  if (scheduleIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Schedule not found'
    });
  }

  // Update schedule
  transportOption.schedules[scheduleIndex] = {
    ...transportOption.schedules[scheduleIndex].toObject(),
    ...updateData
  };

  await transportOption.save();

  res.json({
    success: true,
    message: 'Schedule updated successfully',
    data: { transportOption }
  });
}));

// ==================== PRICING MANAGEMENT ====================

// @route   PUT /api/transport-options/:id/pricing
// @desc    Update transport option pricing
// @access  Private/Admin/Agent
router.put('/:id/pricing', authenticate, agentOrAdmin, asyncHandler(async (req, res) => {
  const { pricing } = req.body;

  const transportOption = await TransportOption.findById(req.params.id);

  if (!transportOption) {
    return res.status(404).json({
      success: false,
      message: 'Transport option not found'
    });
  }

  // Check if user can modify this transport option
  if (req.user.role === 'agent' && transportOption.createdBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only modify transport options you created'
    });
  }

  transportOption.pricing = pricing;
  transportOption.updatedBy = req.user._id;
  transportOption.updatedAt = new Date();
  await transportOption.save();

  res.json({
    success: true,
    message: 'Pricing updated successfully',
    data: { transportOption }
  });
}));

// ==================== AVAILABILITY MANAGEMENT ====================

// @route   GET /api/transport-options/:id/availability
// @desc    Check availability for specific dates
// @access  Public
router.get('/:id/availability', apiLimiter, asyncHandler(async (req, res) => {
  const { date, passengers = 1 } = req.query;

  const transportOption = await TransportOption.findById(req.params.id);

  if (!transportOption || !transportOption.isActive) {
    return res.status(404).json({
      success: false,
      message: 'Transport option not found'
    });
  }

  let availableSchedules = transportOption.schedules;

  if (date) {
    const searchDate = new Date(date);
    availableSchedules = transportOption.schedules.filter(schedule => 
      schedule.departureDate >= searchDate && 
      schedule.availableSeats >= parseInt(passengers)
    );
  }

  res.json({
    success: true,
    data: {
      transportOptionId: transportOption._id,
      availableSchedules,
      totalAvailable: availableSchedules.length
    }
  });
}));

module.exports = router;

const express = require('express');
const User = require('../models/User');
const { authenticate, customerOnly, agentOnly } = require('../middlewares/auth');
const { asyncHandler } = require('../middlewares/errorHandler');
const { apiLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// ==================== PROFILE MANAGEMENT ====================

// @route   GET /api/user/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  
  res.json({
    success: true,
    data: { user }
  });
}));

// @route   PUT /api/user/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticate, asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, address, preferences } = req.body;

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      firstName,
      lastName,
      phone,
      address,
      preferences
    },
    { new: true, runValidators: true }
  ).select('-password');

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: { user: updatedUser }
  });
}));

// @route   POST /api/user/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

// ==================== PREFERENCES MANAGEMENT ====================

// @route   PUT /api/user/preferences
// @desc    Update user travel preferences
// @access  Private
router.put('/preferences', authenticate, asyncHandler(async (req, res) => {
  const { preferences } = req.body;

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { preferences },
    { new: true, runValidators: true }
  ).select('-password');

  res.json({
    success: true,
    message: 'Preferences updated successfully',
    data: { user: updatedUser }
  });
}));

// @route   GET /api/user/preferences
// @desc    Get user travel preferences
// @access  Private
router.get('/preferences', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('preferences');
  
  res.json({
    success: true,
    data: { preferences: user.preferences }
  });
}));

// ==================== ADDRESS MANAGEMENT ====================

// @route   PUT /api/user/address
// @desc    Update user address
// @access  Private
router.put('/address', authenticate, asyncHandler(async (req, res) => {
  const { address } = req.body;

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { address },
    { new: true, runValidators: true }
  ).select('-password');

  res.json({
    success: true,
    message: 'Address updated successfully',
    data: { user: updatedUser }
  });
}));

// ==================== PROFILE IMAGE ====================

// @route   PUT /api/user/profile-image
// @desc    Update profile image
// @access  Private
router.put('/profile-image', authenticate, asyncHandler(async (req, res) => {
  const { profileImage } = req.body;

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { profileImage },
    { new: true, runValidators: true }
  ).select('-password');

  res.json({
    success: true,
    message: 'Profile image updated successfully',
    data: { user: updatedUser }
  });
}));

// ==================== VERIFICATION ====================

// @route   POST /api/user/verify-email
// @desc    Verify email address
// @access  Private
router.post('/verify-email', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user.isEmailVerified) {
    return res.status(400).json({
      success: false,
      message: 'Email is already verified'
    });
  }

  // Generate verification token
  const verificationToken = require('crypto').randomBytes(32).toString('hex');
  user.emailVerificationToken = verificationToken;
  user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  await user.save();

  // TODO: Send verification email
  // For now, return the token (in production, send via email)
  res.json({
    success: true,
    message: 'Verification email sent',
    data: {
      verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined
    }
  });
}));

// @route   POST /api/user/confirm-email
// @desc    Confirm email with token
// @access  Private
router.post('/confirm-email', authenticate, asyncHandler(async (req, res) => {
  const { token } = req.body;

  const user = await User.findById(req.user._id);

  if (user.isEmailVerified) {
    return res.status(400).json({
      success: false,
      message: 'Email is already verified'
    });
  }

  if (user.emailVerificationToken !== token) {
    return res.status(400).json({
      success: false,
      message: 'Invalid verification token'
    });
  }

  if (user.emailVerificationExpires < Date.now()) {
    return res.status(400).json({
      success: false,
      message: 'Verification token has expired'
    });
  }

  // Mark email as verified
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  res.json({
    success: true,
    message: 'Email verified successfully'
  });
}));

// ==================== AGENT-SPECIFIC ROUTES ====================

// @route   GET /api/user/agent-stats
// @desc    Get agent statistics (only for agents)
// @access  Private/Agent
router.get('/agent-stats', authenticate, agentOnly, asyncHandler(async (req, res) => {
  // This would include agent-specific statistics
  // For now, return basic info
  res.json({
    success: true,
    message: 'Agent statistics endpoint - to be implemented',
    data: {
      agentId: req.user._id,
      role: req.user.role
    }
  });
}));

// ==================== CUSTOMER-SPECIFIC ROUTES ====================

// @route   GET /api/user/customer-stats
// @desc    Get customer statistics (only for customers)
// @access  Private/Customer
router.get('/customer-stats', authenticate, customerOnly, asyncHandler(async (req, res) => {
  // This would include customer-specific statistics
  // For now, return basic info
  res.json({
    success: true,
    message: 'Customer statistics endpoint - to be implemented',
    data: {
      customerId: req.user._id,
      role: req.user.role
    }
  });
}));

// ==================== ACCOUNT MANAGEMENT ====================

// @route   DELETE /api/user/account
// @desc    Deactivate user account (soft delete)
// @access  Private
router.delete('/account', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { isActive: false },
    { new: true }
  ).select('-password');

  res.json({
    success: true,
    message: 'Account deactivated successfully',
    data: { user }
  });
}));

// @route   POST /api/user/reactivate
// @desc    Reactivate user account
// @access  Private
router.post('/reactivate', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { isActive: true },
    { new: true }
  ).select('-password');

  res.json({
    success: true,
    message: 'Account reactivated successfully',
    data: { user }
  });
}));

module.exports = router;

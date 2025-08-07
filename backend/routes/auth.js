const express = require('express');

const router = express.Router();

router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, phone, role = 'customer' } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User with this email already exists'
    });
  }

    // Create new user
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phone,
    role
  });

//Generate JWT token 
    const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        phone: user.phone
      },
      token
    }
  });
}));
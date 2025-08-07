# Pleasure Holidays - Complete Travel Booking Platform

A comprehensive travel booking platform built with Node.js, Express.js, MongoDB, and React.js. Features real-time booking, payment processing, role-based access control, and admin management.

## 🚀 Features

### Core Functionality
- **Hotel/Flight/Train Booking System** with real-time rates
- **Package Tours** with customizable options
- **Admin-controlled Pricing Tables**
- **User Request Approval System**

### User Roles & Security
- **Three-tier Role System:**
  - Customers: Browse/book packages
  - Agents: Manage bookings for clients
  - Admins: Full system control
- **JWT Authentication** with role-based access
- **100% Unauthorized API Request Blocking**

### Technical Stack
- **Backend:** Node.js/Express.js RESTful API
- **Database:** MongoDB with Mongoose ODM
- **Frontend:** React.js with responsive UI
- **Payment:** Razorpay integration
- **Authentication:** JWT tokens

## 📋 API Endpoints

### Authentication (12+ endpoints)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/forgot-password` - Forgot password
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/users` - Get all users (Admin)

### Packages
- `GET /api/packages` - Get all packages with filtering
- `GET /api/packages/:id` - Get single package
- `POST /api/packages` - Create package (Admin/Agent)
- `PUT /api/packages/:id` - Update package
- `DELETE /api/packages/:id` - Delete package (Admin)
- `POST /api/packages/:id/approve` - Approve package (Admin)
- `POST /api/packages/:id/reject` - Reject package (Admin)
- `GET /api/packages/pending/approval` - Pending packages (Admin)
- `GET /api/packages/categories` - Get categories
- `GET /api/packages/destinations` - Get destinations
- `GET /api/packages/featured` - Get featured packages

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - Get user bookings
- `GET /api/bookings/:id` - Get single booking
- `POST /api/bookings/:id/payment/create-order` - Create payment order
- `POST /api/bookings/:id/payment/verify` - Verify payment
- `POST /api/bookings/:id/approve` - Approve booking (Admin)
- `POST /api/bookings/:id/reject` - Reject booking (Admin)
- `POST /api/bookings/:id/cancel` - Cancel booking
- `GET /api/bookings/pending/approval` - Pending bookings (Admin)
- `POST /api/bookings/:id/review` - Add review

## 🗄️ Database Schema

### User Schema
```javascript
{
  firstName: String,
  lastName: String,
  email: String (unique),
  password: String (hashed),
  role: ['customer', 'agent', 'admin'],
  phone: String,
  address: Object,
  preferences: Object,
  isActive: Boolean,
  isEmailVerified: Boolean,
  // ... other fields
}
```

### Package Schema
```javascript
{
  name: String,
  description: String,
  destination: Object,
  duration: Object,
  pricing: Object,
  inclusions: Object,
  itinerary: Array,
  images: Array,
  category: String,
  availability: Object,
  ratings: Object,
  // ... other fields
}
```

### Booking Schema
```javascript
{
  bookingId: String (unique),
  customer: ObjectId (ref: User),
  agent: ObjectId (ref: User),
  package: ObjectId (ref: Package),
  travelDetails: Object,
  pricing: Object,
  payment: Object,
  status: String,
  approval: Object,
  // ... other fields
}
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB
- npm or yarn

### Backend Setup
```bash
cd backend
npm install
```

Create `.env` file:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/pleasure-holidays
JWT_SECRET=your-jwt-secret-key
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-secret
FRONTEND_URL=http://localhost:3000
```

Start backend:
```bash
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
```

Start frontend:
```bash
npm start
```

## 🔐 Authentication Flow

1. **User Registration/Login**
   - JWT token generated
   - Token stored in localStorage
   - Token sent with each API request

2. **Role-based Access Control**
   - Admin: Full system access
   - Agent: Package management + client bookings
   - Customer: Browse + book packages

3. **API Security**
   - All protected routes require valid JWT
   - Role-based middleware for specific endpoints
   - Rate limiting on sensitive endpoints

## 💳 Payment Integration

### Razorpay Workflow
1. **Create Booking** - User selects package and travel details
2. **Create Order** - Backend creates Razorpay order
3. **Payment Processing** - Frontend handles payment via Razorpay
4. **Payment Verification** - Backend verifies payment signature
5. **Booking Confirmation** - Booking status updated to confirmed

## 🎨 React Component Hierarchy

```
App.js
├── AuthProvider
├── BookingProvider
├── Router
│   ├── Navbar
│   ├── Routes
│   │   ├── Home
│   │   ├── Packages
│   │   ├── PackageDetail
│   │   ├── Login/Register
│   │   ├── Dashboard
│   │   ├── AdminDashboard
│   │   ├── AgentDashboard
│   │   ├── BookingHistory
│   │   ├── Payment
│   │   └── Profile
│   └── Footer
└── Toaster
```

## 📊 Admin Dashboard Features

- **Package Management**
  - Add/Update/Remove packages
  - Approve/Reject pending packages
  - Real-time pricing updates

- **Booking Management**
  - View all bookings
  - Approve/Reject booking requests
  - Track payment status

- **User Management**
  - View all users
  - Manage user roles
  - Deactivate/Activate accounts

- **Financial Reports**
  - Revenue tracking
  - Payment analytics
  - Booking statistics

## 🔧 Additional Features

- **Email Notifications** for bookings
- **Search/Filter** for travel packages
- **User Review System**
- **Booking History Tracking**
- **Mobile-responsive Design**
- **Real-time Price Updates**
- **Error Handling Middleware**
- **Rate Limiting on APIs**

## 🚀 Deployment

### Environment Variables
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-secure-jwt-secret
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-secret
FRONTEND_URL=https://your-frontend-domain.com
```

### Build Commands
```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

## 📝 API Documentation

### Postman Collection
Import the provided Postman collection for testing all API endpoints.

### Authentication Headers
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

## 🔒 Security Features

- **JWT Token Authentication**
- **Password Hashing** with bcrypt
- **Rate Limiting** on sensitive endpoints
- **CORS Configuration**
- **Helmet Security Headers**
- **Input Validation** and sanitization
- **SQL Injection Prevention** (MongoDB)
- **XSS Protection**

## 📱 Mobile Responsive Design

- **Tailwind CSS** for responsive styling
- **Mobile-first approach**
- **Touch-friendly interfaces**
- **Progressive Web App features**

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## 📈 Performance Optimizations

- **Database Indexing** for faster queries
- **React Query** for efficient data fetching
- **Image Optimization** and lazy loading
- **Code Splitting** for smaller bundles
- **Caching Strategies**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

---

**Pleasure Holidays** - Making travel dreams come true! ✈️🌍 
import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

const BookingContext = createContext();

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};

export const BookingProvider = ({ children }) => {
  const [bookings, setBookings] = useState([]);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch user's bookings
  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/api/bookings/my-bookings');
      setBookings(response.data.bookings);
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch bookings';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new booking
  const createBooking = useCallback(async (bookingData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post('/api/bookings', bookingData);
      const newBooking = response.data.booking;
      
      setBookings(prev => [newBooking, ...prev]);
      setCurrentBooking(newBooking);
      
      return { success: true, booking: newBooking };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to create booking';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // Update a booking
  const updateBooking = useCallback(async (bookingId, updateData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.put(`/api/bookings/${bookingId}`, updateData);
      const updatedBooking = response.data.booking;
      
      setBookings(prev => 
        prev.map(booking => 
          booking._id === bookingId ? updatedBooking : booking
        )
      );
      
      if (currentBooking?._id === bookingId) {
        setCurrentBooking(updatedBooking);
      }
      
      return { success: true, booking: updatedBooking };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to update booking';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [currentBooking]);

  // Cancel a booking
  const cancelBooking = useCallback(async (bookingId) => {
    try {
      setLoading(true);
      setError(null);
      
      await axios.put(`/api/bookings/${bookingId}/cancel`);
      
      setBookings(prev => 
        prev.map(booking => 
          booking._id === bookingId 
            ? { ...booking, status: 'cancelled' }
            : booking
        )
      );
      
      if (currentBooking?._id === bookingId) {
        setCurrentBooking(prev => ({ ...prev, status: 'cancelled' }));
      }
      
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to cancel booking';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [currentBooking]);

  // Get a specific booking
  const getBooking = useCallback(async (bookingId) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`/api/bookings/${bookingId}`);
      const booking = response.data.booking;
      
      setCurrentBooking(booking);
      return { success: true, booking };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch booking';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear current booking
  const clearCurrentBooking = useCallback(() => {
    setCurrentBooking(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Get booking statistics
  const getBookingStats = useCallback(async () => {
    try {
      const response = await axios.get('/api/bookings/stats');
      return response.data.stats;
    } catch (error) {
      console.error('Failed to fetch booking stats:', error);
      return null;
    }
  }, []);

  const value = {
    bookings,
    currentBooking,
    loading,
    error,
    fetchBookings,
    createBooking,
    updateBooking,
    cancelBooking,
    getBooking,
    clearCurrentBooking,
    clearError,
    getBookingStats
  };

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
};

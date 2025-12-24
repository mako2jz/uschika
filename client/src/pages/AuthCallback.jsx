import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');

  useEffect(() => {
    const verifyAndStoreToken = async () => {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');

      if (!token) {
        console.error('No token found in URL.');
        navigate('/');
        return;
      }

      try {
        // Validate token with server before storing
        const response = await axios.post(`${API_URL}/auth/verify-token`, { token });
        
        if (response.data.email) {
          // Token is valid, store it
          localStorage.setItem('authToken', token);
          // Clear the token from URL for security
          window.history.replaceState({}, document.title, '/auth');
          navigate('/chat');
        } else {
          setError('Invalid token. Please request a new magic link.');
          setTimeout(() => navigate('/'), 3000);
        }
      } catch (err) {
        console.error('Token verification failed:', err);
        const errorMessage = err.response?.data?.error || 'Token verification failed.';
        setError(errorMessage);
        setTimeout(() => navigate('/'), 3000);
      }
    };

    verifyAndStoreToken();
  }, [location.search, navigate]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-lg font-semibold text-red-600">{error}</p>
            <p className="text-gray-600">Redirecting to login...</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold">Verifying your login...</p>
            <p className="text-gray-600">Please wait a moment.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
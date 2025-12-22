import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (token) {
      // Store the token
      localStorage.setItem('authToken', token);
      // Redirect to the main app. App.jsx will handle the socket connection.
      navigate('/chat');
    } else {
      // If no token, go back to the login page
      console.error('No token found in URL.');
      navigate('/');
    }
    // The dependency array is empty because we only want this to run once on mount.
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg font-semibold">Logging you in...</p>
        <p className="text-gray-600">Please wait a moment.</p>
      </div>
    </div>
  );
};

export default AuthCallback;
import React, { useState } from 'react';
import AnimatedContent from './AnimatedContent';
import Squares from './Squares';
import PolicyModal from './PolicyModal';
import axios from 'axios';
import logo from '../assets/logo.png';

const API_URL = import.meta.env.VITE_API_URL || 'https://uschika.dcism.org';

function Hero() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  const validateEmail = (email) => {
    // Basic email format validation + domain check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.endsWith('@usc.edu.ph');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Client-side validation before sending
    if (!validateEmail(email)) {
      setMessage('Please enter a valid @usc.edu.ph email address.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const response = await axios.post(`${API_URL}/auth/magic-link`, { email });
      setMessage(response.data.message || 'Magic link sent successfully!');
      setEmail(''); // Clear email after successful submission
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to send magic link.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="hero">
      {/* Squares as the background */}
      <div className="hero-background">
        <Squares 
          speed={0.2} 
          squareSize={40}
          direction="diagonal"
          borderColor="#5a9b3e"
          hoverFillColor="#222"
        />
      </div>

      {/* Hero content */}
      <div className="hero-container">
        <AnimatedContent
          distance={100}
          direction="vertical"
          reverse={false}
          duration={0.8}
          ease="power3.out"
          initialOpacity={0}
          animateOpacity
          scale={1}
          threshold={0.1}
          delay={0.3}
        >
          <div className="hero-logo">
            <img src={logo} alt="USChika Logo" />
          </div>
        </AnimatedContent>
        <div className="hero-content">
          <p className="hero-description">
            Anonymous one-on-one chat with fellow students
          </p>
          <form className="hero-form" onSubmit={handleSubmit}>
            <input
              type="email"
              className="hero-input"
              placeholder="Enter your USC Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={isLoading}
            />
            <button type="submit" className="hero-button" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Magic Link'}
            </button>
          </form>
          {message && (
            <p className={`hero-message ${message.includes('Failed') || message.includes('Please enter') ? 'error' : ''}`}>
              {message}
            </p>
          )}
          <p className="hero-note">
            <strong>Remember:</strong> Be respectful and kind. All chats are
            anonymous but follow school guidelines.
          </p>
          <div className="mt-4 text-center">
            <button 
              onClick={() => setShowPolicy(true)}
              className="hero-button"
            >
              Terms of Service & Privacy Policy
            </button>
          </div>
        </div>
      </div>
      <PolicyModal isOpen={showPolicy} onClose={() => setShowPolicy(false)} />
    </div>
  );
}

export default Hero;
import React from 'react';
import { gsap } from "gsap";
import AnimatedContent from './AnimatedContent';
import PixelBlast from './PixelBlast';

function Hero() {
  return (
    <div className="hero">
      {/* PixelBlast as the background */}
      <div className="hero-background">
        <PixelBlast
          variant="circle"
          pixelSize={6}
          color="#7ed957"
          patternScale={3}
          patternDensity={1.2}
          pixelSizeJitter={0.5}
          enableRipples
          rippleSpeed={0.4}
          rippleThickness={0.12}
          rippleIntensityScale={1.5}
          liquid
          liquidStrength={0.12}
          liquidRadius={1.2}
          liquidWobbleSpeed={5}
          speed={0.6}
          edgeFade={0.25}
          transparent
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
                <img src="src/assets/logo.png" alt="USChika Logo" />
            </div>
        </AnimatedContent>
        <div className="hero-content">
            <p className="hero-description">
              Anonymous one-on-one chat with fellow students
            </p>
            <form className="hero-form">
              <input
                type="email"
                className="hero-input"
                placeholder="USC Email"
                required
              />
              <input
                type="password"
                className="hero-input"
                placeholder="Your Password"
                required
              />
              <button type="submit" className="hero-button">
                Start Chatting
              </button>
            </form>
            <p className="hero-note">
              <strong>Remember:</strong> Be respectful and kind. All chats are
              anonymous but follow school guidelines.
            </p>
        </div>
      </div>
    </div>
  );
}

export default Hero;
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const WelcomeScreen = () => {
  const [readMore, setReadMore] = useState(false);

  return (
    <div className="tea-welcome-container">
      <div className="tea-leaves">
        <div className="leaf leaf1"></div>
        <div className="leaf leaf2"></div>
        <div className="leaf leaf3"></div>
      </div>
      
      <div className="welcome-content">
        <div className="logo">
          <i className="fas fa-leaf"></i>
        </div>
        
        <h1>Tea Collector</h1>
        <p className="tagline">Discover, Collect, and Enjoy Fine Teas</p>
        
        <p className="message">
          Welcome to the ultimate app for tea enthusiasts! Explore a world of rare and exquisite teas, 
          track your collection, connect with fellow collectors, and expand your tea knowledge.
        </p>
        
        {readMore && (
          <div className="more-info">
            <p>With our app, you can:</p>
            <ul>
              <li>Catalog your tea collection with photos and notes</li>
              <li>Discover new teas from around the world</li>
              <li>Connect with other tea enthusiasts</li>
              <li>Learn proper brewing techniques</li>
              <li>Track your tasting experiences</li>
            </ul>
          </div>
        )}
        
        <div className="buttons">
          <button 
            className="btn btn-primary"
            onClick={() => setReadMore(!readMore)}
          >
            <i className={readMore ? "fas fa-arrow-left" : "fas fa-book-open"}></i> 
            {readMore ? 'Back' : 'Read More'}
          </button>
          <Link to={'/register'} className="btn btn-secondary">
            <i className="fas fa-user-plus"></i> Join Now
          </Link>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
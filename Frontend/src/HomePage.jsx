import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="homepage">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-content">
          <div className="nav-logo">
            <span className="logo-icon">🛰️</span>
            <span className="logo-text">ORBIT SHIELD</span>
          </div>
          <div className="nav-links">
            <a href="#home">Home</a>
            <a href="#features">Features</a>
            <a href="#about">About</a>
            <button className="nav-dashboard-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero" id="home">
        <div className="hero-background">
          <div className="stars"></div>
          <div className="stars2"></div>
          <div className="stars3"></div>
          <div className="earth-glow"></div>
        </div>
        <div className="hero-content">
          <h1 className="hero-title">ORBIT SHIELD</h1>
          <p className="hero-subtitle">AI-Powered Space Traffic Management & Collision Avoidance</p>
          <p className="hero-description">
            Real-time satellite tracking.<br/>
            AI-driven collision prediction.<br/>
            Autonomous maneuver planning.<br/>
            <span className="highlight">Everything in one intelligent platform.</span>
          </p>
          <div className="hero-buttons">
            <button className="btn-primary" onClick={() => navigate('/dashboard')}>
              Start Monitoring
            </button>
            <button className="btn-secondary" onClick={() => document.getElementById('about').scrollIntoView({ behavior: 'smooth' })}>
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features" id="features">
        <h2 className="section-title">Core Capabilities</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔭</div>
            <h3>Real-Time 3D Orbital Visualization</h3>
            <p>Interactive Earth with satellites, debris, paths & orbits rendered in 3D.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3>AI Collision Prediction</h3>
            <p>Machine learning models estimate risk levels and potential approaches.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🛰️</div>
            <h3>Autonomous Maneuver Suggestions</h3>
            <p>AI proposes safe orbit adjustments with ΔV estimates.</p>
          </div>

          <div className="feature-card" onClick={() => navigate('/collision-simulator')} style={{ cursor: 'pointer' }}>
            <div className="feature-icon">💥</div>
            <h3>Collision Simulator</h3>
            <p>Simulate collision scenarios with AI-powered avoidance recommendations.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⚠️</div>
            <h3>Instant Alerts & Space Weather Warnings</h3>
            <p>Live notifications for high-risk encounters or debris threats.</p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section" id="about">
        <div className="about-content">
          <h2 className="section-title">About Orbit Shield</h2>
          <p className="about-text">
            Orbit Shield is a next-generation space traffic management system that brings AI, 
            physics simulation, and real-time orbital visualization together in a single unified dashboard.
          </p>
          <p className="about-text">
            Built for <strong>space agencies, satellite operators, defense organizations, and research teams</strong>, 
            our goal is simple:
          </p>
          <div className="about-goals">
            <div className="goal-item">Keep space safe.</div>
            <div className="goal-item">Predict collisions.</div>
            <div className="goal-item">Automate maneuvers.</div>
            <div className="goal-item">Protect missions.</div>
          </div>
          <p className="team-note">Built by a passionate team of AI + Aerospace engineers.</p>
        </div>
      </section>

      {/* Why Orbit Shield Section */}
      <section className="why-section">
        <h2 className="section-title">Why Orbit Shield?</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">10×</div>
            <div className="stat-label">Faster collision checks</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">1,000+</div>
            <div className="stat-label">Satellites tracked in real time</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">AI-Driven</div>
            <div className="stat-label">Maneuver optimization</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">LEO/MEO/GEO</div>
            <div className="stat-label">Built for all orbital missions</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Ready to explore the future of space traffic management?</h2>
          <button className="btn-cta" onClick={() => navigate('/dashboard')}>
            Launch Dashboard
          </button>
          <p className="cta-note">No account needed. Demo mode enabled.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="homepage-footer">
        <div className="footer-content">
          <div className="footer-links">
            <a href="#home">Home</a>
            <span>•</span>
            <a onClick={() => navigate('/dashboard')}>Dashboard</a>
            <span>•</span>
            <a href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer">API Docs</a>
            <span>•</span>
            <a href="#about">About</a>
          </div>
          <p className="copyright">
            <span className="footer-icon">🌍</span> © 2025 Orbit Shield. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;

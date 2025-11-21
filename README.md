# 🚀 Orbit Shield - Space Traffic Management System

A comprehensive real-time satellite tracking and collision risk monitoring system with 3D visualization, AI-powered collision prediction, and intelligent chatbot assistance.

---

## 🌟 Features

### Core Visualization
- **3D Earth Visualization** - Interactive rotating globe with realistic textures
- **Real-Time Satellite Tracking** - Monitor multiple satellites simultaneously with orbital paths
- **Orbit Trails & Risk Glow** - Cinematic trail rendering with high-risk visual highlights
- **Earth Visibility Toggle** - Show/hide Earth in collision simulator for trajectory focus
- **Scenario Sandbox** - Hypothetically adjust altitude/lat/lon with permalink state

### AI & Intelligence
- **AI-Powered Collision Detection** - Machine learning models predict collision risks
- **AI Chatbot Assistant** - Google Gemini 2.5 Flash powered satellite information assistant
  - Contextual satellite data queries
  - Natural language Q&A interface
  - Automatic filtering of unknown/unavailable data
  - Backend proxy integration for enhanced responses
- **Risk Classification** - Color-coded risk levels (Safe, Medium, High)
- **Autonomous Maneuver Planning** - RL agent suggests optimal avoidance maneuvers
- **Multi-Horizon Risk Curves** - Predictive decay curve over future hours

### Real-Time Monitoring
- **Alert System** - Real-time high-priority collision warnings with priority badges
- **LIVE Risk Stream (WebSocket)** - Continuous push of top collision risks
- **Time Scrubber** - Scrub through buffered live risk history
- **Timeline Charts** - 24-hour collision risk predictions with interactive graphs

### Analysis & Reporting
- **Satellite Detail Panel** - Comprehensive satellite information display
  - NORAD ID and satellite name separation
  - Prioritized data fields with custom labels
  - Filtered unknown/N/A values for clean display
- **Collision Risk Chart** - Visual risk assessment over time
- **Maneuver Simulation** - Plan + simulate delta-v outcome and residual risk
- **PDF Mission Report** - One-click generation of risk & maneuver summary (base64)

### Performance & Optimization
- **Spatial Prefilter Optimization** - Coarse hash reduces debris distance checks
- **RESTful API** - Complete backend with 30+ endpoints
- **Efficient Data Fetching** - Supabase integration with optimized queries

---

## 📁 Project Structure

```
Orbit Shield/
│
├── Frontend/          # React + Three.js frontend
│   ├── src/
│   │   ├── App.jsx                      # Main application
│   │   ├── Header.jsx                   # Top navigation
│   │   ├── SatelliteList.jsx            # Satellite panel with filtering
│   │   ├── AlertPanel.jsx               # Alerts panel with priorities
│   │   ├── SatelliteDetailPanel.jsx     # Detailed satellite information
│   │   ├── SatelliteInfoPanel.jsx       # AI Chatbot interface
│   │   ├── CollisionRiskChart.jsx       # Risk timeline visualization
│   │   ├── SatelliteOrbit.jsx           # 3D satellites rendering
│   │   ├── EarthMaterial.jsx            # Earth texture & materials
│   │   ├── AtmosphereMesh.jsx           # Atmospheric effects
│   │   ├── Starfield.jsx                # Space background
│   │   ├── Nebula.jsx                   # Nebula effects
│   │   ├── api/
│   │   │   └── client.js                # API client utilities
│   │   └── ...
│   └── package.json
│
└── Backend/           # Python FastAPI backend
    ├── main.py                          # FastAPI entry point
    ├── requirements.txt                 # Python dependencies
    ├── gemini_search.py                 # AI chatbot backend proxy
    │
    ├── api/                             # REST endpoints
    │   ├── satellites.py                # Satellite CRUD
    │   ├── debris.py                    # Debris tracking
    │   ├── collision_events.py          # AI collision detection
    │   ├── maneuvers.py                 # RL maneuver planning
    │   ├── alerts.py                    # Alert management
    │   └── satellite_analysis.py        # Satellite analytics
    │
    ├── core/
    │   ├── ai/                          # AI models
    │   │   ├── model1_risk_predictor.py # Regression model
    │   │   ├── model2_risk_classifier.py# Classification
    │   │   ├── rl_maneuver_agent.py     # RL agent
    │   │   └── on_click_handler.py      # Click event AI
    │   │
    │   └── orbital/                     # Orbital mechanics
    │       ├── propagate_tle.py         # TLE propagation
    │       ├── vector_math.py           # 3D mathematics
    │       └── collision_detection.py   # Collision algorithms
    │
    ├── services/                        # Business logic
    │   ├── satellite_service.py
    │   ├── collision_service.py
    │   ├── maneuver_service.py
    │   └── alert_service.py
    │
    └── config/                          # Configuration
        ├── settings.py                  # App settings
        ├── supabase_client.py           # Database client
        └── local_cache.py               # Caching layer
```

---

## 🚀 Quick Start

### Frontend Setup

```bash
cd Frontend
npm install
npm run dev
```

Frontend runs on **http://localhost:5173**

### Backend Setup

```bash
cd Backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend runs on **http://localhost:8000**

**API Documentation**: http://localhost:8000/docs

---

## 🎯 Key Technologies

### Frontend
- **React 18** - Modern UI framework with hooks
- **Three.js / React Three Fiber** - 3D rendering and WebGL
- **Vite** - Lightning-fast build tool and dev server
- **CSS3** - Styling with dark space theme and animations
- **React Router DOM** - Client-side routing for navigation

### Backend
- **Python 3.12** - Modern Python with type hints
- **FastAPI** - High-performance async web framework
- **Uvicorn** - Lightning-fast ASGI server
- **Pydantic** - Runtime type validation and serialization
- **Supabase** - PostgreSQL database with real-time capabilities
- **Google Generative AI** - Gemini 2.5 Flash for chatbot intelligence

---

## 🧠 AI Models

The backend includes 3 AI models for space traffic management:

### 1. Risk Predictor (Regression)
- Predicts continuous risk score (0.0-1.0)
- Inputs: distance, velocity, angle, altitude
- Used for detailed risk assessment
- Status: ✅ Operational

### 2. Risk Classifier (Multi-class)
- Classifies risk into 4 levels (0-3)
- Levels: No Risk, Low, Medium, High
- Used for dashboard color coding
- Status: ✅ Operational

### 3. RL Maneuver Agent
- Reinforcement learning for optimal maneuvers
- Outputs: delta-v, burn duration, fuel cost
- Minimizes fuel while maximizing safety
- Status: ✅ Operational

---

## 📡 API Endpoints

### Satellites
```
GET    /api/satellites              # List all
GET    /api/satellites/{id}         # Get details
POST   /api/satellites              # Create
PUT    /api/satellites/{id}         # Update
DELETE /api/satellites/{id}         # Delete
```

### Collision Events (AI-Powered)
```
GET  /api/collision-events/calculate        # Calculate risks
GET  /api/collision-events/satellite/{id}   # Satellite risks
GET  /api/collision-events/high-risk/list   # High-risk only
```

### Maneuvers (RL Agent)
```
POST  /api/maneuvers/plan              # Plan maneuver
POST  /api/maneuvers/plan-multi-burn   # Multi-burn sequence
POST  /api/maneuvers/emergency-plan    # Emergency plan
```

### Alerts
```
GET    /api/alerts                     # List alerts
PATCH  /api/alerts/{id}/acknowledge    # Acknowledge
GET    /api/alerts/unacknowledged/count
```

### AI Chatbot
```
POST  /api/gemini-chat                 # Chat with AI assistant
      Body: {
        satellite_data: {...},
        user_message: "string",
        api_key: "string"
      }
      Response: {
        response: "string",
        has_live_data: boolean,
        sources: "string | null"
      }
```

### Health & Analytics
```
GET  /api/health                       # System health check
GET  /api/satellite-analysis           # Satellite analytics
```

---

## 🎨 Screenshots & Interface

The interface features:
- **Central 3D Earth** - Rotating globe with realistic textures and atmospheric glow
- **Left Panel: Satellite List** 
  - Risk indicators with color coding
  - Search and filtering capabilities
  - Quick satellite selection
- **Right Panel: Dual Mode**
  - **Alert System** - High-priority collision warnings with badges
  - **AI Chatbot** - Intelligent satellite assistant powered by Gemini 2.5 Flash
  - **Satellite Details** - Comprehensive data with NORAD ID and status
  - **Unified Timeline Animation** - Play/Pause, speed (0.5×–3×), progress scrubber, orbital trails across Collision Simulator, Maneuver Planner, and Sandbox
- **Bottom: Risk Timeline** - 24-hour collision prediction charts
- **Interactive Navigation** - Seamless switching between views with React Router

---

## 🛠️ Development

### Run Both Services

**Terminal 1 - Backend:**
```bash
cd Backend
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd Frontend
npm run dev
```

### Test API
Visit http://localhost:8000/docs for interactive API testing with Swagger UI
---

## 📊 Data Flow

1. **Backend** tracks satellites and debris positions
2. **AI Models** calculate collision risks
3. **RL Agent** suggests optimal maneuvers
4. **API** serves data to frontend
5. **Frontend** renders 3D visualization and UI
6. **User** monitors and responds to alerts

---

## 🔧 Configuration

### Backend (.env)
```env
PORT=8000
DEBUG=True
COLLISION_THRESHOLD_KM=10.0
HIGH_RISK_THRESHOLD_KM=5.0

# Supabase Database (Required)
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
```

### Frontend (.env)
```env
# Google Gemini API Key (Required for AI Chatbot)
VITE_GEMINI_API_KEY=your_gemini_api_key

# Get your FREE Gemini API key at:
# https://aistudio.google.com/app/apikey
# Free tier: 15 requests/minute, no credit card required
```

The frontend automatically connects to backend at `http://localhost:8000`

---

## 🧪 Testing

### Test Backend API
```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:8000/api/satellites"
Invoke-RestMethod -Uri "http://localhost:8000/api/collision-events/calculate"
```

### Test Frontend
Open http://localhost:5173 and interact with the 3D visualization
  - ### Timeline Animation Expansion
  - ✅ Added unified timeline playback (Play/Pause, speed, scrubber, trails)
  - ✅ Integrated animation into Maneuver Planner (previously static)
  - ✅ Integrated animation into Sandbox (previously static)
  - ✅ Consistent component pattern derived from Collision Simulator
  - ✅ Enhanced comparative maneuver visualization (original vs new orbit)

---

## 📚 Documentation

  - Use this `README.md` for consolidated setup & feature guidance.
  - Visit http://localhost:8000/docs for live API reference.
  - Ensure `.env` files contain Supabase and Gemini keys.
  - Open an issue for bugs or enhancement requests.
- **Backend README**: `Backend/README.md` - Full API documentation
- **Backend Quickstart**: `Backend/QUICKSTART.md` - 5-minute setup guide
- **Project Summary**: `Backend/PROJECT_SUMMARY.md` - Architecture overview
- **Physics & AI**: `Backend/PHYSICS_AI_README.md` - AI model details
- **Gemini Setup**: `Frontend/GEMINI_SETUP.md` - AI chatbot configuration
- **API Docs**: http://localhost:8000/docs - Interactive Swagger UI

---

## 🆕 Recent Updates

### AI Chatbot Integration (Latest)
- ✅ Google Gemini 2.5 Flash integration for intelligent Q&A
- ✅ Backend proxy architecture for enhanced responses
- ✅ Context-aware satellite information queries
- ✅ Automatic filtering of unknown/N/A data
- ✅ Clean UI with conversational interface
- ✅ Model availability detection and fallback handling

### UI/UX Improvements
- ✅ Satellite Detail Panel with prioritized fields
- ✅ Proper NORAD ID vs Satellite Name separation
- ✅ Earth visibility toggle in collision simulator
- ✅ Enhanced navigation with React Router
- ✅ Improved data display with custom labels

### Backend Enhancements
- ✅ Gemini search endpoint (`/api/gemini-chat`)
- ✅ Enhanced error handling and logging
- ✅ Python SDK integration for Google Generative AI
- ✅ Supabase query optimization
- ✅ Local caching improvements

---

## 🚀 Deployment

### Backend (Python)
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Frontend (Node.js)
```bash
npm run build
# Serve the dist/ folder
```

---

## 🎯 Future Enhancements

### Planned Features (In Progress)
- [ ] **Constellation Mode Toggle** - Filter satellites by constellation (Starlink, GPS, Galileo, GLONASS, OneWeb)
- [ ] **Live Earth Textures** - Real-time cloud overlay and day-night terminator from NASA GIBS API
- [ ] **Real-Time Position Updates** - SGP4 propagation with satellite.js for live orbital positions

### Additional Enhancements
- [ ] Enhanced ML model performance optimization
- [ ] Integration with Space-Track.org for real TLE data
- [ ] Google Search grounding for AI chatbot (live satellite data)
- [ ] Multi-satellite mission planning
- [ ] Historical data analytics and trends
- [ ] Mobile responsive design
- [ ] User authentication and role management
- [ ] Advanced filtering and sorting options

---

## 📝 License

MIT License - See LICENSE file for details

---

## 🤝 Contributing

Contributions welcome! Please read the documentation and follow the existing code structure.

---

## 🆘 Support

- Check `Backend/QUICKSTART.md` for quick setup
- Visit http://localhost:8000/docs for API documentation
- See `Frontend/GEMINI_SETUP.md` for AI chatbot configuration
- Open an issue for bugs or questions

---

## 🔑 API Keys Required

### Supabase (Database) - **Required**
1. Create account at https://supabase.com
2. Create new project
3. Copy Project URL and anon/public key
4. Add to `Backend/.env`

### Google Gemini (AI Chatbot) - **Required for Chatbot**
1. Visit https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key (starts with `AIza...`)
4. Add to `Frontend/.env` as `VITE_GEMINI_API_KEY`
5. **100% FREE** - No credit card required, 15 requests/minute

---

**Built with ❤️ for Space Safety**

*Orbit Shield - Making space operations safer through AI, visualization, and intelligent assistance*

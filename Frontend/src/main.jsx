import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './HomePage.jsx'
import App from './App.jsx'
import SandboxPage from './SandboxPage.jsx'
import CollisionSimulator from './CollisionSimulator.jsx'
import ManeuverPlannerPage from './ManeuverPlannerPage.jsx'
import SatelliteInfoPanel from './SatelliteInfoPanel.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<App />} />
        <Route path="/sandbox" element={<SandboxPage />} />
        <Route path="/collision-simulator" element={<CollisionSimulator />} />
        <Route path="/maneuver-planner" element={<ManeuverPlannerPage />} />
        <Route path="/satellite-info" element={<SatelliteInfoPanel />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)

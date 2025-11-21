import React, { useMemo, useState } from 'react';

function getRiskClass(riskLevel) {
  // Use Model 2 risk level (0-3) as primary indicator
  if (riskLevel == null || riskLevel === 0) return 'safe';
  if (riskLevel === 1) return 'safe'; // Low risk -> green
  if (riskLevel === 2) return 'medium';
  return 'high'; // Level 3
}

function getRiskLabel(riskLevel) {
  if (riskLevel == null || riskLevel === 0) return 'Healthy';
  if (riskLevel === 1) return 'Low Risk';
  if (riskLevel === 2) return 'Medium Risk';
  return 'High Risk'; // Level 3
}

function SatelliteList({ satellites = [], loading, error, selectedId, onSelectSatellite, analysis }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return satellites;
    return satellites.filter(s => (s.name || s.id || '').toLowerCase().includes(term));
  }, [satellites, search]);

  function handleClick(sat) {
    onSelectSatellite && onSelectSatellite(sat);
  }

  return (
    <div className="panel satellite-list">
      <h3 className="panel-title">SATELLITES</h3>
      <input
        type="text"
        className="sat-search"
        placeholder="Search satellite..."
        value={search}
        onChange={(e)=>setSearch(e.target.value)}
      />
      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">{error}</div>}
      <div className="satellite-items-container">
        <div className="satellite-items">
        {filtered.map((sat) => {
          // Use Model 2 risk level (distance-based, more reliable)
          const riskLevel = analysis?.sat?.id === sat.id ? (analysis?.nearest?.[0]?.model2_class?.risk_level) : null;
          const riskClass = getRiskClass(riskLevel);
          const riskLabel = getRiskLabel(riskLevel);
          return (
            <div
              key={sat.id}
              className={`satellite-item ${selectedId === sat.id ? 'selected' : ''}`}
              onClick={() => handleClick(sat)}
            >
              <div className="sat-info">
                <span className={`sat-dot ${riskClass}`}></span>
                <div>
                  <div className="sat-id">{sat.name || sat.sat_name || sat.id}</div>
                  <div className={`sat-status ${riskClass}`}>
                    {riskLabel}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && !loading && <div className="empty">No satellites match search.</div>}
        </div>
      </div>
      {/* Collision risk legend moved to CollisionRiskChart to avoid duplication */}
    </div>
  );
}

export default SatelliteList;

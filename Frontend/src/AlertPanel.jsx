import React from 'react';

function AlertPanel({ analysis }) {
  const nearest = analysis?.nearest?.[0];
  const prob = nearest?.model1_risk?.probability;
  const riskLevel = nearest?.model2_class?.risk_level;
  const maneuver = nearest?.maneuver;
  const debris = nearest?.debris;

  function riskLabel(level) {
    if (level === 3) return 'HIGH RISK WARNING!';
    if (level === 2) return 'MEDIUM RISK';
    if (level === 1) return 'LOW RISK';
    if (level === 0) return 'NO RISK';
    return 'UNKNOWN';
  }

  return (
    <div className="panel alert-panel alert-panel-fixed">
      <h3 className="panel-title">ALERTS</h3>
      {!nearest && <div className="alert-box"><div className="alert-title">Select a satellite</div><div className="alert-text">Click on a satellite to analyze collision threats.</div></div>}
      {nearest && (
        <div className="alert-box">
          <div className="alert-title">{riskLabel(riskLevel)}</div>
          <div className="alert-text">
            {prob != null && prob !== undefined ? `Collision probability ${(prob * 100).toFixed(1)}%` : ''}
          </div>
          <div className="alert-details">
            {debris ? (
              <div className="detail-item">
                <span className="detail-label">Debris:</span>
                <span className="detail-value">{debris.deb_name || debris.name || debris.norad_id || debris.id}</span>
              </div>
            ) : null}
            {nearest.distance_now_km != null ? (
              <div className="detail-item">
                <span className="detail-label">Distance Now:</span>
                <span className="detail-value">{nearest.distance_now_km.toFixed(2)} km</span>
              </div>
            ) : null}
            {nearest.features?.tca_seconds != null ? (
              <div className="detail-item">
                <span className="detail-label">TCA:</span>
                <span className="detail-value">{nearest.features.tca_seconds.toFixed(1)} s</span>
              </div>
            ) : null}
            {maneuver?.total_delta_v != null ? (
              <div className="detail-item">
                <span className="detail-label">ΔV:</span>
                <span className="detail-value">{(maneuver.total_delta_v * 1000).toFixed(2)} m/s</span>
              </div>
            ) : null}
            {maneuver?.expected_increase_in_miss_km != null ? (
              <div className="detail-item">
                <span className="detail-label">Miss +:</span>
                <span className="detail-value">{maneuver.expected_increase_in_miss_km.toFixed(2)} km</span>
              </div>
            ) : null}
            {maneuver?.confidence != null ? (
              <div className="detail-item">
                <span className="detail-label">Confidence:</span>
                <span className="detail-value">{(maneuver.confidence * 100).toFixed(1)}%</span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default AlertPanel;

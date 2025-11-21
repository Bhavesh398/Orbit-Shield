import React from 'react';
import { analyzeSandbox } from './api/client';

function SandboxPanel({ satellite, analysis }) {
  const [altitude, setAltitude] = React.useState('');
  const [latitude, setLatitude] = React.useState('');
  const [longitude, setLongitude] = React.useState('');
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  async function runScenario() {
    if (!satellite) return;
    setLoading(true);
    try {
      const alt = altitude !== '' ? parseFloat(altitude) : undefined;
      const lat = latitude !== '' ? parseFloat(latitude) : undefined;
      const lon = longitude !== '' ? parseFloat(longitude) : undefined;
      const analysisResult = await analyzeSandbox(satellite.id, { altitude_km: alt, latitude: lat, longitude: lon });
      setResult(analysisResult);
      // Permalink encode
      const state = { sat: satellite.id, alt, lat, lon };
      const encoded = btoa(JSON.stringify(state));
      const url = new URL(window.location.href);
      url.searchParams.set('sandbox', encoded);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      console.warn('Sandbox analysis failed', e);
      setResult(null);
    } finally { setLoading(false); }
  }

  function handleOpenSandbox() {
    if (!satellite) return;
    // Store satellite and debris in sessionStorage for sandbox page
    sessionStorage.setItem('sandboxSatellite', JSON.stringify(satellite));
    if (analysis?.nearest) {
      const debris = analysis.nearest.map(n => n.debris);
      sessionStorage.setItem('sandboxDebris', JSON.stringify(debris));
    }
    // Navigate to sandbox page
    window.location.href = '/sandbox';
  }

  React.useEffect(() => {
    // Load permalink if present
    const param = new URLSearchParams(window.location.search).get('sandbox');
    if (param) {
      try {
        const decoded = JSON.parse(atob(param));
        if (decoded.sat === satellite?.id) {
          if (decoded.alt != null) setAltitude(String(decoded.alt));
          if (decoded.lat != null) setLatitude(String(decoded.lat));
          if (decoded.lon != null) setLongitude(String(decoded.lon));
        }
      } catch (_) {}
    }
  }, [satellite?.id]);

  return (
    <div className="panel" style={{marginTop:12}}>
      <h4 className="section-title">SCENARIO SANDBOX</h4>
      {!satellite && <div style={{fontSize:12}}>Select a satellite to sandbox.</div>}
      {satellite && (
        <div style={{display:'flex', flexDirection:'column', gap:6}}>
          <label style={{fontSize:11}}>Altitude Δ (km): <input value={altitude} onChange={e=>setAltitude(e.target.value)} placeholder={satellite.altitude_km} style={{width:'70px'}} /></label>
          <label style={{fontSize:11}}>Latitude: <input value={latitude} onChange={e=>setLatitude(e.target.value)} placeholder={satellite.latitude} style={{width:'70px'}} /></label>
          <label style={{fontSize:11}}>Longitude: <input value={longitude} onChange={e=>setLongitude(e.target.value)} placeholder={satellite.longitude} style={{width:'70px'}} /></label>
          <button onClick={handleOpenSandbox} className="focus-btn" style={{marginTop:8, width:'100%'}}>🧪 Open Sandbox Simulator</button>
          {result && result.nearest && result.nearest[0] && (
            <div style={{fontSize:11, marginTop:6}}>
              Top Risk Prob: {(result.nearest[0].model1_risk.probability*100).toFixed(1)}% | Dist: {result.nearest[0].distance_now_km.toFixed(2)} km
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SandboxPanel;
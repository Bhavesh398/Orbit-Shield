import React, { useMemo } from 'react';

function CollisionRiskChart({ riskHistory = [], selectedIndex, onSelectIndex }) {
  // Prepare polyline points scaled to chart
  const width = 400;
  const height = 100; // plotting area
  const points = useMemo(() => {
    if (riskHistory.length === 0) return '';
    const maxProb = 1; // probabilities already 0..1
    return riskHistory.map((r, i) => {
      const x = (i / Math.max(riskHistory.length - 1, 1)) * width;
      const y = height - (r.probability / maxProb) * height;
      return `${x},${y + 20}`; // offset 20 for top grid line
    }).join(' ');
  }, [riskHistory]);

  const current = selectedIndex != null ? riskHistory[selectedIndex] : riskHistory[riskHistory.length - 1];
  const sliderMax = Math.max(riskHistory.length - 1, 0);

  return (
    <div className="panel collision-chart-panel">
      <h4 className="section-title">COLLISION RISK</h4>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap'}}>
        <div style={{display:'flex', alignItems:'center', gap:'8px', flex:1, minWidth:0}}>
          <input 
            type="range" 
            min={0} 
            max={sliderMax} 
            value={selectedIndex == null ? sliderMax : selectedIndex}
            onChange={(e)=>onSelectIndex(Number(e.target.value))}
            style={{flex:1}}
          />
          <div style={{minWidth:90, fontSize:12, textAlign:'right'}}>
            {current ? `${(current.probability*100).toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className="risk-legend" style={{display:'flex', gap:16}}>
          <div className="risk-item" style={{margin:0}}>
            <span className="risk-dot safe"></span>
            <span>Safe</span>
          </div>
          <div className="risk-item" style={{margin:0}}>
            <span className="risk-dot medium"></span>
            <span>Medium Risk</span>
          </div>
          <div className="risk-item" style={{margin:0}}>
            <span className="risk-dot high"></span>
            <span>High Risk</span>
          </div>
        </div>
      </div>
      <svg className="risk-chart-large" width="100%" height="140" viewBox="0 0 400 140">
        <line x1="0" y1="20" x2="400" y2="20" stroke="#222" strokeWidth="1" />
        <line x1="0" y1="60" x2="400" y2="60" stroke="#222" strokeWidth="1" />
        <line x1="0" y1="100" x2="400" y2="100" stroke="#222" strokeWidth="1" />
        <line x1="0" y1="120" x2="400" y2="120" stroke="#333" strokeWidth="1" />
        {points && (
          <polyline
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="2"
            points={points}
          />
        )}
        {current && (
          <circle
            r={5}
            fill="#ff6b35"
            cx={(selectedIndex == null ? sliderMax : selectedIndex)/Math.max(riskHistory.length - 1,1)*400}
            cy={height - (current.probability)*height + 20}
          />
        )}
      </svg>
    </div>
  );
}

export default CollisionRiskChart;

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function SatelliteInfoPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [satellite, setSatellite] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const sat = location.state?.satellite;
    if (sat) {
      setSatellite(sat);
      // Check if AI service is configured
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const isAIEnabled = apiKey && apiKey !== 'your-gemini-api-key-here';
      
      let aiServiceName = isAIEnabled ? '🤖 AI-powered' : '📊 intelligent';
      
      // Initial AI greeting with satellite info
      const greeting = {
        role: 'assistant',
        content: `Hello! I'm your ${aiServiceName} satellite assistant. I have loaded information about **${sat.name || sat.sat_name || sat.norad_id || 'Unknown Satellite'}**.\n\nI can provide detailed information about:\n• Launch date and mission details\n• Country of origin and operator\n• Purpose and specifications\n• Orbital parameters\n• Current status and health\n\nWhat would you like to know?`
      };
      setMessages([greeting]);
    } else {
      const storedSat = sessionStorage.getItem('infoSatellite');
      if (storedSat) {
        setSatellite(JSON.parse(storedSat));
      }
    }
  }, [location]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateAIResponse = (userQuery, satData) => {
    // Simulate AI response based on satellite data and user query
    const query = userQuery.toLowerCase();
    
    // Build comprehensive satellite info - only include known data
    const satInfo = {};
    
    const name = satData.name || satData.sat_name || satData.norad_id;
    if (name) satInfo.name = name;
    
    const noradId = satData.norad_id || satData.id;
    if (noradId) satInfo.norad_id = noradId;
    
    const altitude = satData.altitude_km || satData.altitude;
    if (altitude && altitude !== 'N/A') satInfo.altitude = altitude;
    
    const latitude = satData.latitude;
    if (latitude != null) satInfo.latitude = latitude;
    
    const longitude = satData.longitude;
    if (longitude != null) satInfo.longitude = longitude;
    
    const inclination = satData.inclination_deg || satData.inclination;
    if (inclination && inclination !== 'N/A') satInfo.inclination = inclination;
    
    const velocity = satData.velocity_kmps || satData.velocity;
    if (velocity && velocity !== 'N/A') satInfo.velocity = velocity;
    
    const status = satData.status;
    if (status && status !== 'Unknown' && status !== 'N/A') satInfo.status = status;
    
    const launchDate = satData.launch_date;
    if (launchDate && launchDate !== 'Data not available' && launchDate !== 'Unknown' && launchDate !== 'N/A') {
      satInfo.launch_date = launchDate;
    }
    
    const country = satData.country;
    if (country && country !== 'Unknown' && country !== 'N/A') satInfo.country = country;
    
    const purpose = satData.purpose;
    if (purpose && purpose !== 'Unknown' && purpose !== 'N/A') satInfo.purpose = purpose;
    
    const mass = satData.mass;
    if (mass && mass !== 'Unknown' && mass !== 'N/A') satInfo.mass = mass;

    // Query-based responses with conditional data inclusion
    if (query.includes('launch') || query.includes('when')) {
      let response = `**Launch Information:**\n\n`;
      if (satInfo.launch_date) {
        response += `${satInfo.name || 'This satellite'} was launched on **${satInfo.launch_date}**.`;
      } else {
        response += `Launch date information is not currently available for ${satInfo.name || 'this satellite'}.`;
      }
      if (satInfo.country) response += ` The satellite is operated by **${satInfo.country}**.`;
      if (satInfo.status) response += ` It is currently in **${satInfo.status}** status.`;
      response += `\n\nWould you like to know more about its mission or orbital parameters?`;
      return response;
    }
    
    if (query.includes('orbit') || query.includes('altitude') || query.includes('position')) {
      let response = `**Orbital Parameters:**\n\n`;
      const params = [];
      if (satInfo.altitude) params.push(`• **Altitude:** ${satInfo.altitude} km`);
      if (satInfo.inclination) params.push(`• **Inclination:** ${satInfo.inclination}°`);
      if (satInfo.latitude != null && satInfo.longitude != null) {
        params.push(`• **Current Position:** ${satInfo.latitude}°N, ${satInfo.longitude}°E`);
      }
      if (satInfo.velocity) params.push(`• **Velocity:** ${satInfo.velocity} km/s`);
      
      if (params.length > 0) {
        response += params.join('\n');
        if (satInfo.altitude) {
          const alt = parseFloat(satInfo.altitude);
          response += `\n\nThis satellite is in a ${alt > 35000 ? 'geostationary' : alt > 2000 ? 'medium Earth' : 'low Earth'} orbit (${alt > 35000 ? 'GEO' : alt > 2000 ? 'MEO' : 'LEO'}).`;
        }
      } else {
        response += `Detailed orbital parameters are not currently available for this satellite.`;
      }
      return response;
    }
    
    if (query.includes('purpose') || query.includes('mission') || query.includes('what') || query.includes('why')) {
      let response = `**Mission Profile:**\n\n`;
      if (satInfo.purpose) {
        response += `**Purpose:** ${satInfo.purpose}\n\n${satInfo.name || 'This satellite'} serves critical functions in ${satInfo.purpose.toLowerCase()}.`;
      } else {
        response += `Mission purpose details are not currently available for ${satInfo.name || 'this satellite'}.`;
      }
      if (satInfo.country) response += ` It is part of the ${satInfo.country} space program.`;
      if (satInfo.mass) response += `\n\nThe satellite weighs approximately **${satInfo.mass} kg**.`;
      if (satInfo.altitude) response += ` It maintains its orbit at **${satInfo.altitude} km**.`;
      return response;
    }
    
    if (query.includes('country') || query.includes('operator') || query.includes('who')) {
      let response = `**Operator Information:**\n\n`;
      const info = [];
      if (satInfo.country) info.push(`**Country:** ${satInfo.country}`);
      if (satInfo.norad_id) info.push(`**NORAD ID:** ${satInfo.norad_id}`);
      if (satInfo.status) info.push(`**Status:** ${satInfo.status.toUpperCase()}`);
      
      if (info.length > 0) {
        response += info.join('\n') + '\n\n';
        if (satInfo.country) {
          response += `This satellite is operated by **${satInfo.country}** and is part of their space infrastructure.`;
        }
        if (satInfo.purpose) {
          response += ` It was designed for ${satInfo.purpose.toLowerCase()} applications.`;
        }
      } else {
        response += `Operator information is not currently available for this satellite.`;
      }
      return response;
    }
    
    if (query.includes('status') || query.includes('health') || query.includes('active')) {
      let response = `**Current Status:**\n\n`;
      const statusInfo = [];
      if (satInfo.status) statusInfo.push(`✅ **Operational Status:** ${satInfo.status.toUpperCase()}`);
      if (satInfo.latitude != null && satInfo.longitude != null) {
        statusInfo.push(`📡 **Last Known Position:** ${satInfo.latitude}°N, ${satInfo.longitude}°E`);
      }
      if (satInfo.altitude) statusInfo.push(`🛰️ **Altitude:** ${satInfo.altitude} km`);
      if (satInfo.velocity) statusInfo.push(`⚡ **Velocity:** ${satInfo.velocity} km/s`);
      
      if (statusInfo.length > 0) {
        response += statusInfo.join('\n');
        if (satInfo.status) {
          response += `\n\nThe satellite is ${satInfo.status === 'active' ? 'functioning normally and maintaining its designated orbit' : 'in ' + satInfo.status + ' status'}. All systems are ${satInfo.status === 'active' ? 'operational' : 'being monitored'}.`;
        }
      } else {
        response += `Current status information is not available for this satellite.`;
      }
      return response;
    }
    
    if (query.includes('specification') || query.includes('detail') || query.includes('info') || query.includes('tell')) {
      let response = `**Complete Satellite Profile:**\n\n`;
      
      const basicInfo = [];
      if (satInfo.name) basicInfo.push(`• Name: ${satInfo.name}`);
      if (satInfo.norad_id) basicInfo.push(`• NORAD ID: ${satInfo.norad_id}`);
      if (satInfo.country) basicInfo.push(`• Country: ${satInfo.country}`);
      if (satInfo.status) basicInfo.push(`• Status: ${satInfo.status}`);
      if (basicInfo.length > 0) {
        response += `**Basic Information:**\n${basicInfo.join('\n')}\n\n`;
      }
      
      const orbitalData = [];
      if (satInfo.altitude) orbitalData.push(`• Altitude: ${satInfo.altitude} km`);
      if (satInfo.inclination) orbitalData.push(`• Inclination: ${satInfo.inclination}°`);
      if (satInfo.velocity) orbitalData.push(`• Velocity: ${satInfo.velocity} km/s`);
      if (satInfo.latitude != null && satInfo.longitude != null) {
        orbitalData.push(`• Position: ${satInfo.latitude}°N, ${satInfo.longitude}°E`);
      }
      if (orbitalData.length > 0) {
        response += `**Orbital Data:**\n${orbitalData.join('\n')}\n\n`;
      }
      
      const missionData = [];
      if (satInfo.purpose) missionData.push(`• Purpose: ${satInfo.purpose}`);
      if (satInfo.launch_date) missionData.push(`• Launch Date: ${satInfo.launch_date}`);
      if (satInfo.mass) missionData.push(`• Mass: ${satInfo.mass} kg`);
      if (missionData.length > 0) {
        response += `**Mission:**\n${missionData.join('\n')}\n\n`;
      }
      
      response += `Is there anything specific you'd like to explore further?`;
      return response;
    }
    
    // Default comprehensive response
    const availableTopics = [];
    if (satInfo.launch_date) availableTopics.push('• Launch history and timeline');
    if (satInfo.altitude || satInfo.inclination) availableTopics.push('• Orbital parameters and current position');
    if (satInfo.purpose) availableTopics.push('• Mission purpose and capabilities');
    if (satInfo.country) availableTopics.push('• Country and operator details');
    if (satInfo.status) availableTopics.push('• Current operational status');
    
    let response = `I can provide information about **${satInfo.name || 'this satellite'}**`;
    if (availableTopics.length > 0) {
      response += ` in several areas:\n\n**Available Topics:**\n${availableTopics.join('\n')}`;
    } else {
      response += `, though detailed information is limited for this satellite.`;
    }
    response += `\n\nPlease ask me about any of these topics, or ask a specific question about the satellite!`;
    return response;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !satellite) return;

    const userMessage = {
      role: 'user',
      content: inputMessage
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      // Check if API key is configured
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      if (!apiKey || apiKey === 'your-gemini-api-key-here') {
        // Fallback to simulated response if no API key
        setTimeout(() => {
          const aiResponse = {
            role: 'assistant',
            content: generateAIResponse(inputMessage, satellite)
          };
          setMessages(prev => [...prev, aiResponse]);
          setLoading(false);
        }, 800);
        return;
      }

      // Build satellite data context
      const satelliteContext = (() => {
        const data = [];
        
        const name = satellite.name || satellite.sat_name;
        if (name) data.push(`- Name: ${name}`);
        
        const noradId = satellite.norad_id || satellite.id;
        if (noradId) data.push(`- NORAD ID: ${noradId}`);
        
        const altitude = satellite.altitude_km || satellite.altitude;
        if (altitude && altitude !== 'N/A') data.push(`- Altitude: ${altitude} km`);
        
        const lat = satellite.latitude;
        const lon = satellite.longitude;
        if (lat != null && lon != null) data.push(`- Position: ${lat}°N, ${lon}°E`);
        
        const inclination = satellite.inclination_deg || satellite.inclination;
        if (inclination && inclination !== 'N/A') data.push(`- Inclination: ${inclination}°`);
        
        const velocity = satellite.velocity_kmps || satellite.velocity;
        if (velocity && velocity !== 'N/A') data.push(`- Velocity: ${velocity} km/s`);
        
        const status = satellite.status;
        if (status && status !== 'Unknown' && status !== 'N/A') data.push(`- Status: ${status}`);
        
        const launchDate = satellite.launch_date;
        if (launchDate && launchDate !== 'Data not available' && launchDate !== 'Unknown' && launchDate !== 'N/A') {
          data.push(`- Launch Date: ${launchDate}`);
        }
        
        const country = satellite.country;
        if (country && country !== 'Unknown' && country !== 'N/A') data.push(`- Country: ${country}`);
        
        const purpose = satellite.purpose;
        if (purpose && purpose !== 'Unknown' && purpose !== 'N/A') data.push(`- Purpose: ${purpose}`);
        
        const mass = satellite.mass;
        if (mass && mass !== 'Unknown' && mass !== 'N/A') data.push(`- Mass: ${mass} kg`);
        
        return data.length > 0 ? 'Satellite Data:\n' + data.join('\n') : 'Limited satellite data available.';
      })();

      const systemPrompt = `You are an expert satellite analyst assistant. You have detailed information about the satellite: ${satellite.name || satellite.sat_name || satellite.norad_id}.

${satelliteContext}

Provide detailed, accurate, and helpful information about this satellite based on the available data. Format your responses with bullet points and sections when appropriate. Be concise but informative. When the user asks about current status, recent updates, or live information, use Google Search to find accurate, real-time information.`;

      // Call backend Gemini proxy with Google Search grounding
      const apiUrl = `http://localhost:8000/api/gemini-chat`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          satellite_data: satellite,
          user_message: inputMessage,
          api_key: apiKey
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Backend error: ${response.status}`);
      }

      const data = await response.json();
      
      // Response format from backend: {response: str, has_live_data: bool, sources: Optional[str]}
      let aiResponse = data.response;
      
      // Add sources attribution if live data was used
      if (data.has_live_data && data.sources) {
        aiResponse += `\n\n📡 **Live Data Sources:**\n${data.sources}`;
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: aiResponse
      }]);
    } catch (error) {
      console.error('AI service error:', error);
      
      // Determine specific error message
      let errorMessage = '⚠️ Unable to connect to AI service. Please ensure the backend server is running on port 8000.\n\nUsing offline mode:\n\n';
      
      if (error.message.includes('Backend error: 400')) {
        errorMessage = '⚠️ Invalid request or API key. Please check your Gemini API key in .env file.\n\nGet a FREE key from: https://aistudio.google.com/app/apikey\n\nUsing offline mode:\n\n';
      } else if (error.message.includes('429')) {
        errorMessage = '⚠️ Rate limit exceeded. Gemini free tier allows 60 requests/minute. Please wait a moment. Using offline mode:\n\n';
      } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        errorMessage = '⚠️ Cannot connect to backend server. Please run: cd Backend && uvicorn main:app --reload\n\nUsing offline mode:\n\n';
      }
      
      // Fallback to simulated response on error
      const fallbackResponse = {
        role: 'assistant',
        content: errorMessage + generateAIResponse(inputMessage, satellite)
      };
      setMessages(prev => [...prev, fallbackResponse]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!satellite) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>No satellite selected</h2>
          <button 
            onClick={() => navigate('/dashboard')}
            style={{ padding: '10px 20px', marginTop: 20, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'linear-gradient(135deg, #3ABEFF, #7B61FF)', color: '#fff' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0f', color: '#fff' }}>
      {/* Header */}
      <div style={{ 
        padding: '20px', 
        background: 'rgba(10, 12, 18, 0.95)', 
        borderBottom: '1px solid rgba(58,190,255,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, letterSpacing: '1px' }}>🤖 AI Satellite Assistant</h2>
          <p style={{ margin: '5px 0 0 0', fontSize: 13, color: '#94a3b8' }}>
            Asking about: <strong style={{ color: '#3ABEFF' }}>{satellite.name || satellite.sat_name || satellite.norad_id}</strong>
          </p>
        </div>
        <button 
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: '1px solid rgba(58,190,255,0.4)',
            color: '#3ABEFF',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13
          }}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Chat Messages */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '30px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ 
            display: 'flex', 
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            animation: 'fadeIn 0.3s ease-in'
          }}>
            <div style={{
              maxWidth: '70%',
              padding: '15px 20px',
              borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
              background: msg.role === 'user' 
                ? 'linear-gradient(135deg, #3ABEFF, #7B61FF)' 
                : 'rgba(15, 17, 25, 0.95)',
              border: msg.role === 'assistant' ? '1px solid rgba(58,190,255,0.2)' : 'none',
              boxShadow: msg.role === 'user' ? '0 4px 20px rgba(58,190,255,0.3)' : '0 4px 20px rgba(0,0,0,0.3)'
            }}>
              <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {msg.content.split('\n').map((line, i) => {
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <div key={i} style={{ fontWeight: 700, marginTop: i > 0 ? 10 : 0, marginBottom: 5, color: '#3ABEFF' }}>{line.replace(/\*\*/g, '')}</div>;
                  }
                  if (line.startsWith('•')) {
                    return <div key={i} style={{ marginLeft: 15, marginTop: 3 }}>{line}</div>;
                  }
                  return <div key={i}>{line}</div>;
                })}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '15px 20px',
              borderRadius: '20px 20px 20px 4px',
              background: 'rgba(15, 17, 25, 0.95)',
              border: '1px solid rgba(58,190,255,0.2)'
            }}>
              <div style={{ fontSize: 13, color: '#3ABEFF' }}>AI is thinking...</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ 
        padding: '20px', 
        background: 'rgba(10, 12, 18, 0.95)', 
        borderTop: '1px solid rgba(58,190,255,0.2)',
        display: 'flex',
        gap: '15px',
        alignItems: 'center'
      }}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me anything about this satellite..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '15px 20px',
            background: '#0d0f14',
            border: '1px solid rgba(58,190,255,0.3)',
            borderRadius: 12,
            color: '#fff',
            fontSize: 14,
            outline: 'none'
          }}
        />
        <button 
          onClick={handleSendMessage}
          disabled={loading || !inputMessage.trim()}
          style={{
            padding: '15px 30px',
            background: loading || !inputMessage.trim() ? '#334155' : 'linear-gradient(135deg, #3ABEFF, #7B61FF)',
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            cursor: loading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            fontSize: 14,
            boxShadow: loading || !inputMessage.trim() ? 'none' : '0 4px 20px rgba(58,190,255,0.3)'
          }}
        >
          Send 🚀
        </button>
      </div>
    </div>
  );
}

export default SatelliteInfoPanel;

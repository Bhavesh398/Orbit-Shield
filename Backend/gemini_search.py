"""
Gemini API with Google Search Grounding
Provides live data fetching for satellite information
"""
import google.generativeai as genai
import os
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()
logger = logging.getLogger(__name__)

class ChatRequest(BaseModel):
    satellite_data: dict
    user_message: str
    api_key: str

@router.post("/api/gemini-chat")
async def gemini_chat(request: ChatRequest):
    """
    Chat endpoint with Google Search grounding for live data
    """
    try:
        logger.info(f"Gemini chat request received for satellite: {request.satellite_data.get('name', 'Unknown')}")
        
        # Configure Gemini with the provided API key
        genai.configure(api_key=request.api_key)
        
        # Build satellite context from provided data
        satellite_context = build_satellite_context(request.satellite_data)
        
        # System prompt with satellite information
        system_prompt = f"""You are an expert satellite analyst assistant. You have detailed information about the satellite: {request.satellite_data.get('name') or request.satellite_data.get('sat_name') or request.satellite_data.get('norad_id')}.

{satellite_context}

Provide detailed, accurate, and helpful information about this satellite based on the available data. Format your responses with bullet points and sections when appropriate. Be concise but informative. When the user asks about current status, recent updates, or live information, use Google Search to find accurate, real-time information."""
        
        # Initialize model WITHOUT Google Search grounding for now (due to API restrictions)
        # Google Search grounding may not be available in all regions/tiers
        # Using gemini-2.5-flash (stable, available on this API key)
        logger.info("Initializing Gemini model without search grounding")
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Generate response
        full_prompt = system_prompt + "\n\nUser question: " + request.user_message
        logger.info(f"Generating content for prompt length: {len(full_prompt)}")
        response = model.generate_content(full_prompt)
        
        logger.info("Response generated successfully")
        
        return {
            "response": response.text,
            "has_live_data": False,  # No search capability for now
            "sources": None
        }
        
    except Exception as e:
        logger.error(f"Gemini API error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")


def build_satellite_context(sat_data: dict) -> str:
    """Build satellite context from available data, excluding unknowns"""
    context_lines = []
    
    # Helper to check if value is valid
    def is_valid(val):
        if val is None:
            return False
        if isinstance(val, str) and val.lower() in ['unknown', 'n/a', 'data not available', '']:
            return False
        return True
    
    # Add fields if they exist and are valid
    if is_valid(sat_data.get('name') or sat_data.get('sat_name')):
        context_lines.append(f"- Name: {sat_data.get('name') or sat_data.get('sat_name')}")
    
    if is_valid(sat_data.get('sat_id')):
        context_lines.append(f"- NORAD ID: {sat_data.get('sat_id')}")
    elif is_valid(sat_data.get('norad_id')):
        context_lines.append(f"- NORAD ID: {sat_data.get('norad_id')}")
    
    if is_valid(sat_data.get('altitude_km') or sat_data.get('altitude')):
        alt = sat_data.get('altitude_km') or sat_data.get('altitude')
        context_lines.append(f"- Altitude: {alt} km")
    
    if is_valid(sat_data.get('latitude')) and is_valid(sat_data.get('longitude')):
        context_lines.append(f"- Position: {sat_data.get('latitude')}°N, {sat_data.get('longitude')}°E")
    
    if is_valid(sat_data.get('inclination_deg') or sat_data.get('inclination')):
        inc = sat_data.get('inclination_deg') or sat_data.get('inclination')
        context_lines.append(f"- Inclination: {inc}°")
    
    if is_valid(sat_data.get('velocity_kmps') or sat_data.get('velocity')):
        vel = sat_data.get('velocity_kmps') or sat_data.get('velocity')
        context_lines.append(f"- Velocity: {vel} km/s")
    
    if is_valid(sat_data.get('status')):
        context_lines.append(f"- Status: {sat_data.get('status')}")
    
    if is_valid(sat_data.get('launch_date')):
        context_lines.append(f"- Launch Date: {sat_data.get('launch_date')}")
    
    if is_valid(sat_data.get('country')):
        context_lines.append(f"- Country: {sat_data.get('country')}")
    
    if is_valid(sat_data.get('purpose')):
        context_lines.append(f"- Purpose: {sat_data.get('purpose')}")
    
    if is_valid(sat_data.get('mass')):
        context_lines.append(f"- Mass: {sat_data.get('mass')} kg")
    
    if context_lines:
        return "Satellite Data:\n" + "\n".join(context_lines)
    else:
        return "Limited satellite data available."

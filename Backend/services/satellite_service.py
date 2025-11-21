"""
Satellite Service
Business logic for satellite operations
"""
from typing import Optional, List, Dict
from datetime import datetime
from config.supabase_client import supabase_client
from config.local_cache import local_cache
from config.sql_loader import load_satellites_from_sql
from core.orbital.propagate_tle import tle_to_position
from core.orbital.vector_math import compute_distance
import uuid


class SatelliteService:
    """Service for satellite CRUD and tracking operations"""
    
    TABLE_NAME = "satellites"
    
    async def get_all_satellites(self, limit: Optional[int] = 100) -> List[Dict]:
        """Get all satellites from Supabase"""
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Fetching satellites from Supabase with limit={limit}")
        
        satellites = await supabase_client.select(self.TABLE_NAME, limit=limit)
        logger.info(f"Retrieved {len(satellites)} satellites from Supabase")
        
        # If still no data, return empty list (no fallback)
        if not satellites:
            logger.warning("No satellites found in Supabase")
            return []
        
        # Update positions for each satellite
        for sat in satellites:
            # Normalize naming: map Supabase 'sat_name' to 'name' for frontend
            if 'name' not in sat and 'sat_name' in sat:
                sat['name'] = sat['sat_name']
            
            # Map Supabase coordinate fields (sat_x, sat_y, etc.) to expected fields (x, y, etc.)
            if 'x' not in sat and 'sat_x' in sat:
                sat['x'] = sat['sat_x']
            if 'y' not in sat and 'sat_y' in sat:
                sat['y'] = sat['sat_y']
            if 'z' not in sat and 'sat_z' in sat:
                sat['z'] = sat['sat_z']
            if 'vx' not in sat and 'sat_vx' in sat:
                sat['vx'] = sat['sat_vx']
            if 'vy' not in sat and 'sat_vy' in sat:
                sat['vy'] = sat['sat_vy']
            if 'vz' not in sat and 'sat_vz' in sat:
                sat['vz'] = sat['sat_vz']
            
            # In Supabase, sat_name IS the NORAD ID, not a separate field
            # Use sat_name or name as the NORAD ID for TLE propagation
            norad_id = sat.get("norad_id") or sat.get("sat_name") or sat.get("name")
            
            # Update position from TLE if we have a satellite identifier
            if norad_id:
                lat, lon, alt = tle_to_position(str(norad_id))
                sat["latitude"] = lat
                sat["longitude"] = lon
                sat["altitude_km"] = alt
                # Store the norad_id for reference
                if "norad_id" not in sat:
                    sat["norad_id"] = norad_id
            
            # Always calculate x,y,z,vx,vy,vz if we have lat/lon/alt
            lat = sat.get("latitude")
            lon = sat.get("longitude")
            alt = sat.get("altitude_km") or sat.get("altitude")
            
            if lat is not None and lon is not None and alt is not None:
                try:
                    import math
                    r = 6371.0 + float(alt)
                    lat_r = math.radians(float(lat))
                    lon_r = math.radians(float(lon))
                    sat["x"] = r * math.cos(lat_r) * math.cos(lon_r)
                    sat["y"] = r * math.sin(lat_r)
                    sat["z"] = r * math.cos(lat_r) * math.sin(lon_r)
                    v_mag = sat.get("velocity_kmps") or sat.get("velocity") or 7.5
                    # Simple tangential velocity approximation in local horizontal plane
                    sat["vx"] = -float(v_mag) * math.sin(lon_r)
                    sat["vy"] = float(v_mag) * math.cos(lon_r)
                    sat["vz"] = 0.0
                except Exception as e:
                    # If coordinate calculation fails, set defaults to avoid crashes
                    import logging
                    logging.warning(f"Failed to calculate coordinates for satellite {sat.get('id')}: {e}")
                    sat.setdefault("x", 0.0)
                    sat.setdefault("y", 0.0)
                    sat.setdefault("z", 0.0)
                    sat.setdefault("vx", 0.0)
                    sat.setdefault("vy", 0.0)
                    sat.setdefault("vz", 0.0)
        
        return satellites
    
    async def get_satellite_by_id(self, satellite_id: str) -> Optional[Dict]:
        """Get satellite by ID from database"""
        satellite = await supabase_client.select_by_id(self.TABLE_NAME, satellite_id)
        if not satellite:
            satellite = local_cache.get_by_id(self.TABLE_NAME, satellite_id)
            if not satellite:
                return None
        
        # Map Supabase coordinate fields (sat_x, sat_y, etc.) to expected fields (x, y, etc.)
        if 'x' not in satellite and 'sat_x' in satellite:
            satellite['x'] = satellite['sat_x']
        if 'y' not in satellite and 'sat_y' in satellite:
            satellite['y'] = satellite['sat_y']
        if 'z' not in satellite and 'sat_z' in satellite:
            satellite['z'] = satellite['sat_z']
        if 'vx' not in satellite and 'sat_vx' in satellite:
            satellite['vx'] = satellite['sat_vx']
        if 'vy' not in satellite and 'sat_vy' in satellite:
            satellite['vy'] = satellite['sat_vy']
        if 'vz' not in satellite and 'sat_vz' in satellite:
            satellite['vz'] = satellite['sat_vz']
        
        # Update current position
        # In Supabase, sat_name IS the NORAD ID, not a separate field
        # Use sat_name or name as the NORAD ID for TLE propagation
        norad_id = satellite.get("norad_id") or satellite.get("sat_name") or satellite.get("name")
        
        if norad_id:
            lat, lon, alt = tle_to_position(str(norad_id))
            satellite["latitude"] = lat
            satellite["longitude"] = lon
            satellite["altitude_km"] = alt
            # Store the norad_id for reference
            if "norad_id" not in satellite:
                satellite["norad_id"] = norad_id
        
        # Always calculate x,y,z,vx,vy,vz if we have lat/lon/alt
        lat = satellite.get("latitude")
        lon = satellite.get("longitude")
        alt = satellite.get("altitude_km") or satellite.get("altitude")
        
        if lat is not None and lon is not None and alt is not None:
            try:
                import math
                r = 6371.0 + float(alt)
                lat_r = math.radians(float(lat))
                lon_r = math.radians(float(lon))
                satellite["x"] = r * math.cos(lat_r) * math.cos(lon_r)
                satellite["y"] = r * math.sin(lat_r)
                satellite["z"] = r * math.cos(lat_r) * math.sin(lon_r)
                v_mag = satellite.get("velocity_kmps") or satellite.get("velocity") or 7.5
                satellite["vx"] = -float(v_mag) * math.sin(lon_r)
                satellite["vy"] = float(v_mag) * math.cos(lon_r)
                satellite["vz"] = 0.0
            except Exception as e:
                # If coordinate calculation fails, set defaults to avoid crashes
                import logging
                logging.warning(f"Failed to calculate coordinates for satellite {satellite.get('id')}: {e}")
                satellite.setdefault("x", 0.0)
                satellite.setdefault("y", 0.0)
                satellite.setdefault("z", 0.0)
                satellite.setdefault("vx", 0.0)
                satellite.setdefault("vy", 0.0)
                satellite.setdefault("vz", 0.0)
        
        return satellite
    
    async def create_satellite(self, data: Dict) -> Dict:
        """Create new satellite"""
        satellite_data = {
            **data,
            "id": str(uuid.uuid4()),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        result = await supabase_client.insert(self.TABLE_NAME, satellite_data)
        # Local cache write-through already handled in client; ensure present
        local_cache.upsert_satellite(satellite_data)
        return result or satellite_data
    
    async def update_satellite(self, satellite_id: str, data: Dict) -> Optional[Dict]:
        """Update satellite"""
        update_data = {
            **data,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        result = await supabase_client.update(self.TABLE_NAME, satellite_id, update_data)
        local_cache.upsert_satellite({"id": satellite_id, **update_data})
        return result or {"id": satellite_id, **update_data}
    
    async def delete_satellite(self, satellite_id: str) -> bool:
        """Delete satellite"""
        deleted = await supabase_client.delete(self.TABLE_NAME, satellite_id)
        if deleted:
            local_cache.delete(self.TABLE_NAME, satellite_id)
        return deleted
    
    def _get_mock_satellites(self) -> List[Dict]:
        """Generate mock satellite data"""
        current_time = datetime.utcnow().isoformat()
        
        return [
            {
                "id": "sat-001",
                "name": "Sat-01",
                "norad_id": "25544",
                "altitude_km": 450.0,
                "inclination_deg": 51.6,
                "latitude": 20.5,
                "longitude": -45.3,
                "velocity_kmps": 7.66,
                "status": "active",
                "created_at": current_time,
                "updated_at": current_time
            },
            {
                "id": "sat-002",
                "name": "Sat-02",
                "norad_id": "25545",
                "altitude_km": 470.0,
                "inclination_deg": 52.3,
                "latitude": 30.2,
                "longitude": -120.5,
                "velocity_kmps": 7.62,
                "status": "active",
                "created_at": current_time,
                "updated_at": current_time
            },
            {
                "id": "sat-003",
                "name": "Sat-03",
                "norad_id": "25546",
                "altitude_km": 500.0,
                "inclination_deg": 53.1,
                "latitude": -15.8,
                "longitude": 78.2,
                "velocity_kmps": 7.58,
                "status": "active",
                "created_at": current_time,
                "updated_at": current_time
            },
            {
                "id": "sat-004",
                "name": "Sat-04",
                "norad_id": "25547",
                "altitude_km": 520.0,
                "inclination_deg": 54.0,
                "latitude": -25.3,
                "longitude": 150.7,
                "velocity_kmps": 7.55,
                "status": "active",
                "created_at": current_time,
                "updated_at": current_time
            }
        ]


satellite_service = SatelliteService()

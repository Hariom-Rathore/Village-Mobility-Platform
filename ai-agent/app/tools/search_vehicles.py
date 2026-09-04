"""
Tool: Search Vehicles
Searches for available vehicles using RideLocal backend API
"""
from typing import Dict, Any, Optional
from loguru import logger
from ..services.ridelocal_client import ridelocal_client


async def search_vehicles(
    pickup: str,
    destination: str,
    passengers: int = 1,
    vehicle_type: Optional[str] = None,
    pickup_lat: Optional[float] = None,
    pickup_lng: Optional[float] = None,
    dest_lat: Optional[float] = None,
    dest_lng: Optional[float] = None,
    ac_only: bool = False,
    verified_only: bool = False,
    min_rating: Optional[float] = None,
    max_price: Optional[float] = None,
    seat_capacity: Optional[int] = None,
    sort: str = "nearest"
) -> Dict[str, Any]:
    """
    Search for available vehicles using RideLocal search API
    
    Args:
        pickup: Pickup location/address
        destination: Destination address
        passengers: Number of passengers (default: 1)
        vehicle_type: Vehicle type filter (SUV, Sedan, etc.)
        pickup_lat: Pickup latitude
        pickup_lng: Pickup longitude
        dest_lat: Destination latitude
        dest_lng: Destination longitude
        ac_only: Filter for AC vehicles only
        min_rating: Minimum rating filter
        max_price: Maximum price filter
        sort: Sort order (nearest, rating, price_low, price_high)
    
    Returns:
        Dict containing search results and trip information
    """
    try:
        logger.info(f"Searching vehicles: {pickup} to {destination}, {passengers} passengers")
        
        result = await ridelocal_client.search_vehicles(
            pickup=pickup,
            destination=destination,
            passengers=passengers,
            vehicle_type=vehicle_type,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            dest_lat=dest_lat,
            dest_lng=dest_lng,
            ac_only=ac_only,
            verified_only=verified_only,
            min_rating=min_rating,
            max_price=max_price,
            seat_capacity=seat_capacity,
            sort=sort
        )
        
        if not result.get("success"):
            logger.error(f"Search failed: {result.get('error')}")
            return {
                "success": False,
                "error": result.get("error", "Search failed"),
                "vehicles": [],
                "trip": None
            }
        
        vehicles = result.get("vehicles", [])
        trip_info = result.get("trip", {})
        
        logger.info(f"Search successful: {len(vehicles)} vehicles found")
        
        return {
            "success": True,
            "vehicles": vehicles,
            "trip": trip_info,
            "vehicle_count": len(vehicles)
        }
        
    except Exception as e:
        logger.error(f"Error in search_vehicles tool: {e}")
        return {
            "success": False,
            "error": str(e),
            "vehicles": [],
            "trip": None
        }
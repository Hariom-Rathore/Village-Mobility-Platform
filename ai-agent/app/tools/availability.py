"""
Tool: Check Vehicle Availability
Checks if a vehicle is available for specific dates
"""
from typing import Dict, Any, Optional
from loguru import logger
from ..services.ridelocal_client import ridelocal_client


async def check_vehicle_availability(
    vehicle_id: str,
    pickup_date: str,
    return_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Check if vehicle is available for specific dates
    
    Args:
        vehicle_id: The vehicle/listing ID
        pickup_date: Pickup date (ISO format: YYYY-MM-DD)
        return_date: Return date (ISO format: YYYY-MM-DD), optional
    
    Returns:
        Dict containing availability status and vehicle info
    """
    try:
        logger.info(f"Checking availability for {vehicle_id} from {pickup_date} to {return_date}")
        
        result = await ridelocal_client.check_availability(
            vehicle_id=vehicle_id,
            pickup_date=pickup_date,
            return_date=return_date
        )
        
        if not result.get("success"):
            logger.error(f"Availability check failed: {result.get('error')}")
            return {
                "success": False,
                "error": result.get("error", "Availability check failed"),
                "available": False,
                "vehicle": None
            }
        
        available = result.get("available", False)
        vehicle_info = result.get("vehicle", {})
        
        logger.info(f"Availability check for {vehicle_id}: {available}")
        
        return {
            "success": True,
            "available": available,
            "vehicle": vehicle_info,
            "vehicle_id": vehicle_id,
            "pickup_date": pickup_date,
            "return_date": return_date
        }
        
    except Exception as e:
        logger.error(f"Error in check_vehicle_availability tool: {e}")
        return {
            "success": False,
            "error": str(e),
            "available": False,
            "vehicle_id": vehicle_id
        }
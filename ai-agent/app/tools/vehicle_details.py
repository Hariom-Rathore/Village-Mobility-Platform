"""
Tool: Get Vehicle Details
Retrieves detailed vehicle information from RideLocal backend
"""
from typing import Dict, Any, Optional
from loguru import logger
from ..services.ridelocal_client import ridelocal_client


async def get_vehicle_details(vehicle_id: str) -> Dict[str, Any]:
    """
    Get detailed vehicle information
    
    Args:
        vehicle_id: The vehicle/listing ID
    
    Returns:
        Dict containing vehicle details
    """
    try:
        logger.info(f"Getting vehicle details for {vehicle_id}")
        
        result = await ridelocal_client.get_vehicle_details(vehicle_id)
        
        logger.info(f"Vehicle details retrieved successfully for {vehicle_id}")
        
        vehicle = result.get("vehicle", result) if isinstance(result, dict) else result
        return {
            "success": True,
            "vehicle": vehicle,
            "vehicle_id": vehicle_id
        }
        
    except Exception as e:
        logger.error(f"Error in get_vehicle_details tool: {e}")
        return {
            "success": False,
            "error": str(e),
            "vehicle_id": vehicle_id
        }
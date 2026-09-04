"""
Tool: Booking Operations
Handles booking request creation and related operations
"""
from typing import Dict, Any, Optional
from loguru import logger
from ..services.ridelocal_client import ridelocal_client


async def create_booking_request(
    vehicle_id: str,
    auth_token: str,
    pickup_location: str,
    destination: str,
    pickup_date: str,
    pickup_time: str,
    passengers: int,
    trip_type: str = "local",
    pickup_lat: Optional[float] = None,
    pickup_lng: Optional[float] = None,
    dest_lat: Optional[float] = None,
    dest_lng: Optional[float] = None,
    distance_km: Optional[float] = None,
    special_instructions: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a booking request through RideLocal backend
    
    Args:
        vehicle_id: The vehicle/listing ID
        auth_token: User authentication token
        pickup_location: Pickup address
        destination: Destination address
        pickup_date: Pickup date (ISO format)
        pickup_time: Pickup time (HH:MM format)
        passengers: Number of passengers
        trip_type: Type of trip (local, outstation, etc.)
        pickup_lat: Pickup latitude
        pickup_lng: Pickup longitude
        dest_lat: Destination latitude
        dest_lng: Destination longitude
        distance_km: Estimated distance in km
        special_instructions: Additional instructions
    
    Returns:
        Dict containing booking request result
    """
    try:
        logger.info(f"Creating booking request for vehicle {vehicle_id}")
        
        result = await ridelocal_client.create_booking_request(
            vehicle_id=vehicle_id,
            auth_token=auth_token,
            pickup_location=pickup_location,
            destination=destination,
            pickup_date=pickup_date,
            pickup_time=pickup_time,
            passengers=passengers,
            trip_type=trip_type,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            dest_lat=dest_lat,
            dest_lng=dest_lng,
            distance_km=distance_km,
            special_instructions=special_instructions
        )
        
        if not result.get("success"):
            logger.error(f"Booking request failed: {result.get('error')}")
            return {
                "success": False,
                "error": result.get("error", "Booking request failed"),
                "booking_id": None,
                "status": None
            }
        
        booking_id = result.get("bookingId")
        status = result.get("message", "PENDING")
        expires_at = result.get("expiresAt")
        
        logger.info(f"Booking request created successfully: {booking_id}")
        
        return {
            "success": True,
            "booking_id": booking_id,
            "status": status,
            "expires_at": expires_at,
            "message": result.get("message", "Booking request sent"),
            "vehicle_id": vehicle_id
        }
        
    except ValueError as e:
        # Authentication error
        logger.error(f"Authentication error in create_booking_request: {e}")
        return {
            "success": False,
            "error": "Authentication required. Please log in.",
            "booking_id": None,
            "status": None
        }
    except Exception as e:
        logger.error(f"Error in create_booking_request tool: {e}")
        return {
            "success": False,
            "error": str(e),
            "booking_id": None,
            "status": None
        }


async def cancel_booking(
    booking_id: str,
    auth_token: str,
    reason: Optional[str] = None
) -> Dict[str, Any]:
    """
    Cancel an existing booking
    
    Args:
        booking_id: The booking ID
        auth_token: User authentication token
        reason: Cancellation reason
    
    Returns:
        Dict containing cancellation result
    """
    try:
        logger.info(f"Cancelling booking {booking_id}")
        
        result = await ridelocal_client.cancel_booking(
            booking_id=booking_id,
            auth_token=auth_token,
            reason=reason
        )
        
        if not result.get("success"):
            logger.error(f"Booking cancellation failed: {result.get('error')}")
            return {
                "success": False,
                "error": result.get("error", "Cancellation failed"),
                "booking_id": booking_id
            }
        
        logger.info(f"Booking {booking_id} cancelled successfully")
        
        return {
            "success": True,
            "booking_id": booking_id,
            "message": result.get("message", "Booking cancelled successfully")
        }
        
    except ValueError as e:
        logger.error(f"Authorization error in cancel_booking: {e}")
        return {
            "success": False,
            "error": str(e),
            "booking_id": booking_id
        }
    except Exception as e:
        logger.error(f"Error in cancel_booking tool: {e}")
        return {
            "success": False,
            "error": str(e),
            "booking_id": booking_id
        }
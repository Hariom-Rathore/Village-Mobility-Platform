"""
Tool: User Bookings
Retrieves user's booking information
"""
from typing import Dict, Any, Optional, List
from loguru import logger
from ..services.ridelocal_client import ridelocal_client


async def get_user_bookings(
    auth_token: str,
    status: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get user's bookings from RideLocal backend
    
    Args:
        auth_token: User authentication token
        status: Filter by booking status (optional)
    
    Returns:
        Dict containing user's bookings
    """
    try:
        logger.info(f"Retrieving user bookings with status filter: {status}")
        
        result = await ridelocal_client.get_user_bookings(
            auth_token=auth_token,
            status=status
        )
        
        if not result.get("success"):
            logger.error(f"Failed to get user bookings: {result.get('error')}")
            return {
                "success": False,
                "error": result.get("error", "Failed to retrieve bookings"),
                "bookings": []
            }
        
        bookings = result.get("bookings", [])
        
        logger.info(f"Retrieved {len(bookings)} bookings for user")
        
        return {
            "success": True,
            "bookings": bookings,
            "booking_count": len(bookings),
            "status_filter": status
        }
        
    except ValueError as e:
        logger.error(f"Authentication error in get_user_bookings: {e}")
        return {
            "success": False,
            "error": "Authentication required. Please log in.",
            "bookings": []
        }
    except Exception as e:
        logger.error(f"Error in get_user_bookings tool: {e}")
        return {
            "success": False,
            "error": str(e),
            "bookings": []
        }


async def get_booking_details(
    booking_id: str,
    auth_token: str
) -> Dict[str, Any]:
    """
    Get detailed information about a specific booking
    
    Args:
        booking_id: The booking ID
        auth_token: User authentication token
    
    Returns:
        Dict containing booking details
    """
    try:
        logger.info(f"Getting details for booking {booking_id}")
        
        result = await ridelocal_client.get_booking_details(
            booking_id=booking_id,
            auth_token=auth_token
        )
        
        if not result.get("success"):
            logger.error(f"Failed to get booking details: {result.get('error')}")
            return {
                "success": False,
                "error": result.get("error", "Failed to retrieve booking details"),
                "booking": None
            }
        
        booking = result.get("booking")
        
        logger.info(f"Booking details retrieved for {booking_id}")
        
        return {
            "success": True,
            "booking": booking,
            "booking_id": booking_id
        }
        
    except ValueError as e:
        logger.error(f"Authorization error in get_booking_details: {e}")
        return {
            "success": False,
            "error": str(e),
            "booking_id": booking_id,
            "booking": None
        }
    except Exception as e:
        logger.error(f"Error in get_booking_details tool: {e}")
        return {
            "success": False,
            "error": str(e),
            "booking_id": booking_id,
            "booking": None
        }
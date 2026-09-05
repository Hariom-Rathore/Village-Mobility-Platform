"""
RideLocal Backend API Client
Handles communication with the existing RideLocal Node.js backend
"""
import httpx
from typing import Optional, Dict, List, Any
from datetime import datetime
from loguru import logger
from ..config import settings


class RideLocalClient:
    """Client for RideLocal Backend API"""
    
    def __init__(self):
        self.base_url = settings.RIDELocal_BACKEND_URL
        self.timeout = settings.RIDELocal_API_TIMEOUT
        self._client: Optional[httpx.AsyncClient] = None
    
    async def get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client"""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client
    
    async def close(self):
        """Close HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    # Vehicle Search APIs
    async def search_vehicles(
        self,
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
        Search for vehicles using existing RideLocal search API
        POST /customers/api/search
        """
        try:
            client = await self.get_client()
            payload = {
                "pickup": pickup,
                "destination": destination,
                "passengers": passengers,
                "vehicleType": vehicle_type,
                "pickupLat": pickup_lat,
                "pickupLng": pickup_lng,
                "destLat": dest_lat,
                "destLng": dest_lng,
                "acOnly": ac_only,
                "verifiedOnly": verified_only,
                "minRating": min_rating,
                "maxPrice": max_price,
                "seatCapacity": seat_capacity,
                "sort": sort
            }
            
            # Remove None values
            payload = {k: v for k, v in payload.items() if v is not None}
            
            response = await client.post(
                f"{self.base_url}/customers/api/search",
                json=payload
            )
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"Vehicle search successful: {len(data.get('vehicles', []))} vehicles found")
            return data
            
        except httpx.HTTPStatusError as e:
            try:
                detail = e.response.json().get("error", "Search request was rejected")
            except ValueError:
                detail = "Search request was rejected"
            logger.error(f"Vehicle search rejected ({e.response.status_code}): {detail}")
            raise ValueError(detail) from e
        except Exception as e:
            logger.error(f"Error searching vehicles: {e}")
            raise
    
    async def get_vehicle_details(self, vehicle_id: str) -> Dict[str, Any]:
        """
        Get detailed vehicle information
        GET /api/ai/vehicles/:id (thin JSON bridge over the existing Listing model)
        """
        try:
            client = await self.get_client()
            response = await client.get(f"{self.base_url}/api/ai/vehicles/{vehicle_id}")
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"Vehicle details retrieved for {vehicle_id}")
            return data
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error getting vehicle details: {e}")
            raise
        except Exception as e:
            logger.error(f"Error getting vehicle details: {e}")
            raise
    
    # Availability APIs
    async def check_availability(
        self,
        vehicle_id: str,
        pickup_date: str,
        return_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Check vehicle availability
        GET /bookings/check/:id
        """
        try:
            client = await self.get_client()
            params = {
                "pickupDate": pickup_date,
                "returnDate": return_date
            }
            # Remove None values
            params = {k: v for k, v in params.items() if v is not None}
            
            response = await client.get(
                f"{self.base_url}/bookings/check/{vehicle_id}",
                params=params
            )
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"Availability check for {vehicle_id}: {data.get('available')}")
            return data
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error checking availability: {e}")
            raise
        except Exception as e:
            logger.error(f"Error checking availability: {e}")
            raise
    
    async def get_availability_calendar(
        self,
        vehicle_id: str,
        start_date: str,
        end_date: str
    ) -> Dict[str, Any]:
        """
        Get availability calendar for vehicle
        GET /bookings/calendar/:id
        """
        try:
            client = await self.get_client()
            params = {
                "startDate": start_date,
                "endDate": end_date
            }
            
            response = await client.get(
                f"{self.base_url}/bookings/calendar/{vehicle_id}",
                params=params
            )
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"Calendar retrieved for {vehicle_id}")
            return data
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error getting calendar: {e}")
            raise
        except Exception as e:
            logger.error(f"Error getting calendar: {e}")
            raise
    
    # Booking APIs (require authentication)
    async def create_booking_request(
        self,
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
        Create booking request
        POST /bookings/request/:id
        """
        try:
            client = await self.get_client()
            headers = {
                "Authorization": f"Bearer {auth_token}",
                "Cookie": auth_token  # Try both header and cookie for session auth
            }
            
            payload = {
                "booking": {
                    "pickupLocation": pickup_location,
                    "destination": destination,
                    "pickupDate": pickup_date,
                    "pickupTime": pickup_time,
                    "passengers": passengers,
                    "tripType": trip_type,
                    "pickupCoordinates": [pickup_lng, pickup_lat] if pickup_lat and pickup_lng else None,
                    "destinationCoordinates": [dest_lng, dest_lat] if dest_lat and dest_lng else None,
                    "distanceKm": distance_km,
                    "specialInstructions": special_instructions
                }
            }
            
            # Remove None values from booking
            payload["booking"] = {k: v for k, v in payload["booking"].items() if v is not None}
            
            response = await client.post(
                f"{self.base_url}/bookings/request/{vehicle_id}",
                json=payload,
                headers=headers
            )
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"Booking request created: {data.get('bookingId')}")
            return data
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error creating booking request: {e}")
            if e.response.status_code == 401:
                raise ValueError("Authentication required")
            raise
        except Exception as e:
            logger.error(f"Error creating booking request: {e}")
            raise
    
    async def get_user_bookings(
        self,
        auth_token: str,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get user's bookings
        GET /bookings/user
        """
        try:
            client = await self.get_client()
            headers = {
                "Authorization": f"Bearer {auth_token}",
                "Cookie": auth_token
            }
            params = {}
            if status:
                params["status"] = status
            
            response = await client.get(
                f"{self.base_url}/bookings/user",
                params=params,
                headers=headers
            )
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"Retrieved {len(data.get('bookings', []))} bookings for user")
            return data
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error getting user bookings: {e}")
            if e.response.status_code == 401:
                raise ValueError("Authentication required")
            raise
        except Exception as e:
            logger.error(f"Error getting user bookings: {e}")
            raise
    
    async def get_booking_details(
        self,
        booking_id: str,
        auth_token: str
    ) -> Dict[str, Any]:
        """
        Get booking details
        GET /bookings/:bookingId/details
        """
        try:
            client = await self.get_client()
            headers = {
                "Authorization": f"Bearer {auth_token}",
                "Cookie": auth_token
            }
            
            response = await client.get(
                f"{self.base_url}/bookings/{booking_id}/details",
                headers=headers
            )
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"Booking details retrieved for {booking_id}")
            return data
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error getting booking details: {e}")
            if e.response.status_code == 401:
                raise ValueError("Authentication required")
            if e.response.status_code == 403:
                raise ValueError("Not authorized to access this booking")
            if e.response.status_code == 404:
                raise ValueError("Booking not found")
            raise
        except Exception as e:
            logger.error(f"Error getting booking details: {e}")
            raise
    
    async def cancel_booking(
        self,
        booking_id: str,
        auth_token: str,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Cancel booking
        DELETE /bookings/:bookingId
        """
        try:
            client = await self.get_client()
            headers = {
                "Authorization": f"Bearer {auth_token}",
                "Cookie": auth_token
            }
            payload = {}
            if reason:
                payload["reason"] = reason
            
            response = await client.delete(
                f"{self.base_url}/bookings/{booking_id}",
                json=payload,
                headers=headers
            )
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"Booking {booking_id} cancelled")
            return data
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error cancelling booking: {e}")
            if e.response.status_code == 401:
                raise ValueError("Authentication required")
            if e.response.status_code == 403:
                raise ValueError("Not authorized to cancel this booking")
            raise
        except Exception as e:
            logger.error(f"Error cancelling booking: {e}")
            raise
    
    # Geocoding APIs
    async def geocode_address(self, address: str) -> List[Dict[str, Any]]:
        """
        Geocode address to coordinates
        GET /cars/geocode
        """
        try:
            client = await self.get_client()
            params = {"q": address}
            
            response = await client.get(
                f"{self.base_url}/cars/geocode",
                params=params
            )
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"Geocoded address: {address}")
            return data
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error geocoding address: {e}")
            raise
        except Exception as e:
            logger.error(f"Error geocoding address: {e}")
            raise


# Global client instance
ridelocal_client = RideLocalClient()

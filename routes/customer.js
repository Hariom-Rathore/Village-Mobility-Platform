const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../utils/middleware');
const Listing = require('../models/listing');

router.get('/home', (req, res) => {
    res.render('customers/home');
});

router.get('/my-trips', isLoggedIn, (req, res) => {
    res.render('customers/my-trips');
});

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodeAddress(address) {
    if (!address || !address.trim()) return null;
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address.trim())}`;
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'RideLocal/1.0', 'Accept-Language': 'en' }
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || data.length === 0) return null;
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
    } catch { return null; }
}

function buildVehicleResult(v, pickupCoords, tripDistanceKm, estimatedDuration) {
    const vCoords = v.locationCoordinates?.coordinates;
    let distFromPickup = 0;
    let vLat = 0, vLng = 0;
    if (vCoords && vCoords.length === 2) {
        vLng = vCoords[0];
        vLat = vCoords[1];
        if (vLat !== 0 || vLng !== 0) {
            distFromPickup = haversineKm(pickupCoords.lat, pickupCoords.lng, vLat, vLng);
        }
    }

    const baseFare = v.baseFare || v.price || 0;
    const pricePerKm = v.pricePerKm || v.ratePerKm || 0;
    const estimatedFare = Math.ceil(baseFare + (tripDistanceKm * pricePerKm));
    const etaMin = Math.max(2, Math.round(distFromPickup / 30 * 60));
    const ownerVerified = v.owner?.isVerified || false;

    return {
        _id: v._id,
        title: v.title,
        vehicleName: v.vehicleName || v.title || 'Vehicle',
        image: (v.images && v.images[0]?.url) || v.image?.url || '',
        seats: v.seats || 4,
        vehicleType: v.vehicleType || v.carType || 'Sedan',
        transmission: v.transmission || 'manual',
        acAvailable: v.acAvailable,
        rating: v.averageRating || 0,
        totalReviews: v.totalReviews || 0,
        verified: ownerVerified,
        baseFare,
        pricePerKm,
        estimatedFare,
        distanceFromPickup: Math.round(distFromPickup * 10) / 10,
        etaMin,
        tripDistanceKm: Math.round(tripDistanceKm * 10) / 10,
        estimatedDuration,
        lat: vLat,
        lng: vLng,
        city: v.city || v.location || '',
        owner: v.owner ? {
            name: v.owner.username,
            rating: v.owner.averageRating,
            verified: ownerVerified
        } : null
    };
}

function buildSeatFilter(pax, seatCapacity) {
    const filter = {};
    if (pax && pax > 0) {
        filter.seats = { $gte: pax };
    }
    if (seatCapacity) {
        filter.seats = { ...(filter.seats || {}), $gte: parseInt(seatCapacity) };
    }
    return filter;
}

async function findNearbyVehicles(pickupCoords, seatFilter, sortOption) {
    const filter = {
        websiteSource: "car-rental",
        availabilityStatus: "AVAILABLE",
        locationCoordinates: {
            $near: {
                $geometry: { type: "Point", coordinates: [pickupCoords.lng, pickupCoords.lat] },
                $maxDistance: 50000
            }
        },
        ...seatFilter
    };

    return Listing.find(filter)
        .populate('owner', 'username email phoneNumber averageRating isVerified')
        .sort(sortOption)
        .limit(50);
}

async function findVehiclesByLocationText(pickupName, seatFilter, sortOption) {
    const cityToken = pickupName.trim().split(/[\s,]+/)[0];
    if (!cityToken) return [];

    const regex = new RegExp(cityToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return Listing.find({
        websiteSource: "car-rental",
        availabilityStatus: "AVAILABLE",
        $or: [
            { city: regex },
            { location: regex },
            { district: regex },
            { state: regex },
            { area: regex },
            { village: regex }
        ],
        ...seatFilter
    })
        .populate('owner', 'username email phoneNumber averageRating isVerified')
        .sort(sortOption)
        .limit(50);
}

async function findAllAvailableVehicles(seatFilter, sortOption) {
    return Listing.find({
        websiteSource: "car-rental",
        availabilityStatus: "AVAILABLE",
        ...seatFilter
    })
        .populate('owner', 'username email phoneNumber averageRating isVerified')
        .sort(sortOption)
        .limit(50);
}

router.post('/api/search', async (req, res) => {
    try {
        const {
            pickup, destination, pickupLat, pickupLng, destLat, destLng,
            passengers, vehicleType, sort, acOnly, verifiedOnly, minRating,
            maxPrice, seatCapacity
        } = req.body;

        if (!pickup && !destination) {
            const featuredVehicles = await Listing.find({
                websiteSource: 'car-rental',
                availabilityStatus: 'AVAILABLE'
            })
                .populate('owner', 'username email phoneNumber averageRating isVerified')
                .sort({ averageRating: -1, createdAt: -1 })
                .limit(12);

            const results = featuredVehicles.map(v => {
                const baseFare = v.baseFare || v.price || 0;
                const pricePerKm = v.pricePerKm || v.ratePerKm || 0;
                const ownerVerified = v.owner?.isVerified || false;

                return {
                    _id: v._id,
                    title: v.title,
                    vehicleName: v.vehicleName || v.title || 'Vehicle',
                    image: (v.images && v.images[0]?.url) || v.image?.url || '',
                    seats: v.seats || 4,
                    vehicleType: v.vehicleType || v.carType || 'Sedan',
                    transmission: v.transmission || 'manual',
                    acAvailable: v.acAvailable,
                    rating: v.averageRating || 0,
                    totalReviews: v.totalReviews || 0,
                    verified: ownerVerified,
                    baseFare,
                    pricePerKm,
                    estimatedFare: Math.ceil(baseFare + (10 * pricePerKm)),
                    distanceFromPickup: 0,
                    etaMin: 0,
                    tripDistanceKm: 0,
                    estimatedDuration: 0,
                    lat: v.locationCoordinates?.coordinates?.[1] || 0,
                    lng: v.locationCoordinates?.coordinates?.[0] || 0,
                    owner: v.owner ? {
                        name: v.owner.username,
                        rating: v.owner.averageRating,
                        verified: ownerVerified
                    } : null
                };
            });

            return res.json({
                success: true,
                vehicles: results,
                trip: {
                    pickup: 'Featured vehicles',
                    destination: 'Popular rides',
                    pickupLat: null,
                    pickupLng: null,
                    destLat: null,
                    destLng: null,
                    distanceKm: 0,
                    estimatedDuration: 0
                }
            });
        }

        let pickupCoords = null;
        if (pickupLat && pickupLng) {
            pickupCoords = { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) };
        } else if (pickup) {
            pickupCoords = await geocodeAddress(pickup);
        }

        let destCoords = null;
        if (destLat && destLng) {
            destCoords = { lat: parseFloat(destLat), lng: parseFloat(destLng) };
        } else if (destination) {
            destCoords = await geocodeAddress(destination);
        }

        if (!pickupCoords) {
            return res.status(400).json({ success: false, error: 'Could not find pickup location.' });
        }
        if (!destCoords) {
            return res.status(400).json({ success: false, error: 'Could not find destination.' });
        }

        const tripDistanceKm = haversineKm(pickupCoords.lat, pickupCoords.lng, destCoords.lat, destCoords.lng);
        const estimatedDuration = Math.max(1, Math.round(tripDistanceKm / 30 * 60));

        const pax = parseInt(passengers);
        const seatFilter = buildSeatFilter(pax, seatCapacity);

        let sortOption = {};
        if (sort === 'rating') {
            sortOption = { averageRating: -1 };
        } else if (sort === 'price_low') {
            sortOption = { baseFare: 1, pricePerKm: 1 };
        } else if (sort === 'price_high') {
            sortOption = { baseFare: -1, pricePerKm: -1 };
        }

        if (vehicleType && vehicleType !== 'all') {
            seatFilter.vehicleType = vehicleType;
        }

        if (acOnly === 'true' || acOnly === true) {
            seatFilter.acAvailable = true;
        }

        if (minRating) {
            seatFilter.averageRating = { $gte: parseFloat(minRating) };
        }

        let vehicles = await findNearbyVehicles(pickupCoords, seatFilter, sortOption);
        let searchMode = 'nearby';

        if (!vehicles.length) {
            vehicles = await findVehiclesByLocationText(pickup, seatFilter, sortOption);
            searchMode = 'city_match';
        }

        if (!vehicles.length) {
            vehicles = await findAllAvailableVehicles(seatFilter, sortOption);
            searchMode = 'all_available';
        }

        const results = vehicles.map(v => buildVehicleResult(v, pickupCoords, tripDistanceKm, estimatedDuration));

        if (!sort || sort === 'nearest' || sort === 'all') {
            results.sort((a, b) => {
                const distA = (a.lat === 0 && a.lng === 0) ? Number.MAX_SAFE_INTEGER : a.distanceFromPickup;
                const distB = (b.lat === 0 && b.lng === 0) ? Number.MAX_SAFE_INTEGER : b.distanceFromPickup;
                return distA - distB;
            });
        }

        if (verifiedOnly === 'true' || verifiedOnly === true) {
            const filtered = results.filter(v => v.verified);
            if (filtered.length > 0) {
                results.splice(0, results.length, ...filtered);
            }
        }

        if (maxPrice) {
            const mp = parseFloat(maxPrice);
            const filtered = results.filter(v => v.estimatedFare <= mp);
            results.splice(0, results.length, ...filtered);
        }

        res.json({
            success: true,
            vehicles: results,
            searchMode,
            trip: {
                pickup: pickupCoords.display || pickup,
                destination: destCoords.display || destination,
                pickupLat: pickupCoords.lat,
                pickupLng: pickupCoords.lng,
                destLat: destCoords.lat,
                destLng: destCoords.lng,
                distanceKm: Math.round(tripDistanceKm * 10) / 10,
                estimatedDuration
            }
        });
    } catch (e) {
        console.error('Search error:', e);
        res.status(500).json({ success: false, error: 'Search failed. Please try again.' });
    }
});

module.exports = router;

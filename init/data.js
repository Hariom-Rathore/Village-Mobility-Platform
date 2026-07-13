const sampleListings = [
  {
    title: "Turbo Red Sports Car",
    description:
      "High-performance sports car with paddle shifters, launch control, and premium leather cabin.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80",
    },
    price: 12999,
    ratePerKm: 50,
    location: "Mumbai",
    country: "India",
    carType: "petrol",
    seats: 4,
  },
  {
    title: "Executive Sedan LX",
    description:
      "Comfort-first premium sedan with ventilated seats, ADAS, and smooth automatic transmission.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80",
    },
    price: 5499,
    ratePerKm: 25,
    location: "Delhi",
    country: "India",
    carType: "petrol",
    seats: 4,
  },
  {
    title: "All-Terrain SUV X",
    description:
      "Rugged 4x4 SUV ready for hills and highways with roof rails and terrain modes.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=800&q=80",
    },
    price: 7999,
    ratePerKm: 35,
    location: "Manali",
    country: "India",
    carType: "diesel",
    seats: 6,
  },
  {
    title: "Electric City Hatch",
    description:
      "Compact EV with fast charging and regenerative braking, perfect for daily city drives.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1502877338535-766e1452684a",
    },
    price: 3999,
    ratePerKm: 10,
    location: "Bengaluru",
    country: "India",
    carType: "electric",
    seats: 4,
  },
  {
    title: "Royal Chauffeur Limousine",
    description:
      "Stretch limousine experience with ambient lighting and executive rear lounge.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80",
    },
    price: 18999,
    ratePerKm: 80,
    location: "Dubai",
    country: "United Arab Emirates",
    carType: "petrol",
    seats: 10,
  },
  {
    title: "Desert Rally Jeep",
    description:
      "Open-top rally jeep tuned for dunes, adventure trails, and weekend road trips.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1553440569-bcc63803a83d",
    },
    price: 6999,
    ratePerKm: 40,
    location: "Jaisalmer",
    country: "India",
    carType: "petrol",
    seats: 4,
  },
  {
    title: "Family MPV Comfort",
    description:
      "Spacious 7-seater MPV with flexible boot space and rear AC vents for long family tours.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1485291571150-772bcfc10da5?auto=format&fit=crop&w=800&q=80",
    },
    price: 4999,
    ratePerKm: 20,
    location: "Goa",
    country: "India",
    carType: "petrol",
    seats: 6,
  },
  {
    title: "Vintage Classic Coupe",
    description:
      "Restored classic coupe for style-focused drives, photoshoots, and special occasions.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1494905998402-395d579af36f",
    },
    price: 9999,
    ratePerKm: 45,
    location: "Rome",
    country: "Italy",
    carType: "petrol",
    seats: 4,
  },
  {
    title: "Convertible Roadster S",
    description:
      "Top-down roadster built for scenic routes, responsive steering, and open-air fun.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d",
    },
    price: 8499,
    ratePerKm: 55,
    location: "Nice",
    country: "France",
    carType: "petrol",
    seats: 4,
  },
  {
    title: "Snow Terrain 4x4",
    description:
      "Winter-ready 4x4 with heated seats and intelligent traction system for icy routes.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=800&q=80",
    },
    price: 8999,
    ratePerKm: 38,
    location: "Zurich",
    country: "Switzerland",
    carType: "diesel",
    seats: 6,
  },
  {
    title: "City Budget Compact",
    description:
      "Fuel-efficient compact car for daily errands and urban commutes with easy parking.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
    },
    price: 2999,
    ratePerKm: 8,
    location: "Pune",
    country: "India",
    carType: "petrol",
    seats: 4,
  },
  {
    title: "Luxury SUV Platinum",
    description:
      "Premium full-size SUV with panoramic sunroof, massage seats, and top-tier safety tech.",
    image: {
      filename: "listingimage",
      url: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80",
    },
    price: 14999,
    ratePerKm: 60,
    location: "Los Angeles",
    country: "United States",
    carType: "petrol",
    seats: 6,
  },
];

module.exports = { data: sampleListings };

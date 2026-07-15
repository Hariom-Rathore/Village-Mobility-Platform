const mongoose = require('mongoose');
const Listing = require('./models/listing');

require('dotenv').config();

const MONGO_URL = process.env.ATLASDB_URL || 'mongodb://127.0.0.1:27017/wanderlust';

async function deleteDemoCars() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log('Connected to MongoDB');

    const carsToDelete = [
      'Turbo Red Sports Car',
      'Executive Sedan LX', 
      'All-Terrain SUV X',
      'Electric City Hatch',
      'Royal Chauffeur Limousine'
    ];

    const result = await Listing.deleteMany({ title: { $in: carsToDelete } });
    console.log('Deleted', result.deletedCount, 'cars from database');

    const remainingCars = await Listing.countDocuments();
    console.log('Remaining cars in database:', remainingCars);

    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

deleteDemoCars();

//THis file make for wirte code for access the cloudinary 
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name:process.env.CLOUD_NAME,
    api_key:process.env.CLOUD_API_KEY,
    api_secret:process.env.CLOUD_API_SECRET
})

//this is source code for make a folder on cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: (req, file) => process.env.NODE_ENV === 'production' ? 'wonderlust_PROD' : 'wonderlust_DEV',
    allowedFormates:["png","jpg","jpeg"],
    transformation: [
      { quality: 'auto', fetch_format: 'auto' },
      { width: 1200, height: 800, crop: 'limit' }
    ]
  },
});

module.exports={
    cloudinary,
    storage,

}
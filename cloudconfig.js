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
  params: async (req, file) => {
    const isPdf = file.mimetype === 'application/pdf';
    const params = {
      folder: process.env.NODE_ENV === 'production' ? 'wonderlust_PROD' : 'wonderlust_DEV',
      resource_type: isPdf ? 'raw' : 'image',
      allowed_formats: isPdf ? ['pdf'] : ['png', 'jpg', 'jpeg', 'webp'],
    };

    if (!isPdf) {
      params.transformation = [
        { quality: 'auto', fetch_format: 'auto' },
        { width: 1200, height: 800, crop: 'limit' }
      ];
    }

    return params;
  },
});

module.exports={
    cloudinary,
    storage,

}
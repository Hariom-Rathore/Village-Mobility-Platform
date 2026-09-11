https://peer-to-peer-vehicle-rental-marketplace.onrender.com
# 🚗 Peer-to-Peer Vehicle Rental Marketplace

> A full-stack vehicle rental platform that connects vehicle owners with renters through a secure, user-friendly, and scalable web application.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge\&logo=node.js\&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge\&logo=express\&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge\&logo=mongodb\&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-7952B3?style=for-the-badge\&logo=bootstrap\&logoColor=white)
![EJS](https://img.shields.io/badge/EJS-8BC34A?style=for-the-badge)

---

## 📖 Overview

The **Peer-to-Peer Vehicle Rental Marketplace** is a full-stack web application where vehicle owners can list their vehicles for rent, and users can browse, book, and manage rentals through a secure platform.

The project was inspired by a real-world problem where many vehicle owners have idle vehicles while others struggle to find reliable rental options. This platform bridges that gap by providing a centralized marketplace.

---

## ✨ Key Features

* 🔐 Secure Authentication & Authorization
* 🚗 Add, Edit & Delete Vehicle Listings
* 🔎 Search Available Vehicles
* 📅 Vehicle Booking System
* 📷 Image Upload Support
* 👤 User Profile Management
* 📱 Responsive User Interface
* ⚡ RESTful APIs
* 🗄 MongoDB Database
* ☁ Cloud Image Storage

---

## 🛠 Tech Stack

### Frontend

* HTML5
* CSS3
* Bootstrap
* EJS

### Backend

* Node.js
* Express.js

### Database

* MongoDB
* Mongoose

### Authentication

* Passport.js
* Express Session

### Cloud & Tools

* Cloudinary
* Git
* GitHub
* Render
* MongoDB Atlas

---

# 📂 Project Structure

```text
Peer-to-Peer-Vehicle-Rental-Marketplace
│
├── controllers
├── models
├── routes
├── views
├── public
├── middleware
├── utils
├── init
├── app.js
├── package.json
└── README.md
```

---

# 🚀 Getting Started

## Clone Repository

```bash
git clone https://github.com/Hariom-Rathore/Peer-to-Peer-Vehicle-Rental-Marketplace.git
```

## Move to Project

```bash
cd Peer-to-Peer-Vehicle-Rental-Marketplace
```

## Install Dependencies

```bash
npm install
```

## Create .env

```env
ATLASDB_URL=your_mongodb_connection_string

CLOUD_NAME=your_cloudinary_cloud_name

CLOUD_API_KEY=your_cloudinary_api_key

CLOUD_API_SECRET=your_cloudinary_api_secret

SECRET=your_session_secret
```

## Run

```bash
npm start
```

## Deploy With AI Chat on Render

The AI assistant runs as a separate Python web service. Deploy the repository with
the included `render.yaml` Blueprint, then set the secret values requested by
Render, including a valid `GEMINI_API_KEY`. The Blueprint connects the
Node service to the AI service through `AI_SERVICE_HOST` and configures the AI
service to call the Node service through `RIDELocal_BACKEND_HOST`.

After deployment, verify:

```text
https://<node-service-host>/api/ai/health
```

The response must contain `"status":"healthy"` before testing chat.

---





# 🌐 Live Demo

🚀 **Live Website**

> Coming Soon...

---

# 💡 Future Improvements

* 💳 Online Payment Gateway
* 📍 Google Maps Integration
* ⭐ Ratings & Reviews
* 📧 Email Notifications
* 📱 Progressive Web App (PWA)
* 🔔 Real-Time Notifications

---

# 👨‍💻 Developer

**Hariom Rathore**

### GitHub

https://github.com/Hariom-Rathore

---

# ⭐ Show Your Support

If you like this project, consider giving it a ⭐ on GitHub.

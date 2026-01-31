# External Services - The Vauxhalls Website

## Render (Hosting)
- **Service ID:** srv-d5tekcd6ubrc73ehfen0
- **Type:** Web Service (NOT Static Site)
- **Domain:** vauxhalls.info
- **Render URL:** https://vauxhalls-info.onrender.com
- **Build Command:** `npm install`
- **Start Command:** `node server.js`

### Environment Variables for Render:
```
JWT_SECRET=vauxhalls_secret_jwt_key_2026_secure_random_string_here
RESEND_API_KEY=<your_resend_api_key>
ADMIN_EMAIL=thevauxhallsmusic@gmail.com
SERVER_URL=https://vauxhalls-info.onrender.com
FIREBASE_SERVICE_ACCOUNT=<your_firebase_service_account_json>
```

### Getting FIREBASE_SERVICE_ACCOUNT:
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Copy the entire JSON content
4. In Render, paste it as the value for FIREBASE_SERVICE_ACCOUNT (as one line, no line breaks)

---

## Resend (Email Service)
- **Website:** https://resend.com
- **Used for:** Sending band approval emails
- **API Key Location:** Resend Dashboard → API Keys

---

## Firebase (Realtime Database)
- **Project:** vauxhalls
- **Database URL:** https://vauxhalls-default-rtdb.firebaseio.com
- **Used for:** Chat messages, presence, visitor tracking
- **Console:** https://console.firebase.google.com/project/vauxhalls

---

## Cloudinary (Image Hosting)
- **Cloud Name:** dcapiwyx1
- **Upload Preset:** vauxhalls_flyers
- **Used for:** Band profile pictures, flyer images in chat

---

## Domain
- **Domain:** vauxhalls.info
- **Registrar:** (add your registrar here)

---

## Admin Account
- **Email:** thevauxhallsmusic@gmail.com
- **Auto-admin:** Yes (code grants admin privileges to this email)

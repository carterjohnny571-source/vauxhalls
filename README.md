# The Vauxhalls - Official Website

A modern, automotive-inspired website for **The Vauxhalls** band, featuring a sleek design aesthetic inspired by luxury car brand websites (Tesla, Audi, BMW), complete with an anonymous real-time chat room called "The Garage."

## Features

- **Automotive-Inspired Design**: Dark theme with metallic chrome accents, premium typography, smooth animations
- **Responsive Layout**: Mobile-first design that works on all devices
- **Parallax Effects**: Subtle parallax scrolling on hero and story sections
- **Music Integration**: Embedded Spotify player and links to streaming platforms
- **Tour Dates**: Showroom-style event listings
- **The Garage Chat Room**: Anonymous real-time chat with multiple channels
- **Smooth Animations**: Fade-in effects, stagger animations, and CSS transitions

## Quick Start

### Option 1: Static Hosting (No Backend Required)

The website works out of the box with localStorage for chat persistence:

1. Clone or download this repository
2. Open `index.html` in a web browser
3. Or deploy to any static hosting service

### Option 2: With Firebase Real-time Chat

For true real-time chat functionality across all users:

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Realtime Database
3. Configure database rules (see below)
4. Add your Firebase config to `js/chat.js`

## File Structure

```
the-vauxhalls-website/
├── index.html              # Main website page
├── chat.html               # The Garage chat room
├── css/
│   ├── main.css           # Core styles and design system
│   └── chat.css           # Chat room specific styles
├── js/
│   ├── main.js            # Navigation, animations, parallax
│   └── chat.js            # Chat functionality
├── assets/
│   └── images/            # Place your images here
└── README.md              # This file
```

## Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Follow the setup wizard
4. Once created, click the gear icon → Project Settings

### 2. Add Web App

1. In Project Settings, scroll to "Your apps"
2. Click the web icon `</>`
3. Register your app with a nickname
4. Copy the firebaseConfig object

### 3. Enable Realtime Database

1. Go to "Build" → "Realtime Database"
2. Click "Create Database"
3. Start in **test mode** for development (secure later!)
4. Choose your database location

### 4. Add Config to chat.js

Open `js/chat.js` and replace the placeholder config:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 5. Add Firebase SDK

Add these scripts to `chat.html` before the closing `</body>` tag, BEFORE the chat.js script:

```html
<!-- Firebase SDK -->
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js"></script>

<!-- Your chat script -->
<script src="js/chat.js"></script>
```

### 6. Database Rules (Production)

For production, update your database rules in Firebase Console:

```json
{
  "rules": {
    "messages": {
      "$channel": {
        ".read": true,
        ".write": true,
        "$messageId": {
          ".validate": "newData.hasChildren(['username', 'text', 'timestamp']) &&
                        newData.child('text').val().length <= 500 &&
                        newData.child('username').val().length <= 20"
        }
      }
    },
    "presence": {
      ".read": true,
      ".write": true
    }
  }
}
```

## Customization

### Replacing Placeholder Images

The website uses placeholder divs for images. Replace them with actual images:

1. **Hero Image/Video** (1920x1080 recommended)
   - Replace the `.hero-placeholder` div in `index.html` with:
   ```html
   <img src="assets/images/hero.jpg" alt="The Vauxhalls" class="hero-img">
   ```
   - Or for video:
   ```html
   <video autoplay muted loop playsinline class="hero-video">
       <source src="assets/videos/hero.mp4" type="video/mp4">
   </video>
   ```

2. **Album/Release Art** (800x800 recommended)
   - Replace `.image-placeholder` divs with actual album artwork

3. **Story Section** (1920x1080 recommended)
   - Replace `.story-placeholder` with band photo

4. **Favicon**
   - Add `favicon.png` to `assets/images/`

### Updating Band Information

- **Tour Dates**: Edit the `.show-item` elements in `index.html`
- **Releases**: Update the `.release-card` elements
- **Band Story**: Edit the `.story-content` section
- **Social Links**: Update URLs in navigation and footer

### Color Customization

Edit CSS custom properties in `css/main.css`:

```css
:root {
    /* Change accent color */
    --color-accent: #00d4ff;

    /* Change text colors */
    --text-primary: #ffffff;
    --text-secondary: #a0a0a0;
}
```

## Deployment

### GitHub Pages

1. Push to a GitHub repository
2. Go to Settings → Pages
3. Select source branch (main)
4. Your site will be at `https://yourusername.github.io/repo-name`

### Netlify

1. Sign up at [netlify.com](https://netlify.com)
2. Drag and drop the project folder
3. Or connect your Git repository for auto-deploys

### Vercel

1. Sign up at [vercel.com](https://vercel.com)
2. Import your Git repository
3. Deploy automatically

### Traditional Hosting

Upload all files to your web hosting via FTP/SFTP.

## Chat Features

### Channels
- **General Chat**: Open discussion for all fans
- **Show Announcements**: Official band/venue announcements
- **Recommendations**: Share music and show recommendations

### Moderation
- 500 character message limit
- 2-second cooldown between messages
- 20 character username limit
- Basic HTML sanitization

### Storage
- **With Firebase**: Real-time sync across all users
- **Without Firebase**: localStorage fallback (per-browser persistence)

## Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)

## Performance Tips

1. **Optimize Images**: Use WebP format, compress images
2. **Enable Gzip**: Configure server compression
3. **CDN**: Use a CDN for assets
4. **Lazy Loading**: Images use native lazy loading

## Credits

- Design inspired by Tesla, Audi, and BMW websites
- Fonts: [Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue), [Inter](https://fonts.google.com/specimen/Inter)
- Icons: Custom SVG icons

## License

This template is provided for The Vauxhalls band. Feel free to customize for your needs.

---

## Social Links

- Instagram: https://www.instagram.com/thevauxhalls/
- Spotify: https://open.spotify.com/artist/2dg5NW2EXyujvQfqXokBTd
- Apple Music: https://music.apple.com/ca/artist/the-vauxhalls

---

*Engineered with precision. Built for the stage.*

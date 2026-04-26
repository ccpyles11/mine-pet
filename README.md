# Cozy Pup — Virtual Pet Game

A standalone mobile-first virtual pet game built with plain HTML, CSS, and JavaScript Canvas. It is ready to host on GitHub Pages with no build step.

## Features Included

- Cozy mobile game layout
- Four rooms: living room, kitchen, bathroom, park
- Animated canvas dog character
- Hunger, happiness, cleanliness, and energy stats
- Stats deplete over time
- Offline progress calculation when the app is closed
- Tap-to-interact dog reactions
- Feed, drink, play, bath, and rest actions
- Daily reward system
- Coins/treats
- Leveling and unlockable decor
- Local save system using localStorage
- Sound effects using Web Audio API
- Mobile-responsive UI
- GitHub Pages compatible

## How to Run Locally

Open `index.html` in your browser.

For best testing, use a local server:

```bash
python -m http.server 8080
```

Then visit:

```text
http://localhost:8080
```

## How to Host on GitHub Pages

1. Create a new GitHub repository.
2. Upload these files:
   - `index.html`
   - `styles.css`
   - `game.js`
   - `README.md`
3. Go to your repository settings.
4. Open **Pages**.
5. Set source to your main branch and root folder.
6. Save.
7. GitHub will give you a public link.

## Important Note

This version uses programmatic canvas art, meaning the dog and rooms are drawn with code. To make it look like a premium App Store game, replace or enhance the canvas-drawn dog and rooms with professional assets from Rive, Spine, sprite sheets, or custom illustrations.

Recommended next upgrades:

- Replace coded dog drawing with Rive or Spine animations
- Add real background music and sound effects
- Add more pet emotions
- Add wardrobe/items shop
- Add Supabase login and cloud save
- Add push notification reminders
- Add mini-games
- Add more pets

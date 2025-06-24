# TypeSprint

Real-time multiplayer typing race game built with HTML5, CSS3, and JavaScript. Race against friends with customizable text and AI-powered content generation.

## Features

- **Multiplayer Racing**: Real-time peer-to-peer gameplay via WebRTC
- **Lobby System**: Create or join rooms with simple codes
- **AI Text Generation**: Custom typing challenges using AI prompts
- **Dual View Modes**: Standard split-screen or immersive scrolling view
- **Live Statistics**: Real-time WPM tracking and performance charts
- **Modern UI**: Glassmorphism design with dark theme

## Quick Start

1. Open `index.html` in a modern web browser
2. Enter your name to create a new lobby
3. Share lobby code with friends or join existing room
4. Customize race text or generate with AI
5. Ready up and start typing when countdown begins

## Technical Details

### Technologies
- **Frontend**: HTML5, CSS3 (Tailwind), JavaScript
- **Networking**: WebRTC via PeerJS for P2P connections
- **Visualization**: Chart.js for statistics
- **AI Integration**: Hack Club AI API
- **Fonts**: Google Fonts (Syne, Inter)

### Browser Support
Chrome, Firefox, Safari, Edge (WebRTC required)

## How It Works

1. **Lobby Creation**: Host creates room and receives unique lobby code
2. **Peer Connection**: Players join via WebRTC for direct P2P communication
3. **Game Sync**: Host manages game state and broadcasts to all participants
4. **Real-time Updates**: Live typing progress shared between players
5. **Performance Tracking**: WPM calculated and statistics displayed

## Game Modes

### Standard View
- Split-screen display showing all players
- Individual progress bars and cursors
- Side-by-side comparison racing

### Scrolling View
- Immersive single-screen experience
- Text scrolls as you type
- Focused typing environment

## Customization Options

- **Text Sources**: Use AI generation, custom input, or preset sentences
- **View Modes**: Toggle between standard and scrolling during gameplay
- **Cursor Animation**: Smooth cursor movement (standard view only)
- **Responsive Design**: Works on desktop, tablet, and mobile
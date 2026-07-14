# Touchline

**Digital Coaching Companion for Grassroots Youth Football**

Touchline helps grassroots football coaches organise, develop and inspire their teams while dramatically reducing administration.

## Philosophy

> Spend less time organising and more time coaching.

## MVP 0.1

The first version supports:
- One coach, one team, one local installation
- Player management with full profiles
- Fixture management
- Availability tracking
- Team selection with Equal Playing Time Engine
- Post-match recording
- Statistics (positive only)
- Player development (FA Four Corners)
- Training session planning
- Reports with PDF export
- AI Coach (OpenAI GPT-4o-mini)
- Coaching Philosophy & Policy Engine

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Express.js, TypeScript |
| Database | SQLite (via Drizzle ORM) |
| AI | OpenAI API (GPT-4o-mini) |
| Validation | Zod |

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install

# Install client dependencies
cd client && npm install

# Run database migrations
npm run db:migrate

# Start development (both client and server)
npm run dev
```

The app will be available at:
- **Frontend:** http://localhost:5173
- **API:** http://localhost:3001

### Accessing from Phone (same network)

The server binds to `0.0.0.0` so you can access it from your phone on the same WiFi network using your laptop's local IP address.

## Project Structure

```
touchline/
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared types and validation
├── docs/            # Project documentation
└── package.json     # Root scripts
```

## Documentation

- [Product Decisions](docs/PRODUCT_DECISIONS.md)
- [Implementation Log](docs/IMPLEMENTATION_LOG.md)
- [Known Issues](docs/KNOWN_ISSUES.md)

## Principles

- Coach always makes the football decisions
- AI recommends but never decides
- Never publicly rank or score children
- Statistics support development, not comparison
- Equal playing time is advisory
- Simplicity over feature quantity
- Every feature reduces coach administration

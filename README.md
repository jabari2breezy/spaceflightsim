# Celestia - Advanced Space Flight Simulator

A professional-grade, web-first space flight simulator with realistic physics, advanced mission planning, and beautiful 3D visualization.

## Features

### Core Gameplay
- **Realistic Physics Engine**: N-body gravity simulation, atmospheric drag, thermal management
- **Orbital Mechanics**: Precise delta-v calculations, orbit visualization, Hohmann transfers
- **Spacecraft Builder**: Modular component system with realistic part interactions
- **Mission Planning**: Advanced trajectory planning with visual prediction
- **Campaign Mode**: Story-driven missions with progressive difficulty
- **Sandbox Mode**: Freeform exploration and experimentation

### Unique Features
- **Procedural Planet Generation**: Infinite procedurally-generated star systems
- **Dynamic Events**: Solar flares, meteor showers, system hazards
- **Advanced Flight Computer**: Programmable autopilot and autonomous maneuvers
- **Research Tech Tree**: Unlock advanced components and capabilities
- **Community Features**: Share designs, challenge friends, global leaderboards
- **Telemetry System**: Real-time flight data with customizable displays

### Technical Excellence
- **Accurate Physics**: Real gravitational constants, specific impulse calculations
- **Atmospheric Modeling**: Exponential atmosphere with temperature/density effects
- **Thermal Dynamics**: Reentry heating, radiative cooling, ablation
- **Performance Optimized**: Handles 10x+ time acceleration smoothly

## Installation

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/celestia.git
cd celestia

# Install dependencies
npm install

# Build
npm run build

# Start web version
npm run dev

# Or start desktop version
npm run electron-dev
```

## Usage

### Web Version
```bash
npm run dev
# Navigate to http://localhost:8080
```

### Desktop Version
```bash
npm run electron-dev
```

### Production Build
```bash
npm run build
npm start
```

## Project Structure

```
src/
├── physics/          # Physics engine (gravity, drag, orbital mechanics)
├── core/            # Game logic (spacecraft, bodies, missions)
├── graphics/        # 3D visualization with Babylon.js
├── ui/              # React components
│   ├── screens/    # Main screens (menu, VAB, flight)
│   └── components/ # UI components (telemetry, controls, etc)
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
├── styles/         # CSS styling
└── assets/         # 3D models, textures, sounds

```

## Game Modes

### Campaign Mode
Work through a structured series of missions:
1. Reach orbit around Earth
2. Achieve lunar orbit
3. Land on the Moon
4. Travel to Mars
5. Advanced exploration missions

### Sandbox Mode
Complete freedom to:
- Design and build spacecraft
- Explore the solar system
- Attempt custom challenges
- Experiment with physics

## Controls

### Flight Controls
- **Pitch/Yaw/Roll**: Attitude control
- **Throttle**: Engine power (0-100%)
- **Quick Maneuvers**: Prograde, retrograde, normal, radial

### Time Controls
- **Pause**: Stop time
- **1x / 5x / 10x / 50x**: Time acceleration
- **Warp**: Jump to next event

### Information Displays
- **Telemetry**: Real-time flight data
- **Map**: Orbital visualization
- **Trajectories**: Planned maneuvers
- **Navball**: Attitude indicator

## Physics Model

### Gravity
- Newtonian N-body gravity simulation
- Real gravitational constants
- High-precision RK4 integration

### Atmosphere
- Exponential density model
- Temperature effects on drag
- Realistic reentry heating

### Propulsion
- Real specific impulse (Isp) values
- Fuel consumption calculations
- Multi-stage rocket physics

### Vehicles
- Modular part system
- Fuel crossfeed simulation
- Structural integrity
- Gimbal control

## Spacecraft Parts

### Engines
- **Merlin 1D**: Efficient LOX/kerosene engine
- **RS-25 (SSME)**: Powerful LH2/LOX engine
- **Ion Thruster**: High Isp deep space engine

### Tanks
- **LH2 Tank**: Hydrogen storage (high Isp)
- **RP-1 Tank**: Kerosene storage (reliable)

### Avionics
- Flight computers for autonomous control
- Sensors and communication systems

### Heat Shields
- Ablative materials
- Reentry protection

### Other
- RCS thrusters
- Solar panels
- Communication antennas

## Development

### Tech Stack
- **Frontend**: React 18 + TypeScript
- **Graphics**: Babylon.js
- **Physics**: Custom engine
- **Build**: Webpack
- **Desktop**: Electron
- **Styling**: CSS

### Contributing
Contributions welcome! Areas for help:
- Physics engine improvements
- 3D models and textures
- UI/UX enhancements
- Campaign missions
- Documentation

## Roadmap

### v1.0 (Current)
- ✅ Core physics engine
- ✅ Spacecraft builder
- ✅ Basic mission system
- 🔄 3D visualization
- 🔄 Tutorial missions

### v1.1
- [ ] Advanced atmospheric effects
- [ ] Multi-vehicle missions
- [ ] Docking system
- [ ] EVA system
- [ ] Space stations

### v1.2
- [ ] Procedural generation expansion
- [ ] Advanced tutorials
- [ ] Mod support
- [ ] Replay system
- [ ] Streaming integration

### v2.0
- [ ] Multiplayer missions
- [ ] Full solar system
- [ ] Exoplanet exploration
- [ ] Time travel mechanics
- [ ] VR support

## Performance

- Supports up to 100x time acceleration
- 60 FPS gameplay on modern hardware
- Handles complex multi-stage rockets
- Efficient physics substrate stepping

## License

MIT License - see LICENSE.md for details

## Support

- **Documentation**: [docs/](./docs)
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Discord**: [Join our server](https://discord.gg/celestia)

## Credits

Inspired by the space exploration genre and real space physics.

---

**Celestia** - Reaching for the stars, one mission at a time.

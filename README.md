# UAV Virtual Lab Simulator

A comprehensive web-based UAV (Unmanned Aerial Vehicle) virtual laboratory simulator for educational purposes. Design, customize, and simulate drones in realistic 3D environments entirely in your browser.

## Features

### Design Lab
- **Component Selection**: Choose from various frame types (quad/hexa/octa-rotor), motors, propellers, batteries, and payloads
- **Real-time Calculations**: Automatic calculation of thrust-to-weight ratio, flight time, power consumption, and performance metrics
- **3D Preview**: Interactive 3D visualization of your UAV design
- **Environment Configuration**: Set wind speed, temperature, visibility, and terrain type
- **Design Recommendations**: Intelligent feedback on your UAV configuration

### Flight Simulator
- **Realistic Physics**: Newton-Euler equations with thrust, gravity, drag, and wind forces
- **Multiple Camera Views**: Chase, FPV, free camera, top-down, and side views
- **RC Controller Interface**: Visual RC transmitter with mouse/keyboard/gamepad support
- **Real-time Telemetry**: Altitude, speed, battery status, orientation, and system health
- **Flight Data Graphs**: 30-second scrolling charts for all flight parameters
- **Terrain Types**: Flat, hilly, urban, and desert environments with procedural generation

## Technical Stack

- **3D Graphics**: Three.js (WebGL)
- **Physics**: Custom physics engine with PID controllers
- **UI**: Pure HTML5, CSS3, JavaScript
- **Data Visualization**: Chart.js
- **Terrain Generation**: Perlin noise algorithms

## Getting Started

### Installation

1. Clone or download this repository
2. Open `index.html` in a modern web browser (Chrome, Firefox, Edge recommended)
3. No build process or server required - runs entirely client-side!

### Usage

#### Design Lab

1. **Select Components**:
   - Choose frame type, material, and size
   - Select propellers (size, pitch, blades)
   - Pick motors (KV rating)
   - Configure battery (cells, capacity, C-rating)
   - Add optional payload

2. **Configure Environment**:
   - Adjust wind speed and direction
   - Set visibility and temperature
   - Choose terrain type

3. **Review Specifications**:
   - Check thrust-to-weight ratio (aim for 2.0-3.5)
   - Review estimated flight time
   - Read design recommendations

4. **Launch Simulator**:
   - Click "LAUNCH SIMULATOR" when ready

#### Flight Simulator

**Controls**:

- **Keyboard**:
  - `W/S`: Throttle up/down
  - `A/D`: Yaw left/right
  - `Arrow Keys`: Pitch/Roll
  - `Space`: Emergency stop

- **Mouse**:
  - Click and drag RC sticks for precise control
  - Left stick: Throttle (vertical) and Yaw (horizontal)
  - Right stick: Pitch (vertical) and Roll (horizontal)

- **Buttons**:
  - `ARM`: Enable motors
  - `RTH`: Return to home
  - `STOP`: Emergency motor cutoff

**Camera Views**:
- **Chase**: Follows UAV from behind (default)
- **FPV**: First-person view from UAV
- **Free**: User-controlled camera (WASD to move)
- **Top-Down**: Bird's eye view
- **Side**: Side profile view

## Physics Model

### Forces
- **Thrust**: Calculated from motor RPM and propeller specifications
- **Gravity**: Standard 9.81 m/s²
- **Drag**: Air resistance based on velocity and frontal area
- **Wind**: Constant wind with Perlin noise turbulence
- **Ground Effect**: Increased thrust efficiency near ground

### Flight Dynamics
- **PID Controllers**: Cascaded PID for attitude and position control
- **Battery Model**: Realistic voltage drop and discharge curves
- **Motor Dynamics**: Response delays and current draw simulation
- **Environmental Effects**: Air density varies with temperature

## Performance

- **Target Frame Rate**: 60 FPS rendering
- **Physics Update Rate**: 120 Hz
- **Recommended Hardware**: Mid-range GPU with WebGL 2.0 support
- **Browser**: Modern browsers (Chrome 90+, Firefox 88+, Edge 90+)

## Educational Value

This simulator helps students understand:
- UAV design tradeoffs (weight vs. power vs. flight time)
- Physics of flight (thrust, drag, lift)
- Control systems (PID controllers, stabilization)
- Battery management and power consumption
- Environmental effects on flight performance

## Project Structure

```
uav-lab_v3/
├── index.html              # Main HTML file
├── css/
│   ├── main.css           # Global styles
│   ├── design-lab.css     # Design Lab styles
│   └── simulator.css      # Simulator styles
├── js/
│   ├── main.js            # Application entry point
│   ├── design-lab/
│   │   ├── calculations.js    # UAV calculations engine
│   │   ├── preview-renderer.js # 3D preview
│   │   └── ui-handler.js      # UI event handlers
│   ├── simulator/
│   │   ├── physics-engine.js      # Physics simulation
│   │   ├── flight-controller.js   # Input handling & PID
│   │   ├── uav-model.js          # 3D UAV model
│   │   ├── camera-controller.js   # Camera system
│   │   ├── telemetry.js          # Telemetry display
│   │   └── terrain-generator.js   # Procedural terrain
│   └── utils/
│       ├── perlin-noise.js    # Perlin noise implementation
│       └── pid-controller.js  # PID controller classes
└── README.md
```

## Tips for Best Results

### Design Tips
- **Thrust-to-Weight Ratio**: Aim for 2.0-3.5 for balanced performance
- **Battery Capacity**: Larger batteries = longer flight time but more weight
- **Propeller Size**: Match propeller size to frame size and motor KV
- **Material Selection**: Carbon fiber is lightest but most expensive

### Flying Tips
- **Start Slow**: Begin with low throttle and gentle inputs
- **Altitude Hold**: Maintain steady altitude before attempting maneuvers
- **Wind Awareness**: Strong winds require constant correction
- **Battery Management**: Land before battery drops below 20%
- **Practice**: Use flat terrain first before trying urban or hilly environments

## Known Limitations

- Simplified aerodynamics (no blade element theory)
- No obstacle collision detection (except ground)
- Battery model is approximate
- Wind turbulence is simplified
- No structural damage modeling

## Future Enhancements

Potential features for future versions:
- Save/load UAV designs
- Flight missions and waypoints
- Multiplayer racing mode
- Video recording of flights
- Advanced weather effects (rain, fog)
- Acrobatic flight mode
- Damage model
- Leaderboards

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Edge 90+
- ✅ Safari 14+ (may have reduced performance)
- ❌ Internet Explorer (not supported)

## Credits

Developed as an educational tool for UAV engineering and flight dynamics.

**Technologies Used**:
- Three.js - 3D graphics library
- Chart.js - Data visualization
- Perlin Noise - Procedural terrain generation
- Custom physics engine

## License

This project is intended for educational purposes.

## Support

For issues or questions, please refer to the documentation or contact your instructor.

---

**Happy Flying! 🚁**

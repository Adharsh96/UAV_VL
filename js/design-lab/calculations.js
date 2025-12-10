// UAV Calculations Engine
class UAVCalculations {
    constructor() {
        this.config = {
            frame: { type: 'quad-x', material: 'carbon', size: 450 },
            propellers: { size: 8, pitch: 5, blades: 2, material: 'plastic' },
            motors: { kv: 2300 },
            battery: { cells: 4, capacity: 3300, cRating: 45 },
            flightController: { type: 'gps' },
            payload: { type: 'none' }
        };

        this.specs = {};
    }

    // Material multipliers for mass
    getMaterialMultiplier(material) {
        const multipliers = {
            'carbon': 1.0,
            'aluminum': 1.3,
            'plastic': 1.5
        };
        return multipliers[material] || 1.0;
    }

    // Calculate frame mass based on size and material
    getFrameMass() {
        const { size, material, type } = this.config.frame;
        let baseMass = 0;

        // Base mass depends on frame type and size
        const sizeMultiplier = size / 450; // Normalized to 450mm

        switch (type) {
            case 'quad-x':
            case 'quad-plus':
                baseMass = 200 * sizeMultiplier;
                break;
            case 'hexa':
                baseMass = 300 * sizeMultiplier;
                break;
            case 'octa':
                baseMass = 400 * sizeMultiplier;
                break;
        }

        return baseMass * this.getMaterialMultiplier(material);
    }

    // Get number of motors based on frame type
    getMotorCount() {
        const { type } = this.config.frame;
        switch (type) {
            case 'quad-x':
            case 'quad-plus':
                return 4;
            case 'hexa':
                return 6;
            case 'octa':
                return 8;
            default:
                return 4;
        }
    }

    // Calculate motor mass based on KV rating
    getMotorMass() {
        const { kv } = this.config.motors;
        // Lower KV = larger motor = more mass
        if (kv >= 3000) return 25;
        if (kv >= 2300) return 40;
        if (kv >= 1500) return 60;
        if (kv >= 1000) return 90;
        return 120;
    }

    // Calculate propeller mass
    getPropellerMass() {
        const { size, material } = this.config.propellers;
        const baseMass = size * 2; // Rough estimate: 2g per inch
        return material === 'carbon' ? baseMass * 0.8 : baseMass;
    }

    // Calculate battery mass
    getBatteryMass() {
        const { capacity } = this.config.battery;
        return capacity * 0.15; // ~0.15g per mAh for LiPo
    }

    // Calculate flight controller mass
    getFlightControllerMass() {
        const { type } = this.config.flightController;
        switch (type) {
            case 'basic':
                return 10;
            case 'gps':
                return 30;
            case 'advanced':
                return 50;
            default:
                return 30;
        }
    }

    // Calculate payload mass
    getPayloadMass() {
        const { type } = this.config.payload;
        const masses = {
            'none': 0,
            'camera-small': 50,
            'camera-medium': 100,
            'camera-large': 200,
            'sensor': 50,
            'delivery': 300
        };
        return masses[type] || 0;
    }

    // Calculate total mass
    getTotalMass() {
        const motorCount = this.getMotorCount();
        const frameMass = this.getFrameMass();
        const motorMass = this.getMotorMass() * motorCount;
        const propMass = this.getPropellerMass() * motorCount;
        const batteryMass = this.getBatteryMass();
        const fcMass = this.getFlightControllerMass();
        const payloadMass = this.getPayloadMass();

        return frameMass + motorMass + propMass + batteryMass + fcMass + payloadMass;
    }

    // Calculate thrust coefficient based on propeller specs
    getThrustCoefficient() {
        const { size, pitch, blades } = this.config.propellers;
        // Simplified thrust coefficient calculation
        // k = C * D^4 * P
        const diameter = size * 0.0254; // Convert inches to meters
        const pitchValue = pitch;
        const bladeMultiplier = 1 + (blades - 2) * 0.1;

        return 0.00001 * Math.pow(diameter, 4) * pitchValue * bladeMultiplier;
    }

    // Calculate motor max RPM
    getMotorMaxRPM() {
        const { kv } = this.config.motors;
        const { cells } = this.config.battery;
        const voltage = cells * 3.7; // Nominal voltage per cell
        return kv * voltage;
    }

    // Calculate thrust per motor
    getThrustPerMotor() {
        const k = this.getThrustCoefficient();
        const maxRPM = this.getMotorMaxRPM();
        const omega = (maxRPM * 2 * Math.PI) / 60; // Convert RPM to rad/s

        // T = k * ω²
        const thrustNewtons = k * omega * omega;
        return thrustNewtons * 1000 / 9.81; // Convert to grams
    }

    // Calculate total thrust
    getTotalThrust() {
        const motorCount = this.getMotorCount();
        return this.getThrustPerMotor() * motorCount;
    }

    // Calculate thrust-to-weight ratio
    getTWR() {
        const totalThrust = this.getTotalThrust();
        const totalMass = this.getTotalMass();
        return totalThrust / totalMass;
    }

    // Calculate hover throttle percentage
    getHoverThrottle() {
        const twr = this.getTWR();
        return Math.min(100, (1 / twr) * 100);
    }

    // Calculate current draw
    getCurrentDraw(throttle = 0.5) {
        const { kv } = this.config.motors;
        const { cells } = this.config.battery;
        const voltage = cells * 3.7;
        const motorCount = this.getMotorCount();

        // Simplified current calculation
        // Higher throttle = more current
        const currentPerMotor = (voltage * kv / 1000) * throttle * 0.5;
        return currentPerMotor * motorCount;
    }

    // Calculate flight time
    getFlightTime() {
        const { capacity } = this.config.battery;
        const hoverThrottle = this.getHoverThrottle() / 100;
        const avgCurrent = this.getCurrentDraw(hoverThrottle);

        if (avgCurrent === 0) return 0;

        // Flight time = (Capacity * 0.8) / Current
        // 0.8 factor for safe discharge
        const flightTimeHours = (capacity * 0.8) / (avgCurrent * 1000);
        return flightTimeHours * 60; // Convert to minutes
    }

    // Calculate max speed (simplified)
    getMaxSpeed() {
        const twr = this.getTWR();
        const totalMass = this.getTotalMass() / 1000; // Convert to kg

        // Simplified: higher TWR and lighter = faster
        // Assuming 45° tilt for max forward speed
        const maxAccel = (twr - 1) * 9.81 * Math.cos(Math.PI / 4);
        const dragCoeff = 0.5;
        const frontalArea = Math.pow(this.config.frame.size / 1000, 2);

        // Terminal velocity: v = sqrt(2 * m * a / (ρ * Cd * A))
        const airDensity = 1.225;
        const maxSpeed = Math.sqrt((2 * totalMass * maxAccel) / (airDensity * dragCoeff * frontalArea));

        return Math.min(maxSpeed, 30); // Cap at 30 m/s for safety
    }

    // Calculate power consumption
    getPowerConsumption() {
        const { cells } = this.config.battery;
        const voltage = cells * 3.7;

        const hoverCurrent = this.getCurrentDraw(this.getHoverThrottle() / 100);
        const maxCurrent = this.getCurrentDraw(1.0);

        return {
            hover: voltage * hoverCurrent,
            max: voltage * maxCurrent
        };
    }

    // Update configuration
    updateConfig(category, key, value) {
        if (this.config[category]) {
            this.config[category][key] = value;
        }
        this.calculateAll();
    }

    // Calculate all specifications
    calculateAll() {
        this.specs = {
            totalMass: this.getTotalMass(),
            totalThrust: this.getTotalThrust(),
            twr: this.getTWR(),
            flightTime: this.getFlightTime(),
            maxSpeed: this.getMaxSpeed(),
            power: this.getPowerConsumption(),
            hoverThrottle: this.getHoverThrottle()
        };

        return this.specs;
    }

    // Get design recommendations
    getRecommendations() {
        const { twr, flightTime, totalMass } = this.specs;
        const recommendations = [];

        if (twr < 1.5) {
            recommendations.push({
                type: 'warning',
                message: '⚠️ Warning: Low thrust-to-weight ratio. Aircraft may struggle to lift off. Consider lighter frame or more powerful motors.'
            });
        } else if (twr > 4.0) {
            recommendations.push({
                type: 'warning',
                message: '⚠️ Warning: Very high thrust. Aircraft will be very responsive but battery life will be short.'
            });
        } else if (twr >= 2.0 && twr <= 3.5) {
            recommendations.push({
                type: 'success',
                message: '✅ Great design! Balanced thrust-to-weight ratio for stable flight.'
            });
        }

        if (flightTime < 5) {
            recommendations.push({
                type: 'tip',
                message: '💡 Tip: Increase battery capacity for longer flight time.'
            });
        } else if (flightTime > 30) {
            recommendations.push({
                type: 'success',
                message: '✅ Excellent flight time! Good for long missions.'
            });
        }

        if (totalMass > 3000) {
            recommendations.push({
                type: 'tip',
                message: '💡 Tip: Consider lighter materials or smaller battery to reduce weight.'
            });
        }

        if (recommendations.length === 0) {
            recommendations.push({
                type: 'info',
                message: '💡 Configure your UAV to see recommendations.'
            });
        }

        return recommendations;
    }

    // Check if configuration is valid for simulation
    isValid() {
        const { twr } = this.specs;
        return twr >= 1.2; // Minimum TWR to fly
    }
    // Optimizer: Adjusts parameters for best TWR (Target ~2.5) without sacrificing too much flight time
    optimize() {
        // 1. Maximize Prop Size based on Frame Size
        // Rule of thumb: Max Prop (inch) approx Frame Size (mm) / 25.4 / 2.2 (to prevent overlap) ?
        // Simplification: Frame 450mm -> ~10-11 inch props. Frame 250 -> 5-6 inch.
        // Let's safe limit: FrameSize/40 works well for standard quads. 450/40 = 11.25. 250/40 = 6.25.
        const maxPropSize = Math.floor(this.config.frame.size / 40);
        this.config.propellers.size = Math.max(3, maxPropSize);

        // 2. Adjust KV based on Prop Size and Battery
        // Larger props -> Lower KV. Smaller props -> Higher KV.
        // Heuristic: KV * PropSize ~ 20000 (roughly for 3-4S).
        // Let's try to target a specific RPM range or TWR.
        // Iterative approach:

        let bestScore = -Infinity;
        let bestConfig = JSON.parse(JSON.stringify(this.config));

        const cellOptions = [3, 4, 6];
        const kvOptions = [1000, 1500, 2300, 2600, 3000]; // Discretized search space for KV

        // Fix prop size to max allowed (usually best for efficiency/thrust ratio)
        this.config.propellers.size = maxPropSize;

        for (let cells of cellOptions) {
            for (let kv of kvOptions) {
                // Apply temp config
                this.config.battery.cells = cells;
                this.config.motors.kv = kv;
                this.calculateAll();

                const twr = this.specs.twr;
                const time = this.specs.flightTime;

                // Scoring function:
                // We want TWR >= 2.5
                // Maximize Flight Time
                // Penalty for TWR < 2.0

                let score = 0;
                if (twr < 2.0) score -= 1000;
                else if (twr > 4.0) score -= (twr - 4) * 10; // Slight penalty for overpower
                else score += twr * 10;

                score += time; // Add minutes of flight time

                if (score > bestScore) {
                    bestScore = score;
                    bestConfig.battery.cells = cells;
                    bestConfig.motors.kv = kv;
                    bestConfig.propellers.size = maxPropSize;
                }
            }
        }

        // Apply best found
        this.config.battery.cells = bestConfig.battery.cells;
        this.config.motors.kv = bestConfig.motors.kv;
        this.config.propellers.size = bestConfig.propellers.size;

        // Adjust capacity for weight balancing?
        // Keep current capacity for now, user can tune.

        this.calculateAll();
        return this.config;
    }
}

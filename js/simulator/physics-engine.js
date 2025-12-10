// Physics Engine for UAV Simulation
class PhysicsEngine {
    constructor(uavConfig, environmentConfig) {
        this.config = uavConfig;
        this.environment = environmentConfig;

        // Physics state
        this.state = {
            position: new THREE.Vector3(0, 2, 0),
            velocity: new THREE.Vector3(0, 0, 0),
            acceleration: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Quaternion(),
            angularVelocity: new THREE.Vector3(0, 0, 0),
            motorSpeeds: [],
            batteryVoltage: 0,
            batteryPercentage: 100,
            currentDraw: 0,
            isArmed: false,
            timestamp: 0,
            temperature: 20, // Degrees C
            isCollided: false
        };

        // Constants
        this.gravity = 9.81;
        this.airDensity = this.calculateAirDensity();
        this.dragCoefficient = 0.5;
        this.frontalArea = Math.pow(this.config.frame.size / 1000, 2);

        // Calculate UAV properties
        this.calculateProperties();

        // Initialize motor speeds
        const motorCount = this.getMotorCount();
        this.state.motorSpeeds = new Array(motorCount).fill(0);

        // Battery
        this.batteryCapacityAh = this.config.battery.capacity / 1000;
        this.batteryUsedAh = 0;
        this.state.batteryVoltage = this.config.battery.cells * 4.2; // Fully charged

        // Home position
        this.homePosition = this.state.position.clone();
    }

    calculateProperties() {
        // Calculate mass
        this.totalMass = this.calculateTotalMass() / 1000; // Convert to kg

        // Calculate thrust coefficient
        const propSize = this.config.propellers.size * 0.0254;
        const propPitch = this.config.propellers.pitch;
        const propBlades = this.config.propellers.blades;
        const bladeMultiplier = 1 + (propBlades - 2) * 0.1;
        this.thrustCoefficient = 0.00001 * Math.pow(propSize, 4) * propPitch * bladeMultiplier;

        // Calculate motor properties
        this.motorKv = this.config.motors.kv;
        const batteryVoltage = this.config.battery.cells * 4.2;
        this.maxRPM = this.motorKv * batteryVoltage;
        this.maxOmega = (this.maxRPM * 2 * Math.PI) / 60;

        // Calculate max thrust per motor
        this.maxThrustPerMotor = this.thrustCoefficient * this.maxOmega * this.maxOmega;

        // Arm length
        this.armLength = (this.config.frame.size / 1000) / 2;
    }

    calculateTotalMass() {
        // Simplified mass calculation
        const frameMultiplier = { 'carbon': 1.0, 'aluminum': 1.3, 'plastic': 1.5 };
        const frameMass = 200 * (this.config.frame.size / 450) * frameMultiplier[this.config.frame.material];

        const motorCount = this.getMotorCount();
        const motorMass = 40 * motorCount;
        const propMass = this.config.propellers.size * 2 * motorCount;
        const batteryMass = this.config.battery.capacity * 0.15;
        const fcMass = 30;
        const payloadMass = this.getPayloadMass();

        return frameMass + motorMass + propMass + batteryMass + fcMass + payloadMass;
    }

    getMotorCount() {
        const type = this.config.frame.type;
        if (type.includes('quad')) return 4;
        if (type === 'hexa') return 6;
        if (type === 'octa') return 8;
        return 4;
    }

    getPayloadMass() {
        const masses = {
            'none': 0, 'camera-small': 50, 'camera-medium': 100,
            'camera-large': 200, 'sensor': 50, 'delivery': 300
        };
        return masses[this.config.payload.type] || 0;
    }

    calculateAirDensity() {
        const temp = this.environment.temperature + 273.15; // Convert to Kelvin
        const tempRef = 288.15; // 15°C in Kelvin
        const densityRef = 1.225; // kg/m³ at sea level, 15°C
        return densityRef * (tempRef / temp);
    }

    update(controls, dt) {
        if (this.state.isCollided) {
            // Disable motors if crashed
            this.state.isArmed = false;
            this.state.motorSpeeds.fill(0);
            return this.state;
        }

        if (!this.state.isArmed) {
            // Cool down when disarmed
            this.state.temperature = Math.max(this.environment.temperature, this.state.temperature - dt);
            this.state.motorSpeeds.fill(0);
        } else {
            // Heat up
            const load = this.state.currentDraw / 20; // Arbitrary heating factor
            this.state.temperature = Math.min(100, this.state.temperature + load * dt);
            this.updateMotorSpeeds(controls, dt);
        }

        // Check Collisions
        this.checkCollisions();

        // Calculate forces
        const forces = this.calculateForces();

        // Calculate torques
        const torques = this.state.isArmed ? this.calculateTorques(controls) : new THREE.Vector3(0, 0, 0);

        // Update linear motion
        this.updateLinearMotion(forces, dt);

        // Update angular motion
        this.updateAngularMotion(torques, dt);

        // Update battery
        this.updateBattery(dt);

        // Update timestamp
        this.state.timestamp += dt;

        return this.state;
    }

    checkCollisions() {
        if (!window.uavSimulator || !window.uavSimulator.terrainGenerator) return;

        // Simple ground check first (fallback)
        const groundHeight = window.uavSimulator.terrainGenerator.getTerrainHeight(this.state.position.x, this.state.position.z);
        if (this.state.position.y <= groundHeight + 0.1) {
            // Handle ground collision dynamics (bounce/crash) in updateLinearMotion
            // But distinct from obstacle collision
        }

        // Object collision checks would go here if we had mesh data
        if (this.state.position.y < groundHeight) {
            this.state.position.y = groundHeight;
            // If speed was high, CRASH
            if (this.state.velocity.length() > 10) {
                console.log("CRASH!");
                this.state.isCollided = true;
                this.state.isArmed = false;
            }
        }
    }

    updateMotorSpeeds(controls, dt) {
        const { throttle, pitch, roll, yaw } = controls;

        // Base throttle for all motors
        const baseThrottle = Math.max(0, Math.min(1, throttle));

        // Motor mixing for quad-rotor (X configuration)
        // Motor layout: 0=front-right, 1=back-left, 2=front-left, 3=back-right
        const motorCount = this.getMotorCount();

        if (motorCount === 4) {
            // Corrected quad-X mixing (0=FR, 1=BL, 2=FL, 3=BR)
            this.state.motorSpeeds[0] = baseThrottle - pitch + roll - yaw; // Front-right
            this.state.motorSpeeds[1] = baseThrottle + pitch - roll - yaw; // Back-left
            this.state.motorSpeeds[2] = baseThrottle - pitch - roll + yaw; // Front-left
            this.state.motorSpeeds[3] = baseThrottle + pitch + roll + yaw; // Back-right
        } else {
            // Simplified for hexa/octa
            for (let i = 0; i < motorCount; i++) {
                this.state.motorSpeeds[i] = baseThrottle;
            }
        }

        // Clamp motor speeds
        for (let i = 0; i < motorCount; i++) {
            this.state.motorSpeeds[i] = Math.max(0, Math.min(1, this.state.motorSpeeds[i]));
        }

        // Simulate motor response delay
        const responseRate = 20; // rad/s²
        for (let i = 0; i < motorCount; i++) {
            const omegaMax = Math.max(this.maxOmega, 1);
            const targetSpeed = this.state.motorSpeeds[i] * omegaMax;
            const currentSpeed = this.state.motorSpeeds[i] * omegaMax;
            const delta = (targetSpeed - currentSpeed) * responseRate * dt;
            this.state.motorSpeeds[i] = (currentSpeed + delta) / omegaMax;
        }
    }

    calculateForces() {
        const forces = new THREE.Vector3();

        // 1. Thrust force (body frame, pointing up)
        let totalThrust = 0;
        for (let i = 0; i < this.state.motorSpeeds.length; i++) {
            const omega = this.state.motorSpeeds[i] * this.maxOmega;
            const thrust = this.thrustCoefficient * omega * omega;
            totalThrust += thrust;
        }

        // Ground effect (increased thrust near ground)
        const altitude = this.state.position.y;
        const rotorDiameter = this.config.propellers.size * 0.0254;
        if (altitude < rotorDiameter) {
            const groundEffectMultiplier = 1 + 0.1 * (1 - altitude / rotorDiameter);
            totalThrust *= groundEffectMultiplier;
        }

        // Transform thrust to world frame
        const thrustBody = new THREE.Vector3(0, totalThrust, 0);
        const thrustWorld = thrustBody.applyQuaternion(this.state.rotation);
        forces.add(thrustWorld);

        // 2. Gravity force (world frame, pointing down)
        const gravity = new THREE.Vector3(0, -this.totalMass * this.gravity, 0);
        forces.add(gravity);

        // 3. Drag force (Improved with Angle of Attack)
        const speed = this.state.velocity.length();
        if (speed > 0.01) {
            // Angle of Attack (AoA) affects drag area
            // Vector pointing relatively "Up" for the drone
            const uavUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.state.rotation);
            // Velocity direction
            const velDir = this.state.velocity.clone().normalize();

            // Dot product gives cosine of angle between Up and Velocity.
            // A_effective = A_side + (A_top - A_side) * projection
            const projection = Math.abs(uavUp.dot(velDir));

            const areaTop = this.config.frame.size / 1000 * this.config.frame.size / 1000;
            const areaSide = this.frontalArea; // calculated earlier

            const effectiveArea = areaSide + (areaTop - areaSide) * projection;

            const dragMagnitude = 0.5 * this.airDensity * this.dragCoefficient *
                effectiveArea * speed * speed;
            const dragForce = this.state.velocity.clone().normalize().multiplyScalar(-dragMagnitude);
            forces.add(dragForce);
        }

        // 4. Wind force
        const windSpeed = this.environment.windSpeed;
        const windDir = this.environment.windDirection * Math.PI / 180;
        const windVelocity = new THREE.Vector3(
            Math.sin(windDir) * windSpeed,
            0,
            Math.cos(windDir) * windSpeed
        );

        // Add turbulence
        const time = this.state.timestamp;
        const pos = this.state.position;
        const turbulence = new THREE.Vector3(
            perlin.noise3D(pos.x / 10, pos.y / 10, time * 0.5) * windSpeed * 0.3,
            perlin.noise3D(pos.x / 10 + 100, pos.y / 10, time * 0.5) * windSpeed * 0.2,
            perlin.noise3D(pos.x / 10, pos.y / 10 + 100, time * 0.5) * windSpeed * 0.3
        );
        windVelocity.add(turbulence);

        // Disable wind forces when disarmed to prevent lateral drift at any altitude
        if (!this.state.isArmed) {
            return forces;
        }

        const relativeVelocity = this.state.velocity.clone().sub(windVelocity);
        const relativeSpeed = relativeVelocity.length();
        if (relativeSpeed > 0.01) {
            const windDragMagnitude = 0.5 * this.airDensity * this.dragCoefficient *
                this.frontalArea * relativeSpeed * relativeSpeed;
            const windForce = relativeVelocity.clone().normalize().multiplyScalar(-windDragMagnitude);
            forces.add(windForce);
        }

        return forces;
    }

    calculateTorques(controls) {
        const torques = new THREE.Vector3();

        // Simplified torque calculation
        const { pitch, roll, yaw } = controls;

        // Roll torque
        torques.x = roll * this.armLength * this.maxThrustPerMotor * 2;

        // Pitch torque
        torques.z = pitch * this.armLength * this.maxThrustPerMotor * 2;

        // Yaw torque (from motor drag)
        torques.y = yaw * 0.05 * this.maxThrustPerMotor;

        // Aerodynamic damping
        const damping = 0.1;
        torques.sub(this.state.angularVelocity.clone().multiplyScalar(damping));

        return torques;
    }

    updateLinearMotion(forces, dt) {
        // F = ma => a = F/m
        this.state.acceleration = forces.divideScalar(this.totalMass);

        // Update velocity: v = v + a*dt
        this.state.velocity.add(this.state.acceleration.clone().multiplyScalar(dt));

        // Update position: p = p + v*dt
        this.state.position.add(this.state.velocity.clone().multiplyScalar(dt));

        // Ground collision
        if (this.state.position.y < 0.1) {
            this.state.position.y = 0.1;
            this.state.velocity.y = Math.max(0, this.state.velocity.y * -0.3); // Bounce
            this.state.velocity.x *= 0.8; // Friction
            this.state.velocity.z *= 0.8;
            if (!this.state.isArmed) {
                // Strong static friction when disarmed on ground
                this.state.velocity.x = 0;
                this.state.velocity.z = 0;
                this.state.angularVelocity.set(0, 0, 0);
            }
        }
    }

    updateAngularMotion(torques, dt) {
        // Simplified angular dynamics
        const inertia = this.totalMass * this.armLength * this.armLength;

        // τ = Iα => α = τ/I
        const angularAccel = torques.divideScalar(inertia);

        // Update angular velocity
        this.state.angularVelocity.add(angularAccel.multiplyScalar(dt));

        // Update rotation (simplified)
        const deltaRotation = new THREE.Euler(
            this.state.angularVelocity.x * dt,
            this.state.angularVelocity.y * dt,
            this.state.angularVelocity.z * dt,
            'XYZ'
        );
        const deltaQuat = new THREE.Quaternion().setFromEuler(deltaRotation);
        this.state.rotation.multiply(deltaQuat);
        this.state.rotation.normalize();
    }

    updateBattery(dt) {
        // Calculate current draw
        let totalCurrent = 0;
        for (let i = 0; i < this.state.motorSpeeds.length; i++) {
            const throttle = this.state.motorSpeeds[i];
            const currentPerMotor = (this.state.batteryVoltage * this.motorKv / 1000) * throttle * 0.5;
            totalCurrent += currentPerMotor;
        }
        this.state.currentDraw = totalCurrent;

        // Update battery capacity
        this.batteryUsedAh += (totalCurrent * dt) / 3600; // Convert to Ah
        this.state.batteryPercentage = Math.max(0, 100 * (1 - this.batteryUsedAh / this.batteryCapacityAh));

        // Voltage drop under load
        const cellCount = this.config.battery.cells;
        const vFull = cellCount * 4.2;
        const vEmpty = cellCount * 3.5;
        const vDrop = (vFull - vEmpty) * (this.batteryUsedAh / this.batteryCapacityAh);
        const internalResistance = 0.02 * cellCount;
        this.state.batteryVoltage = vFull - vDrop - (totalCurrent * internalResistance);

        // Battery cutoff
        if (this.state.batteryPercentage < 10) {
            // Auto-land or disarm
            this.state.isArmed = false;
        }
    }

    arm() {
        this.state.isArmed = true;
    }

    disarm() {
        this.state.isArmed = false;
        this.state.motorSpeeds.fill(0);
    }

    reset() {
        this.state.position.copy(this.homePosition);
        this.state.velocity.set(0, 0, 0);
        this.state.rotation.set(0, 0, 0, 1);
        this.state.angularVelocity.set(0, 0, 0);
        this.state.motorSpeeds.fill(0);
        this.batteryUsedAh = 0;
        this.state.batteryPercentage = 100;
        this.state.batteryVoltage = this.config.battery.cells * 4.2;
        this.state.isArmed = false;
        this.state.isCollided = false;
    }
}

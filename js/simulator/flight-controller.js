class FlightController {
    constructor() {
        this.pidController = new CascadedPIDController();

        // Control inputs
        this.controls = {
            throttle: 0,
            pitch: 0,
            roll: 0,
            yaw: 0,
            cameraMode: 'chase'
        };

        // Input sensitivity (affects keyboard increments)
        this.sensitivity = 1;

        // Keyboard state
        this.keys = {};

        // Mouse/stick state (Left: Throttle/Yaw, Right: Pitch/Roll)
        this.leftStick = { x: 0, y: -1 }; // y = -1 for 0 throttle by default
        this.rightStick = { x: 0, y: 0 };
        this.draggingStick = null;
        this.stickElements = {};

        // Flight modes
        this.altitudeHold = false;
        this.positionHold = false;
        this.returnToHome = false;
        this.flightMode = 'stabilize';
        this.loiterTarget = null;

        this.setupInputHandlers();
    }

    setupInputHandlers() {
        // Keyboard
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;

            if (e.key === ' ') {
                e.preventDefault();
                this.emergencyStop();
            }
            if (key === 'r') {
                this.resetUAV();
            }
            if (key === 'c') {
                this.cycleCamera();
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = false;
        });

        // RC Sticks
        this.setupStickControls('left-stick', 'left-stick-boundary', (x, y) => {
            this.leftStick = { x, y };
        });

        this.setupStickControls('right-stick', 'right-stick-boundary', (x, y) => {
            this.rightStick = { x, y };
        });

        // Global mouse handlers for sticks
        document.addEventListener('mousemove', (e) => this.handleStickDrag(e));
        document.addEventListener('mouseup', () => this.handleStickRelease());

        // Buttons
        document.getElementById('arm-button').addEventListener('click', () => this.toggleArm());
        document.getElementById('rth-button').addEventListener('click', () => this.activateRTH());
        document.getElementById('emergency-button').addEventListener('click', () => this.emergencyStop());

        // Camera mode
        document.getElementById('camera-mode').addEventListener('change', (e) => {
            this.controls.cameraMode = e.target.value;
        });

        const modeSelect = document.getElementById('flight-mode');
        if (modeSelect) {
            modeSelect.addEventListener('change', (e) => {
                this.setMode(e.target.value);
            });
        }
    }

    setupStickControls(stickId, boundaryId, callback) {
        const stick = document.getElementById(stickId);
        const boundary = document.getElementById(boundaryId);

        this.stickElements[stickId] = { stick, boundary, callback };

        boundary.addEventListener('mousedown', (e) => {
            this.draggingStick = stickId;
            this.handleStickDrag(e);
        });
    }

    handleStickDrag(e) {
        if (!this.draggingStick) return;

        const { stick, boundary, callback } = this.stickElements[this.draggingStick];
        const rect = boundary.getBoundingClientRect();
        const radius = rect.width / 2;
        const knobRadius = stick.offsetWidth / 2;
        const centerX = rect.left + radius;
        const centerY = rect.top + radius;

        let x = e.clientX - centerX;
        let y = e.clientY - centerY;

        const distance = Math.sqrt(x * x + y * y);
        const limit = Math.max(0, radius - knobRadius);
        if (distance > limit) {
            const angle = Math.atan2(y, x);
            x = Math.cos(angle) * limit;
            y = Math.sin(angle) * limit;
        }

        stick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

        const normalizedX = x / limit;
        const normalizedY = -y / limit;

        callback(normalizedX, normalizedY);
    }

    handleStickRelease() {
        if (!this.draggingStick) return;

        const { stick, boundary, callback } = this.stickElements[this.draggingStick];
        const rect = boundary.getBoundingClientRect();
        const radius = rect.width / 2;
        const knobRadius = stick.offsetWidth / 2;
        const limit = Math.max(0, radius - knobRadius);

        if (this.draggingStick === 'right-stick') {
            stick.style.transform = 'translate(-50%, -50%)';
            callback(0, 0);
        } else if (this.draggingStick === 'left-stick') {
            const currentY = this.leftStick.y;
            stick.style.transform = `translate(-50%, calc(-50% + ${-currentY * limit}px))`;
            callback(0, currentY);
        }

        this.draggingStick = null;
    }

    update(physicsState, dt) {
        // Base controls from sticks
        this.updateFromSticks();
        // Override with keyboard if keys are pressed
        this.updateFromKeyboard();

        // Apply mode controllers
        if (this.flightMode === 'loiter') {
            this.applyLoiter(physicsState, dt);
        } else if (this.flightMode === 'rth' || this.returnToHome) {
            this.applyRTH(physicsState, dt);
        } else {
            this.applyStabilize(physicsState, dt);
        }

        // Clamp
        this.controls.throttle = Math.max(0, Math.min(1, this.controls.throttle));
        this.controls.pitch = Math.max(-1, Math.min(1, this.controls.pitch));
        this.controls.roll = Math.max(-1, Math.min(1, this.controls.roll));
        this.controls.yaw = Math.max(-1, Math.min(1, this.controls.yaw));
        return this.controls;
    }

    updateFromSticks() {
        // Only update from sticks if they are moved from default or being dragged
        const stickThrottle = (this.leftStick.y + 1) / 2;

        // If stick is being dragged, use stick.
        // Or if stick is NOT at default (-1), use stick.
        // Otherwise, do not overwrite throttle (let keyboard control it)
        if (this.draggingStick === 'left-stick' || Math.abs(this.leftStick.y + 1) > 0.01) {
            this.controls.throttle = stickThrottle;
            this.controls.yaw = this.leftStick.x;
        } else {
            // For yaw, if stick is centered (0), we might want to let keyboard control it
            // But existing logic for keyboard is incremental.
            // If stick is center, keyboard works.
            // If stick not center, stick works.
        }

        // Right Stick (Pitch/Roll)
        if (this.draggingStick === 'right-stick' || Math.abs(this.rightStick.x) > 0.01 || Math.abs(this.rightStick.y) > 0.01) {
            this.controls.pitch = this.rightStick.y;
            this.controls.roll = this.rightStick.x;
        }
    }

    updateFromKeyboard() {
        // Mapping: Arrows = Throttle/Yaw, WASD = Pitch/Roll
        const boost = this.keys['shift'] ? 2.5 : 1;
        const step = 0.06 * this.sensitivity * boost;
        const throttleStep = 0.04 * this.sensitivity * boost;

        // Throttle (Arrow Up/Down)
        if (this.keys['arrowup']) {
            this.controls.throttle = Math.min(1, this.controls.throttle + throttleStep);
        } else if (this.keys['arrowdown']) {
            this.controls.throttle = Math.max(0, this.controls.throttle - throttleStep);
        }

        // Yaw (Arrow Left/Right) - incremental with auto-centering
        if (this.keys['arrowleft']) {
            this.controls.yaw = Math.max(-1, this.controls.yaw - step);
        } else if (this.keys['arrowright']) {
            this.controls.yaw = Math.min(1, this.controls.yaw + step);
        } else {
            if (Math.abs(this.controls.yaw) < step) this.controls.yaw = 0;
            else this.controls.yaw += this.controls.yaw > 0 ? -step : step;
        }

        // Pitch (W/S)
        if (this.keys['w']) {
            this.controls.pitch = Math.min(1, this.controls.pitch + step);
        } else if (this.keys['s']) {
            this.controls.pitch = Math.max(-1, this.controls.pitch - step);
        } else {
            if (Math.abs(this.controls.pitch) < step) this.controls.pitch = 0;
            else this.controls.pitch += this.controls.pitch > 0 ? -step : step;
        }

        // Roll (A/D)
        if (this.keys['a']) {
            this.controls.roll = Math.max(-1, this.controls.roll - step);
        } else if (this.keys['d']) {
            this.controls.roll = Math.min(1, this.controls.roll + step);
        } else {
            if (Math.abs(this.controls.roll) < step) this.controls.roll = 0;
            else this.controls.roll += this.controls.roll > 0 ? -step : step;
        }

        this.updateLeftStickVisual();
        this.updateRightStickVisual();
    }

    updateLeftStickVisual() {
        const stick = document.getElementById('left-stick');
        const boundary = document.getElementById('left-stick-boundary');
        if (!stick || !boundary) return;

        const rect = boundary.getBoundingClientRect();
        const radius = rect.width / 2;
        const knobRadius = stick.offsetWidth / 2;
        const limit = Math.max(0, radius - knobRadius);

        const y = -(this.controls.throttle * 2 - 1) * limit;
        const x = this.controls.yaw * limit;

        stick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    }

    updateRightStickVisual() {
        const stick = document.getElementById('right-stick');
        const boundary = document.getElementById('right-stick-boundary');
        if (!stick || !boundary) return;

        const rect = boundary.getBoundingClientRect();
        const radius = rect.width / 2;
        const knobRadius = stick.offsetWidth / 2;
        const limit = Math.max(0, radius - knobRadius);

        const x = this.controls.roll * limit;
        const y = -this.controls.pitch * limit;

        stick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    }

    activateRTH() {
        this.setMode('rth');
    }

    applyStabilize(physicsState, dt) {
        const euler = new THREE.Euler().setFromQuaternion(physicsState.rotation);
        const currentRoll = euler.x;
        const currentPitch = euler.z;
        // If sticks near center, level the craft
        const dead = 0.05;
        if (Math.abs(this.controls.roll) < dead) {
            const corr = this.pidController.rollPID.update(0, currentRoll, dt);
            this.controls.roll = this.controls.roll * 0.6 + corr * 0.4;
        }
        if (Math.abs(this.controls.pitch) < dead) {
            const corr = this.pidController.pitchPID.update(0, currentPitch, dt);
            this.controls.pitch = this.controls.pitch * 0.6 + corr * 0.4;
        }
    }

    applyLoiter(physicsState, dt) {
        if (!this.loiterTarget) {
            this.loiterTarget = physicsState.position.clone();
        }
        const desiredAltitude = this.loiterTarget.y;
        const pos2D = new THREE.Vector2(physicsState.position.x, physicsState.position.z);
        const target2D = new THREE.Vector2(this.loiterTarget.x, this.loiterTarget.z);
        const err = target2D.clone().sub(pos2D);
        const posCorr = this.pidController.updatePosition(0, 0, err.x, err.y, dt);
        // Map position correction to pitch/roll
        this.controls.roll = Math.max(-1, Math.min(1, posCorr.x));
        this.controls.pitch = Math.max(-1, Math.min(1, posCorr.y));
        const altCorr = this.pidController.updateAltitude(desiredAltitude, physicsState.position.y, dt);
        this.controls.throttle = Math.max(0, Math.min(1, this.controls.throttle + altCorr * 0.2));
    }

    applyRTH(physicsState, dt) {
        const home = (window.uavSimulator && window.uavSimulator.physics) ? window.uavSimulator.physics.homePosition.clone() : new THREE.Vector3(0, 0, 0);
        const current = physicsState.position.clone();
        const desiredAlt = Math.max(5, home.y + 2);
        // Altitude first
        const altCorr = this.pidController.updateAltitude(desiredAlt, current.y, dt);
        this.controls.throttle = Math.max(0, Math.min(1, this.controls.throttle + altCorr * 0.3));
        // Heading to home
        current.y = 0; home.y = 0;
        const dir = home.clone().sub(current);
        const distance = dir.length();
        if (distance > 0.01) dir.normalize();
        const desiredYaw = Math.atan2(dir.x, dir.z);
        const euler = new THREE.Euler().setFromQuaternion(physicsState.rotation);
        const yawNow = euler.y;
        let yawErr = desiredYaw - yawNow;
        while (yawErr > Math.PI) yawErr -= 2 * Math.PI;
        while (yawErr < -Math.PI) yawErr += 2 * Math.PI;
        this.controls.yaw = Math.max(-1, Math.min(1, yawErr / (Math.PI / 2)));
        // Forward pitch proportional to distance
        const forward = Math.max(0.1, Math.min(0.5, distance * 0.1));
        this.controls.pitch = forward;
        if (distance < 0.5) {
            this.controls.pitch = 0;
            this.controls.throttle = Math.max(0, this.controls.throttle - 0.01);
            if (physicsState.position.y < 0.2) {
                this.returnToHome = false;
                this.flightMode = 'stabilize';
            }
        }
    }

    setMode(mode) {
        this.flightMode = mode;
        if (mode === 'loiter') {
            this.loiterTarget = (window.uavSimulator && window.uavSimulator.physics) ? window.uavSimulator.physics.state.position.clone() : null;
        } else if (mode === 'stabilize') {
            this.loiterTarget = null;
        } else if (mode === 'rth') {
            this.returnToHome = true;
        }
    }

    toggleArm() {
        console.log('Toggle ARM clicked');
        const button = document.getElementById('arm-button');
        if (window.uavSimulator && window.uavSimulator.physics) {
            if (window.uavSimulator.physics.state.isArmed) {
                window.uavSimulator.physics.disarm();
                button.textContent = 'ARM';
                button.style.background = 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';
            } else {
                window.uavSimulator.physics.arm();
                button.textContent = 'DISARM';
                button.style.background = 'linear-gradient(135deg, #f44336 0%, #da190b 100%)';
            }
        }
    }

    emergencyStop() {
        if (window.uavSimulator && window.uavSimulator.physics) {
            window.uavSimulator.physics.disarm();
            this.controls.throttle = 0;
            this.controls.pitch = 0;
            this.controls.roll = 0;
            this.controls.yaw = 0;

            const button = document.getElementById('arm-button');
            button.textContent = 'ARM';
            button.style.background = 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';
        }
    }

    resetUAV() {
        if (window.uavSimulator && window.uavSimulator.physics) {
            window.uavSimulator.physics.reset();
            this.reset();
        }
    }

    cycleCamera() {
        const cameraSelect = document.getElementById('camera-mode');
        if (cameraSelect) {
            const currentIndex = cameraSelect.selectedIndex;
            const nextIndex = (currentIndex + 1) % cameraSelect.options.length;
            cameraSelect.selectedIndex = nextIndex;
            cameraSelect.dispatchEvent(new Event('change'));
        }
    }

    reset() {
        this.controls.throttle = 0;
        this.controls.pitch = 0;
        this.controls.roll = 0;
        this.controls.yaw = 0;
        this.leftStick = { x: 0, y: -1 };
        this.rightStick = { x: 0, y: 0 };
        this.altitudeHold = false;
        this.positionHold = false;
        this.returnToHome = false;
        this.pidController.reset();
    }
}

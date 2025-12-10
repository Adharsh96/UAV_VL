// PID Controller Implementation
class PIDController {
    constructor(kp, ki, kd, outputMin = -Infinity, outputMax = Infinity) {
        this.kp = kp;
        this.ki = ki;
        this.kd = kd;
        this.outputMin = outputMin;
        this.outputMax = outputMax;
        
        this.integral = 0;
        this.previousError = 0;
        this.previousTime = null;
    }

    update(setpoint, measured, dt = null) {
        const currentTime = performance.now();
        
        if (this.previousTime === null) {
            this.previousTime = currentTime;
            return 0;
        }

        if (dt === null) {
            dt = (currentTime - this.previousTime) / 1000; // Convert to seconds
        }
        this.previousTime = currentTime;

        // Calculate error
        const error = setpoint - measured;

        // Proportional term
        const pTerm = this.kp * error;

        // Integral term with anti-windup
        this.integral += error * dt;
        const iTerm = this.ki * this.integral;

        // Derivative term
        const derivative = (error - this.previousError) / dt;
        const dTerm = this.kd * derivative;

        // Calculate output
        let output = pTerm + iTerm + dTerm;

        // Clamp output
        output = Math.max(this.outputMin, Math.min(this.outputMax, output));

        // Anti-windup: prevent integral windup
        if (output === this.outputMin || output === this.outputMax) {
            this.integral -= error * dt; // Undo the integral accumulation
        }

        this.previousError = error;

        return output;
    }

    reset() {
        this.integral = 0;
        this.previousError = 0;
        this.previousTime = null;
    }

    setGains(kp, ki, kd) {
        this.kp = kp;
        this.ki = ki;
        this.kd = kd;
    }

    setOutputLimits(min, max) {
        this.outputMin = min;
        this.outputMax = max;
    }
}

// Cascaded PID Controller for attitude and position control
class CascadedPIDController {
    constructor() {
        // Attitude controllers (inner loop - fast)
        this.rollPID = new PIDController(4.0, 0.05, 1.2, -1, 1);
        this.pitchPID = new PIDController(4.0, 0.05, 1.2, -1, 1);
        this.yawPID = new PIDController(3.0, 0.01, 0.5, -1, 1);
        
        // Altitude controller (outer loop - slow)
        this.altitudePID = new PIDController(2.0, 0.0, 1.5, -1, 1);
        
        // Position controllers (outer loop - slow)
        this.positionXPID = new PIDController(0.5, 0.0, 0.2, -0.5, 0.5);
        this.positionYPID = new PIDController(0.5, 0.0, 0.2, -0.5, 0.5);
    }

    updateAttitude(desiredRoll, desiredPitch, desiredYaw, currentRoll, currentPitch, currentYaw, dt) {
        return {
            roll: this.rollPID.update(desiredRoll, currentRoll, dt),
            pitch: this.pitchPID.update(desiredPitch, currentPitch, dt),
            yaw: this.yawPID.update(desiredYaw, currentYaw, dt)
        };
    }

    updateAltitude(desiredAltitude, currentAltitude, dt) {
        return this.altitudePID.update(desiredAltitude, currentAltitude, dt);
    }

    updatePosition(desiredX, desiredY, currentX, currentY, dt) {
        return {
            x: this.positionXPID.update(desiredX, currentX, dt),
            y: this.positionYPID.update(desiredY, currentY, dt)
        };
    }

    reset() {
        this.rollPID.reset();
        this.pitchPID.reset();
        this.yawPID.reset();
        this.altitudePID.reset();
        this.positionXPID.reset();
        this.positionYPID.reset();
    }
}

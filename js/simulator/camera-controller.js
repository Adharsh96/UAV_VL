// Camera Controller for different view modes
class CameraController {
    constructor(camera, uavModel) {
        this.camera = camera;
        this.uavModel = uavModel;
        this.mode = 'chase';
        
        // Camera parameters
        this.chaseDistance = 8;
        this.chaseHeight = 3;
        this.chaseSmoothness = 0.1;
        
        this.freePosition = new THREE.Vector3(0, 10, 20);
        this.freeRotation = { x: 0, y: 0 };
        this.freeMoveSpeed = 0.5;
        
        this.currentPosition = new THREE.Vector3();
        this.currentLookAt = new THREE.Vector3();
        
        this.setupControls();
        this.setupWheelZoom();
    }

    setupControls() {
        // Free camera controls
        const keys = {};
        
        document.addEventListener('keydown', (e) => {
            keys[e.key.toLowerCase()] = true;
        });
        
        document.addEventListener('keyup', (e) => {
            keys[e.key.toLowerCase()] = false;
        });
        
        // Store keys reference
        this.freeKeys = keys;
    }

    update(dt) {
        const uavPosition = this.uavModel.getPosition();
        const uavRotation = this.uavModel.getRotation();
        
        // In free mode, OrbitControls handles everything
        if (this.mode === 'free') {
            return; // Let OrbitControls handle camera
        }
        
        switch(this.mode) {
            case 'chase':
                this.updateChaseCamera(uavPosition, uavRotation, dt);
                break;
            case 'fpv':
                this.updateFPVCamera(uavPosition, uavRotation);
                break;
            case 'top':
                this.updateTopCamera(uavPosition);
                break;
            case 'side':
                this.updateSideCamera(uavPosition);
                break;
        }
    }

    updateChaseCamera(uavPosition, uavRotation, dt) {
        // Calculate desired camera position behind UAV
        const euler = new THREE.Euler().setFromQuaternion(uavRotation);
        const yaw = euler.y;
        
        const desiredPosition = new THREE.Vector3(
            uavPosition.x - Math.sin(yaw) * this.chaseDistance,
            uavPosition.y + this.chaseHeight,
            uavPosition.z - Math.cos(yaw) * this.chaseDistance
        );
        
        // Smooth camera movement
        this.currentPosition.lerp(desiredPosition, this.chaseSmoothness);
        this.currentLookAt.lerp(uavPosition, this.chaseSmoothness);
        
        this.camera.position.copy(this.currentPosition);
        this.camera.lookAt(this.currentLookAt);
    }

    setupWheelZoom() {
        const container = document.getElementById('simulator-canvas-container');
        if (!container) return;
        container.addEventListener('wheel', (e) => {
            if (this.mode !== 'chase') return; // Only in chase mode
            e.preventDefault();
            const delta = Math.sign(e.deltaY);
            // Zoom in/out by adjusting distance and height
            this.chaseDistance = this._clamp(this.chaseDistance + delta * 0.8, 3, 30);
            this.chaseHeight = this._clamp(this.chaseHeight + delta * 0.3, 1, 15);
        }, { passive: false });
    }

    _clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

    updateFPVCamera(uavPosition, uavRotation) {
        // Camera mounted on UAV
        this.camera.position.copy(uavPosition);
        this.camera.quaternion.copy(uavRotation);
        
        // Add slight offset forward
        const forward = new THREE.Vector3(0, 0, -0.1);
        forward.applyQuaternion(uavRotation);
        this.camera.position.add(forward);
        
        // Add camera shake based on throttle (simulated vibration)
        const shake = Math.random() * 0.02;
        this.camera.position.x += (Math.random() - 0.5) * shake;
        this.camera.position.y += (Math.random() - 0.5) * shake;
        this.camera.position.z += (Math.random() - 0.5) * shake;
    }

    updateFreeCamera(dt) {
        // WASD movement
        const moveSpeed = this.freeMoveSpeed;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        
        if (this.freeKeys['w']) {
            this.freePosition.add(forward.multiplyScalar(moveSpeed));
        }
        if (this.freeKeys['s']) {
            this.freePosition.sub(forward.multiplyScalar(moveSpeed));
        }
        if (this.freeKeys['a']) {
            this.freePosition.sub(right.multiplyScalar(moveSpeed));
        }
        if (this.freeKeys['d']) {
            this.freePosition.add(right.multiplyScalar(moveSpeed));
        }
        if (this.freeKeys['q']) {
            this.freePosition.y -= moveSpeed;
        }
        if (this.freeKeys['e']) {
            this.freePosition.y += moveSpeed;
        }
        
        this.camera.position.copy(this.freePosition);
        
        // Look at UAV
        const uavPosition = this.uavModel.getPosition();
        this.camera.lookAt(uavPosition);
    }

    updateTopCamera(uavPosition) {
        // Directly above UAV
        this.camera.position.set(
            uavPosition.x,
            uavPosition.y + 50,
            uavPosition.z
        );
        this.camera.lookAt(uavPosition);
    }

    updateSideCamera(uavPosition) {
        // Side view, following horizontally
        this.camera.position.set(
            uavPosition.x + 20,
            15,
            uavPosition.z
        );
        this.camera.lookAt(uavPosition);
    }

    setMode(mode) {
        this.mode = mode;
        
        // Enable/disable OrbitControls based on mode
        if (window.uavSimulator && window.uavSimulator.orbitControls) {
            const controls = window.uavSimulator.orbitControls;
            
            if (mode === 'free') {
                // Enable OrbitControls for free camera
                controls.enabled = true;
                this.freePosition.copy(this.camera.position);
            } else {
                // Disable OrbitControls for automatic camera modes
                controls.enabled = false;
            }
        }
    }
}

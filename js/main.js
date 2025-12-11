// Main Application Entry Point
class UAVSimulatorApp {
    constructor() {
        this.designLab = null;
        this.simulator = null;

        this.init();
    }

    init() {
        // Hide loading screen after a short delay
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
        }, 1000);

        // Initialize Design Lab
        this.initializeDesignLab();
    }

    initializeDesignLab() {
        // Create calculator
        const calculator = new UAVCalculations();
        calculator.calculateAll();

        // Create UI handler
        this.designLab = new DesignLabUI(calculator);

        // Create 3D preview renderer
        window.previewRenderer = new PreviewRenderer('preview-canvas-container');
        window.previewRenderer.updateUAV(calculator.config);
    }
}

// UAV Simulator Class
class UAVSimulator {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.uavModel = null;
        this.physics = null;
        this.flightController = null;
        this.cameraController = null;
        this.telemetry = null;
        this.terrainGenerator = null;
        this.flightRecorder = new FlightRecorder();
        this.missionManager = null;

        this.lastTime = performance.now();
        this.physicsAccumulator = 0;
        this.physicsTimestep = 1 / 120; // 120 Hz physics

        this.isRunning = false;
    }

    initialize(uavConfig, environmentConfig) {
        console.log('Initializing simulator...');

        // Clean up previous instance if exists
        if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
            console.log('Removing old renderer');
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }

        // Setup scene
        console.log('Setting up scene...');
        this.setupScene();
        console.log('Scene setup complete. Renderer:', !!this.renderer, 'Scene:', !!this.scene, 'Camera:', !!this.camera);

        // Generate terrain
        this.terrainGenerator = new TerrainGenerator(this.scene);
        this.terrainGenerator.generate(environmentConfig.terrain);
        console.log('Terrain generated, terrain object:', !!this.terrainGenerator.terrain);

        // Create UAV model
        this.uavModel = new UAVModel(this.scene, uavConfig);
        console.log('UAV model created, UAV group:', !!this.uavModel.group);
        console.log('UAV group children count:', this.uavModel.group.children.length);

        // Initialize physics
        this.physics = new PhysicsEngine(uavConfig, environmentConfig);
        console.log('Physics initialized');
        if (this.physics) {
            this.physics.disarm();
        }

        // Initialize flight controller
        if (!this.flightController) {
            this.flightController = new FlightController();
        } else {
            this.flightController.reset();
        }
        console.log('Flight controller initialized');

        // Initialize camera controller
        this.cameraController = new CameraController(this.camera, this.uavModel);
        console.log('Camera controller initialized');

        // Initialize telemetry
        if (!this.telemetry) {
            this.telemetry = new TelemetryDisplay();
        } else {
            this.telemetry.reset();
        }
        console.log('Telemetry initialized');

        // Initialize Missions
        this.missionManager = new MissionManager(this.telemetry);
        this.missionManager.reset();

        // Keyboard listener for Recorder
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'l') {
                this.flightRecorder.toggle();
            }
        });

        // Setup camera mode selector (remove old listener first)
        const cameraSelect = document.getElementById('camera-mode');
        const newCameraSelect = cameraSelect.cloneNode(true);
        cameraSelect.parentNode.replaceChild(newCameraSelect, cameraSelect);
        newCameraSelect.addEventListener('change', (e) => {
            this.cameraController.setMode(e.target.value);
        });

        // Setup exit button (remove old listener first)
        const exitBtn = document.getElementById('exit-simulator');
        const newExitBtn = exitBtn.cloneNode(true);
        exitBtn.parentNode.replaceChild(newExitBtn, exitBtn);
        newExitBtn.addEventListener('click', () => {
            this.exitSimulator();
        });

        // Start simulation loop
        this.isRunning = true;
        this.lastTime = performance.now();
        this.physicsAccumulator = 0;
        console.log('Starting animation loop...');
        this.animate();
    }

    setupScene() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.002); // Exponential fog looks better appropriately


        // Camera
        const container = document.getElementById('simulator-canvas-container');
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(-8, 6, 8); // Better position to see terrain and UAV
        this.camera.lookAt(0, 2, 0); // Look at UAV position slightly above ground

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        // OrbitControls for mouse interaction (disabled by default, enabled in 'free' camera mode)
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.orbitControls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.orbitControls.enableDamping = true;
            this.orbitControls.dampingFactor = 0.05;
            this.orbitControls.minDistance = 5;
            this.orbitControls.maxDistance = 200;
            this.orbitControls.maxPolarAngle = Math.PI / 2; // Prevent going below ground
            this.orbitControls.enablePan = true;
            this.orbitControls.panSpeed = 1.0;
            this.orbitControls.rotateSpeed = 0.5;
            this.orbitControls.zoomSpeed = 1.0;
            this.orbitControls.enabled = false; // Start disabled, enable in 'free' mode
        }

        // Lighting
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        this.scene.add(hemisphereLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.near = 1;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -200;
        directionalLight.shadow.camera.right = 200;
        directionalLight.shadow.camera.top = 200;
        directionalLight.shadow.camera.bottom = -200;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    animate() {
        if (!this.isRunning) {
            console.log('Animation stopped - isRunning is false');
            return;
        }

        requestAnimationFrame(() => this.animate());

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Fixed timestep physics
        this.physicsAccumulator += deltaTime;
        while (this.physicsAccumulator >= this.physicsTimestep) {
            this.updatePhysics(this.physicsTimestep);
            this.physicsAccumulator -= this.physicsTimestep;
        }

        // Update OrbitControls if available
        if (this.orbitControls) {
            this.orbitControls.update();
        }

        // Update camera controller (only if not using manual camera mode)
        if (this.cameraController && this.flightController && this.flightController.controls.cameraMode !== 'free') {
            this.cameraController.update(deltaTime);
        }

        // Update telemetry
        if (this.telemetry && this.physics) {
            this.telemetry.update(this.physics.state, this.flightController.controls);
        }

        // Update Missions & Recorder
        if (this.missionManager && this.physics) {
            this.missionManager.update(this.physics.state, deltaTime);
        }
        if (this.flightRecorder && this.physics) {
            this.flightRecorder.record(this.physics.state, this.flightController.controls);
        }

        // Update terrain
        if (this.terrainGenerator && this.physics) {
            this.terrainGenerator.update(this.physics.state.position);
        }

        // Always render, even if disarmed
        try {
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            } else {
                console.error('Renderer, scene, or camera is null:', {
                    renderer: !!this.renderer,
                    scene: !!this.scene,
                    camera: !!this.camera
                });
            }
        } catch (error) {
            console.error('Render error:', error);
        }
    }

    updatePhysics(dt) {
        // Get control inputs
        const controls = this.flightController.update(this.physics.state, dt);

        // Update physics
        const state = this.physics.update(controls, dt);

        // Update UAV model
        this.uavModel.update(state);
    }

    onWindowResize() {
        const container = document.getElementById('simulator-canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    exitSimulator() {
        // Stop simulation
        this.isRunning = false;

        // Clean up
        if (this.uavModel) {
            this.uavModel.remove();
        }

        if (this.renderer) {
            this.renderer.domElement.remove();
        }

        // Reset controllers
        if (this.flightController) {
            this.flightController.reset();
        }

        if (this.telemetry) {
            this.telemetry.reset();
        }

        if (this.flightRecorder) {
            this.flightRecorder.stop();
        }
        if (this.missionManager) {
            this.missionManager.reset();
        }

        // Switch back to design lab
        document.getElementById('simulator').classList.remove('active');
        document.getElementById('design-lab').classList.add('active');
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create main app
    window.app = new UAVSimulatorApp();

    // Create simulator instance (will be initialized when launched)
    window.uavSimulator = new UAVSimulator();
});

// 3D Preview Renderer for Design Lab
class PreviewRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.uavGroup = null;
        this.controls = null;
        
        this.init();
        this.animate();
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

        // Camera setup
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(3, 2, 3);
        this.camera.lookAt(0, 0, 0);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        this.scene.add(hemisphereLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -10;
        directionalLight.shadow.camera.right = 10;
        directionalLight.shadow.camera.top = 10;
        directionalLight.shadow.camera.bottom = -10;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Grid floor
        const gridHelper = new THREE.GridHelper(10, 10, 0x4CAF50, 0x888888);
        gridHelper.position.y = -0.5;
        this.scene.add(gridHelper);

        // Ground plane
        const groundGeometry = new THREE.PlaneGeometry(10, 10);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x90EE90,
            roughness: 0.8
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.51;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Axis helper
        const axesHelper = new THREE.AxesHelper(2);
        this.scene.add(axesHelper);

        // UAV group
        this.uavGroup = new THREE.Group();
        this.scene.add(this.uavGroup);

        // OrbitControls for better interaction
        this.setupControls();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupControls() {
        // Use OrbitControls if available
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.minDistance = 2;
            this.controls.maxDistance = 10;
            this.controls.target.set(0, 0, 0);
        } else {
            // Fallback to manual controls
            let isDragging = false;
            let previousMousePosition = { x: 0, y: 0 };

            this.renderer.domElement.addEventListener('mousedown', (e) => {
                isDragging = true;
                previousMousePosition = { x: e.clientX, y: e.clientY };
            });

            this.renderer.domElement.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    const deltaX = e.clientX - previousMousePosition.x;
                    const deltaY = e.clientY - previousMousePosition.y;

                    const rotationSpeed = 0.005;
                    this.camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), -deltaX * rotationSpeed);
                    
                    previousMousePosition = { x: e.clientX, y: e.clientY };
                    this.camera.lookAt(0, 0, 0);
                }
            });

            this.renderer.domElement.addEventListener('mouseup', () => {
                isDragging = false;
            });

            this.renderer.domElement.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY * 0.005;
                const direction = this.camera.position.clone().normalize();
                this.camera.position.add(direction.multiplyScalar(delta));
                
                // Clamp distance
                const distance = this.camera.position.length();
                if (distance < 2) {
                    this.camera.position.normalize().multiplyScalar(2);
                } else if (distance > 10) {
                    this.camera.position.normalize().multiplyScalar(10);
                }
            }, { passive: false });
        }
    }

    updateUAV(config) {
        // Clear existing UAV
        while (this.uavGroup.children.length > 0) {
            this.uavGroup.remove(this.uavGroup.children[0]);
        }

        // Build new UAV based on configuration
        this.buildFrame(config.frame);
        this.buildMotorsAndProps(config.frame, config.motors, config.propellers);
        this.buildBattery(config.battery);
        this.buildPayload(config.payload);
    }

    buildFrame(frameConfig) {
        const { type, size, material } = frameConfig;
        const armLength = (size / 1000); // Convert mm to meters (full arm length)

        // Material colors
        const materialColors = {
            'carbon': 0x1a1a1a,
            'aluminum': 0xc0c0c0,
            'plastic': 0x333333
        };
        const color = materialColors[material];

        // Center body (larger and more visible)
        const bodyGeometry = new THREE.CylinderGeometry(0.06, 0.08, 0.04, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        this.uavGroup.add(body);

        // Arms - extend from center to motor position
        const motorCount = type.includes('quad') ? 4 : type === 'hexa' ? 6 : 8;
        
        // The arm length should be the radius (half the frame size)
        const motorDistance = armLength * 0.85 / 2;
        const armGeometry = new THREE.BoxGeometry(motorDistance, 0.01, 0.03); // Flat rectangular arms
        const armMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });

        for (let i = 0; i < motorCount; i++) {
            const angle = (i * 2 * Math.PI) / motorCount;
            const arm = new THREE.Mesh(armGeometry, armMaterial);
            
            // Position the arm's center halfway to the motor
            arm.position.x = Math.cos(angle) * motorDistance / 2;
            arm.position.z = Math.sin(angle) * motorDistance / 2;
            arm.rotation.y = angle;
            arm.castShadow = true;
            
            this.uavGroup.add(arm);
        }
    }

    buildMotorsAndProps(frameConfig, motorConfig, propConfig) {
        const { type, size } = frameConfig;
        const armLength = (size / 1000); // Full arm length in meters
        const motorCount = type.includes('quad') ? 4 : type === 'hexa' ? 6 : 8;
        const propRadius = propConfig.size * 0.0254 / 2; // Convert inches to meters radius
        
        // Motor position should match arm length
        const motorDistance = armLength * 0.85 / 2; // Match the arm length calculation
        
        // Ensure propeller radius doesn't exceed arm length (leave some clearance)
        const maxPropRadius = motorDistance * 0.9;
        const actualPropRadius = Math.min(propRadius, maxPropRadius);

        // Motor and propeller material
        const motorMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.3, metalness: 0.5 });
        const propMaterial = new THREE.MeshStandardMaterial({ 
            color: propConfig.material === 'carbon' ? 0x1a1a1a : 0x2196F3,
            roughness: 0.4,
            transparent: true,
            opacity: 0.8
        });

        for (let i = 0; i < motorCount; i++) {
            const angle = (i * 2 * Math.PI) / motorCount;
            // Position at end of arm
            const x = Math.cos(angle) * motorDistance;
            const z = Math.sin(angle) * motorDistance;

            // Motor - positioned at end of arm
            const motorGeometry = new THREE.CylinderGeometry(0.025, 0.03, 0.04, 16);
            const motor = new THREE.Mesh(motorGeometry, motorMaterial);
            motor.position.set(x, 0.02, z); // Slightly above arm
            motor.castShadow = true;
            this.uavGroup.add(motor);

            // Motor shaft
            const shaftGeometry = new THREE.CylinderGeometry(0.005, 0.005, 0.03, 8);
            const shaftMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
            const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
            shaft.position.set(x, 0.055, z); // Above motor
            this.uavGroup.add(shaft);

            // Propeller hub (center piece)
            const hubGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.005, 16);
            const hubMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 });
            const hub = new THREE.Mesh(hubGeometry, hubMaterial);
            hub.position.set(x, 0.07, z);
            this.uavGroup.add(hub);

            // Propeller blades - properly aligned
            const propGroup = new THREE.Group();
            const bladeCount = propConfig.blades;
            
            for (let j = 0; j < bladeCount; j++) {
                const bladeAngle = (j * 2 * Math.PI) / bladeCount;
                
                // Create blade shape with proper dimensions
                const bladeLength = actualPropRadius * 0.9; // 90% of radius for realistic look
                const bladeGeometry = new THREE.BoxGeometry(bladeLength, 0.003, 0.03);
                const blade = new THREE.Mesh(bladeGeometry, propMaterial);
                
                // Position blade extending from center
                const bladeX = Math.cos(bladeAngle) * bladeLength / 2;
                const bladeZ = Math.sin(bladeAngle) * bladeLength / 2;
                
                blade.position.set(bladeX, 0, bladeZ);
                blade.rotation.y = bladeAngle;
                blade.castShadow = true;
                
                propGroup.add(blade);
            }
            
            // Position propeller group above motor hub
            propGroup.position.set(x, 0.073, z);
            this.uavGroup.add(propGroup);
        }
    }

    buildBattery(batteryConfig) {
        const { cells, capacity } = batteryConfig;
        
        // Battery size based on capacity
        const width = 0.05 + (capacity / 10000) * 0.05;
        const height = 0.03 + (cells / 6) * 0.02;
        const depth = 0.08 + (capacity / 10000) * 0.04;

        const batteryGeometry = new THREE.BoxGeometry(width, height, depth);
        const batteryMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xFFD700,
            roughness: 0.6
        });
        const battery = new THREE.Mesh(batteryGeometry, batteryMaterial);
        battery.position.y = -0.04;
        battery.castShadow = true;
        this.uavGroup.add(battery);
    }

    buildPayload(payloadConfig) {
        const { type } = payloadConfig;
        
        if (type === 'none') return;

        let payloadGeometry, payloadMaterial;

        if (type.includes('camera')) {
            // Camera gimbal
            payloadGeometry = new THREE.BoxGeometry(0.04, 0.04, 0.05);
            payloadMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
        } else if (type === 'sensor') {
            payloadGeometry = new THREE.SphereGeometry(0.02, 16, 16);
            payloadMaterial = new THREE.MeshStandardMaterial({ color: 0x4CAF50 });
        } else if (type === 'delivery') {
            payloadGeometry = new THREE.BoxGeometry(0.1, 0.08, 0.1);
            payloadMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        }

        if (payloadGeometry) {
            const payload = new THREE.Mesh(payloadGeometry, payloadMaterial);
            payload.position.y = -0.1;
            payload.castShadow = true;
            this.uavGroup.add(payload);
        }
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update OrbitControls if available
        if (this.controls && this.controls.update) {
            this.controls.update();
        }
        
        // Slow rotation for preview (only if not using OrbitControls)
        if (!this.controls) {
            this.uavGroup.rotation.y += 0.002;
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

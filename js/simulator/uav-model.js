// UAV 3D Model for Simulator
class UAVModel {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.group = new THREE.Group();
        this.propellers = [];

        // Generate procedural textures
        this.carbonTexture = this.createCarbonTexture();
        this.metalTexture = this.createMetalTexture();
        this.plasticTexture = this.createPlasticTexture();

        this.build();
    }

    createCarbonTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Base
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, 512, 512);

        // Weave pattern
        ctx.fillStyle = '#2a2a2a';
        for (let y = 0; y < 512; y += 8) {
            for (let x = 0; x < 512; x += 8) {
                if ((x / 8 + y / 8) % 2 === 0) {
                    ctx.fillRect(x, y, 8, 8);
                }
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        return texture;
    }

    createMetalTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Brushed metal gradient
        const grad = ctx.createLinearGradient(0, 0, 256, 256);
        grad.addColorStop(0, '#888888');
        grad.addColorStop(0.5, '#aaaaaa');
        grad.addColorStop(1, '#999999');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);

        // Noise
        for (let i = 0; i < 5000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#bbbbbb' : '#777777';
            ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 1);
        }

        return new THREE.CanvasTexture(canvas);
    }

    createPlasticTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(canvas);
    }


    build() {
        const { frame, motors, propellers, battery, payload } = this.config;

        // Build frame
        this.buildFrame(frame);

        // Build motors and propellers
        this.buildMotorsAndProps(frame, motors, propellers);

        // Build battery
        this.buildBattery(battery);

        // Build payload
        this.buildPayload(payload);

        // Add to scene
        this.scene.add(this.group);
    }

    buildFrame(frameConfig) {
        const { type, size, material } = frameConfig;
        const armLength = (size / 1000); // Full arm length in meters

        const materialColors = {
            'carbon': 0x1a1a1a,
            'aluminum': 0xc0c0c0,
            'plastic': 0x333333
        };
        const color = materialColors[material];

        // Center body
        const bodyGeometry = new THREE.CylinderGeometry(0.06, 0.08, 0.04, 8);

        let bodyMatParams = { color, roughness: 0.5, metalness: 0.3 };
        if (material === 'carbon') {
            bodyMatParams = { map: this.carbonTexture, roughness: 0.4, metalness: 0.5, color: 0xffffff };
        } else if (material === 'aluminum') {
            bodyMatParams = { map: this.metalTexture, roughness: 0.3, metalness: 0.8, color: 0xffffff };
        }

        const bodyMaterial = new THREE.MeshStandardMaterial(bodyMatParams);
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        this.group.add(body);

        // Arms - extend from center to motor position
        const motorCount = type.includes('quad') ? 4 : type === 'hexa' ? 6 : 8;
        const motorDistance = armLength * 0.85 / 2;
        const armGeometry = new THREE.BoxGeometry(motorDistance, 0.01, 0.03);

        // Reuse same material params logic
        const armMaterial = bodyMaterial.clone();

        for (let i = 0; i < motorCount; i++) {
            const angle = (i * 2 * Math.PI) / motorCount;
            const arm = new THREE.Mesh(armGeometry, armMaterial);

            // Position the arm's center halfway to the motor
            arm.position.x = Math.cos(angle) * motorDistance / 2;
            arm.position.z = Math.sin(angle) * motorDistance / 2;
            arm.rotation.y = angle;
            arm.castShadow = true;

            this.group.add(arm);
        }
    }

    buildMotorsAndProps(frameConfig, motorConfig, propConfig) {
        const { type, size } = frameConfig;
        const armLength = (size / 1000); // Full arm length
        const motorCount = type.includes('quad') ? 4 : type === 'hexa' ? 6 : 8;
        const propRadius = propConfig.size * 0.0254 / 2;

        // Motor position should match arm length
        const motorDistance = armLength * 0.85 / 2;

        // Ensure propeller radius doesn't exceed arm length (leave some clearance)
        const maxPropRadius = motorDistance * 0.9;
        const actualPropRadius = Math.min(propRadius, maxPropRadius);

        const motorMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.3, metalness: 0.5 });
        const propMaterial = new THREE.MeshStandardMaterial({
            color: propConfig.material === 'carbon' ? 0x1a1a1a : 0x2196F3,
            roughness: 0.4,
            transparent: true,
            opacity: 0.7
        });

        for (let i = 0; i < motorCount; i++) {
            const angle = (i * 2 * Math.PI) / motorCount;
            const x = Math.cos(angle) * motorDistance;
            const z = Math.sin(angle) * motorDistance;

            // Motor
            const motorGeometry = new THREE.CylinderGeometry(0.025, 0.03, 0.04, 16);
            const motor = new THREE.Mesh(motorGeometry, motorMaterial);
            motor.position.set(x, 0.02, z);
            motor.castShadow = true;
            this.group.add(motor);

            // Motor shaft
            const shaftGeometry = new THREE.CylinderGeometry(0.005, 0.005, 0.03, 8);
            const shaftMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
            const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
            shaft.position.set(x, 0.055, z);
            this.group.add(shaft);

            // Propeller hub
            const hubGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.005, 16);
            const hubMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 });
            const hub = new THREE.Mesh(hubGeometry, hubMaterial);
            hub.position.set(x, 0.07, z);
            this.group.add(hub);

            // Propeller blades
            const propGroup = new THREE.Group();
            const bladeCount = propConfig.blades;

            for (let j = 0; j < bladeCount; j++) {
                const bladeAngle = (j * 2 * Math.PI) / bladeCount;
                const bladeLength = actualPropRadius * 0.9;
                const bladeGeometry = new THREE.BoxGeometry(bladeLength, 0.003, 0.03);
                const blade = new THREE.Mesh(bladeGeometry, propMaterial);

                const bladeX = Math.cos(bladeAngle) * bladeLength / 2;
                const bladeZ = Math.sin(bladeAngle) * bladeLength / 2;

                blade.position.set(bladeX, 0, bladeZ);
                blade.rotation.y = bladeAngle;
                blade.castShadow = true;

                propGroup.add(blade);
            }

            propGroup.position.set(x, 0.073, z);
            this.propellers.push(propGroup);
            this.group.add(propGroup);
        }
    }

    buildBattery(batteryConfig) {
        const { cells, capacity } = batteryConfig;

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
        this.group.add(battery);
    }

    buildPayload(payloadConfig) {
        const { type } = payloadConfig;

        if (type === 'none') return;

        let payloadGeometry, payloadMaterial;

        if (type.includes('camera')) {
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
            this.group.add(payload);
        }
    }

    update(state) {
        // Update position
        this.group.position.copy(state.position);

        // Update rotation
        this.group.quaternion.copy(state.rotation);

        // Spin propellers based on motor speeds
        if (state.motorSpeeds && this.propellers.length > 0) {
            for (let i = 0; i < this.propellers.length; i++) {
                const speed = state.motorSpeeds[i] || 0;
                // Spin propellers (visual effect)
                const direction = i % 2 === 0 ? 1 : -1;
                this.propellers[i].rotation.y += speed * 0.15 * direction;
            }
        }
    }

    getPosition() {
        return this.group.position.clone();
    }

    getRotation() {
        return this.group.quaternion.clone();
    }

    remove() {
        this.scene.remove(this.group);
    }
}

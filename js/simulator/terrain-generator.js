// Terrain Generator for Simulator
class TerrainGenerator {
    constructor(scene) {
        this.scene = scene;
        this.terrainType = 'flat';
        this.chunkSize = 250; // Size of each terrain chunk
        this.viewDistance = 2; // In chunks
        this.chunks = {};
        this.lastUAVChunkX = 0;
        this.lastUAVChunkZ = 0;
    }

    generate(type) {
        this.clear();
        this.terrainType = type;
        this.generateInitialChunks();
    }

    update(uavPosition) {
        const uavChunkX = Math.floor(uavPosition.x / this.chunkSize);
        const uavChunkZ = Math.floor(uavPosition.z / this.chunkSize);

        if (uavChunkX !== this.lastUAVChunkX || uavChunkZ !== this.lastUAVChunkZ) {
            this.lastUAVChunkX = uavChunkX;
            this.lastUAVChunkZ = uavChunkZ;
            this.updateChunks();
        }
    }

    generateInitialChunks() {
        for (let x = -this.viewDistance; x <= this.viewDistance; x++) {
            for (let z = -this.viewDistance; z <= this.viewDistance; z++) {
                this.generateChunk(x, z);
            }
        }
    }

    updateChunks() {
        const currentChunks = {};
        for (let x = this.lastUAVChunkX - this.viewDistance; x <= this.lastUAVChunkX + this.viewDistance; x++) {
            for (let z = this.lastUAVChunkZ - this.viewDistance; z <= this.lastUAVChunkZ + this.viewDistance; z++) {
                const chunkId = `${x},${z}`;
                currentChunks[chunkId] = true;
                if (!this.chunks[chunkId]) {
                    this.generateChunk(x, z);
                }
            }
        }

        // Remove old chunks
        for (const chunkId in this.chunks) {
            if (!currentChunks[chunkId]) {
                this.removeChunk(chunkId);
            }
        }
    }

    generateChunk(chunkX, chunkZ) {
        const chunkId = `${chunkX},${chunkZ}`;
        if (this.chunks[chunkId]) return;

        let chunk;
        switch (this.terrainType) {
            case 'flat':
                chunk = this.generateFlatChunk(chunkX, chunkZ);
                break;
            case 'hilly':
                chunk = this.generateHillyChunk(chunkX, chunkZ);
                break;
            case 'urban':
                chunk = this.generateUrbanChunk(chunkX, chunkZ);
                break;
            case 'desert':
                chunk = this.generateDesertChunk(chunkX, chunkZ);
                break;
            default:
                chunk = this.generateFlatChunk(chunkX, chunkZ);
        }

        chunk.position.set(chunkX * this.chunkSize, 0, chunkZ * this.chunkSize);
        this.scene.add(chunk);
        this.chunks[chunkId] = chunk;
    }

    removeChunk(chunkId) {
        const chunk = this.chunks[chunkId];
        if (chunk) {
            this.scene.remove(chunk);
            // Dispose of geometries and materials to free up memory
            chunk.traverse(object => {
                if (object.isMesh) {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => material.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                }
            });
        }
        delete this.chunks[chunkId];
    }

    clear() {
        for (const chunkId in this.chunks) {
            this.removeChunk(chunkId);
        }
        this.chunks = {};
    }

    // --- Height sampling and normals for seamless stitching ---
    sampleHeight(wx, wz) {
        switch (this.terrainType) {
            case 'flat': {
                // Gentle undulation
                const h1 = perlin.octaveNoise2D(wx / 200, wz / 200, 2, 0.5) * 1.5;
                const h2 = perlin.octaveNoise2D((wx + 1000) / 80, (wz - 500) / 80, 1, 0.5) * 0.5;
                return h1 + h2;
            }
            case 'hilly': {
                // Rolling hills with rocky variation
                const base = perlin.octaveNoise2D(wx / 140, wz / 140, 4, 0.55) * 18;
                const detail = perlin.octaveNoise2D(wx / 40, wz / 40, 2, 0.45) * 6;
                return base + detail;
            }
            case 'desert': {
                // Dune-like ridged noise
                const n1 = perlin.octaveNoise2D(wx / 180, wz / 180, 3, 0.5);
                const n2 = perlin.octaveNoise2D((wx + 500) / 60, (wz - 700) / 60, 1, 0.5);
                const ridged = Math.pow(Math.abs(n1), 1.3) * 16;
                return ridged + n2 * 3;
            }
            case 'urban':
            default:
                return 0;
        }
    }

    computeNormalsFromHeight(geometry, chunkX, chunkZ) {
        const pos = geometry.attributes.position.array;
        const normals = new Float32Array(pos.length);
        const eps = 1.0; // sampling offset in world units
        for (let i = 0; i < pos.length; i += 3) {
            const lx = pos[i];
            const ly = pos[i + 1];
            const wx = lx + chunkX * this.chunkSize;
            const wz = ly + chunkZ * this.chunkSize;

            const hL = this.sampleHeight(wx - eps, wz);
            const hR = this.sampleHeight(wx + eps, wz);
            const hD = this.sampleHeight(wx, wz - eps);
            const hU = this.sampleHeight(wx, wz + eps);

            const dx = (hR - hL);
            const dz = (hU - hD);
            // Local normal for surface z = h(x,y): [-dh/dx, -dh/dy, 1]
            let nx = -dx;
            let ny = -dz;
            let nz = 2 * eps;
            const invLen = 1.0 / Math.hypot(nx, ny, nz);
            nx *= invLen; ny *= invLen; nz *= invLen;
            normals[i] = nx;
            normals[i + 1] = ny;
            normals[i + 2] = nz;
        }
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.attributes.normal.needsUpdate = true;
        geometry.attributes.position.needsUpdate = true;
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
    }

    generateFlatChunk(chunkX, chunkZ) {
        const terrainGroup = new THREE.Group();
        const groundGeometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, 40, 40);
        const vertices = groundGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const lx = vertices[i];
            const ly = vertices[i + 1];
            const wx = lx + chunkX * this.chunkSize;
            const wz = ly + chunkZ * this.chunkSize;
            vertices[i + 2] = this.sampleHeight(wx, wz);
        }
        this.computeNormalsFromHeight(groundGeometry, chunkX, chunkZ);
        const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x90EE90, roughness: 0.95, side: THREE.DoubleSide });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        ground.frustumCulled = false;
        terrainGroup.add(ground);
        this.addSkirts(terrainGroup, chunkX, chunkZ, 0x90EE90, groundGeometry.parameters.widthSegments, groundGeometry.parameters.heightSegments);
        // Add sparse trees/shrubs
        for (let i = 0; i < 6; i++) {
            const obj = Math.random() < 0.3 ? this.createShrub() : this.createTree();
            obj.position.x = (Math.random() - 0.5) * this.chunkSize;
            obj.position.z = (Math.random() - 0.5) * this.chunkSize;
            const wx = obj.position.x + chunkX * this.chunkSize;
            const wz = obj.position.z + chunkZ * this.chunkSize;
            obj.position.y = this.sampleHeight(wx, wz);
            terrainGroup.add(obj);
        }
        // Occasional puddle
        if (Math.random() < 0.3) {
            const puddleGeo = new THREE.CircleGeometry(6 + Math.random() * 10, 24);
            const puddleMat = new THREE.MeshStandardMaterial({ color: 0x88ccee, roughness: 0.1, metalness: 0.0, transparent: true, opacity: 0.6 });
            const puddle = new THREE.Mesh(puddleGeo, puddleMat);
            puddle.rotation.x = -Math.PI / 2;
            puddle.position.set((Math.random() - 0.5) * this.chunkSize * 0.7, 0.05, (Math.random() - 0.5) * this.chunkSize * 0.7);
            terrainGroup.add(puddle);
        }
        return terrainGroup;
    }

    generateHillyChunk(chunkX, chunkZ) {
        const terrainGroup = new THREE.Group();
        const geometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, 64, 64);
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const lx = vertices[i];
            const ly = vertices[i + 1];
            const wx = lx + chunkX * this.chunkSize;
            const wz = ly + chunkZ * this.chunkSize;
            vertices[i + 2] = this.sampleHeight(wx, wz);
        }
        this.computeNormalsFromHeight(geometry, chunkX, chunkZ);
        const material = new THREE.MeshStandardMaterial({ color: 0x7CB342, roughness: 0.95, side: THREE.DoubleSide });
        const terrain = new THREE.Mesh(geometry, material);
        terrain.rotation.x = -Math.PI / 2;
        terrain.receiveShadow = true;
        terrain.frustumCulled = false;
        terrainGroup.add(terrain);
        this.addSkirts(terrainGroup, chunkX, chunkZ, 0x7CB342, geometry.parameters.widthSegments, geometry.parameters.heightSegments);
        // Add trees and rocks
        for (let i = 0; i < 8; i++) {
            const t = this.createTree();
            t.position.x = (Math.random() - 0.5) * this.chunkSize;
            t.position.z = (Math.random() - 0.5) * this.chunkSize;
            const wx = t.position.x + chunkX * this.chunkSize;
            const wz = t.position.z + chunkZ * this.chunkSize;
            t.position.y = this.sampleHeight(wx, wz);
            terrainGroup.add(t);
        }
        for (let i = 0; i < 5; i++) {
            const r = this.createRock();
            r.position.x = (Math.random() - 0.5) * this.chunkSize;
            r.position.z = (Math.random() - 0.5) * this.chunkSize;
            const wx = r.position.x + chunkX * this.chunkSize;
            const wz = r.position.z + chunkZ * this.chunkSize;
            r.position.y = this.sampleHeight(wx, wz);
            terrainGroup.add(r);
        }
        return terrainGroup;
    }

    generateUrbanChunk(chunkX, chunkZ) {
        const terrainGroup = new THREE.Group();
        const groundGeometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, 1, 1);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x404040,
            roughness: 0.8,
            side: THREE.DoubleSide
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        ground.frustumCulled = false;
        terrainGroup.add(ground);
        this.addSkirts(terrainGroup, chunkX, chunkZ, 0x404040, 1, 1);
        // Simple grid roads
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x2f2f2f, roughness: 0.85 });
        const roadW = 8;
        for (let i = -2; i <= 2; i++) {
            const roadX = new THREE.Mesh(new THREE.PlaneGeometry(this.chunkSize, roadW), roadMat);
            roadX.rotation.x = -Math.PI / 2; roadX.position.z = i * 50; roadX.position.y = 0.02;
            terrainGroup.add(roadX);
            const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(roadW, this.chunkSize), roadMat);
            roadZ.rotation.x = -Math.PI / 2; roadZ.position.x = i * 50; roadZ.position.y = 0.02;
            terrainGroup.add(roadZ);
        }
        // Buildings
        for (let i = 0; i < 4; i++) {
            const building = this.createBuilding();
            building.position.x = (Math.random() - 0.5) * this.chunkSize * 0.8;
            building.position.z = (Math.random() - 0.5) * this.chunkSize * 0.8;
            terrainGroup.add(building);
        }
        return terrainGroup;
    }

    generateDesertChunk(chunkX, chunkZ) {
        const terrainGroup = new THREE.Group();
        const geometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, 64, 64);
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const lx = vertices[i];
            const ly = vertices[i + 1];
            const wx = lx + chunkX * this.chunkSize;
            const wz = ly + chunkZ * this.chunkSize;
            vertices[i + 2] = this.sampleHeight(wx, wz);
        }
        this.computeNormalsFromHeight(geometry, chunkX, chunkZ);
        const material = new THREE.MeshStandardMaterial({ color: 0xEDC9AF, roughness: 0.97, side: THREE.DoubleSide });
        const terrain = new THREE.Mesh(geometry, material);
        terrain.rotation.x = -Math.PI / 2;
        terrain.receiveShadow = true;
        terrain.frustumCulled = false;
        terrainGroup.add(terrain);
        this.addSkirts(terrainGroup, chunkX, chunkZ, 0xEDC9AF, geometry.parameters.widthSegments, geometry.parameters.heightSegments);
        // Add cacti and rocks
        for (let i = 0; i < 6; i++) {
            const c = this.createCactus();
            c.position.x = (Math.random() - 0.5) * this.chunkSize;
            c.position.z = (Math.random() - 0.5) * this.chunkSize;
            const wx = c.position.x + chunkX * this.chunkSize;
            const wz = c.position.z + chunkZ * this.chunkSize;
            c.position.y = this.sampleHeight(wx, wz);
            terrainGroup.add(c);
        }
        for (let i = 0; i < 4; i++) {
            const r = this.createRock(0xC2B280);
            r.position.x = (Math.random() - 0.5) * this.chunkSize;
            r.position.z = (Math.random() - 0.5) * this.chunkSize;
            const wx = r.position.x + chunkX * this.chunkSize;
            const wz = r.position.z + chunkZ * this.chunkSize;
            r.position.y = this.sampleHeight(wx, wz);
            terrainGroup.add(r);
        }
        return terrainGroup;
    }

    createTree() {
        const tree = new THREE.Group();
        const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 4, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 2;
        trunk.castShadow = true;
        tree.add(trunk);
        const foliageGeometry = new THREE.ConeGeometry(2, 4, 8);
        const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.y = 5;
        foliage.castShadow = true;
        tree.add(foliage);
        return tree;
    }

    createShrub() {
        const shrub = new THREE.Group();
        const geo = new THREE.SphereGeometry(1.2, 8, 8);
        const mat = new THREE.MeshStandardMaterial({ color: 0x7fae4d, roughness: 0.9 });
        const m = new THREE.Mesh(geo, mat);
        m.position.y = 1.2;
        shrub.add(m);
        return shrub;
    }

    createBuilding() {
        const building = new THREE.Group();
        const height = 10 + Math.random() * 90;
        const width = 10 + Math.random() * 10;
        const depth = 10 + Math.random() * 10;
        const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
        const buildingMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0, 0, 0.3 + Math.random() * 0.3),
            roughness: 0.7
        });
        const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
        buildingMesh.position.y = height / 2;
        buildingMesh.castShadow = true;
        buildingMesh.receiveShadow = true;
        building.add(buildingMesh);
        return building;
    }

    createRock(color = 0x8a7f77) {
        const geo = new THREE.IcosahedronGeometry(2 + Math.random() * 3, 0);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
        const rock = new THREE.Mesh(geo, mat);
        rock.position.y = 1.5;
        rock.castShadow = true;
        return rock;
    }

    createCactus() {
        const cactus = new THREE.Group();
        const main = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 6, 8), new THREE.MeshStandardMaterial({ color: 0x2E8B57, roughness: 0.9 }));
        main.position.y = 3;
        cactus.add(main);
        // arms
        const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 3, 8), main.material);
        arm1.position.set(0.9, 3.5, 0);
        arm1.rotation.z = Math.PI / 3;
        cactus.add(arm1);
        const arm2 = arm1.clone();
        arm2.position.x = -0.9; arm2.rotation.z = -Math.PI / 3;
        cactus.add(arm2);
        return cactus;
    }

    addSkirts(terrainGroup, chunkX, chunkZ, color, segX, segY) {
        const depth = 40; // how far to extrude downward
        const mats = new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide });
        const half = this.chunkSize / 2;
        const stepX = this.chunkSize / segX;
        const stepY = this.chunkSize / segY;

        const buildSide = (pointsTop) => {
            const count = pointsTop.length;
            const positions = new Float32Array(count * 2 * 3); // top + bottom
            for (let i = 0; i < count; i++) {
                const { lx, ly, h } = pointsTop[i];
                // top vertex
                positions[i * 3 + 0] = lx;
                positions[i * 3 + 1] = ly;
                positions[i * 3 + 2] = h;
                // bottom vertex
                const bi = count + i;
                positions[bi * 3 + 0] = lx;
                positions[bi * 3 + 1] = ly;
                positions[bi * 3 + 2] = h - depth;
            }
            const indices = [];
            for (let i = 0; i < count - 1; i++) {
                const a = i;
                const b = i + 1;
                const c = count + i;
                const d = count + i + 1;
                // two triangles: a,c,b and b,c,d
                indices.push(a, c, b, b, c, d);
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geo.setIndex(indices);
            geo.computeVertexNormals();
            const mesh = new THREE.Mesh(geo, mats);
            mesh.rotation.x = -Math.PI / 2; // align axis with terrain
            mesh.frustumCulled = false;
            terrainGroup.add(mesh);
        };

        // Collect edge samples in local plane coordinates
        const left = [];
        for (let j = 0; j <= segY; j++) {
            const lx = -half;
            const ly = -half + j * stepY;
            const wx = lx + chunkX * this.chunkSize;
            const wz = ly + chunkZ * this.chunkSize;
            left.push({ lx, ly, h: this.sampleHeight(wx, wz) });
        }
        buildSide(left);

        const right = [];
        for (let j = 0; j <= segY; j++) {
            const lx = half;
            const ly = -half + j * stepY;
            const wx = lx + chunkX * this.chunkSize;
            const wz = ly + chunkZ * this.chunkSize;
            right.push({ lx, ly, h: this.sampleHeight(wx, wz) });
        }
        buildSide(right);

        const near = [];
        for (let i = 0; i <= segX; i++) {
            const lx = -half + i * stepX;
            const ly = -half;
            const wx = lx + chunkX * this.chunkSize;
            const wz = ly + chunkZ * this.chunkSize;
            near.push({ lx, ly, h: this.sampleHeight(wx, wz) });
        }
        buildSide(near);

        const far = [];
        for (let i = 0; i <= segX; i++) {
            const lx = -half + i * stepX;
            const ly = half;
            const wx = lx + chunkX * this.chunkSize;
            const wz = ly + chunkZ * this.chunkSize;
            far.push({ lx, ly, h: this.sampleHeight(wx, wz) });
        }
        buildSide(far);

        // Bottom cap to avoid hollow underside
        const edgeBottoms = [];
        const collectBottoms = (arr) => {
            for (const p of arr) edgeBottoms.push(p.h - depth);
        };
        collectBottoms(left); collectBottoms(right); collectBottoms(near); collectBottoms(far);
        const minBottom = Math.min.apply(null, edgeBottoms) - 0.5;
        const capGeo = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, 1, 1);
        const capMat = mats;
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.rotation.x = -Math.PI / 2;
        cap.position.y = minBottom;
        cap.frustumCulled = false;
        terrainGroup.add(cap);
    }

    getTerrainHeight(x, z) {
        const uavChunkX = Math.floor(x / this.chunkSize);
        const uavChunkZ = Math.floor(z / this.chunkSize);
        const chunkId = `${uavChunkX},${uavChunkZ}`;
        const chunk = this.chunks[chunkId];

        if (!chunk) return 0;

        const raycaster = new THREE.Raycaster(
            new THREE.Vector3(x, 1000, z),
            new THREE.Vector3(0, -1, 0)
        );
        const intersects = raycaster.intersectObjects(chunk.children, true);
        if (intersects.length > 0) {
            return intersects[0].point.y;
        }
        return 0;
    }
}
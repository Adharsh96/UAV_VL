// Design Lab UI Handler
class DesignLabUI {
    constructor(calculator) {
        this.calculator = calculator;
        this.loadConfig(); // Load saved config on init
        this.initializeEventListeners();
        this.updateUI();
    }

    saveConfig() {
        localStorage.setItem('uav-lab-config', JSON.stringify(this.calculator.config));
        // Also save environment
        localStorage.setItem('uav-lab-env', JSON.stringify(this.getEnvironmentConfig()));
    }

    loadConfig() {
        const saved = localStorage.getItem('uav-lab-config');
        if (saved) {
            try {
                const config = JSON.parse(saved);
                // Deep merge or assign
                Object.assign(this.calculator.config, config);
                // We need to sync the UI Selects/Inputs with this loaded config
                this.syncUItoConfig();
            } catch (e) { console.error("Error loading config", e); }
        }
    }

    syncUItoConfig() {
        const setUI = (selectId, inputId, value) => {
            const select = document.getElementById(selectId);
            const input = document.getElementById(inputId);
            let match = false;
            for (let opt of select.options) {
                if (opt.value == value) {
                    select.value = value;
                    match = true;
                    input.classList.add('hidden');
                    break;
                }
            }
            if (!match) {
                select.value = 'custom';
                input.value = value;
                input.classList.remove('hidden');
            }
        };

        const c = this.calculator.config;
        setUI('frame-size-select', 'frame-size-custom', c.frame.size);
        setUI('prop-size-select', 'prop-size-custom', c.propellers.size);
        setUI('prop-pitch-select', 'prop-pitch-custom', c.propellers.pitch);
        setUI('motor-kv-select', 'motor-kv-custom', c.motors.kv);
        setUI('battery-cells-select', 'battery-cells-custom', c.battery.cells);
        setUI('battery-capacity-select', 'battery-capacity-custom', c.battery.capacity);

        // Standard selects
        document.getElementById('frame-type').value = c.frame.type;
        document.getElementById('frame-material').value = c.frame.material;
        document.getElementById('prop-blades').value = c.propellers.blades;
        document.getElementById('prop-material').value = c.propellers.material;
        document.getElementById('battery-c-rating').value = c.battery.cRating;
        document.getElementById('fc-type').value = c.flightController.type;
        document.getElementById('payload-type').value = c.payload.type;
    }

    initializeEventListeners() {
        // Safe listener helper
        const addListenerSafe = (id, event, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, handler);
            else console.warn(`Element ${id} missing for event ${event}`);
        };

        // Category toggles
        document.querySelectorAll('.category-header').forEach(header => {
            header.addEventListener('click', () => this.toggleCategory(header));
        });

        // Helper to handle custom inputs
        const setupCustomInput = (selectId, inputId, configPath, parseFunc = parseInt) => {
            const select = document.getElementById(selectId);
            const input = document.getElementById(inputId);

            if (!select || !input) {
                // Warn but don't crash loop
                console.warn(`Missing element: ${selectId} or ${inputId}`);
                return;
            }

            select.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    input.classList.remove('hidden');
                    // Trigger update with input value (if valid number)
                    const val = parseFunc(input.value);
                    if (!isNaN(val)) this.calculator.updateConfig(configPath[0], configPath[1], val);
                } else {
                    input.classList.add('hidden');
                    this.calculator.updateConfig(configPath[0], configPath[1], parseFunc(e.target.value));
                }
                this.updateUI();
            });

            input.addEventListener('input', (e) => {
                if (select.value === 'custom') {
                    const val = parseFunc(e.target.value);
                    if (!isNaN(val)) {
                        this.calculator.updateConfig(configPath[0], configPath[1], val);
                        this.updateUI();
                    }
                }
            });
        };

        // Frame Size
        setupCustomInput('frame-size-select', 'frame-size-custom', ['frame', 'size']);

        // Prop Size
        setupCustomInput('prop-size-select', 'prop-size-custom', ['propellers', 'size'], parseFloat);

        // Prop Pitch
        setupCustomInput('prop-pitch-select', 'prop-pitch-custom', ['propellers', 'pitch'], parseFloat);

        // Motor KV
        setupCustomInput('motor-kv-select', 'motor-kv-custom', ['motors', 'kv']);

        // Battery Cells
        setupCustomInput('battery-cells-select', 'battery-cells-custom', ['battery', 'cells']);

        // Battery Capacity
        setupCustomInput('battery-capacity-select', 'battery-capacity-custom', ['battery', 'capacity']);

        // Frame options (Type/Material)
        addListenerSafe('frame-type', 'change', (e) => {
            this.calculator.updateConfig('frame', 'type', e.target.value);
            this.updateUI();
        });
        addListenerSafe('frame-material', 'change', (e) => {
            this.calculator.updateConfig('frame', 'material', e.target.value);
            this.updateUI();
        });

        // Propeller options (Blades/Material)
        addListenerSafe('prop-blades', 'change', (e) => {
            this.calculator.updateConfig('propellers', 'blades', parseInt(e.target.value));
            this.updateUI();
        });
        addListenerSafe('prop-material', 'change', (e) => {
            this.calculator.updateConfig('propellers', 'material', e.target.value);
            this.updateUI();
        });

        // Battery C-Rating
        addListenerSafe('battery-c-rating', 'change', (e) => {
            this.calculator.updateConfig('battery', 'cRating', parseInt(e.target.value));
            this.updateUI();
        });

        // Optimize Button
        addListenerSafe('optimize-btn', 'click', () => {
            this.optimizeDesign();
        });

        // Flight controller options
        addListenerSafe('fc-type', 'change', (e) => {
            this.calculator.updateConfig('flightController', 'type', e.target.value);
            this.updateUI();
        });

        // Payload options
        addListenerSafe('payload-type', 'change', (e) => {
            this.calculator.updateConfig('payload', 'type', e.target.value);
            this.updateUI();
        });

        // Environment settings
        addListenerSafe('wind-speed', 'input', (e) => {
            document.getElementById('wind-speed-value').textContent = e.target.value;
            this.updateWindIndicator(parseFloat(e.target.value));
        });
        addListenerSafe('wind-direction', 'input', (e) => {
            document.getElementById('wind-direction-value').textContent = e.target.value;
        });
        addListenerSafe('visibility', 'input', (e) => {
            document.getElementById('visibility-value').textContent = e.target.value;
        });
        addListenerSafe('temperature', 'input', (e) => {
            document.getElementById('temperature-value').textContent = e.target.value;
        });

        // Terrain selection
        document.querySelectorAll('.terrain-option').forEach(option => {
            option.addEventListener('click', () => this.selectTerrain(option));
        });

        // Launch button
        // Global fallback for launch button (Force override)
        document.body.addEventListener('click', (e) => {
            const btn = e.target.closest('#launch-simulator');
            if (btn) {
                console.log("Global Launch Listener Triggered");
                if (document.getElementById('design-lab').classList.contains('active')) {
                    this.launchSimulator();
                }
            }
        });
        const launchBtn = document.getElementById('launch-simulator');
        if (launchBtn) {
            launchBtn.addEventListener('click', () => {
                this.launchSimulator();
            });
        } else {
            console.error("Launch button not found!");
        }
    }

    toggleCategory(header) {
        const content = header.nextElementSibling;
        header.classList.toggle('collapsed');
        content.classList.toggle('collapsed');
    }

    updateWindIndicator(speed) {
        const indicator = document.getElementById('wind-indicator');
        if (speed < 2) {
            indicator.textContent = 'Calm';
            indicator.style.background = 'rgba(76, 175, 80, 0.2)';
        } else if (speed < 8) {
            indicator.textContent = 'Light Breeze';
            indicator.style.background = 'rgba(33, 150, 243, 0.2)';
        } else if (speed < 15) {
            indicator.textContent = 'Moderate Wind';
            indicator.style.background = 'rgba(255, 193, 7, 0.2)';
        } else if (speed < 25) {
            indicator.textContent = 'Strong Wind';
            indicator.style.background = 'rgba(255, 152, 0, 0.2)';
        } else {
            indicator.textContent = 'Storm';
            indicator.style.background = 'rgba(244, 67, 54, 0.2)';
        }
    }

    selectTerrain(option) {
        document.querySelectorAll('.terrain-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        option.classList.add('selected');
    }

    updateUI() {
        const specs = this.calculator.specs;

        // Update specifications
        document.getElementById('total-mass').textContent = `${specs.totalMass.toFixed(0)} g`;
        document.getElementById('total-thrust').textContent = `${specs.totalThrust.toFixed(0)} g`;

        // Update TWR with color coding
        const twrElement = document.getElementById('twr');
        twrElement.textContent = specs.twr.toFixed(2);
        const twrParent = twrElement.parentElement;
        twrParent.classList.remove('highlight');

        if (specs.twr < 1.5) {
            twrElement.style.color = '#F44336';
        } else if (specs.twr < 2.5) {
            twrElement.style.color = '#FFC107';
        } else {
            twrElement.style.color = '#4CAF50';
            twrParent.classList.add('highlight');
        }

        document.getElementById('flight-time').textContent = `${specs.flightTime.toFixed(1)} min`;
        document.getElementById('max-speed').textContent = `${specs.maxSpeed.toFixed(1)} m/s`;
        document.getElementById('power').textContent =
            `${specs.power.hover.toFixed(0)}W / ${specs.power.max.toFixed(0)}W`;

        // Update recommendations
        const recommendations = this.calculator.getRecommendations();
        const tipsContainer = document.getElementById('design-tips');
        tipsContainer.innerHTML = '';

        recommendations.forEach(rec => {
            const tipDiv = document.createElement('div');
            tipDiv.className = 'tip';
            tipDiv.textContent = rec.message;
            tipsContainer.appendChild(tipDiv);
        });

        // Update launch button - always enabled (let physics handle poor designs)
        const launchButton = document.getElementById('launch-simulator');
        launchButton.disabled = false;

        if (window.previewRenderer) {
            window.previewRenderer.updateUAV(this.calculator.config);
        }

        this.saveConfig(); // Auto-save on every update
    }

    launchSimulator() {
        console.log("Launching Simulator...");
        // Hide design lab, show simulator
        const designLab = document.getElementById('design-lab');
        const simulator = document.getElementById('simulator');

        if (designLab && simulator) {
            designLab.classList.remove('active');
            simulator.classList.add('active');
            console.log("Switched to Simulator View");
        } else {
            console.error("Design Lab or Simulator element not found!");
            return;
        }

        // Initialize simulator with current configuration
        if (window.uavSimulator) {
            console.log("Initializing UAV Simulator...");
            window.uavSimulator.initialize(this.calculator.config, this.getEnvironmentConfig());
        } else {
            console.error("uavSimulator window object not found!");
        }
    }

    optimizeDesign() {
        const optimized = this.calculator.optimize();

        // Helper to update UI to custom mode
        const setCustom = (selectId, inputId, value) => {
            const select = document.getElementById(selectId);
            const input = document.getElementById(inputId);

            if (!select || !input) return;

            let match = false;
            for (let opt of select.options) {
                if (opt.value == value) {
                    select.value = value;
                    match = true;
                    input.classList.add('hidden');
                    break;
                }
            }

            if (!match) {
                select.value = 'custom';
                input.value = value;
                input.classList.remove('hidden');
            }
        };

        if (optimized.propellers) setCustom('prop-size-select', 'prop-size-custom', optimized.propellers.size);
        if (optimized.motors) setCustom('motor-kv-select', 'motor-kv-custom', optimized.motors.kv);
        if (optimized.battery) {
            setCustom('battery-cells-select', 'battery-cells-custom', optimized.battery.cells);
            setCustom('battery-capacity-select', 'battery-capacity-custom', optimized.battery.capacity);
        }

        this.updateUI();

        // Visual feedback
        const btn = document.getElementById('optimize-btn');
        if (btn) {
            const origText = btn.textContent;
            btn.textContent = "✅ Optimized!";
            setTimeout(() => btn.textContent = origText, 2000);
        }
    }

    getEnvironmentConfig() {
        return {
            windSpeed: parseFloat(document.getElementById('wind-speed').value),
            windDirection: parseFloat(document.getElementById('wind-direction').value),
            visibility: parseFloat(document.getElementById('visibility').value),
            temperature: parseFloat(document.getElementById('temperature').value),
            terrain: document.querySelector('.terrain-option.selected').dataset.terrain
        };
    }
}

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
            } catch (e) { console.error("Error loading config", e); }
        }
    }

    initializeEventListeners() {
        // Category toggles
        document.querySelectorAll('.category-header').forEach(header => {
            header.addEventListener('click', () => this.toggleCategory(header));
        });

        // Frame options
        document.getElementById('frame-type').addEventListener('change', (e) => {
            this.calculator.updateConfig('frame', 'type', e.target.value);
            this.updateUI();
        });
        document.getElementById('frame-material').addEventListener('change', (e) => {
            this.calculator.updateConfig('frame', 'material', e.target.value);
            this.updateUI();
        });
        document.getElementById('frame-size').addEventListener('change', (e) => {
            this.calculator.updateConfig('frame', 'size', parseInt(e.target.value));
            this.updateUI();
        });

        // Propeller options
        document.getElementById('prop-size').addEventListener('change', (e) => {
            this.calculator.updateConfig('propellers', 'size', parseFloat(e.target.value));
            this.updateUI();
        });
        document.getElementById('prop-pitch').addEventListener('change', (e) => {
            this.calculator.updateConfig('propellers', 'pitch', parseFloat(e.target.value));
            this.updateUI();
        });
        document.getElementById('prop-blades').addEventListener('change', (e) => {
            this.calculator.updateConfig('propellers', 'blades', parseInt(e.target.value));
            this.updateUI();
        });
        document.getElementById('prop-material').addEventListener('change', (e) => {
            this.calculator.updateConfig('propellers', 'material', e.target.value);
            this.updateUI();
        });

        // Motor options
        document.getElementById('motor-kv').addEventListener('change', (e) => {
            this.calculator.updateConfig('motors', 'kv', parseInt(e.target.value));
            this.updateUI();
        });

        // Battery options
        document.getElementById('battery-cells').addEventListener('change', (e) => {
            this.calculator.updateConfig('battery', 'cells', parseInt(e.target.value));
            this.updateUI();
        });
        document.getElementById('battery-capacity').addEventListener('change', (e) => {
            this.calculator.updateConfig('battery', 'capacity', parseInt(e.target.value));
            this.updateUI();
        });
        document.getElementById('battery-c-rating').addEventListener('change', (e) => {
            this.calculator.updateConfig('battery', 'cRating', parseInt(e.target.value));
            this.updateUI();
        });

        // Flight controller options
        document.getElementById('fc-type').addEventListener('change', (e) => {
            this.calculator.updateConfig('flightController', 'type', e.target.value);
            this.updateUI();
        });

        // Payload options
        document.getElementById('payload-type').addEventListener('change', (e) => {
            this.calculator.updateConfig('payload', 'type', e.target.value);
            this.updateUI();
        });

        // Environment settings
        document.getElementById('wind-speed').addEventListener('input', (e) => {
            document.getElementById('wind-speed-value').textContent = e.target.value;
            this.updateWindIndicator(parseFloat(e.target.value));
        });
        document.getElementById('wind-direction').addEventListener('input', (e) => {
            document.getElementById('wind-direction-value').textContent = e.target.value;
        });
        document.getElementById('visibility').addEventListener('input', (e) => {
            document.getElementById('visibility-value').textContent = e.target.value;
        });
        document.getElementById('temperature').addEventListener('input', (e) => {
            document.getElementById('temperature-value').textContent = e.target.value;
        });

        // Terrain selection
        document.querySelectorAll('.terrain-option').forEach(option => {
            option.addEventListener('click', () => this.selectTerrain(option));
        });

        // Launch button
        document.getElementById('launch-simulator').addEventListener('click', () => {
            this.launchSimulator();
        });
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
        // Hide design lab, show simulator
        document.getElementById('design-lab').classList.remove('active');
        document.getElementById('simulator').classList.add('active');

        // Initialize simulator with current configuration
        if (window.uavSimulator) {
            window.uavSimulator.initialize(this.calculator.config, this.getEnvironmentConfig());
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

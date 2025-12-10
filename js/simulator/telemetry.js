// Telemetry Display and Flight Data Graphs
class TelemetryDisplay {
    constructor() {
        this.chart = null;
        this.chartData = {
            labels: [],
            datasets: []
        };
        this.maxDataPoints = 300; // 30 seconds at 10Hz
        this.isPaused = false;
        
        this.initializeChart();
        this.setupControls();
    }

    initializeChart() {
        const ctx = document.getElementById('flight-graph').getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Throttle (%)',
                        data: [],
                        borderColor: '#00FF00',
                        backgroundColor: 'rgba(0, 255, 0, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.4
                    },
                    {
                        label: 'Altitude (m)',
                        data: [],
                        borderColor: '#00FFFF',
                        backgroundColor: 'rgba(0, 255, 255, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.4
                    },
                    {
                        label: 'Battery (%)',
                        data: [],
                        borderColor: '#FFFF00',
                        backgroundColor: 'rgba(255, 255, 0, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.4
                    },
                    {
                        label: 'Speed (m/s)',
                        data: [],
                        borderColor: '#FF00FF',
                        backgroundColor: 'rgba(255, 0, 255, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.2)'
                        },
                        ticks: {
                            color: '#E0E0E0'
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 12,
                        right: 8,
                        bottom: 8,
                        left: 8
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            color: '#E0E0E0',
                            font: {
                                size: 10
                            },
                            usePointStyle: true,
                            boxWidth: 6
                        }
                    }
                }
            }
        });
    }

    setupControls() {
        document.getElementById('pause-graph').addEventListener('click', () => {
            this.isPaused = !this.isPaused;
            const button = document.getElementById('pause-graph');
            button.textContent = this.isPaused ? '▶' : '⏸';
        });

        document.getElementById('clear-graph').addEventListener('click', () => {
            this.clearData();
        });

        window.addEventListener('resize', () => {
            setTimeout(() => {
                if (this.chart) {
                    this.chart.resize();
                }
            }, 100);
        });
    }

    update(physicsState, controls) {
        // Update telemetry displays
        this.updateTelemetryValues(physicsState, controls);
        
        // Update graphs
        if (!this.isPaused) {
            this.updateGraph(physicsState, controls);
        }
        
        // Update HUD horizon overlay
        this.updateHUD(physicsState);
    }

    updateTelemetryValues(state, controls) {
        // Position and velocity
        document.getElementById('telem-altitude').textContent = `${state.position.y.toFixed(1)} m`;
        
        const verticalSpeed = state.velocity.y;
        const vspeedElement = document.getElementById('telem-vspeed');
        vspeedElement.textContent = `${verticalSpeed >= 0 ? '↑' : '↓'}${Math.abs(verticalSpeed).toFixed(1)} m/s`;
        
        const horizontalSpeed = Math.sqrt(state.velocity.x ** 2 + state.velocity.z ** 2);
        document.getElementById('telem-speed').textContent = `${horizontalSpeed.toFixed(1)} m/s`;
        
        // Heading
        const euler = new THREE.Euler().setFromQuaternion(state.rotation);
        const heading = ((euler.y * 180 / Math.PI) + 360) % 360;
        document.getElementById('telem-heading').textContent = `${heading.toFixed(0)}°`;
        
        // Distance from home
        const distance = Math.sqrt(state.position.x ** 2 + state.position.z ** 2);
        document.getElementById('telem-distance').textContent = `${distance.toFixed(1)} m`;
        
        // Armed status
        const armedElement = document.getElementById('armed-status');
        if (state.isArmed) {
            armedElement.textContent = 'ARMED';
            armedElement.classList.add('armed');
        } else {
            armedElement.textContent = 'DISARMED';
            armedElement.classList.remove('armed');
        }
        
        // Battery
        document.getElementById('telem-battery').textContent = `${state.batteryPercentage.toFixed(0)}%`;
        document.getElementById('telem-voltage').textContent = `${state.batteryVoltage.toFixed(1)}V`;
        document.getElementById('telem-current').textContent = `${state.currentDraw.toFixed(1)}A`;
        
        // Battery bar
        const batteryFill = document.getElementById('battery-fill');
        batteryFill.style.width = `${state.batteryPercentage}%`;
        batteryFill.classList.remove('warning', 'critical');
        if (state.batteryPercentage < 30) {
            batteryFill.classList.add('warning');
        }
        if (state.batteryPercentage < 10) {
            batteryFill.classList.add('critical');
        }
        
        // Orientation
        const pitch = euler.z * 180 / Math.PI;
        const roll = euler.x * 180 / Math.PI;
        const yaw = euler.y * 180 / Math.PI;
        
        document.getElementById('telem-pitch').textContent = `${pitch.toFixed(1)}°`;
        document.getElementById('telem-roll').textContent = `${roll.toFixed(1)}°`;
        document.getElementById('telem-yaw').textContent = `${yaw.toFixed(1)}°`;
    }

    updateGraph(state, controls) {
        const time = state.timestamp.toFixed(1);
        
        // Add new data point
        this.chart.data.labels.push(time);
        this.chart.data.datasets[0].data.push(controls.throttle * 100);
        this.chart.data.datasets[1].data.push(state.position.y);
        this.chart.data.datasets[2].data.push(state.batteryPercentage);
        
        const horizontalSpeed = Math.sqrt(state.velocity.x ** 2 + state.velocity.z ** 2);
        this.chart.data.datasets[3].data.push(horizontalSpeed);
        
        // Remove old data points
        if (this.chart.data.labels.length > this.maxDataPoints) {
            this.chart.data.labels.shift();
            this.chart.data.datasets.forEach(dataset => {
                dataset.data.shift();
            });
        }
        
        this.chart.update('none'); // Update without animation
    }

    updateHUD(state) {
        const euler = new THREE.Euler().setFromQuaternion(state.rotation);
        const pitchDeg = euler.z * 180 / Math.PI;
        const rollDeg = euler.x * 180 / Math.PI;

        const mover = document.getElementById('hud-horizon-mover');
        const rollPointer = document.getElementById('hud-roll-pointer');

        if (mover) {
            const pitchOffset = pitchDeg * 2; // px per degree
            // rotate by roll and translate vertically by pitch
            mover.style.transform = `translate(-50%, -50%) rotate(${rollDeg}deg) translateY(${pitchOffset}px)`;
        }
        if (rollPointer) {
            // rotate the pointer to current roll around its base
            rollPointer.style.transform = 'translateX(-50%) rotate(' + rollDeg + 'deg)';
        }
    }

    clearData() {
        this.chart.data.labels = [];
        this.chart.data.datasets.forEach(dataset => {
            dataset.data = [];
        });
        this.chart.update();
    }

    reset() {
        this.clearData();
        this.isPaused = false;
        document.getElementById('pause-graph').textContent = '⏸';
    }
}

// Mission Manager - Handles mission objectives and state
class MissionManager {
    constructor(telemetryDisplay) {
        this.telemetryDisplay = telemetryDisplay;
        this.missions = [
            {
                id: 'hover_test',
                name: 'Hover Check',
                description: 'Maintain 5m altitude for 5 seconds',
                check: (state) => Math.abs(state.position.y - 5) < 1.0,
                duration: 5,
                progress: 0,
                completed: false
            },
            {
                id: 'speed_test',
                name: 'Speed Run',
                description: 'Reach 10 m/s ground speed',
                check: (state) => state.velocity.length() > 10,
                duration: 1, // Instant
                progress: 0,
                completed: false
            },
            {
                id: 'endurance',
                name: 'Endurance',
                description: 'Fly for 30 seconds without crashing',
                check: (state) => state.position.y > 0.5,
                duration: 30,
                progress: 0,
                completed: false
            }
        ];
        this.currentMissionIndex = 0;
        this.lastCheckTime = 0;
    }

    update(state, dt) {
        if (this.currentMissionIndex >= this.missions.length) return;

        const mission = this.missions[this.currentMissionIndex];

        if (mission.check(state)) {
            mission.progress += dt;
        } else {
            mission.progress = Math.max(0, mission.progress - dt * 0.5); // Decay progress if condition lost
        }

        if (mission.progress >= mission.duration) {
            this.completeMission(mission);
        }

        this.updateDisplay(mission);
    }

    completeMission(mission) {
        mission.completed = true;
        this.currentMissionIndex++;
        console.log(`Mission Complete: ${mission.name}`);
        // Visual feedback
        const el = document.querySelector('.sim-title');
        if (el) {
            const original = el.textContent;
            el.textContent = `MISSION COMPLETE: ${mission.name}`;
            el.style.color = '#4CAF50';
            setTimeout(() => {
                el.textContent = original;
                el.style.color = '';
            }, 3000);
        }
    }

    updateDisplay(mission) {
        // Find a place to show mission status. We'll use the Telemetry Header or create a small overlay in the existing telemetry panel
        const container = document.querySelector('.telemetry-header');
        if (container) {
            const percent = Math.min(100, (mission.progress / mission.duration) * 100).toFixed(0);
            container.innerHTML = `MISSION: ${mission.name}<br><span style="font-size:0.7em">${mission.description} (${percent}%)</span>`;
        }
    }

    reset() {
        this.currentMissionIndex = 0;
        this.missions.forEach(m => {
            m.progress = 0;
            m.completed = false;
        });
        const container = document.querySelector('.telemetry-header');
        if (container) container.innerHTML = 'TELEMETRY';
    }
}

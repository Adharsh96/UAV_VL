// Flight Recorder - Records telemetry data to CSV
class FlightRecorder {
    constructor() {
        this.isRecording = false;
        this.data = [];
        this.startTime = 0;
    }

    start() {
        this.isRecording = true;
        this.data = [];
        this.startTime = Date.now();
        console.log('Flight Recorder: STARTED');
        this.showNotification('Flight Recording Started');
    }

    stop() {
        if (!this.isRecording) return;
        this.isRecording = false;
        console.log('Flight Recorder: STOPPED');
        this.downloadCSV();
        this.showNotification('Flight Recording Saved');
    }

    toggle() {
        if (this.isRecording) this.stop();
        else this.start();
    }

    record(state, controls) {
        if (!this.isRecording) return;

        const time = (Date.now() - this.startTime) / 1000;
        this.data.push({
            time: time.toFixed(3),
            altitude: state.position.y.toFixed(2),
            speed: state.velocity.length().toFixed(2),
            battery: state.batteryPercentage.toFixed(1),
            throttle: controls.throttle.toFixed(2),
            pitch: controls.pitch.toFixed(2),
            roll: controls.roll.toFixed(2),
            yaw: controls.yaw.toFixed(2)
        });
    }

    downloadCSV() {
        if (this.data.length === 0) return;

        const headers = Object.keys(this.data[0]).join(',');
        const rows = this.data.map(row => Object.values(row).join(','));
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `flight_log_${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    showNotification(msg) {
        // Minimal UI feedback reusing existing elements or console
        const indicator = document.getElementById('wind-indicator'); // Reuse a bubble if visible, or just console
        if(indicator) {
            const oldText = indicator.textContent;
            indicator.textContent = msg;
            setTimeout(() => indicator.textContent = oldText, 2000);
        }
    }
}

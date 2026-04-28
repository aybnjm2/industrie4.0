require('dotenv').config();
const mqtt = require('mqtt');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const cors = require('cors');

// --- Configuration (Environment Variables with Fallbacks) ---
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://broker.emqx.io';
const MQTT_TOPIC = process.env.MQTT_TOPIC || 'factory/telemetry';
const INFLUX_URL = process.env.INFLUX_URL || 'http://127.0.0.1:8086';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || 'd0UmnmR3FWNLgA6jMcbEpzaKHv3or0b9_DgBskyOgALQN-qU8vrezYpQjeUICc9zptQkng03_eS1ryvcwvN11A==';
const INFLUX_ORG = process.env.INFLUX_ORG || 'factory';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'telemetry';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/digital_twin';

// --- Setup Infrastructure ---
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const mqttClient = mqtt.connect(MQTT_BROKER);
const influxDB = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
const writeApi = influxDB.getWriteApi(INFLUX_ORG, INFLUX_BUCKET, 'ns', {
    flushInterval: 5000, // Flush every 5 seconds instead of 60s
    batchSize: 1,        // For testing, send every point immediately
});


// --- Metadata Database (MongoDB) Setup & Cache ---
mongoose.connect(MONGO_URI);
const MachineSchema = new mongoose.Schema({
    machine_id: String,
    type: String,
    thresholds: Object
});
const Machine = mongoose.model('Machine', MachineSchema);

// Cache to hold thresholds in memory so we don't query Mongo on every MQTT message
let machineMetadataCache = {};

/**
async function seedAndLoadMetadata() {
    try {
        const exists = await Machine.findOne({ machine_id: 'machine1' });
        if (!exists) {
            await Machine.create({
                machine_id: 'machine1',
                type: 'CNC Milling',
                thresholds: { temp_max: 80, vib_max: 3 }
            });
            console.log("Metadata Seeded into MongoDB.");
        }
        
        // Load all thresholds into memory
        const allMachines = await Machine.find();
        allMachines.forEach(m => {
            machineMetadataCache[m.machine_id] = m.thresholds;
        });
        console.log("Loaded Machine Thresholds Cache:", machineMetadataCache);
    } catch (err) {
        console.error("MongoDB setup error:", err);
    }
}
 */

async function seedAndLoadMetadata() {
    try {
        // --- Seed Machine 01 (Interactive Hardware) ---
        if (!(await Machine.findOne({ machine_id: 'machine-01' }))) {
            await Machine.create({
                machine_id: 'machine-01',
                type: 'Interactive Node',
                thresholds: { temp_max: 80, vib_max: 4.5 }
            });
        }

        // --- Seed Machine 02 (Stable & Healthy) ---
        if (!(await Machine.findOne({ machine_id: 'machine-02' }))) {
            await Machine.create({
                machine_id: 'machine-02',
                type: 'Stable Node',
                thresholds: { temp_max: 55, vib_max: 2.0 } // Tighter thresholds because it should be stable
            });
        }

        // --- Seed Machine 03 (Erratic & Degrading) ---
        if (!(await Machine.findOne({ machine_id: 'machine-03' }))) {
            await Machine.create({
                machine_id: 'machine-03',
                type: 'Degrading Node',
                thresholds: { temp_max: 85, vib_max: 4.0 }
            });
            console.log("Metadata Seeded into MongoDB for all 3 Wokwi machines.");
        }
        
        // Load all thresholds into memory cache
        const allMachines = await Machine.find();
        allMachines.forEach(m => {
            machineMetadataCache[m.machine_id] = m.thresholds;
        });
        console.log("Loaded Machine Thresholds Cache:", machineMetadataCache);
    } catch (err) {
        console.error("MongoDB setup error:", err);
    }
}
seedAndLoadMetadata();

// --- Processing Logic ---
mqttClient.on('connect', () => {
    console.log(`Connected to MQTT Broker at ${MQTT_BROKER}`);
    mqttClient.subscribe(MQTT_TOPIC);
});

mqttClient.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        const { machine_id, temperature, vibration, motor_load } = data;

        // 1. Calculate Health Score
        let rawHealth = 100 - (temperature * 0.4 + vibration * 35 + motor_load * 0.2);
        let health = Math.max(0, Math.min(100, rawHealth)); // Clamp 0-100

        // 2. Anomaly Detection Rules (Using Dynamic Database Thresholds)
        let status = "RUNNING";
        let alert = null;

        // Get limits from cache, or use safe defaults if machine isn't registered
        const limits = machineMetadataCache[machine_id] || { temp_max: 85, vib_max: 5 };

        if (temperature > limits.temp_max || vibration > limits.vib_max) {
            status = "CRITICAL";
            alert = `Critical: Limit exceeded! (Max Temp: ${limits.temp_max}°C, Max Vib: ${limits.vib_max}g)`;
        } else if (health < 60) {
            status = "WARNING";
            alert = "Warning: Degradation detected.";
        }

        const processedData = {
            ...data,
            health: parseFloat(health.toFixed(2)),
            status,
            alert,
            server_time: new Date()
        };

        // 3. Store in InfluxDB
        const point = new Point('sensor_data')
            .tag('machine_id', machine_id)
            .floatField('temperature', temperature)
            .floatField('vibration', vibration)
            .floatField('motor_load', motor_load)
            .floatField('health', health);
        writeApi.writePoint(point);

        // 4. Push to Frontend via WebSocket
        io.emit('telemetry', processedData);
        console.log(`[${status}] ${machine_id} | Health: ${health.toFixed(1)} | T: ${temperature.toFixed(1)}`);

    } catch (err) {
        console.error("Payload error:", err);
    }
});

server.listen(5000, () => {
    console.log('Backend & WebSocket Server running on port 5000');
});
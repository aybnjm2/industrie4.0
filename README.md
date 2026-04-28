# Industrie 4.0 Digital Twin

A real-time industrial IoT platform for monitoring and visualizing machine telemetry data. This project implements a digital twin architecture for factory equipment, collecting sensor data via MQTT and displaying it in a React-based dashboard.

![React](https://img.shields.io/badge/React-19.2-blue)
![Node.js](https://img.shields.io/badge/Node.js-20-green)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)

## What the Project Does

This project provides a complete industrial monitoring solution that:

- Collects real-time telemetry data from machines via MQTT protocol
- Stores time-series data in InfluxDB for historical analysis
- Stores machine metadata in MongoDB
- Streams live data to a React frontend using WebSockets
- Visualizes machine metrics (temperature, vibration, power consumption) in an interactive dashboard

## Architecture

```
┌─────────────┐     MQTT      ┌──────────────┐
│   Wokwi     │──────────────▶│   Mosquitto  │
│  (Arduino)  │               │   Broker    │
└─────────────┘               └──────┬───────┘
                                      │
                                      ▼
                              ┌──────────────┐
                              │    Backend   │
                              │  (Node.js)   │
                              └──────┬───────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
     ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
     │   InfluxDB  │       │   MongoDB    │       │   Frontend   │
     │ (Telemetry) │       │  (Metadata)  │       │   (React)    │
     └──────────────┘       └──────────────┘       └──────────────┘
```

## Key Features

- **Real-time Monitoring**: Live telemetry data streaming via WebSocket
- **Time-series Storage**: Historical data stored in InfluxDB
- **Machine Metadata**: Configurable thresholds and machine types in MongoDB
- **Interactive Dashboard**: React UI with charts and machine status indicators
- **MQTT Integration**: Standard industrial IoT messaging protocol
- **Docker Support**: Full containerized setup with Docker Compose

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Python 3.12+ (for optional backend)

### Option 1: Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# Services will be available at:
# - Frontend: http://localhost:5173
# - Backend API: http://localhost:5000
# - MQTT Broker: localhost:1883
# - InfluxDB: http://localhost:8086
# - MongoDB: localhost:27017
```

### Option 2: Manual Setup

#### Backend

```bash
cd backend
npm install
npm run start
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Create a `.env` file in the backend directory:

```env
MQTT_BROKER=mqtt://broker.emqx.io
MONGO_URI=mongodb://localhost:27017/digital_twin
INFLUX_URL=http://127.0.0.1:8086
INFLUX_TOKEN=your-influx-token
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/machines` | List all registered machines |
| `GET /api/history/:machineId` | Get telemetry history for a machine |
| `POST /api/machines` | Register a new machine |

## Project Structure

```
industrie4.0/
├── backend/           # Node.js Express server
│   ├── server.js     # Main server file
│   └── package.json  # Backend dependencies
├── frontend/          # React application
│   ├── src/
│   │   ├── App.jsx  # Main dashboard component
│   │   └── App.css  # Dashboard styles
│   └── package.json # Frontend dependencies
├── wokwi/            # Arduino firmware
│   └── sketch.ino   # ESP32/Arduino telemetry sender
├── docker-compose.yml
├── mosquitto.conf    # MQTT broker configuration
└── pyproject.toml    # Python project config
```

## Technologies

- **Frontend**: React 19, Recharts, Socket.IO Client, Lucide Icons
- **Backend**: Express, Socket.IO, MQTT.js, Mongoose, InfluxDB Client
- **Databases**: MongoDB (metadata), InfluxDB (time-series)
- **Message Broker**: Eclipse Mosquitto
- **Container**: Docker Compose

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions and support:
- Open an issue on GitHub
- Check the inline code comments for implementation details

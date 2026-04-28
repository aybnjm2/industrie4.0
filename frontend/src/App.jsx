import React, { useState, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Thermometer, Zap, HeartPulse, Factory, AlertTriangle, Server, Settings, RefreshCcw } from 'lucide-react';
import './App.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const socket = io(BACKEND_URL, { transports: ['websocket'] });

function App() {
  const [machines, setMachines] = useState({});
  const [history, setHistory] = useState({});
  const [selectedId, setSelectedId] = useState('machine-01');
  const [isConnected, setIsConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // 1. Fetch History from InfluxDB when selecting a new machine
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/history/${selectedId}`);
        const data = await res.json();
        setHistory(prev => ({ ...prev, [selectedId]: data }));
      } catch (err) {
        console.error("History fetch error:", err);
      }
    };
    fetchHistory();
  }, [selectedId]);

  // 2. Listen for Live Telemetry
  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('telemetry', (data) => {
      const id = data.machine_id;
      setMachines(prev => ({ ...prev, [id]: data }));
      
      setHistory(prev => {
        const mHistory = prev[id] || [];
        const newPoint = { 
            time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }), 
            ...data 
        };
        const updated = [...mHistory, newPoint].slice(-50);
        return { ...prev, [id]: updated };
      });
    });

    return () => {
      socket.off('telemetry');
    };
  }, []);

  const handleUpdateThresholds = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
      temp_max: parseFloat(formData.get('temp_max')),
      vib_max: parseFloat(formData.get('vib_max'))
    };

    try {
      await fetch(`${BACKEND_URL}/api/thresholds/${selectedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setShowSettings(false);
      alert("Thresholds Updated Successfully");
    } catch (err) {
      alert("Failed to update thresholds");
    }
  };

  const selectedMachine = machines[selectedId];
  const selectedHistory = history[selectedId] || [];

  if (!selectedMachine) {
    return <div className="loading-screen"><RefreshCcw className="spin" /> Syncing Industrial Streams...</div>;
  }

  return (
    <div className="app-wrapper">
      <header className="header">
        <h1 className="header-title"><Factory color="var(--color-info)" size={20} /> Line Monitoring HMI</h1>
        <div className="header-actions">
            <button className="config-btn" onClick={() => setShowSettings(!showSettings)}>
                <Settings size={16} /> CONFIG
            </button>
            <div className={`connection-status ${!isConnected ? 'offline' : ''}`}>
                <div className="pulse-dot"></div> {isConnected ? 'ONLINE' : 'OFFLINE'}
            </div>
        </div>
      </header>

      <div className="dashboard-content">
        <aside className="sidebar">
          <div className="sidebar-header"><Server size={14} /> Nodes</div>
          {Object.values(machines).map(m => (
            <div key={m.machine_id} className={`machine-list-item ${selectedId === m.machine_id ? 'active' : ''}`} onClick={() => setSelectedId(m.machine_id)}>
              <div className="machine-list-info">
                <h4>{m.machine_id.toUpperCase()}</h4>
                <p>Health: {m.health.toFixed(1)}%</p>
              </div>
              <div className={`status-indicator ${m.status}`}></div>
            </div>
          ))}
        </aside>

        <main className="main-view">
          {showSettings && (
            <div className="settings-overlay">
                <form className="settings-form" onSubmit={handleUpdateThresholds}>
                    <h3>Configuration: {selectedId}</h3>
                    <div className="form-group">
                        <label>Max Temp Limit (°C)</label>
                        <input name="temp_max" type="number" defaultValue={85} step="1" />
                    </div>
                    <div className="form-group">
                        <label>Max Vibration Limit (g)</label>
                        <input name="vib_max" type="number" defaultValue={4.5} step="0.1" />
                    </div>
                    <div className="form-actions">
                        <button type="button" onClick={() => setShowSettings(false)}>Cancel</button>
                        <button type="submit" className="save-btn">Apply</button>
                    </div>
                </form>
            </div>
          )}

          {selectedMachine.alert && (
            <div className={`alert-banner ${selectedMachine.status}`}>
              <AlertTriangle size={18} /> {selectedMachine.machine_id.toUpperCase()}: {selectedMachine.alert}
            </div>
          )}

          <div className="kpi-row">
            <div className="kpi-card">
                <div className="kpi-label"><Thermometer size={14}/> Temp</div>
                <div className="kpi-val">{selectedMachine.temperature.toFixed(2)}<small>°C</small></div>
            </div>
            <div className="kpi-card">
                <div className="kpi-label"><Activity size={14}/> Vibration</div>
                <div className="kpi-val">{selectedMachine.vibration.toFixed(3)}<small>g</small></div>
            </div>
            <div className="kpi-card">
                <div className="kpi-label"><HeartPulse size={14}/> Health</div>
                <div className="kpi-val" style={{color: selectedMachine.health < 60 ? 'var(--color-critical)' : 'var(--color-success)'}}>
                    {selectedMachine.health.toFixed(1)}<small>%</small>
                </div>
            </div>
            <div className="kpi-card">
                <div className="kpi-label"><Zap size={14}/> Motor Load</div>
                <div className="kpi-val">{selectedMachine.motor_load.toFixed(1)}<small>%</small></div>
            </div>
          </div>

          <div className="charts-grid">
            <div className="chart-container">
              <h3 className="chart-title">Thermal & Load History (15m)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selectedHistory} syncId="scada">
                  <CartesianGrid strokeDasharray="2 2" stroke="#333" vertical={false} />
                  <XAxis dataKey="time" stroke="#555" fontSize={10} tickMargin={10} />
                  <YAxis stroke="#555" fontSize={10} />
                  <Tooltip contentStyle={{backgroundColor: '#1a1a1a', border: '1px solid #333'}} />
                  <Line type="stepAfter" dataKey="temperature" stroke="#2196f3" dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="motor_load" stroke="#ff9800" dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-container">
              <h3 className="chart-title">Mechanical & Health Dynamics</h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selectedHistory} syncId="scada">
                  <CartesianGrid strokeDasharray="2 2" stroke="#333" vertical={false} />
                  <XAxis dataKey="time" stroke="#555" fontSize={10} tickMargin={10} />
                  <YAxis stroke="#555" fontSize={10} />
                  <Tooltip contentStyle={{backgroundColor: '#1a1a1a', border: '1px solid #333'}} />
                  <Line type="stepAfter" dataKey="vibration" stroke="#f44336" dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="health" stroke="#4caf50" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
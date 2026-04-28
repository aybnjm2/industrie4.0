#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

const char* ssid = "Wokwi-GUEST";
const char* password = "";
const char* mqtt_server = "broker.emqx.io";
const char* mqtt_topic = "factory/telemetry"; // shared topic for all machines

WiFiClient espClient;
PubSubClient client(espClient);

#define DHTPIN 15
#define DHTTYPE DHT22
#define LOAD_PIN 34
#define VIB_PIN 35

DHT dht(DHTPIN, DHTTYPE);

// synthetic variables for Machine 2 & 3
float m3_vib = 2.0;

void setup() {
  Serial.begin(115200);
  dht.begin();
  pinMode(LOAD_PIN, INPUT);
  pinMode(VIB_PIN, INPUT);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
  client.setServer(mqtt_server, 1883);
}

void reconnect() {
  while (!client.connected()) {
    if (client.connect("ESP32_Fleet_Sim")) { } else { delay(5000); }
  }
}

void sendMachineData(String id, float t, float v, float l) {
  StaticJsonDocument<200> doc;
  doc["machine_id"] = id;
  doc["temperature"] = t;
  doc["vibration"] = v;
  doc["motor_load"] = l;
  doc["timestamp"] = millis();

  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);
  client.publish(mqtt_topic, jsonBuffer);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  // MACHINE 1: Interactive Hardware
  float temp1 = dht.readTemperature();
  if (isnan(temp1)) temp1 = 25.0;
  float load1 = (analogRead(LOAD_PIN) / 4095.0) * 100.0;
  float vib1 = (analogRead(VIB_PIN) / 4095.0) * 5.0;
  sendMachineData("machine-01", temp1, vib1, load1);

  // MACHINE 2: Stable & Healthy (simulating)
  float temp2 = 45.0 + (random(-10, 10) / 10.0);
  float vib2 = 1.2 + (random(-5, 5) / 100.0);
  float load2 = 60.0 + (random(-20, 20) / 10.0);
  sendMachineData("machine-02", temp2, vib2, load2);

  // MACHINE 3: Erratic & Degrading (simulating)
  m3_vib += 0.05; // Gets worse over time
  if(m3_vib > 4.5) m3_vib = 1.0; // Reset cycle
  float temp3 = 70.0 + (random(-30, 30) / 10.0);
  float load3 = 85.0 + (random(-15, 15) / 10.0);
  sendMachineData("machine-03", temp3, m3_vib, load3);

  Serial.println("Fleet data sent.");
  delay(1000); // Wait 2 seconds before next fleet update
}
# DeDoCracia - Deployment and Testing Guide

## 🚀 Quick Deployment to AWS

### Step 1: Upload Updated Code to AWS Public Instance

```bash
# SSH into your AWS public instance
ssh -i labsuser.pem ubuntu@34.197.123.11

# Navigate to your project
cd ~/dedocracia

# Update your code (replace these files with the updated versions)
# You can use scp to upload the files or git pull if using version control
```

### Step 2: Update Backend Files

Upload/replace these files on AWS:
- `backend/server.js` - Now includes MQTT integration and finalization endpoint
- `backend/mqtt_service.js` - Enhanced with voting finalization
- `backend/codigo-esp32.ino` - Updated with winner display functionality

### Step 3: Update Frontend Files

Upload/replace these files on AWS:
- `frontend/src/dashboard.js` - Now includes finalization button and winner display
- `frontend/src/App.css` - Added winner styling

### Step 4: Restart Services on AWS

```bash
# Stop existing services
pm2 stop all

# Start backend
pm2 start ~/dedocracia/backend/server.js --name backend

# Start MQTT service
pm2 start ~/dedocracia/backend/mqtt_service.js --name mqtt_service

# Build and start frontend
cd ~/dedocracia/frontend
npm run build
pm2 serve ~/dedocracia/frontend/build 3001 --name frontend

# Check all services are running
pm2 status
```

## 🧪 Testing the Complete System

### Test 1: Web Interface
1. Open: `http://34.197.123.11:3001`
2. Verify you can see the dashboard with statistics
3. Add a test candidate using the form
4. Look for the green "Finalizar Votación" button

### Test 2: ESP32 Communication
1. Upload the updated Arduino code to your ESP32
2. Open Serial Monitor
3. Enter a fingerprint ID (1-127)
4. Register fingerprint on sensor
5. Press voting buttons
6. Verify MQTT messages in backend logs

### Test 3: Voting Finalization
1. After some votes are cast, click "Finalizar Votación" in web interface
2. Confirm the action
3. Verify winner appears in golden card on web
4. Check ESP32 OLED shows winner name and vote count

## 📊 System Monitoring

### Check Service Status
```bash
pm2 status
pm2 logs backend
pm2 logs mqtt_service
pm2 logs frontend
```

### Check MQTT Broker
```bash
sudo lsof -i -P -n | grep 1883
mosquitto_pub -h localhost -t test -m "hello"
```

### Check Database
```bash
# From public instance, test connection to private DB
psql -h 172.31.11.100 -U dedouser -d votaciones -c "SELECT * FROM candidatos;"
```

## 🔧 Troubleshooting

### Problem: ESP32 not connecting to MQTT
- Check WiFi credentials in ESP32 code
- Verify MQTT broker IP (34.197.123.11)
- Check security groups allow port 1883

### Problem: Database connection errors
- Verify PostgreSQL running on private instance (172.31.11.100)
- Check security groups allow port 5432 from public to private
- Test connection manually

### Problem: Frontend shows connection errors
- Check backend server running on port 3000
- Verify API_BASE_URL in dashboard.js points to correct server
- Check CORS configuration

## 📝 Key Features Now Working

✅ **ESP32 Fingerprint Registration**
- Serial input for fingerprint ID
- AS608 sensor integration
- MQTT publishing to backend
- Database storage confirmation

✅ **Voting Process**
- Two-button voting interface
- MQTT vote transmission
- Duplicate vote prevention
- Real-time statistics updates

✅ **Web Dashboard**
- Real-time vote counting
- Candidate management (add/remove)
- Statistics visualization with charts
- Voting finalization controls

✅ **Winner Display**
- Automatic winner calculation
- Golden winner card on web interface
- Winner display on ESP32 OLED screen
- Animated winner presentation

✅ **MQTT Communication**
- Bidirectional ESP32 ↔ Backend communication
- Real-time candidate list updates
- Vote confirmations
- Finalization notifications

## 🎯 Complete Workflow

1. **Setup Phase**: Admin adds candidates via web interface
2. **Registration Phase**: Users register fingerprints on ESP32
3. **Voting Phase**: Users vote using ESP32 buttons
4. **Monitoring Phase**: Admin monitors real-time statistics on web
5. **Finalization Phase**: Admin clicks "Finalizar Votación"
6. **Results Phase**: Winner displayed on both web and ESP32 OLED

## 📱 ESP32 Display States

1. **Startup**: "Iniciando..." → "Sensor OK" → "WiFi conectado"
2. **Registration**: "Ingrese ID por Serial" → "Registrando ID X" → "Huella ID X registrada OK"
3. **Voting**: "Elija candidato: [1] Name1 [2] Name2" → "Voto: NameX"
4. **Winner Display**: "GANADOR!" → Winner name → Vote count → "Felicitaciones!"

The system is now fully functional with all requested features implemented!

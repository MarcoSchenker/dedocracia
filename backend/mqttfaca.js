const mqtt = require('mqtt');
const db = require('../dataBase')

// conexión al broker mqtt con mi ip elastica publica
const mqttClient = mqtt.connect('mqtt://100.28.15.22:1883')

// Cuando se conecta al broker MQTT
mqttClient.on('connect', () => {
    console.log('Conectado al broker MQTT');

    // Escucha todos los cambios de asientos en todos los trenes
    const topic = 'train/+/seat/+/status';

    // Escuchar todos los sensores
    mqttClient.subscribe(topic, (err) => {
        if (!err) {
            console.log(`Subscribed to ${topic}`);
        } else {
            console.error('Subscription error:', err);
        }
    });
});

// Mensajes del ESP32
mqttClient.on('message', async (topic, message) => {
    try {
        const parts = topic.split('/');

        // se espera algo como: train/1/seat/1-03/status
        if( parts.length !== 5 || parts[0] !== 'train' || parts[2] !== 'seat' || parts[4] !== 'status') {
            console.warn(`Unknown topic recieved ${topic}`);
            return;
        }
        const trainId = parseInt(parts[1]);
        const [railcarNumber, seatNumber] = parts[3].split('-').map(Number);
        const payload = message.toString();

        // Interpretar '1' como ocupado y '0' como libre
        const isOccupied = payload === '1';

        // Validar que los datos sean numéricos
        if (isNaN(trainId) || isNaN(railcarNumber) || isNaN(seatNumber)) {
            console.warn('Invalid topic data:', topic);
            return;
        }

        const result = await db.query(
                'UPDATE seat ' +
                'SET is_occupied = $1 ' +
                'WHERE train_id = $2 AND railcar_number = $3 AND seat_number = $4',
                [isOccupied, trainId, railcarNumber, seatNumber]
        );

        if (result.rowCount === 0) {
            console.warn(`No seat found for Train ${trainId}, Railcar ${railcarNumber}, Seat ${seatNumber}`);
        } else {
            console.log(`Seat updated: Train ${trainId}, Railcar ${railcarNumber}, Seat ${seatNumber} → ${isOccupied ? 'Occupied' : 'Free'}`);
        }
    } catch (err) {
        console.error('Error processing MQTT message:', err);
    }
});

module.exports = mqttClient;
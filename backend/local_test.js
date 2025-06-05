const mqtt = require('mqtt');

// Test MQTT connection and functionality
console.log('🧪 Iniciando pruebas locales del sistema DeDoCracia...');

// Simulate ESP32 client
const esp32Client = mqtt.connect('mqtt://34.197.123.11:1883', {
  clientId: 'ESP32_test_' + Math.random().toString(16).substr(2, 8)
});

// Simulate backend service client  
const backendClient = mqtt.connect('mqtt://34.197.123.11:1883', {
  clientId: 'backend_test_' + Math.random().toString(16).substr(2, 8)
});

esp32Client.on('connect', () => {
  console.log('✅ ESP32 simulado conectado');
  
  // Subscribe to responses
  esp32Client.subscribe('dedocracia/confirmacion');
  esp32Client.subscribe('dedocracia/candidatos');
  esp32Client.subscribe('dedocracia/resultado');
  
  // Test fingerprint registration
  setTimeout(() => {
    console.log('📤 ESP32: Registrando huella ID 123');
    esp32Client.publish('dedocracia/huella', JSON.stringify({
      id_huella: 123
    }));
  }, 1000);
  
  // Test vote
  setTimeout(() => {
    console.log('📤 ESP32: Enviando voto para candidato 1');
    esp32Client.publish('dedocracia/voto', JSON.stringify({
      id_huella: 123,
      id_candidato: 1
    }));
  }, 3000);
  
  // Request candidates
  setTimeout(() => {
    console.log('📤 ESP32: Solicitando candidatos');
    esp32Client.publish('dedocracia/solicitud', JSON.stringify({
      accion: 'obtener_candidatos'
    }));
  }, 2000);
});

esp32Client.on('message', (topic, message) => {
  console.log(`📥 ESP32 recibió [${topic}]:`, message.toString());
});

backendClient.on('connect', () => {
  console.log('✅ Backend simulado conectado');
  
  // Listen for messages
  backendClient.subscribe('dedocracia/huella');
  backendClient.subscribe('dedocracia/voto');
  backendClient.subscribe('dedocracia/solicitud');
  
  // Test finalization after 5 seconds
  setTimeout(() => {
    console.log('📤 Backend: Finalizando votación');
    backendClient.publish('dedocracia/resultado', JSON.stringify({
      ganador: {
        nombre: 'Andrés Molina',
        id: 1,
        votos: 5
      },
      estadisticas: [
        { nombre: 'Andrés Molina', id: 1, votos: 5 },
        { nombre: 'Carlos Castillo', id: 2, votos: 3 }
      ],
      total_votantes: 8,
      finalizada: true,
      fecha_finalizacion: new Date().toISOString()
    }));
  }, 5000);
});

backendClient.on('message', (topic, message) => {
  console.log(`📥 Backend recibió [${topic}]:`, message.toString());
  
  // Simulate responses
  if (topic === 'dedocracia/huella') {
    const data = JSON.parse(message.toString());
    console.log('🔄 Backend: Confirmando registro de huella');
    backendClient.publish('dedocracia/confirmacion', JSON.stringify({
      status: 'success',
      id_huella: data.id_huella,
      id_usuario: 1,
      message: 'Usuario registrado exitosamente'
    }));
  }
  
  if (topic === 'dedocracia/voto') {
    const data = JSON.parse(message.toString());
    console.log('🔄 Backend: Confirmando voto');
    backendClient.publish('dedocracia/confirmacion', JSON.stringify({
      status: 'success',
      id_huella: data.id_huella,
      id_usuario: 1,
      id_voto: 1,
      message: 'Voto registrado exitosamente'
    }));
  }
  
  if (topic === 'dedocracia/solicitud') {
    const data = JSON.parse(message.toString());
    if (data.accion === 'obtener_candidatos') {
      console.log('🔄 Backend: Enviando candidatos');
      backendClient.publish('dedocracia/candidatos', JSON.stringify({
        candidatos: [
          { id: 1, nombre: 'Andrés Molina' },
          { id: 2, nombre: 'Carlos Castillo' }
        ]
      }));
    }
  }
});

// Close after 10 seconds
setTimeout(() => {
  console.log('🔚 Finalizando pruebas...');
  esp32Client.end();
  backendClient.end();
  process.exit(0);
}, 10000);

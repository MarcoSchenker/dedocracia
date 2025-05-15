const mqtt = require('mqtt');
const pool = require('./db');
require('dotenv').config();

// Configuración de MQTT
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost';
const MQTT_PORT = process.env.MQTT_PORT || 1883;

const MQTT_OPTIONS = {
  port: MQTT_PORT,
  clientId: 'dedocracia_' + Math.random().toString(16).substr(2, 8),
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASSWORD,
  keepalive: 60,
  reconnectPeriod: 1000
};

console.log(`📶 Conectando a MQTT broker: ${MQTT_BROKER}`);

// Conectar al broker MQTT
const client = mqtt.connect(MQTT_BROKER, MQTT_OPTIONS);

// Manejar eventos de conexión
client.on('connect', () => {
  console.log('✅ Conectado al broker MQTT');
  
  // Suscribirse a los tópicos
  client.subscribe('dedocracia/huella', (err) => {
    if (err) {
      console.error('❌ Error suscribiéndose a dedocracia/huella:', err);
    } else {
      console.log('✅ Suscrito a dedocracia/huella');
    }
  });
  
  client.subscribe('dedocracia/voto', (err) => {
    if (err) {
      console.error('❌ Error suscribiéndose a dedocracia/voto:', err);
    } else {
      console.log('✅ Suscrito a dedocracia/voto');
    }
  });
});

// Manejar errores
client.on('error', (error) => {
  console.error('❌ Error en la conexión MQTT:', error);
});

// Manejar mensajes recibidos
client.on('message', async (topic, message) => {
  console.log(`📥 Mensaje recibido en ${topic}:`, message.toString());
  
  try {
    const data = JSON.parse(message.toString());
    
    switch (topic) {
      case 'dedocracia/huella':
        await registrarUsuario(data.id_huella);
        break;
        
      case 'dedocracia/voto':
        await registrarVoto(data.id_huella, data.id_candidato);
        break;
        
      default:
        console.log(`⚠️ Tópico no manejado: ${topic}`);
    }
  } catch (error) {
    console.error(`❌ Error procesando mensaje de ${topic}:`, error);
  }
});

// Función para registrar un nuevo usuario
async function registrarUsuario(id_huella) {
  console.log(`⏳ Registrando usuario con huella ID: ${id_huella}`);
  
  try {
    // Verificar si el usuario ya existe
    const checkResult = await pool.query(
      'SELECT * FROM usuarios WHERE id_huella = $1',
      [id_huella]
    );
    
    if (checkResult.rows.length > 0) {
      console.log(`👤 Usuario con huella ID ${id_huella} ya existe.`);
      // Enviar confirmación
      client.publish('dedocracia/confirmacion', JSON.stringify({
        status: 'exists',
        id_huella: id_huella,
        id_usuario: checkResult.rows[0].id_usuario
      }));
      return;
    }
    
    // Registrar nuevo usuario
    const result = await pool.query(
      'INSERT INTO usuarios(id_huella) VALUES($1) RETURNING id_usuario',
      [id_huella]
    );
    
    console.log(`✅ Usuario registrado con huella ID ${id_huella} y usuario ID ${result.rows[0].id_usuario}`);
    
    // Enviar confirmación
    client.publish('dedocracia/confirmacion', JSON.stringify({
      status: 'success',
      id_huella: id_huella,
      id_usuario: result.rows[0].id_usuario
    }));
    
  } catch (error) {
    console.error('❌ Error registrando usuario:', error);
    
    // Enviar error
    client.publish('dedocracia/confirmacion', JSON.stringify({
      status: 'error',
      id_huella: id_huella,
      message: error.message
    }));
  }
}

// Función para registrar un voto
async function registrarVoto(id_huella, id_candidato) {
  console.log(`⏳ Registrando voto: huella ID ${id_huella} por candidato ID ${id_candidato}`);
  
  try {
    // Obtener id_usuario a partir de id_huella
    const userResult = await pool.query(
      'SELECT id_usuario FROM usuarios WHERE id_huella = $1',
      [id_huella]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error(`No se encontró usuario con huella ID ${id_huella}`);
    }
    
    const id_usuario = userResult.rows[0].id_usuario;
    
    // Verificar si el usuario ya votó
    const checkResult = await pool.query(
      'SELECT * FROM votaciones WHERE id_usuario = $1',
      [id_usuario]
    );
    
    if (checkResult.rows.length > 0) {
      console.log(`⚠️ El usuario con ID ${id_usuario} ya ha votado anteriormente.`);
      
      // Enviar confirmación de voto duplicado
      client.publish('dedocracia/confirmacion', JSON.stringify({
        status: 'duplicate',
        id_huella: id_huella,
        id_usuario: id_usuario
      }));
      return;
    }
    
    // Registrar el voto
    const result = await pool.query(
      'INSERT INTO votaciones (id_usuario, id_candidato) VALUES ($1, $2) RETURNING id_voto',
      [id_usuario, id_candidato]
    );
    
    console.log(`✅ Voto registrado: ID ${result.rows[0].id_voto} para usuario ${id_usuario} por candidato ${id_candidato}`);
    
    // Enviar confirmación
    client.publish('dedocracia/confirmacion', JSON.stringify({
      status: 'success',
      id_huella: id_huella,
      id_usuario: id_usuario,
      id_voto: result.rows[0].id_voto
    }));
    
  } catch (error) {
    console.error('❌ Error registrando voto:', error);
    
    // Enviar error
    client.publish('dedocracia/confirmacion', JSON.stringify({
      status: 'error',
      id_huella: id_huella,
      id_candidato: id_candidato,
      message: error.message
    }));
  }
}

// Manejar el cierre de la aplicación
process.on('SIGINT', () => {
  console.log('⏹️ Cerrando conexión MQTT');
  client.end();
  process.exit();
});
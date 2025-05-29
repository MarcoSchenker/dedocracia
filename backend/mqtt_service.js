const mqtt = require('mqtt');
const pool = require('./db');

// Configuración hardcodeada para MQTT
const MQTT_BROKER = 'mqtt://34.197.123.11:1883';
const MQTT_PORT = 1883;
const MQTT_USER = '';
const MQTT_PASSWORD = '';

const MQTT_OPTIONS = {
  port: MQTT_PORT,
  clientId: 'dedocracia_' + Math.random().toString(16).substr(2, 8),
  username: MQTT_USER,
  password: MQTT_PASSWORD,
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
  
  client.subscribe('dedocracia/solicitud', (err) => {
    if (!err) console.log('✅ Suscrito a dedocracia/solicitud');
  });

  // Publicar lista de candidatos al conectar
  publicarCandidatos();
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
        
      case 'dedocracia/solicitud':
        const solicitud = data.accion;
        if (solicitud === 'obtener_candidatos') {
          await publicarCandidatos();
        }
        break;
        
      case 'dedocracia/confirmacion':
        // Manejar confirmaciones si es necesario
        console.log('✅ Confirmación recibida:', data);
        break;
        
      case 'dedocracia/candidatos':
        // Manejar lista de candidatos si es necesario
        console.log('📋 Lista de candidatos recibida:', data);
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
      client.publish('dedocracia/confirmacion', JSON.stringify({
        status: 'exists',
        id_huella: id_huella,
        id_usuario: checkResult.rows[0].id_usuario
      }));
      return;
    }
    
    const result = await pool.query(
      'INSERT INTO usuarios(id_huella) VALUES($1) RETURNING id_usuario',
      [id_huella]
    );
    
    console.log(`✅ Usuario registrado con huella ID ${id_huella} y usuario ID ${result.rows[0].id_usuario}`);
    client.publish('dedocracia/confirmacion', JSON.stringify({
      status: 'success',
      id_huella: id_huella,
      id_usuario: result.rows[0].id_usuario
    }));
    
  } catch (error) {
    console.error('❌ Error registrando usuario:', error);
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
    const userResult = await pool.query(
      'SELECT id_usuario FROM usuarios WHERE id_huella = $1',
      [id_huella]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error(`No se encontró usuario con huella ID ${id_huella}`);
    }
    
    const id_usuario = userResult.rows[0].id_usuario;
    
    const checkResult = await pool.query(
      'SELECT * FROM votaciones WHERE id_usuario = $1',
      [id_usuario]
    );
    
    if (checkResult.rows.length > 0) {
      console.log(`⚠️ El usuario con ID ${id_usuario} ya ha votado anteriormente.`);
      client.publish('dedocracia/confirmacion', JSON.stringify({
        status: 'duplicate',
        id_huella: id_huella,
        id_usuario: id_usuario
      }));
      return;
    }
    
    const result = await pool.query(
      'INSERT INTO votaciones (id_usuario, id_candidato) VALUES ($1, $2) RETURNING id_voto',
      [id_usuario, id_candidato]
    );
    
    console.log(`✅ Voto registrado: ID ${result.rows[0].id_voto} para usuario ${id_usuario} por candidato ${id_candidato}`);
    client.publish('dedocracia/confirmacion', JSON.stringify({
      status: 'success',
      id_huella: id_huella,
      id_usuario: id_usuario,
      id_voto: result.rows[0].id_voto
    }));
    
  } catch (error) {
    console.error('❌ Error registrando voto:', error);
    client.publish('dedocracia/confirmacion', JSON.stringify({
      status: 'error',
      id_huella: id_huella,
      id_candidato: id_candidato,
      message: error.message
    }));
  }
}

// Publicar los 2 candidatos actuales vía MQTT
async function publicarCandidatos() {
  try {
    const result = await pool.query('SELECT id_candidato AS id, nombre FROM candidatos ORDER BY id_candidato ASC LIMIT 2');
    
    if (result.rows.length === 2) {
      const candidatos = {
        candidatos: result.rows
      };
      const mensaje = JSON.stringify(candidatos);
      client.publish('dedocracia/candidatos', mensaje);
      console.log('📤 Candidatos enviados por MQTT:', mensaje);
    } else {
      console.warn('⚠️ No hay exactamente 2 candidatos en la base de datos');
    }
  } catch (error) {
    console.error('❌ Error al publicar candidatos:', error);
  }
}

// Función para reconectar el cliente MQTT
function reconnect() {
  while (!client.connected()) {
    const clientId = 'ESP32Client-' + Math.random().toString(16).substr(2, 8);
    if (client.connect(clientId)) {
      client.subscribe('dedocracia/confirmacion');
      client.subscribe('dedocracia/candidatos');
      
      // Solicitar candidatos al reconectar
      client.publish('dedocracia/solicitud', JSON.stringify({ accion: 'obtener_candidatos' }));
    } else {
      setTimeout(reconnect, 5000);
    }
  }
}

// Manejar el cierre de la aplicación
process.on('SIGINT', () => {
  console.log('⏹️ Cerrando conexión MQTT');
  client.end();
  process.exit();
});
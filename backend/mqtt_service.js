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

// Estado de la votación
let votacionIniciada = false;

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

  client.subscribe('dedocracia/finalizacion', (err) => {
    if (!err) console.log('✅ Suscrito a dedocracia/finalizacion');
  });

  // NOTA: Ya no publicamos candidatos automáticamente al conectar
  // Los candidatos solo se publican cuando se presiona "Iniciar Votación"
  console.log('📋 Esperando comando para iniciar votación...');
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
        
      case 'dedocracia/finalizacion':
        await manejarFinalizacion(data);
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
        id_usuario: checkResult.rows[0].id_usuario,
        message: 'Usuario ya registrado'
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
      id_usuario: result.rows[0].id_usuario,
      message: 'Usuario registrado exitosamente'
    }));
    
  } catch (error) {
    console.error('❌ Error registrando usuario:', error);
    client.publish('dedocracia/confirmacion', JSON.stringify({
      status: 'error',
      id_huella: id_huella,
      message: 'Error en base de datos: ' + error.message
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
        id_usuario: id_usuario,
        message: 'Usuario ya ha votado'
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
      id_voto: result.rows[0].id_voto,
      message: 'Voto registrado exitosamente'
    }));
    
  } catch (error) {
    console.error('❌ Error registrando voto:', error);
    client.publish('dedocracia/confirmacion', JSON.stringify({
      status: 'error',
      id_huella: id_huella,
      id_candidato: id_candidato,
      message: 'Error registrando voto: ' + error.message
    }));
  }
}

// Publicar los 2 candidatos actuales vía MQTT
async function publicarCandidatos() {
  try {
    if (!votacionIniciada) {
      console.log('⏳ Votación no iniciada aún - Enviando mensaje de espera al ESP32');
      client.publish('dedocracia/candidatos', JSON.stringify({
        candidatos: [],
        mensaje: 'Esperando inicio de votación',
        iniciada: false
      }));
      return;
    }

    // Enviar todos los candidatos disponibles (sin límite)
    const result = await pool.query('SELECT id_candidato AS id, nombre FROM candidatos ORDER BY id_candidato ASC');
    
    if (result.rows.length >= 2) {
      const candidatos = {
        candidatos: result.rows,
        iniciada: true
      };
      const mensaje = JSON.stringify(candidatos);
      client.publish('dedocracia/candidatos', mensaje);
      console.log('📤 Candidatos enviados por MQTT:', mensaje);
    } else {
      console.warn('⚠️ No hay suficientes candidatos en la base de datos');
      client.publish('dedocracia/candidatos', JSON.stringify({
        candidatos: [],
        mensaje: 'Se necesitan al menos 2 candidatos',
        iniciada: false
      }));
    }
  } catch (error) {
    console.error('❌ Error al publicar candidatos:', error);
  }
}

// Manejar finalización de votación
async function manejarFinalizacion(data) {
  try {
    console.log('🏁 Procesando finalización de votación...');
    
    // Obtener estadísticas completas ordenadas por votos
    const estadisticasResult = await pool.query(`
      SELECT c.id_candidato, c.nombre, COUNT(v.id_voto) as total_votos
      FROM candidatos c
      LEFT JOIN votaciones v ON c.id_candidato = v.id_candidato
      GROUP BY c.id_candidato, c.nombre
      ORDER BY total_votos DESC, c.nombre ASC
    `);
    
    if (estadisticasResult.rows.length > 0) {
      const estadisticas = estadisticasResult.rows.map(row => ({
        nombre: row.nombre,
        id: row.id_candidato,
        votos: parseInt(row.total_votos)
      }));
      
      // Verificar si hay empate (mismo número de votos en los primeros lugares)
      const maxVotos = estadisticas[0].votos;
      const candidatosConMaxVotos = estadisticas.filter(candidato => candidato.votos === maxVotos);
      
      let resultadoFinal;
      
      if (candidatosConMaxVotos.length > 1) {
        // HAY EMPATE
        console.log('🤝 EMPATE DETECTADO entre', candidatosConMaxVotos.length, 'candidatos con', maxVotos, 'votos cada uno');
        
        resultadoFinal = {
          empate: true,
          votos_empate: maxVotos,
          candidatos_empatados: candidatosConMaxVotos,
          estadisticas: estadisticas,
          total_votantes: await getTotalVotantes(),
          finalizada: true
        };
        
        console.log('🤝 Empate entre:', candidatosConMaxVotos.map(c => c.nombre).join(' y '));
      } else {
        // HAY GANADOR CLARO
        const ganador = estadisticas[0];
        
        resultadoFinal = {
          empate: false,
          ganador: {
            nombre: ganador.nombre,
            id: ganador.id,
            votos: ganador.votos
          },
          estadisticas: estadisticas,
          total_votantes: await getTotalVotantes(),
          finalizada: true
        };
        
        console.log('🏆 Ganador determinado:', ganador.nombre, 'con', ganador.votos, 'votos');
      }
      
      // Publicar resultado en MQTT para ESP32
      client.publish('dedocracia/resultado', JSON.stringify(resultadoFinal));
      console.log('📤 Resultado final enviado por MQTT:', JSON.stringify(resultadoFinal, null, 2));
      
      return resultadoFinal;
    } else {
      console.warn('⚠️ No se encontraron candidatos para determinar ganador');
    }
  } catch (error) {
    console.error('❌ Error procesando finalización:', error);
  }
}

// Obtener total de votantes
async function getTotalVotantes() {
  try {
    const result = await pool.query('SELECT COUNT(DISTINCT id_usuario) as total FROM votaciones');
    return parseInt(result.rows[0].total) || 0;
  } catch (error) {
    console.error('❌ Error obteniendo total de votantes:', error);
    return 0;
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

// Función para iniciar votación (cambiar estado y publicar candidatos)
function iniciarVotacion() {
  votacionIniciada = true;
  console.log('🚀 Votación iniciada desde el frontend');
  publicarCandidatos();
}

// Función para resetear votación
function resetearVotacion() {
  votacionIniciada = false;
  console.log('🔄 Estado de votación reseteado');
}

// Exportar funciones para uso externo
module.exports = {
  client,
  iniciarVotacion,
  resetearVotacion
};

// Manejar el cierre de la aplicación
process.on('SIGINT', () => {
  console.log('⏹️ Cerrando conexión MQTT');
  client.end();
  process.exit();
});
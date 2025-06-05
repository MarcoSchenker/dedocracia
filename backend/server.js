const express = require('express');
const pool = require('./db');
const cors = require('cors');
const mqtt = require('mqtt');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0'; // Escucha en todas las interfaces

// Configuración de MQTT para poder comunicarse con el ESP32
const MQTT_BROKER = 'mqtt://34.197.123.11:1883';
let mqttClient;

// Inicializar conexión MQTT
function initMQTT() {
  mqttClient = mqtt.connect(MQTT_BROKER, {
    clientId: 'server_' + Math.random().toString(16).substr(2, 8)
  });

  mqttClient.on('connect', () => {
    console.log('🚀 Servidor conectado a MQTT broker');
  });

  mqttClient.on('error', (error) => {
    console.error('❌ Error MQTT en servidor:', error);
  });
}

// Inicializar MQTT
initMQTT();

// Configuración de CORS para permitir peticiones desde el frontend
app.use(cors());
app.options('*', cors()); // Permitir preflight requests

app.use(express.json()); // Permite manejar el cuerpo de las peticiones como JSON

// Ruta principal
app.get('/', (req, res) => {
    res.send('API funcionando');
});
// Endpoint vacío para evitar errores con solicitudes de líderes
app.get('/api/lideres', (req, res) => {
  res.status(200).json([]);
});

// Rutas para usuarios
// GET: Obtener todos los usuarios
app.get('/api/usuarios', async (req, res) => {

  try {
    const { rows } = await pool.query('SELECT * FROM usuarios');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los usuarios' });
  }
});

// POST: Agregar un usuario
app.post('/api/usuarios', async (req, res) => {
  const { id_huella } = req.body;

  if (!id_huella) {
    return res.status(400).json({ error: 'Se requiere ID de huella' });
  }

  try {
    // Verificar si el usuario ya existe
    const checkResult = await pool.query('SELECT * FROM usuarios WHERE id_huella = $1', [id_huella]);
    
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    const { rows } = await pool.query(
      'INSERT INTO usuarios(id_huella) VALUES($1) RETURNING *',
      [id_huella]
    );
    res.status(201).json({
      mensaje: 'Usuario registrado exitosamente',
      usuario: rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

// Rutas para candidatos
// GET: Obtener todos los candidatos
app.get('/api/candidatos', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM candidatos ORDER BY id_candidato ASC');
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error al obtener candidatos:', err);
    res.status(500).json({ error: 'Error al obtener candidatos' });
  }
});

// POST: Agregar un nuevo candidato
app.post('/api/candidatos', async (req, res) => {
    const { nombre, descripcion } = req.body;

    if (!nombre || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre del candidato es requerido' });
    }

    try {
        const { rows } = await pool.query(
            'INSERT INTO candidatos (nombre, descripcion) VALUES ($1, $2) RETURNING *',
            [nombre, descripcion || '']
        );
        
        res.status(201).json({
            mensaje: 'Candidato agregado correctamente',
            id_candidato: rows[0].id_candidato
        });
    } catch (err) {
        console.error('Error al agregar candidato:', err);
        res.status(500).json({ error: 'Error al agregar candidato' });
    }
});

// DELETE: Eliminar un candidato
app.delete('/api/candidatos/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM candidatos WHERE id_candidato = $1 RETURNING *', [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Candidato no encontrado' });
        }

        res.status(200).json({ mensaje: 'Candidato eliminado correctamente' });
    } catch (err) {
        console.error('Error al eliminar candidato:', err);
        res.status(500).json({ error: 'Error al eliminar candidato' });
    }
}); 

// Rutas para votaciones
// POST: Registrar un voto
app.post('/api/votar', async (req, res) => {
  const { id_usuario, id_candidato } = req.body;

  if (!id_usuario || !id_candidato) {
    return res.status(400).json({ error: 'Se requieren ID de usuario e ID de candidato' });
  }

  try {
    // Verificar si el usuario ya votó
    const checkResult = await pool.query('SELECT * FROM votaciones WHERE id_usuario = $1', [id_usuario]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: 'El usuario ya ha votado' });
    }

    // Registrar el voto
    const { rows } = await pool.query(
      'INSERT INTO votaciones (id_usuario, id_candidato) VALUES ($1, $2) RETURNING id_voto',
      [id_usuario, id_candidato]
    );

    res.status(201).json({ 
      mensaje: 'Voto registrado exitosamente', 
      id_voto: rows[0].id_voto 
    });
  } catch (err) {
    console.error('Error al registrar voto:', err);
    res.status(500).json({ error: 'Error al registrar voto' });
  }
});

// Rutas para estadísticas
// GET: Obtener estadísticas de votación
app.get('/api/estadisticas', async (req, res) => {
  const query = `
    SELECT c.id_candidato, c.nombre, COUNT(v.id_voto) as total_votos
    FROM candidatos c
    LEFT JOIN votaciones v ON c.id_candidato = v.id_candidato
    GROUP BY c.id_candidato
    ORDER BY total_votos DESC
  `;

  try {
    const { rows } = await pool.query(query);
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error al obtener estadísticas:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Autenticar usuario por huella digital
app.post('/api/autenticar', async (req, res) => {
  const { id_huella } = req.body;

  if (!id_huella) {
    return res.status(400).json({ error: 'Se requiere ID de huella' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE id_huella = $1', [id_huella]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.status(200).json({ usuario: rows[0] });
  } catch (err) {
    console.error('Error al autenticar usuario:', err);
    res.status(500).json({ error: 'Error al autenticar usuario' });
  }
});

// Finalizar votación y obtener ganador
app.post('/api/finalizar-votacion', async (req, res) => {
  try {
    console.log('🏁 Iniciando finalización de votación...');
    
    // Obtener el ganador con más votos
    const ganadorResult = await pool.query(`
      SELECT c.id_candidato, c.nombre, COUNT(v.id_voto) as total_votos
      FROM candidatos c
      LEFT JOIN votaciones v ON c.id_candidato = v.id_candidato
      GROUP BY c.id_candidato, c.nombre
      ORDER BY total_votos DESC, c.nombre ASC
      LIMIT 1
    `);
    
    // Obtener estadísticas completas
    const estadisticasResult = await pool.query(`
      SELECT c.id_candidato, c.nombre, COUNT(v.id_voto) as total_votos
      FROM candidatos c
      LEFT JOIN votaciones v ON c.id_candidato = v.id_candidato
      GROUP BY c.id_candidato, c.nombre
      ORDER BY total_votos DESC, c.nombre ASC
    `);
    
    // Obtener total de votantes únicos
    const totalVotantesResult = await pool.query('SELECT COUNT(DISTINCT id_usuario) as total FROM votaciones');
    const totalVotantes = parseInt(totalVotantesResult.rows[0].total) || 0;
    
    if (ganadorResult.rows.length > 0) {
      const ganador = ganadorResult.rows[0];
      
      const resultadoFinal = {
        ganador: {
          nombre: ganador.nombre,
          id: ganador.id_candidato,
          votos: parseInt(ganador.total_votos)
        },
        estadisticas: estadisticasResult.rows.map(row => ({
          nombre: row.nombre,
          id: row.id_candidato,
          votos: parseInt(row.total_votos)
        })),
        total_votantes: totalVotantes,
        finalizada: true,
        fecha_finalizacion: new Date().toISOString()
      };
      
      // Enviar resultado al ESP32 vía MQTT
      if (mqttClient && mqttClient.connected) {
        mqttClient.publish('dedocracia/resultado', JSON.stringify(resultadoFinal));
        console.log('📤 Resultado enviado al ESP32 vía MQTT');
      }
      
      console.log('🏆 Votación finalizada. Ganador:', ganador.nombre, 'con', ganador.total_votos, 'votos');
      res.status(200).json(resultadoFinal);
    } else {
      res.status(404).json({ error: 'No se encontraron candidatos' });
    }
  } catch (err) {
    console.error('❌ Error al finalizar votación:', err);
    res.status(500).json({ error: 'Error al finalizar votación' });
  }
});

// Inicia el servidor (SOLO UNA VEZ AL FINAL DEL ARCHIVO)
app.listen(PORT, HOST, () => {
  console.log(`🔥 Servidor escuchando en http://${HOST}:${PORT}`);
  console.log(`🌐 Acceso externo: http://34.197.123.11:${PORT}`);
});
const { Pool } = require('pg');
require('dotenv').config();

// Configuración más robusta para producción
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionTimeoutMillis: 10000, // 10 segundos de timeout
  idleTimeoutMillis: 30000,       // 30 segundos antes de cerrar conexiones inactivas
  max: 20                         // máximo número de conexiones
});


pool.connect()
  .then(client => {
    console.log('✅ Conectado correctamente a la base de datos PostgreSQL');
    // Devolvemos el cliente a la pool
    client.release();
    // Inicializar la base de datos
    initializeDatabase();
  })
  .catch(err => {
    console.error('Error al conectar a la base de datos PostgreSQL:', err);
  });

async function initializeDatabase() {
  try {
    // Verificar si existen candidatos
    const result = await pool.query('SELECT COUNT(*) as count FROM candidatos');
    
    if (parseInt(result.rows[0].count) === 0) {
      console.log('Insertando candidatos de prueba...');
      const candidatos = [
        'Andrés Molina',
        'Carlos Castillo'
      ];
      
      // En PostgreSQL usamos INSERT con VALUES y múltiples tuplas
      await pool.query(
        'INSERT INTO candidatos (nombre) VALUES ($1), ($2)',
        candidatos
      );
      
      console.log('✅ Candidatos de prueba insertados correctamente');
    }
  } catch (err) {
    console.error('Error en la inicialización de la base de datos:', err);
  }
}

module.exports = pool;

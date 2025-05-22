const { Pool } = require('pg');

// Configuración hardcodeada - sin necesidad de .env
const pool = new Pool({
  host: '172.31.11.100', // IP de la instancia privada
  port: 5432,
  user: 'dedouser',
  password: 'dedopassword',
  database: 'votaciones',
  connectionTimeoutMillis: 10000, // 10 segundos de timeout
  idleTimeoutMillis: 30000,       // 30 segundos antes de cerrar conexiones inactivas
  max: 20                         // máximo número de conexiones
});

// Imprimir la configuración para verificar (sin mostrar password)
console.log('📊 Configuración de conexión a PostgreSQL:');
console.log(`Host: 172.31.11.100, Puerto: 5432, Usuario: dedouser, DB: votaciones`);

pool.connect()
  .then(client => {
    console.log('✅ Conectado correctamente a la base de datos PostgreSQL');
    client.release();
    initializeDatabase();
  })
  .catch(err => {
    console.error('❌ Error al conectar a la base de datos PostgreSQL:', err);
  });

async function initializeDatabase() {
  try {
    // Verificar si existen candidatos
    const result = await pool.query('SELECT COUNT(*) as count FROM candidatos');
    
    if (parseInt(result.rows[0].count) === 0) {
      console.log('🔄 Insertando candidatos de prueba...');
      
      // En PostgreSQL usamos INSERT con VALUES y múltiples tuplas
      await pool.query(
        'INSERT INTO candidatos (nombre) VALUES ($1), ($2)',
        ['Andrés Molina', 'Carlos Castillo']
      );
      
      console.log('✅ Candidatos de prueba insertados correctamente');
    }
  } catch (err) {
    console.error('❌ Error en la inicialización de la base de datos:', err);
  }
}

module.exports = pool;

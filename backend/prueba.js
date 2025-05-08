const { Client } = require('pg');

// Configuración de la base de datos
const db = new Client({
  host: '172.31.11.100',
  user: 'dedouser',
  password: 'dedopassword',
  database: 'votaciones',
  port: 5432,
});

db.connect()
  .then(() => {
    console.log('🟢 Conectado a PostgreSQL');
    return db.query('SELECT * FROM datos ORDER BY id');
  })
  .then(result => {
    console.log('📋 Datos en la tabla "datos":');
    result.rows.forEach(row => {
      console.log(row);
    });
  })
  .catch(err => {
    console.error('❌ Error:', err);
  })
  .finally(() => {
    db.end();
  });
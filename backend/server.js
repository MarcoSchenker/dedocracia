const express = require('express');
const pool = require('./db');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json()); // Permite manejar el cuerpo de las peticiones como JSON

// Ruta GET para obtener todos los usuarios
app.get('/usuarios', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM usuarios');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los usuarios' });
  }
});

// Ruta POST para agregar un usuario
app.post('/usuarios', async (req, res) => {
  const { id_huella } = req.body; // Se espera un JSON con un campo id_huella

  try {
    const { rows } = await pool.query(
      'INSERT INTO usuarios(id_huella) VALUES($1) RETURNING *',
      [id_huella]
    );
    res.status(201).json(rows[0]); // Devuelve el usuario creado
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

// Inicia el servidor
app.listen(3000, () => {
  console.log('Servidor corriendo en puerto 3000');
});

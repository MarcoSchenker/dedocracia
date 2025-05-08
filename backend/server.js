const express = require('express');
const pool = require('./db');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/usuarios', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM usuarios');
  res.json(rows);
});

app.listen(3000, () => {
  console.log('Servidor corriendo en puerto 3000');
});

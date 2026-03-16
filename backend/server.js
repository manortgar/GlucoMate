require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Endpoints básicos
app.get('/', (req, res) => {
    res.send('Backend de Glucosa funcionando correctamente.');
});

// Endpoint principal para recibir lecturas de glucosa de React Native
app.post('/api/glucose', async (req, res) => {
    try {
        const { user_id, value, trend, timestamp } = req.body;

        // Validación básica
        if (!value || !timestamp) {
            return res.status(400).json({ error: 'Faltan campos obligatorios: value y timestamp' });
        }

        // Insertar en la base de datos (se asume que la tabla 'glucose_readings' existe)
        const query = `
      INSERT INTO glucose_readings (user_id, glucose_value, trend, reading_time)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
        const values = [user_id || 1, value, trend, new Date(timestamp)];

        const result = await db.query(query, values);

        res.status(201).json({
            message: 'Lectura guardada correctamente',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error guardando la lectura:', error);
        res.status(500).json({ error: 'Error interno del servidor al guardar los datos' });
    }
});

// NUEVO: Endpoint para pedir el historial de 12 horas para la gráfica D3
app.get('/api/glucose/history', async (req, res) => {
    try {
        const query = `
            SELECT glucose_value, reading_time 
            FROM glucose_readings 
            WHERE reading_time >= NOW() - INTERVAL '12 HOURS'
            ORDER BY reading_time ASC;
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error extrayendo el historial de la BD:', error);
        res.status(500).json({ error: 'Error interno obteniendo el historial' });
    }
});

// Inicializar el servidor para que acepte conexiones de toda la red local (0.0.0.0)
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Servidor Backend Node.js escuchando en todas las interfaces (0.0.0.0) en el puerto ${port}`);
    console.log(`📱 Tu móvil debe apuntar a: http://<TU_IP_WIFI_DEL_PC>:${port}/api/glucose`);

    // Testear conexión a DB al arrancar
    db.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('❌ Error conectando a PostgreSQL. ¿Está encendido el servicio y configurada la DB?', err.stack);
        } else {
            console.log('✅ Conexión a PostgreSQL establecida. Hora del servidor BD:', res.rows[0].now);
        }
    });
});

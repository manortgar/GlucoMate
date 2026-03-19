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

// ============================================================
// ENDPOINTS: Perfil de Diabetes ("Mi Perfil")
// ============================================================

// Catálogo de insulinas (para los pickers del frontend)
app.get('/api/insulins', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM insulins ORDER BY type, name`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo catálogo de insulinas:', error);
        res.status(500).json({ error: 'Error interno obteniendo insulinas' });
    }
});

// Perfil del usuario (JOIN con insulinas para devolver nombres completos)
app.get('/api/profile', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                up.*,
                fi.name  AS fast_insulin_name,
                fi.type  AS fast_insulin_type,
                fi.duration_hours AS fast_insulin_duration,
                fi.peak_hours     AS fast_insulin_peak,
                si.name  AS slow_insulin_name,
                si.type  AS slow_insulin_type,
                si.duration_hours AS slow_insulin_duration,
                si.peak_hours     AS slow_insulin_peak
            FROM user_profile up
            LEFT JOIN insulins fi ON up.fast_insulin_id = fi.id
            LEFT JOIN insulins si ON up.slow_insulin_id = si.id
            WHERE up.id = 1
        `);
        if (result.rows.length === 0) {
            return res.json(null); // Perfil aún no configurado
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        res.status(500).json({ error: 'Error interno obteniendo el perfil' });
    }
});

// Guardar/Actualizar perfil (UPSERT → siempre es la fila con id=1)
app.put('/api/profile', async (req, res) => {
    try {
        const {
            fast_insulin_id, slow_insulin_id,
            icr_breakfast, icr_mid_morning, icr_lunch, icr_snack, icr_dinner,
            fsi
        } = req.body;

        const result = await db.query(`
            INSERT INTO user_profile 
                (id, fast_insulin_id, slow_insulin_id, icr_breakfast, icr_mid_morning, icr_lunch, icr_snack, icr_dinner, fsi, updated_at)
            VALUES 
                (1, $1, $2, $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT (id) DO UPDATE SET
                fast_insulin_id = EXCLUDED.fast_insulin_id,
                slow_insulin_id = EXCLUDED.slow_insulin_id,
                icr_breakfast   = EXCLUDED.icr_breakfast,
                icr_mid_morning = EXCLUDED.icr_mid_morning,
                icr_lunch       = EXCLUDED.icr_lunch,
                icr_snack       = EXCLUDED.icr_snack,
                icr_dinner      = EXCLUDED.icr_dinner,
                fsi             = EXCLUDED.fsi,
                updated_at      = NOW()
            RETURNING *;
        `, [
            fast_insulin_id || null, slow_insulin_id || null,
            icr_breakfast || null, icr_mid_morning || null,
            icr_lunch || null, icr_snack || null, icr_dinner || null,
            fsi || null
        ]);

        res.json({ message: 'Perfil guardado correctamente', data: result.rows[0] });
    } catch (error) {
        console.error('Error guardando perfil:', error);
        res.status(500).json({ error: 'Error interno guardando el perfil' });
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

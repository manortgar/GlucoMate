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

// ============================================================
// ENDPOINTS: Registro de Eventos (Dashboard)
// ============================================================

// Recuperar inyecciones recientes (ej. últimas 24h) con JOIN a insulinas para tener sus duraciones
app.get('/api/insulin-events', async (req, res) => {
    try {
        const { hours = 24 } = req.query; // Por defecto 24 horas
        const result = await db.query(`
            SELECT 
                e.id, 
                e.units, 
                e.event_time, 
                i.name as insulin_name, 
                i.duration_hours, 
                i.peak_hours,
                i.type as insulin_type
            FROM insulin_events e
            LEFT JOIN insulins i ON e.insulin_id = i.id
            WHERE e.event_time >= NOW() - INTERVAL '1 hour' * $1
            ORDER BY e.event_time DESC
        `, [hours]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo inyecciones:', error);
        res.status(500).json({ error: 'Error obteniendo historial de inyecciones' });
    }
});

// Crear nuevo evento de insulina
app.post('/api/insulin-events', async (req, res) => {
    try {
        const { units, event_time, insulin_id } = req.body;
        
        const result = await db.query(`
            INSERT INTO insulin_events (units, event_time, insulin_id)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [units, event_time, insulin_id]);

        res.status(201).json({ message: 'Dosis guardada', data: result.rows[0] });
    } catch (error) {
        console.error('Error guardando dosis:', error);
        res.status(500).json({ error: 'Error al registrar la dosis de insulina' });
    }
});

// ============================================================
// ENDPOINTS: Registro de Comidas (Food Events)
// ============================================================

// Recuperar historial de comidas
app.get('/api/food-events', async (req, res) => {
    try {
        const { hours = 24 } = req.query;
        const result = await db.query(`
            SELECT id, carbs_g, event_time 
            FROM food_events 
            WHERE event_time >= NOW() - INTERVAL '1 hour' * $1
            ORDER BY event_time DESC
        `, [hours]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo comidas:', error);
        res.status(500).json({ error: 'Error obteniendo historial de comidas' });
    }
});

// Crear nuevo evento de comida (y de insulina si se aplica bolo)
app.post('/api/food-events', async (req, res) => {
    let client;
    try {
        const { carbs, units, event_time } = req.body;
        client = await db.connect();
        await client.query('BEGIN');

        // 1. Insertar carbs en food_events
        const foodResult = await client.query(`
            INSERT INTO food_events (carbs_g, event_time)
            VALUES ($1, $2)
            RETURNING *
        `, [carbs, event_time]);

        let insulinResult = null;
        
        // 2. Si hay insulina, insertarla en insulin_events
        if (units && parseFloat(units) > 0) {
            // Obtener perfil para saber fast_insulin_id
            const profileRes = await client.query('SELECT fast_insulin_id FROM user_profile WHERE id = 1');
            const fastInsulinId = profileRes.rows[0]?.fast_insulin_id;
            
            if (!fastInsulinId) {
                throw new Error("No hay insulina rápida definida en el perfil, no se puede registrar el bolo.");
            }

            const insRes = await client.query(`
                INSERT INTO insulin_events (units, event_time, insulin_id)
                VALUES ($1, $2, $3)
                RETURNING *
            `, [parseFloat(units), event_time, fastInsulinId]);
            
            insulinResult = insRes.rows[0];
        }

        await client.query('COMMIT');

        res.status(201).json({ 
            message: 'Comida registrada con éxito', 
            food: foodResult.rows[0],
            insulin: insulinResult 
        });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error guardando comida:', error);
        res.status(500).json({ error: error.message || 'Error al registrar la comida' });
    } finally {
        if (client) client.release();
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

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { GoogleGenAI } = require('@google/genai');

// Inicializar cliente de Google AI con la API KEY extraída del entorno (.env)
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

const app = express();
const port = process.env.PORT || 3000;
const SPORT_REDUCTION = {
    'Aeróbico': { pct: 20, warn: false },
    'Mixto': { pct: 12.5, warn: false },
    'Baja intensidad': { pct: 5, warn: false },
    'Anaeróbico': { pct: 0, warn: true },
};

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

// ============================================================
// ENDPOINTS: Registro de Deportes (Exercise Events)
// ============================================================

// Obtener catálogo de deportes
app.get('/api/sports', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM sports ORDER BY name ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo deportes:', error);
        res.status(500).json({ error: 'Error obteniendo catálogo de deportes' });
    }
});

// Recuperar historial de ejercicio
app.get('/api/exercise-events', async (req, res) => {
    try {
        const { hours = 24 } = req.query;
        const result = await db.query(`
            SELECT e.id, e.start_time, e.duration_minutes, s.name as sport_name, s.intensity_type, s.danger_window_hours
            FROM exercise_events e
            JOIN sports s ON e.sport_id = s.id
            WHERE e.start_time >= NOW() - INTERVAL '1 hour' * $1
            ORDER BY e.start_time DESC
        `, [hours]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo historial de ejercicio:', error);
        res.status(500).json({ error: 'Error obteniendo historial de ejercicios' });
    }
});

// Crear nuevo evento de ejercicio
app.post('/api/exercise-events', async (req, res) => {
    try {
        const { sport_id, start_time, duration_minutes } = req.body;

        const result = await db.query(`
            INSERT INTO exercise_events (sport_id, start_time, duration_minutes)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [sport_id, start_time, duration_minutes]);

        res.status(201).json({ message: 'Ejercicio registrado con éxito', data: result.rows[0] });
    } catch (error) {
        console.error('Error guardando ejercicio:', error);
        res.status(500).json({ error: 'Error al registrar el evento deportivo' });
    }
});

// ============================================================
// ENDPOINTS: Agente de IA (GlucoMate AI)
// ============================================================

app.post('/api/chat', async (req, res) => {
    // Lógica de reducción por tipo de deporte (fuera del try, a nivel de módulo)


    try {
        if (!ai) {
            return res.status(500).json({ error: 'GEMINI_API_KEY no detectada. Por favor configúrala en el backend.' });
        }

        const { message } = req.body;

        if (!message?.trim()) {
            return res.status(400).json({ error: 'El mensaje está vacío.' });
        }

        // 1. RECOLECCIÓN DE CONTEXTO — paralelo, columnas exactas
        const [profileRes, iobRes, execRes, glucoseRes] = await Promise.all([

            db.query(`
      SELECT icr_breakfast, icr_lunch, icr_dinner, fsi
      FROM user_profile
      WHERE id = 1
    `),

            db.query(`
      SELECT COALESCE(SUM(units), 0) AS iob
      FROM insulin_events
      WHERE insulin_id = (SELECT fast_insulin_id FROM user_profile WHERE id = 1)
        AND event_time >= NOW() - INTERVAL '4 hours'
    `),

            db.query(`
      SELECT s.name           AS sport_name,
             s.intensity_type,
             s.danger_window_hours
      FROM exercise_events e
      JOIN sports s ON e.sport_id = s.id
      WHERE e.start_time >= NOW() - (s.danger_window_hours * INTERVAL '1 hour')
    `),

            db.query(`
      SELECT glucose_value, trend
      FROM glucose_readings
      ORDER BY reading_time DESC
      LIMIT 1
    `),

        ]);

        // 2. PREPARACIÓN DE DATOS
        const p = profileRes.rows[0] || {};
        const g = glucoseRes.rows[0] || {};
        const iob = parseFloat(iobRes.rows[0]?.iob || 0);

        let maxReduction = 0;
        let anaerobicWarn = false;
        const sportLines = [];

        for (const row of execRes.rows) {
            const rule = SPORT_REDUCTION[row.intensity_type];
            if (!rule) continue;

            if (rule.warn) {
                anaerobicWarn = true;
                sportLines.push(`${row.sport_name} (Anaeróbico — vigilar bajadas)`);
            } else {
                maxReduction = Math.max(maxReduction, rule.pct);
                sportLines.push(`${row.sport_name} (${row.intensity_type} — reducir ${rule.pct}%)`);
            }
        }

        const activeSports = sportLines.length ? sportLines.join(', ') : null;

        const sportSection = (() => {
            if (!activeSports) return 'Ninguno.';
            const lines = [`Deportes activos: ${activeSports}`];
            if (maxReduction > 0) lines.push(`→ Reduce el bolo un ${maxReduction}% y explícalo.`);
            if (anaerobicWarn) lines.push(`→ No reduzcas el bolo, pero avisa de posibles bajadas postejercicio.`);
            return lines.join('\n');
        })();

        // 3. SYSTEM PROMPT
        const sysPrompt = `Eres GlucoMate AI, asistente de apoyo para diabetes. Responde siempre en español y de forma concisa.

## DATOS DEL USUARIO (tiempo real)
- Glucosa: ${g.glucose_value ?? 'desconocida'} mg/dL | Tendencia: ${g.trend ?? 'N/A'}
- ICR: Desayuno ${p.icr_breakfast ?? '--'} | Almuerzo ${p.icr_lunch ?? '--'} | Cena ${p.icr_dinner ?? '--'}
- FSI: ${p.fsi ?? '--'} mg/dL por unidad
${iob > 1 ? `- ⚠️ IOB activo: ${iob.toFixed(1)} UI — ya hay insulina circulando, tenlo en cuenta.` : ''}

## CÓMO CALCULAR INSULINA PARA UNA COMIDA
1. Identifica los gramos de HC que menciona el usuario.
2. Si no está claro a qué comida se refiere (desayuno/almuerzo/cena), pregúntale antes de calcular.
3. Fórmula: unidades = (gramos de HC ÷ 10) × ICR correspondiente.
4. Muestra siempre el cálculo paso a paso con valores reales.
${maxReduction > 0 ? `5. Aplica reducción por deporte: resta un ${maxReduction}% al resultado y explícalo.` : ''}
${anaerobicWarn ? `5. No reduzcas el bolo, pero avisa de riesgo de bajada por deporte anaeróbico reciente.` : ''}

## GLUCOSA ACTUAL
- Si glucosa < 70: NO recomiendes insulina. Indica hipoglucemia y que debe tratarla primero.
- Si glucosa > 180: añade corrección → unidades extra = (glucosa - 100) ÷ FSI.
- Si glucosa entre 70-180: sin corrección adicional.

## DEPORTE EN VENTANA DE PELIGRO
${sportSection}

## AVISO OBLIGATORIO — incluye esto AL INICIO de cada respuesta, textualmente:
"⚠️ Soy una IA de apoyo, no un médico. Esta sugerencia no reemplaza el criterio clínico."`;

        // 4. LLAMAR A GEMINI (Con sistema de reintento para el error 503)
        let response;
        let retries = 3;
        let success = false;

        while (retries > 0 && !success) {
            try {
                response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: [{ role: 'user', parts: [{ text: message }] }],
                    config: {
                        systemInstruction: sysPrompt,
                        temperature: 0.2,
                    },
                });
                success = true;
            } catch (err) {
                if ((err.status === 503 || err.status === 429) && retries > 1) {
                    const errorMsg = err.status === 429 ? "Límite de peticiones (Error 429)" : "Servidor saturado (Error 503)";
                    console.warn(`[Gemini AI] ${errorMsg}. Reintentando en 5s... (Quedan ${retries - 1} intentos)`);
                    retries--;
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Espera 5 segundos antes de reintentar
                } else {
                    throw err; // Lanza el error si no es 503/429 o si se agotaron los intentos
                }
            }
        }

        res.json({ reply: response.text });

    } catch (error) {
        console.error('Error en el chat de IA:', error);
        res.status(500).json({ error: 'Error procesando tu solicitud de inteligencia artificial.' });
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

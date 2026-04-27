const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'glucose_db',
    password: process.env.DB_PASSWORD || 'your_password_here',
    port: process.env.DB_PORT || 5432,
});

pool.on('error', (err, client) => {
    console.error('Error inesperado en el cliente de la base de datos', err);
    process.exit(-1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    connect: () => pool.connect(),
};

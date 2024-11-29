const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.MYSQLHOST || 'localhost',
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || 'your_password',
    database: process.env.MYSQLDATABASE || 'railway',
    port: process.env.MYSQLPORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    },
    connectTimeout: 10000,
    socketPath: process.env.NODE_ENV === 'production' ? undefined : undefined
});

// Create tables if they don't exist
async function initializeDatabase() {
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS appointments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                service ENUM('brada', 'kosa', 'bradaikosa') NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                date DATE NOT NULL,
                time TIME NOT NULL,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                email VARCHAR(255) NOT NULL,
                calendarEventId VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_datetime (date, time)
            )
        `);
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
        console.error('Connection details:', {
            host: process.env.MYSQLHOST,
            user: process.env.MYSQLUSER,
            database: process.env.MYSQLDATABASE,
            port: process.env.MYSQLPORT
        });
        throw error;
    }
}

module.exports = { pool, initializeDatabase }; 
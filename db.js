const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.MYSQLHOST || process.env.MYSQL_HOST,
    user: process.env.MYSQLUSER || process.env.MYSQL_USER,
    password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE,
    port: process.env.MYSQLPORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    }
});

// Add debug logging
console.log('Database configuration:', {
    host: process.env.MYSQLHOST || process.env.MYSQL_HOST,
    user: process.env.MYSQLUSER || process.env.MYSQL_USER,
    database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE,
    port: process.env.MYSQLPORT || 3306
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
            host: process.env.MYSQLHOST || process.env.MYSQL_HOST,
            user: process.env.MYSQLUSER || process.env.MYSQL_USER,
            database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE,
            port: process.env.MYSQLPORT || 3306
        });
        throw error;
    }
}

module.exports = { pool, initializeDatabase }; 
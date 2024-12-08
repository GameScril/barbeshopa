const mysql = require('mysql2/promise');
require('dotenv').config();

// Update the pool configuration to use Railway's environment variables
const pool = mysql.createPool({
    host: process.env.MYSQLHOST || 'localhost',
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || '',
    database: process.env.MYSQLDATABASE || 'appointments',
    port: process.env.MYSQLPORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const initializeDatabase = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('Database connection info:', {
            host: process.env.MYSQLHOST,
            user: process.env.MYSQLUSER,
            database: process.env.MYSQLDATABASE,
            port: process.env.MYSQLPORT
        });
        
        // Create appointments table if it doesn't exist
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS appointments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                service VARCHAR(255) NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                date DATE NOT NULL,
                time TIME NOT NULL,
                duration INT NOT NULL DEFAULT 30,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Database initialized successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('Database initialization error details:', {
            message: error.message,
            code: error.code,
            errno: error.errno,
            sqlState: error.sqlState,
            host: process.env.MYSQLHOST,
            user: process.env.MYSQLUSER,
            database: process.env.MYSQLDATABASE
        });
        throw error;
    }
};

// Add a function to test the database connection
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        return true;
    } catch (error) {
        console.error('Database connection test failed:', error);
        return false;
    }
};

module.exports = { pool, initializeDatabase, testConnection }; 
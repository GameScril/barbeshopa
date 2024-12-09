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
        
        // Check if the table exists
        const [tables] = await connection.execute(
            "SHOW TABLES LIKE 'appointments'"
        );
        
        // Only create the table if it doesn't exist
        if (tables.length === 0) {
            // Create appointments table
            await connection.execute(`
                CREATE TABLE appointments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    service VARCHAR(255) NOT NULL,
                    price DECIMAL(10,2) NOT NULL,
                    date DATE NOT NULL,
                    time TIME NOT NULL,
                    duration INT NOT NULL DEFAULT 30,
                    name VARCHAR(255) NOT NULL,
                    phone VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('Appointments table created successfully');
        }

        connection.release();
        return true;
    } catch (error) {
        console.error('Database initialization error:', error);
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
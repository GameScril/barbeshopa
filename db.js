const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initializeDatabase() {
    try {
        // Test the connection
        const connection = await pool.getConnection();
        console.log('Database connected successfully');
        
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
                email VARCHAR(255) NOT NULL,
                calendarEventId VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add duration column if it doesn't exist
        try {
            await connection.execute(`
                ALTER TABLE appointments 
                ADD COLUMN duration INT NOT NULL DEFAULT 30
            `);
            console.log('Added duration column');
        } catch (error) {
            // Column might already exist, which is fine
            if (!error.message.includes('Duplicate column name')) {
                throw error;
            }
        }
        
        connection.release();
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
}

module.exports = { pool, initializeDatabase }; 
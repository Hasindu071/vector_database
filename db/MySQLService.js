"use strict";
const mysql = require('mysql2/promise');

class MySQLService {
    constructor() {
        this.config = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 4000,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'vector_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            ssl: {
                rejectUnauthorized: true
            }
        };

        this.pool = mysql.createPool(this.config);
        console.log('MySQL connection pool created');
    }

    async runquery(sql, params = []) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    async close() {
        await this.pool.end();
        console.log('MySQL connection pool closed');
    }
}

module.exports = MySQLService;

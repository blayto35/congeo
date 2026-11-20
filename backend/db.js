const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const { Pool } = require("pg");

const config = process.env.NODE_ENV === "production" && process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    }
    : {
        user: process.env.POSTGRES_USER,
        host: process.env.POSTGRES_HOST || "localhost",
        database: process.env.POSTGRES_DB,
        password: process.env.POSTGRES_PASSWORD,
        port: Number(process.env.POSTGRES_PORT) || 5432
    };

const pool = new Pool(config);

module.exports = pool;

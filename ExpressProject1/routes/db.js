const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'iriguchi.proxy.rlwy.net',
    port: 43945,
    user: 'root',
    password: 'CgjVNTPZygNVxiKQCuqYAzyqlSrGSZVU',
    database: 'railway',
    waitForConnections: true,
    connectionLimit: 10
});

module.exports = pool;
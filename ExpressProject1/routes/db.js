const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '#Edric1234',
    database: 'cinnamon_leaf',
    waitForConnections: true,
    connectionLimit: 10
});

module.exports = pool;
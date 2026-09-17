var express = require('express');
var router = express.Router();

const db = require('../routes/db');

/* GET users listing. */
router.get('/', function (req, res, next) {
    db.query('SELECT * FROM users', (err, results) => {
        res.send(results);
    });
});

module.exports = router;

var express = require('express');
var router = express.Router();

const db = require('../routes/db');
/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/register', function (req, res, next) {
    res.render('register');
});

router.get('/dashboard', function (req, res) {

    if (!req.session || !req.session.user) {
        return res.redirect('/');
    }

    db.query('SELECT tableID FROM restaurant_table WHERE status = "occupied"', (err, results) => {

        if (err) {
            console.error(err);
            return res.send('Database error');
        }

        db.query('SELECT * FROM menu_items WHERE available = 1', (err, menuResults) => {
            if (err) {
                console.error(err);
                return res.send('Database error');
            }

            res.render('dashboard', {
                user: req.session.user,
                tables: results,
                items: menuResults
            });
            
        });

    });

});

router.get('/logout', function (req, res) {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

router.post('/add-order', function (req, res) {
    const itemID = req.body['items[]'];
    const quantity = req.body['quantities[]'];
    const tableID = req.body.tableID;
    const userID = req.session.user.id;

    if (!itemID || !quantity || !tableID || !userID) {
        return res.status(400).send('Invalid request data');
    }

    const items = Array.isArray(itemID) ? itemID : [itemID];
    const quantities = Array.isArray(quantity) ? quantity : [quantity];

    db.query('INSERT INTO orders (tableID, userID) VALUES (?, ?)', [tableID, userID], (err, orderResult) => {
        if (err) return res.status(500).send('Database error');

        const orderID = orderResult.insertId;
        let completed = 0;

        items.forEach((id, index) => {
            db.query('INSERT INTO order_items (orderID, itemID, quantity) VALUES (?, ?, ?)', [orderID, id, quantities[index]],(err) => {
                if (err) return res.status(500).send('Database error');

                completed++;

                if (completed === items.length) {
                    db.query('SELECT SUM(price * quantity) AS total FROM menu_items, order_items WHERE order_items.itemID = menu_items.itemID AND orderID = ?', [orderID], (err, totalResult) => {
                        if (err) return res.status(500).send('Database error');

                        // Send to kitchen orders table

                        db.query('INSERT INTO kitchenorders (orderID) VALUES (?)', [orderID], (err) => {
                            if (err) return res.status(500).send('Database error');
                        });

                        const totalPrice = totalResult[0].total || 0;

                        db.query('UPDATE orders SET totalAmount = ? WHERE orderID = ?', [totalPrice, orderID], (err) => {
                            if (err) return res.status(500).send('Database error');
                            res.redirect('/dashboard');
                        });
                    });
                }
            });
        });
    });
});

router.post('/login', function (req, res, next) {

    const username = req.body.username;
    const password = req.body.password;

    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {

        if (err) {

            return res.render('index', {

                message: 'Something went wrong, please try again',
                success: false

            });

        }

        if (results.length === 0) {

            return res.render('index', {message: 'Username not found', success: false});

        }

        if (results[0].password !== password) {

            return res.render('index', { message: 'Incorrect password', success: false });

        } else {

            req.session.user = {

                id: results[0].userID,
                username: results[0].username,
                role: results[0].role

            };
            res.redirect('/dashboard');

        }

    });

});

router.post('/register', function (req, res, next) {

    const username = req.body.username;
    const password = req.body.password;
    const role = req.body.role;

    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {

        if (err) {

            return res.render('register', {
                message: 'Something went wrong, please try again',
                success: false
            });

        }

        if (results.length > 0) {

            return res.render('register', {
                message: 'Username already exists',
                success: false
            });

        }

        if (password.length < 8) {

            return res.render('register', {
                message: 'Password must be at least 8 characters long',
                success: false
            });

        }


        db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, role], (err, results) => {

            if (err) {

                return res.render('register', {
                    message: 'Something went wrong, please try again',
                    success: false
                })

            }

            return res.render('register', {

                message: 'User registered successfully, redirecting...',
                success: true

            });

        });

    });

});

router.post('/get-daily-sales', function (req, res) {

    const inputDate = req.body.date;

    // get sales and number of orders for the requested date and send it to dashboard

    db.query('SELECT sum(totalAmount) as profit, count(*) as total FROM orders WHERE orderDate like ? AND status = "paid"', [`${inputDate}%`], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }

        // get orderID, table number and total amount of each order for the requested date and send it to dashboard

        let ordersCompleted = 0;

        db.query('SELECT orderID, tableID, totalAmount as amount FROM orders WHERE orderDate like ?', [`${inputDate}%`], (err, orders) => {

            if (err) {
                console.error(err);
                return res.status(500).send('Database error');
            }

            if (results.length > 0 && results[0].total > 0) {

                return res.render('dashboard', {
                    user: req.session.user,
                    success: true,
                    dates: inputDate,
                    totalSales: results[0].profit,
                    totalOrders: results[0].total,
                    orderDetails: orders,
                    tables: [],
                    items: []
                });

            }

            return res.render('dashboard', {

                user: req.session.user,
                success: false

            });

        });

    });

});

router.get('/get-pending-orders', function (req, res) {

    db.query('SELECT orders.orderID, orders.tableID, kitchenorders.status, kitchenorders.kitchenID FROM orders, kitchenorders WHERE orders.orderID = kitchenorders.orderID', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }
        res.json(results);
    });

});

router.get('/get-order-details/:orderID', (req, res) => {

    const orderID = req.params.orderID;

    db.query(
        `SELECT
            menu_items.itemName,
            order_items.quantity,
            order_items.status,
            order_items.orderItemID
        FROM order_items
        JOIN menu_items
        ON menu_items.itemID = order_items.itemID
        WHERE order_items.orderID = ?`,
        [orderID],
        (err, results) => {

            if (err) {
                return res.status(500).json({
                    error: 'Database error'
                });
            }

            res.json(results);
        }
    );
});

router.post('/update-order-status', (req, res) => {

    const orderID = req.body.currentOrderID;
    const updateStatusValue = req.body.currentValue;

    db.query('UPDATE kitchenorders SET status = ? WHERE orderID = ?', [updateStatusValue, orderID], (err) => {

        if (err) {

            return res.status(500).send('Database error')

        }

        db.query('UPDATE orders SET status = ? WHERE orderID = ?', [updateStatusValue, orderID], (err) => {

            if (err) {

                return res.status(500).send('Database error');

            }

            res.json({ success: true });

        });

    });

});

router.post('/update-orderItem-status', (req, res) => {

    const orderItemID = req.body.orderItemID;
    const updateStatus = req.body.itemStatusChecked;

    let status = 'uncompleted';

    if (updateStatus) status = 'completed'

    db.query('UPDATE order_items SET status = ? WHERE orderItemID = ?', [status, orderItemID], (err) => {

        if (err) {

            return res.status(500).send('Database error')

        }

        console.log('success');
        res.json({ success: true });

    })

});

router.get('/get-table-data', (req, res) => {

    db.query('SELECT * FROM restaurant_table', (err, results) => {

        if (err) {

            return res.status(500).send('Database error');

        }

        res.json(results);

    });

});

router.post('/update-tableStatus', (req, res) => {

    const status = req.body.statusValue;
    const tableID = req.body.tableID;
    let checkInTime = new Date();


    db.query('UPDATE restaurant_table SET status = ?, checkIN = ? WHERE tableID = ?', [status, checkInTime, tableID], (err) => {

        if (err) {

            return res.status(500).send('Database error')

        }

        res.json({ success: true });

    });

})

router.get('/get-totalAmount/:tableID', (req, res) => {

    const tableID = req.params.tableID;
    let checkIn;

    db.query('SELECT checkIN FROM restaurant_table WHERE tableID = ?', [tableID], (err, results) => {

        if (err) {

            return res.status(500).send('Database error')

        }

        checkIn = results[0].checkIN;

        db.query('SELECT SUM(totalAmount) as total FROM orders WHERE tableID = ? AND orderDate BETWEEN ? AND NOW()', [tableID, checkIn], (err, total) => {

            if (err) {

                return res.status(500).send('Database error')

            }

            res.json({total: total[0].total});

        });

    });

});

router.post('/post-paymentDetail', (req, res) => {

    const total = req.body.total;
    const method = req.body.method;
    const status = 'available';
    const tableID = req.body.tableID;
    let checkIn;

    db.query('INSERT INTO payments (method, amount) VALUES (?, ?)', [method, total], (err) => {

        if (err) {

            return res.status(500).send('Database error')

        }

        db.query('SELECT checkIN FROM restaurant_table WHERE tableID = ?', [tableID], (err, results) => {

            if (err) {

                return res.status(500).send('Database error')

            }

            checkIn = results[0].checkIN;

            db.query('SELECT orderID FROM orders WHERE tableID = ? AND orderDate BETWEEN ? AND NOW()', [tableID, checkIn], (err, details) => {

                if (err) {

                    return res.status(500).send('Database error')

                }

                for (let i = 0; i < details.length; i++) {

                    db.query('UPDATE orders SET status = "paid" WHERE orderID = ?', [details[i].orderID], (err) => {

                        if (err) {

                            return res.status(500).send('Database error')

                        }

                    });

                }

                db.query('UPDATE restaurant_table SET status = ?, checkIN = ? WHERE tableID = ?', [status, null, tableID], (err) => {

                    if (err) {

                        return res.status(500).send('Database error')

                    }

                    res.json({ success: true });

                });

            });

        });

    });

});

module.exports = router;
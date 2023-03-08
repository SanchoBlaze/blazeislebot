const config = require('config');
const mysql = require('mysql');

/**
 * Database class to handle interacting with mysql
 */
class Database {

    constructor() {
        this.connection = mysql.createConnection({
            host: config.get('Database.host'),
            user: config.get('Database.user'),
            password: config.get('Database.password'),
            database: config.get('Database.database'),
        });
        this.connection.connect(function(err) {
            if (err) throw err;
            console.log('Database Connected!');
        });
        /**
            const exists = this.checkTables(table, this.connection).then(function(rows) {
                if(rows) {
                    console.log('Result = true');
                    if(rows.length == 0) {
                        console.log('Result == 0');
                        return false;
                    }
                    console.log(rows);
                    return true;
                }
            }).catch((err) => setImmediate(() => { throw err; }));
        */
    }

    async checkTables(table, connection) {
        return new Promise(function(resolve, reject) {
            connection.query('SHOW TABLES LIKE ?', [table], function(err, rows) {
                if (err) {
                    return reject(err);
                }
                resolve(rows);
            });
        });
    }
}

module.exports = Database;
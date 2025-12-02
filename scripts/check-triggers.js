/* eslint-disable no-console */
const Database = require('better-sqlite3');
const db = new Database('./data/bot.db');
console.log('Tables:');
const tables = db.prepare('SELECT name FROM sqlite_master WHERE type = \'table\'').all();
tables.forEach((t) => console.log('- ' + t.name));

console.log('\nTriggers:');
const triggers = db.prepare('SELECT name, sql FROM sqlite_master WHERE type = \'trigger\'').all();
triggers.forEach((t) => console.log(t.name + ':', t.sql));

db.close();

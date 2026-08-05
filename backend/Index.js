const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test route
app.get('/', (req, res) => {
  res.send('Expense Splitter Backend is running!');
});

// Get all data from users table
app.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add a new user
app.post('/users', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields: name, email, password' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let result;
    try {
      [result] = await pool.query(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [name, email, passwordHash]
      );
    } catch (dbErr) {
      // MySQL ER_DUP_ENTRY
      if (dbErr && dbErr.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Email already exists' });
      }
      throw dbErr;
    }

    const [createdRows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    return res.status(201).json(createdRows[0]);
  } catch (error) {
    console.error('Error adding user:', error);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Get all data from expenses table
app.get('/expenses', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM expenses');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});

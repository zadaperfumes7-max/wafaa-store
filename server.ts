import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import cors from 'cors';

const __dirname = process.cwd();
const PORT = 3000;

// Initialize Database
const db = new Database(path.join(__dirname, 'store.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    imageUrl TEXT,
    category TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' })); // For Base64 images

  // --- API Routes ---

  // Get all products
  app.get('/api/products', (req, res) => {
    try {
      const products = db.prepare('SELECT * FROM products ORDER BY createdAt DESC').all();
      res.json(products);
    } catch (err) {
      console.error('DB Fetch Error:', err);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  // Add product
  app.post('/api/products', (req, res) => {
    try {
      const { name, description, price, imageUrl, category } = req.body;
      const info = db.prepare(
        'INSERT INTO products (name, description, price, imageUrl, category) VALUES (?, ?, ?, ?, ?)'
      ).run(name, description, price, imageUrl, category);
      
      const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
      res.json(newProduct);
    } catch (err) {
      console.error('DB Insert Error:', err);
      res.status(500).json({ error: 'Failed to add product' });
    }
  });

  // Update product
  app.put('/api/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, price, imageUrl, category } = req.body;
      db.prepare(
        'UPDATE products SET name = ?, description = ?, price = ?, imageUrl = ?, category = ? WHERE id = ?'
      ).run(name, description, price, imageUrl, category, id);
      
      const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      res.json(updatedProduct);
    } catch (err) {
      console.error('DB Update Error:', err);
      res.status(500).json({ error: 'Failed to update product' });
    }
  });

  // Delete product
  app.delete('/api/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (err) {
      console.error('DB Delete Error:', err);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  // --- Vite Setup ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();

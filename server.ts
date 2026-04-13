import express from 'express';
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
  
  // Logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  app.use(cors());
  app.use(express.json({ limit: '20mb' })); // Increased limit for high-res Base64

  // --- API Routes ---

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/products', (req, res) => {
    try {
      const products = db.prepare('SELECT * FROM products ORDER BY createdAt DESC').all();
      res.json(products);
    } catch (err: any) {
      console.error('DB Fetch Error:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch products' });
    }
  });

  app.post('/api/products', (req, res) => {
    try {
      const { name, description, price, imageUrl, category } = req.body;
      if (!name || !price) {
        return res.status(400).json({ error: 'Name and Price are required' });
      }
      const info = db.prepare(
        'INSERT INTO products (name, description, price, imageUrl, category) VALUES (?, ?, ?, ?, ?)'
      ).run(name, description, price, imageUrl, category);
      
      const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
      res.json(newProduct);
    } catch (err: any) {
      console.error('DB Insert Error:', err);
      res.status(500).json({ error: err.message || 'Failed to add product' });
    }
  });

  app.put('/api/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, price, imageUrl, category } = req.body;
      db.prepare(
        'UPDATE products SET name = ?, description = ?, price = ?, imageUrl = ?, category = ? WHERE id = ?'
      ).run(name, description, price, imageUrl, category, id);
      
      const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      res.json(updatedProduct);
    } catch (err: any) {
      console.error('DB Update Error:', err);
      res.status(500).json({ error: err.message || 'Failed to update product' });
    }
  });

  app.delete('/api/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error('DB Delete Error:', err);
      res.status(500).json({ error: err.message || 'Failed to delete product' });
    }
  });

  // --- Vite / Static Setup ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('Dist folder not found. Make sure to run npm run build.');
      app.get('*', (req, res) => {
        res.status(404).send('Application not built. Please run build first.');
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});

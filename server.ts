import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import multer from 'multer';
import cors from 'cors';

const __dirname = path.resolve();
const PORT = 3000;

// Initialize Database
const db = new Database('store.db');
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

// Setup Multer for Image Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

  // --- API Routes ---

  // Get all products
  app.get('/api/products', (req, res) => {
    const products = db.prepare('SELECT * FROM products ORDER BY createdAt DESC').all();
    res.json(products);
  });

  // Add product
  app.post('/api/products', (req, res) => {
    const { name, description, price, imageUrl, category } = req.body;
    const info = db.prepare(
      'INSERT INTO products (name, description, price, imageUrl, category) VALUES (?, ?, ?, ?, ?)'
    ).run(name, description, price, imageUrl, category);
    
    const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
    res.json(newProduct);
  });

  // Update product
  app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const { name, description, price, imageUrl, category } = req.body;
    db.prepare(
      'UPDATE products SET name = ?, description = ?, price = ?, imageUrl = ?, category = ? WHERE id = ?'
    ).run(name, description, price, imageUrl, category, id);
    
    const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json(updatedProduct);
  });

  // Delete product
  app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    res.json({ success: true });
  });

  // Upload image
  app.post('/api/upload', upload.single('image'), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
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

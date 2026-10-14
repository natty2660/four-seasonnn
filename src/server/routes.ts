import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
  getDatabase,
  getDatabaseAsync,
  saveDatabase,
  saveDatabaseAsync,
  mutateDatabaseAsync,
  generateAdminToken,
  verifyAdminToken,
  checkAdminPassword,
  setAdminPassword,
  getImageBlob,
  saveImageBlob,
  ensureDatabaseInitialized,
} from './db.ts';
import { buildMenuResponse, validateBirrPrice, DatabaseState } from '../lib/storage.ts';
import { generateQRCodeDataUrl } from '../lib/qr.ts';
import { MenuItem, Category, VipTable, Waiter, WaiterCall, CallType, CallStatus, getCallPriorityWeight } from '../types/index.ts';

export const apiRouter = Router();

// Active Server-Sent Events (SSE) connections for Waiter mobile apps & dashboards
export const sseClients = new Set<Response>();

// Ensure PostgreSQL state is loaded before handling API requests on serverless cold boots
apiRouter.use(async (_req: Request, _res: Response, next: NextFunction) => {
  await ensureDatabaseInitialized().catch(() => {});
  next();
});

// Middleware: Require Admin Authentication
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!verifyAdminToken(authHeader)) {
    res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
    return;
  }
  next();
};

// 1. Health check
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Prime Cafe QR Menu API', timestamp: new Date().toISOString() });
});

// High-Res Image Delivery Endpoint (Serves from disk or fallback to PostgreSQL blobs)
apiRouter.get('/images/:filename', async (req: Request, res: Response) => {
  const rawFilename = req.params.filename || '';
  const decodedRaw = decodeURIComponent(rawFilename);
  const filename = path.basename(decodedRaw);

  if (!filename) {
    res.status(400).send('Filename required');
    return;
  }

  // 1. Check local disk first
  const localPath = path.join(process.cwd(), 'public', 'assets', 'images', filename);
  if (fs.existsSync(localPath)) {
    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    fs.createReadStream(localPath).pipe(res);
    return;
  }

  // 2. Query PostgreSQL prime_cafe_image_blobs
  try {
    const blob = await getImageBlob(filename);
    if (blob && blob.data) {
      res.setHeader('Content-Type', blob.mime_type || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.end(blob.data);
      return;
    }

    // Also check if there is a canonical or timestamped alternate
    const baseName = filename.replace(/\.[^/.]+$/, '');
    const ext = path.extname(filename) || '.jpg';
    // If filename has timestamp, try without; if without, try with
    const cleanPattern = baseName.replace(/_\d{10,}$/, '');
    const altBlob = await getImageBlob(`${cleanPattern}${ext}`);
    if (altBlob && altBlob.data) {
      res.setHeader('Content-Type', altBlob.mime_type || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.end(altBlob.data);
      return;
    }
  } catch (err: any) {
    console.warn(`[API /images] Failed fetching blob for ${filename}:`, err.message);
  }

  res.status(404).setHeader('Content-Type', 'text/plain').send('Image not found');
});

// Database status & PostgreSQL connectivity check
apiRouter.get('/db/status', async (_req: Request, res: Response) => {
  try {
    const { getDatabaseStatus } = await import('./db.ts');
    const status = await getDatabaseStatus();
    res.json(status);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Real-time System Status & Periodic Latency Ping (Database + Waiter App Connection)
apiRouter.get(['/system/status', '/system/ping'], async (_req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { getDatabaseStatus } = await import('./db.ts');
    const dbStatus = await getDatabaseStatus();
    const serverProcessingMs = Date.now() - startTime;
    const db = getDatabase();
    const activeCalls = (db.waiter_calls || []).filter((c) =>
      ['pending', 'hold', 'accepted'].includes(c.status)
    );
    const onDutyWaiters = (db.waiters || []).filter((w) => w.is_on_duty);

    res.json({
      online: true,
      timestamp: new Date().toISOString(),
      server_latency_ms: serverProcessingMs,
      database: dbStatus,
      waiter_connection: {
        status: dbStatus.connected ? 'online' : 'degraded',
        active_calls_count: activeCalls.length,
        on_duty_waiters_count: onDutyWaiters.length,
        sse_clients_count: sseClients.size,
        sync_mode: 'Real-time SSE + Polling Fallback',
        latency_ms: dbStatus.latency_ms || serverProcessingMs,
      },
    });
  } catch (e: any) {
    res.status(500).json({
      online: false,
      error: e.message,
      timestamp: new Date().toISOString(),
      server_latency_ms: Date.now() - startTime,
    });
  }
});

// Resync database with fresh seed and push to PostgreSQL (Admin only)
apiRouter.post('/db/resync', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { getInitialState } = await import('../lib/storage.ts');
    const fresh = getInitialState();
    saveDatabase(fresh);
    res.json({ success: true, message: 'Database resynchronized and updated in PostgreSQL successfully', state: fresh });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Public Menu Fetch by Slug (Single-query fast fetch with resilient slug fallback)
apiRouter.get(['/menu/:slug', '/menu'], (req: Request, res: Response) => {
  const slug = req.params.slug || 'prime-cafe';
  const db = getDatabase();
  let menu = buildMenuResponse(db, slug);

  // If slug requested isn't found, smoothly fallback to the active restaurant's menu
  if (!menu && db.restaurant) {
    menu = buildMenuResponse(db, db.restaurant.slug);
  }

  if (!menu) {
    res.status(404).json({ error: `Menu not found for restaurant slug "${slug}".` });
    return;
  }

  res.json(menu);
});

// 3. Admin Login
apiRouter.post('/admin/login', (req: Request, res: Response) => {
  const { password } = req.body || {};
  if (!password || !checkAdminPassword(password)) {
    res.status(401).json({ message: 'Invalid admin credentials.' });
    return;
  }

  const token = generateAdminToken();
  res.json({
    token,
    role: 'admin',
    message: 'Welcome to Prime Cafe staff portal',
  });
});

// 4. Admin Verify
apiRouter.get('/admin/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (verifyAdminToken(authHeader)) {
    res.json({ valid: true });
  } else {
    res.status(401).json({ valid: false });
  }
});

// 4b. Admin Change Password (Auth required)
apiRouter.post('/admin/change-password', requireAdmin, (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
    res.status(400).json({ error: 'New password must be at least 4 characters.' });
    return;
  }

  // Check current password if provided
  if (currentPassword && !checkAdminPassword(currentPassword)) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }

  const success = setAdminPassword(newPassword.trim());
  if (!success) {
    res.status(500).json({ error: 'Failed to persist new password to database.' });
    return;
  }

  res.json({
    success: true,
    message: 'Admin password successfully updated and persisted to database.',
  });
});

// 5. Get Restaurant Profile
apiRouter.get('/restaurants', (_req: Request, res: Response) => {
  const db = getDatabase();
  res.json(db.restaurant);
});

// 6. Update Restaurant Profile (Auth)
apiRouter.put('/restaurants', requireAdmin, (req: Request, res: Response) => {
  const db = getDatabase();
  const updated = {
    ...db.restaurant,
    ...req.body,
    slug: db.restaurant.slug, // Slug is immutable to preserve QR codes!
    updated_at: new Date().toISOString(),
  };

  db.restaurant = updated;
  saveDatabase(db);
  res.json(db.restaurant);
});

// 7. Update Item Price (Auth & Birr Validation)
apiRouter.put('/items/:id/price', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { price } = req.body;

  const validation = validateBirrPrice(price);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const db = getDatabase();
  const itemIndex = db.items.findIndex((i) => i.id === id);
  if (itemIndex === -1) {
    res.status(404).json({ error: 'Item not found.' });
    return;
  }

  db.items[itemIndex].price = validation.value;
  db.items[itemIndex].updated_at = new Date().toISOString();
  saveDatabase(db);

  res.json(db.items[itemIndex]);
});

// 8. Update Item (Auth)
apiRouter.put('/items/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const itemIndex = db.items.findIndex((i) => i.id === id);

  if (itemIndex === -1) {
    res.status(404).json({ error: 'Item not found.' });
    return;
  }

  if (req.body.price !== undefined) {
    const validation = validateBirrPrice(req.body.price);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }
    req.body.price = validation.value;
  }

  db.items[itemIndex] = {
    ...db.items[itemIndex],
    ...req.body,
    id,
    updated_at: new Date().toISOString(),
  };

  saveDatabase(db);
  res.json(db.items[itemIndex]);
});

// 9. Add or Upsert Item (Auth)
apiRouter.post('/items', requireAdmin, (req: Request, res: Response) => {
  const itemData: MenuItem = req.body;

  if (!itemData.name || itemData.name.trim() === '') {
    res.status(400).json({ error: 'Dish name is required.' });
    return;
  }

  const db = getDatabase();
  const existingIdx = db.items.findIndex((i) => i.id === itemData.id);

  if (existingIdx !== -1) {
    const { price: _p, ...cleanData } = itemData;
    db.items[existingIdx] = {
      ...cleanData,
      updated_at: new Date().toISOString(),
    };
  } else {
    const { price: _p, ...cleanData } = itemData;
    const newItem: MenuItem = {
      ...cleanData,
      id: itemData.id || `item_${Date.now()}`,
      restaurant_id: db.restaurant.id,
      display_order: itemData.display_order || db.items.length + 1,
      is_available: itemData.is_available !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.items.push(newItem);
  }

  saveDatabase(db);
  res.status(201).json({ success: true, items: db.items });
});

// 10. Delete Item (Auth)
apiRouter.delete('/items/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  db.items = db.items.filter((i) => i.id !== id);
  saveDatabase(db);
  res.json({ success: true, remaining: db.items.length });
});

// 11. Sync Entire Item List (Auth)
apiRouter.post('/items/sync', requireAdmin, (req: Request, res: Response) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'Items must be an array.' });
    return;
  }

  const db = getDatabase();
  db.items = items;
  saveDatabase(db);
  res.json({ success: true, count: db.items.length });
});

// 12. Add Category (Auth)
apiRouter.post('/categories', requireAdmin, (req: Request, res: Response) => {
  const catData: Category = req.body;
  if (!catData.name) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }

  const db = getDatabase();
  const newCat: Category = {
    ...catData,
    id: catData.id || `cat_${Date.now()}`,
    restaurant_id: db.restaurant.id,
    display_order: catData.display_order || db.categories.length + 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.categories.push(newCat);
  saveDatabase(db);
  res.status(201).json(newCat);
});

// 13. Sync Categories (Auth)
apiRouter.post('/categories/sync', requireAdmin, (req: Request, res: Response) => {
  const { categories } = req.body;
  if (!Array.isArray(categories)) {
    res.status(400).json({ error: 'Categories must be an array.' });
    return;
  }

  const db = getDatabase();
  db.categories = categories;
  saveDatabase(db);
  res.json({ success: true, count: db.categories.length });
});

// 14. Delete Category (Auth)
apiRouter.delete('/categories/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const hasItems = db.items.some((i) => i.category_id === id);

  if (hasItems) {
    res.status(400).json({ error: 'Cannot delete category that still contains dishes.' });
    return;
  }

  db.categories = db.categories.filter((c) => c.id !== id);
  saveDatabase(db);
  res.json({ success: true });
});

// 15. Server-side QR Generator
apiRouter.get('/qr/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const menuUrl = process.env.PUBLIC_BASE_URL
    ? `${process.env.PUBLIC_BASE_URL}/menu/${slug}`
    : `${protocol}://${host}/menu/${slug}`;

  try {
    const dataUrl = await generateQRCodeDataUrl({
      url: menuUrl,
      size: 1024,
      darkColor: '#0A0A0A',
      lightColor: '#FBF5B7',
    });

    res.json({
      slug,
      url: menuUrl,
      dataUrl,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed generating QR code.' });
  }
});

// 16. Upload Dish Photo - Saves file directly to public/assets/images, src/assets/images, PostgreSQL, and seedData.ts
apiRouter.post('/upload-dish-photo', (req: Request, res: Response) => {
  const { itemId, fileName, dataBase64 } = req.body;
  if (!itemId || !dataBase64) {
    res.status(400).json({ error: 'itemId and dataBase64 are required.' });
    return;
  }

  try {
    const matches = dataBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    const ext = matches ? matches[1].replace('jpeg', 'jpg') : 'jpg';
    const rawData = matches ? matches[2] : dataBase64;
    const buffer = Buffer.from(rawData, 'base64');

    const safeSlug = (fileName || itemId)
      .toLowerCase()
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    const outFileName = `original_${safeSlug}_${itemId.toLowerCase()}.${ext}`;
    const publicDir = path.join(process.cwd(), 'public', 'assets', 'images');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    const targetPath = path.join(publicDir, outFileName);
    fs.writeFileSync(targetPath, buffer);

    // Fast-loading optimization: resize and compress dish photos to web-ready lightweight dimensions
    try {
      execSync(`convert "${targetPath}" -resize 440x440\\> -strip -quality 65 -interlace Plane /tmp/opt_upload.jpg && mv /tmp/opt_upload.jpg "${targetPath}"`);
    } catch {
      // Fallback to original buffer if convert is not available
    }

    const optimizedBuffer = fs.existsSync(targetPath) ? fs.readFileSync(targetPath) : buffer;

    const srcCopyPath = path.join(process.cwd(), 'src', 'assets', 'images', outFileName);
    try {
      if (fs.existsSync(path.dirname(srcCopyPath))) {
        fs.writeFileSync(srcCopyPath, optimizedBuffer);
      }
    } catch {
      // Ignore if src does not exist in production build
    }

    // Also persist directly to PostgreSQL image blobs
    saveImageBlob(outFileName, `image/${ext === 'png' ? 'png' : 'jpeg'}`, optimizedBuffer).catch(() => {});

    const publicUrl = `/assets/images/${outFileName}`;
    const db = getDatabase();
    const item = db.items.find((i) => i.id === itemId);
    if (item) {
      item.image_url = publicUrl;
      saveDatabase(db);
    }

    // Also persist directly into src/data/seedData.ts so future restarts or seeds keep the exact original photo
    try {
      const seedPath = path.join(process.cwd(), 'src', 'data', 'seedData.ts');
      if (fs.existsSync(seedPath)) {
        const seedContent = fs.readFileSync(seedPath, 'utf-8');
        const escapedId = itemId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`("id":\\s*"${escapedId}"[\\s\\S]*?"image_url":\\s*)"[^"]*"`, 'm');
        if (re.test(seedContent)) {
          fs.writeFileSync(seedPath, seedContent.replace(re, `$1"${publicUrl}"`), 'utf-8');
        }
      }
    } catch {
      // Ignore seedData write error in read-only environments
    }

    res.json({ success: true, image_url: publicUrl, itemId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 17. Upload Unedited Confidential Brand Logo & Cropped Wall Photo
apiRouter.post('/upload-brand-asset', (req: Request, res: Response) => {
  const { wallBase64, logoBase64 } = req.body || {};
  if (!wallBase64 && !logoBase64) {
    res.status(400).json({ error: 'wallBase64 or logoBase64 is required.' });
    return;
  }

  try {
    const db = getDatabase();
    const timestamp = Date.now();

    if (wallBase64) {
      const matches = wallBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      const ext = matches ? matches[1].replace('jpeg', 'jpg') : 'jpg';
      const rawData = matches ? matches[2] : wallBase64;
      const buffer = Buffer.from(rawData, 'base64');
      const wallFileName = `four_season_confidential_wall_${timestamp}.${ext}`;

      const publicDir = path.join(process.cwd(), 'public', 'assets', 'images');
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
      fs.writeFileSync(path.join(publicDir, wallFileName), buffer);

      const srcDir = path.join(process.cwd(), 'src', 'assets', 'images');
      if (fs.existsSync(srcDir)) {
        fs.writeFileSync(path.join(srcDir, wallFileName), buffer);
      }

      saveImageBlob(wallFileName, `image/${ext === 'png' ? 'png' : 'jpeg'}`, buffer).catch(() => {});
      db.restaurant.cover_url = `/assets/images/${wallFileName}`;
    }

    if (logoBase64) {
      const matches = logoBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      const ext = matches ? matches[1].replace('jpeg', 'jpg') : 'jpg';
      const rawData = matches ? matches[2] : logoBase64;
      const buffer = Buffer.from(rawData, 'base64');
      const logoFileName = `four_season_confidential_logo_${timestamp}.${ext}`;

      const publicDir = path.join(process.cwd(), 'public', 'assets', 'images');
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
      fs.writeFileSync(path.join(publicDir, logoFileName), buffer);

      const srcDir = path.join(process.cwd(), 'src', 'assets', 'images');
      if (fs.existsSync(srcDir)) {
        fs.writeFileSync(path.join(srcDir, logoFileName), buffer);
      }

      saveImageBlob(logoFileName, `image/${ext === 'png' ? 'png' : 'jpeg'}`, buffer).catch(() => {});
      db.restaurant.logo_url = `/assets/images/${logoFileName}`;
    }

    db.restaurant.updated_at = new Date().toISOString();
    saveDatabase(db);

    res.json({
      success: true,
      restaurant: db.restaurant,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 18. VIP Tables & Waiter Call System Endpoints
// ==========================================

// 18.1 Get All VIP Tables
apiRouter.get('/vip-tables', async (_req: Request, res: Response) => {
  const db = await getDatabaseAsync();
  res.json(db.vip_tables || []);
});

// 18.2 Create VIP Table (Admin)
apiRouter.post('/vip-tables', requireAdmin, async (req: Request, res: Response) => {
  const { table_number, name, secret_code, assigned_waiter_id, notes } = req.body;
  if (!table_number || !name) {
    res.status(400).json({ error: 'table_number and name are required.' });
    return;
  }
  let newTable: VipTable | null = null;
  await mutateDatabaseAsync((db) => {
    if (!Array.isArray(db.vip_tables)) db.vip_tables = [];
    newTable = {
      id: `vip_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      table_number: String(table_number).trim(),
      name: String(name).trim(),
      secret_code: secret_code ? String(secret_code).trim() : undefined,
      assigned_waiter_id: assigned_waiter_id || null,
      is_active: true,
      notes: notes ? String(notes).trim() : '',
      created_at: new Date().toISOString(),
    };
    db.vip_tables.push(newTable);
    return db;
  });

  broadcastWaiterUpdate();
  res.status(201).json(newTable);
});

// 18.3 Update VIP Table (Admin)
apiRouter.put('/vip-tables/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  let updatedTable: VipTable | null = null;
  await mutateDatabaseAsync((db) => {
    if (!Array.isArray(db.vip_tables)) db.vip_tables = [];
    const index = db.vip_tables.findIndex((t) => t.id === id);
    if (index !== -1) {
      db.vip_tables[index] = {
        ...db.vip_tables[index],
        ...req.body,
        id,
      };
      updatedTable = db.vip_tables[index];
    }
    return db;
  });

  if (!updatedTable) {
    res.status(404).json({ error: 'VIP table not found.' });
    return;
  }

  broadcastWaiterUpdate();
  res.json(updatedTable);
});

// 18.4 Delete VIP Table (Admin)
apiRouter.delete('/vip-tables/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  await mutateDatabaseAsync((db) => {
    if (Array.isArray(db.vip_tables)) {
      db.vip_tables = db.vip_tables.filter((t) => t.id !== id);
    }
    return db;
  });

  broadcastWaiterUpdate();
  res.json({ success: true });
});

// 19. Waiters Management
// 19.1 Get All Waiters
apiRouter.get('/waiters', async (_req: Request, res: Response) => {
  const db = await getDatabaseAsync();
  res.json(db.waiters || []);
});

// 19.2 Create Waiter (Permissive & idempotent)
apiRouter.post('/waiters', async (req: Request, res: Response) => {
  const { name, pin, phone } = req.body;
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: 'Waiter name is required.' });
    return;
  }
  const cleanName = String(name).trim();
  let createdWaiter: Waiter | null = null;

  const updatedDb = await mutateDatabaseAsync((db) => {
    if (!Array.isArray(db.waiters)) db.waiters = [];
    // Idempotency: return existing waiter if identical name already exists
    const existing = db.waiters.find((w) => w.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      createdWaiter = existing;
      return db;
    }

    createdWaiter = {
      id: `waiter_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      pin: pin ? String(pin).trim() : '1234',
      phone: phone ? String(phone).trim() : undefined,
      is_on_duty: true,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    db.waiters.push(createdWaiter);
    return db;
  });

  broadcastWaiterUpdate(updatedDb);
  res.status(201).json(createdWaiter);
});

// 19.2b Bulk Sync Waiters (Ensures UI deletions and edits persist permanently to PostgreSQL)
apiRouter.post('/waiters/sync', async (req: Request, res: Response) => {
  const { waiters } = req.body;
  if (!Array.isArray(waiters)) {
    res.status(400).json({ error: 'waiters array is required.' });
    return;
  }

  const updatedDb = await mutateDatabaseAsync((db) => {
    db.waiters = waiters;
    const validWaiterIds = new Set(waiters.map((w: any) => w.id));

    // Clean up foreign-key assignments for any deleted waiters
    if (Array.isArray(db.vip_tables)) {
      db.vip_tables.forEach((t) => {
        if (t.assigned_waiter_id && !validWaiterIds.has(t.assigned_waiter_id)) {
          t.assigned_waiter_id = null;
        }
      });
    }

    // Auto-escalate any active calls originally assigned to deleted waiters
    if (Array.isArray(db.waiter_calls)) {
      db.waiter_calls.forEach((c) => {
        if (c.assigned_waiter_id && !validWaiterIds.has(c.assigned_waiter_id)) {
          c.assigned_waiter_id = null;
          c.is_escalated = true;
        }
      });
    }

    return db;
  });

  broadcastWaiterUpdate(updatedDb);
  res.json({ success: true, waiters: updatedDb.waiters });
});

// 19.3 Update Waiter (Duty toggle or Admin edit)
apiRouter.put('/waiters/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  let updatedWaiter: Waiter | null = null;

  const updatedDb = await mutateDatabaseAsync((db) => {
    if (!Array.isArray(db.waiters)) db.waiters = [];
    const index = db.waiters.findIndex((w) => w.id === id);
    if (index !== -1) {
      db.waiters[index] = {
        ...db.waiters[index],
        ...req.body,
        id,
      };
      updatedWaiter = db.waiters[index];
    }
    return db;
  });

  if (!updatedWaiter) {
    res.status(404).json({ error: 'Waiter not found.' });
    return;
  }

  broadcastWaiterUpdate(updatedDb);
  res.json(updatedWaiter);
});

// 19.4 Delete Waiter - Permanently persisted to PostgreSQL and unassigned from all tables
apiRouter.delete('/waiters/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  let deleted = false;
  let remainingCount = 0;

  const updatedDb = await mutateDatabaseAsync((db) => {
    if (!Array.isArray(db.waiters)) db.waiters = [];
    const prevLen = db.waiters.length;
    db.waiters = db.waiters.filter((w) => w.id !== id);
    deleted = db.waiters.length < prevLen;
    remainingCount = db.waiters.length;

    // Clean up foreign-key association: unassign waiter from all tables
    if (Array.isArray(db.vip_tables)) {
      db.vip_tables.forEach((t) => {
        if (t.assigned_waiter_id === id) {
          t.assigned_waiter_id = null;
        }
      });
    }

    // Unassign and escalate calls from this deleted waiter immediately
    if (Array.isArray(db.waiter_calls)) {
      db.waiter_calls.forEach((c) => {
        if (c.assigned_waiter_id === id) {
          c.assigned_waiter_id = null;
          c.is_escalated = true;
        }
      });
    }

    return db;
  });

  broadcastWaiterUpdate(updatedDb);
  res.json({ success: true, deleted_id: id, remaining: remainingCount, was_found: deleted });
});

// 19.5 Bulk Sync VIP Tables
apiRouter.post('/vip-tables/sync', async (req: Request, res: Response) => {
  const { vip_tables } = req.body;
  if (!Array.isArray(vip_tables)) {
    res.status(400).json({ error: 'vip_tables array is required.' });
    return;
  }

  const updatedDb = await mutateDatabaseAsync((db) => {
    db.vip_tables = vip_tables;
    return db;
  });

  broadcastWaiterUpdate(updatedDb);
  res.json({ success: true, vip_tables: updatedDb.vip_tables });
});

// 20. Live Waiter Calls
// Auto-detect and sync call timeouts (unanswered pending calls >= 60s become 'missed')
export function syncCallTimeouts(calls: WaiterCall[]): void {
  const now = Date.now();
  for (const c of calls) {
    if (c.status === 'pending') {
      const elapsed = now - new Date(c.created_at).getTime();
      if (elapsed >= 60000) {
        c.status = 'missed';
        if (!c.missed_at) c.missed_at = new Date().toISOString();
      }
    }
  }
}

/**
 * Periodically and transactionally checks for calls that have timed out (> 60s unanswered).
 * Commits changes to PostgreSQL / Database and broadcasts update via SSE.
 * Permanently prevents calls from appearing, disappearing, or re-ringing after timeout.
 */
export async function syncAndPersistTimeouts(): Promise<void> {
  const now = Date.now();
  const db = getDatabase();
  const calls = Array.isArray(db.waiter_calls) ? db.waiter_calls : [];
  
  // Fast check: Only mutate the database if there is actually a pending call >= 60 seconds old
  const hasTimedOutCall = calls.some(
    (c) => c.status === 'pending' && now - new Date(c.created_at).getTime() >= 60000
  );
  if (!hasTimedOutCall) {
    return; // Completely skip database transaction when no calls need timeout!
  }

  let timedOutCount = 0;
  const updatedDb = await mutateDatabaseAsync((state) => {
    if (!Array.isArray(state.waiter_calls)) return state;
    for (const c of state.waiter_calls) {
      if (c.status === 'pending') {
        const elapsed = now - new Date(c.created_at).getTime();
        if (elapsed >= 60000) {
          c.status = 'missed';
          if (!c.missed_at) c.missed_at = new Date().toISOString();
          timedOutCount++;
        }
      }
    }
    return state;
  });

  if (timedOutCount > 0) {
    broadcastWaiterUpdate(updatedDb);
  }
}

// Background sweep every 3 seconds to guarantee instant and persistent timeouts
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    syncAndPersistTimeouts().catch(() => {});
  }, 3000);
}

// Helper to sort waiter calls hierarchically: Active status > Priority rank (Urgent > Bill > Order > Water > General) > Newest first
export function sortCallsByPriority(calls: WaiterCall[]): WaiterCall[] {
  syncCallTimeouts(calls);
  return [...calls].sort((a, b) => {
    const statusScore = (s: string) => {
      if (s === 'accepted') return 5000;
      if (s === 'pending') return 4000;
      if (s === 'hold') return 3000;
      if (s === 'missed') return 2000;
      return 1000;
    };
    const scoreDiff = statusScore(b.status) - statusScore(a.status);
    if (scoreDiff !== 0) return scoreDiff;

    const weightA = getCallPriorityWeight(a.call_type);
    const weightB = getCallPriorityWeight(b.call_type);
    if (weightB !== weightA) return weightB - weightA;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// 20.1 List Active & Recent Calls (Pure read: No destructive un-locked mutations on GET)
apiRouter.get('/waiter-calls', async (_req: Request, res: Response) => {
  const db = await getDatabaseAsync();
  const calls = Array.isArray(db.waiter_calls) ? db.waiter_calls : [];
  const now = Date.now();
  const hasTimedOutCall = calls.some(
    (c) => c.status === 'pending' && now - new Date(c.created_at).getTime() >= 60000
  );
  if (hasTimedOutCall) {
    await syncAndPersistTimeouts();
    const freshDb = await getDatabaseAsync();
    res.json(sortCallsByPriority(freshDb.waiter_calls || []));
    return;
  }
  syncCallTimeouts(calls);
  res.json(sortCallsByPriority(calls));
});

// --- Real-Time Server-Sent Events (SSE) Stream for Waiter Dashboard ---

export function broadcastWaiterUpdate(state?: DatabaseState) {
  const db = state || getDatabase();
  const sortedCalls = sortCallsByPriority(db.waiter_calls || []);
  const payload = JSON.stringify({
    type: 'update',
    calls: sortedCalls,
    waiters: db.waiters || [],
    tables: db.vip_tables || [],
    timestamp: new Date().toISOString(),
  });
  const message = `data: ${payload}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
      if (typeof (client as any).flush === 'function') {
        (client as any).flush();
      }
    } catch {
      sseClients.delete(client);
    }
  }
}

// 20.1c Server-Sent Events (SSE) live stream for instant real-time waiter call alerts
apiRouter.get(['/waiter-calls/stream', '/waiter/stream'], async (_req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  const db = await getDatabaseAsync();
  const initial = JSON.stringify({
    type: 'init',
    calls: sortCallsByPriority(db.waiter_calls || []),
    waiters: db.waiters || [],
    tables: db.vip_tables || [],
    timestamp: new Date().toISOString(),
  });
  res.write(`data: ${initial}\n\n`);

  sseClients.add(res);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 15000);

  const cleanup = () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  };

  res.on('close', cleanup);
  res.on('error', cleanup);
});

// 20.1b Waiter Calls Active Endpoint (used by mobile and background polling)
apiRouter.get(['/waiter/calls/active', '/waiter-calls/active'], async (_req: Request, res: Response) => {
  const db = await getDatabaseAsync();
  const calls = Array.isArray(db.waiter_calls) ? db.waiter_calls : [];
  const now = Date.now();
  const hasTimedOutCall = calls.some(
    (c) => c.status === 'pending' && now - new Date(c.created_at).getTime() >= 60000
  );
  if (hasTimedOutCall) {
    await syncAndPersistTimeouts();
    const freshDb = await getDatabaseAsync();
    const freshCalls = Array.isArray(freshDb.waiter_calls) ? freshDb.waiter_calls : [];
    const activeCalls = freshCalls.filter((c) => ['pending', 'accepted', 'hold', 'missed'].includes(c.status));
    res.json({ calls: sortCallsByPriority(activeCalls) });
    return;
  }
  syncCallTimeouts(calls);
  const activeCalls = calls.filter((c) => ['pending', 'accepted', 'hold', 'missed'].includes(c.status));
  res.json({ calls: sortCallsByPriority(activeCalls) });
});

// 20.3b Call dismiss aliases
apiRouter.post(
  ['/waiter/calls/:id/dismiss', '/waiter-calls/:id/dismiss'],
  async (req: Request, res: Response) => {
    const { id } = req.params;
    let targetCall: WaiterCall | null = null;

    const updatedDb = await mutateDatabaseAsync((db) => {
      if (!Array.isArray(db.waiter_calls)) db.waiter_calls = [];
      const call = db.waiter_calls.find((c) => c.id === id);
      if (call) {
        call.status = 'cancelled';
        call.completed_at = new Date().toISOString();
        targetCall = call;
      }
      return db;
    });

    if (!targetCall) {
      res.json({ success: true, message: 'Call already cleared' });
      return;
    }

    broadcastWaiterUpdate(updatedDb);
    res.json(targetCall);
  }
);

// 20.2 Place Call from VIP Table (Idempotent & Deduplicated)
apiRouter.post('/waiter-calls', async (req: Request, res: Response) => {
  const { table_id, call_type = 'general', message = '' } = req.body;
  if (!table_id) {
    res.status(400).json({ error: 'table_id is required.' });
    return;
  }

  const defaultMessages: Record<string, string> = {
    general: 'VIP staff assistance requested',
    order: 'Ready to order dishes / food request',
    water: 'Water & drink refill requested',
    bill: 'Bill & payment receipt requested',
    urgent: 'URGENT assistance needed immediately!',
  };
  const cleanMessage =
    String(message || '').trim() ||
    defaultMessages[call_type] ||
    'Assistance requested';

  let finalCall: WaiterCall | null = null;
  let isNew = false;

  const updatedDb = await mutateDatabaseAsync((db) => {
    if (!Array.isArray(db.waiter_calls)) db.waiter_calls = [];
    const normalizedTableId = String(table_id || '').toLowerCase().trim();
    const table = (db.vip_tables || []).find(
      (t) =>
        t.id.toLowerCase() === normalizedTableId ||
        t.table_number.toLowerCase() === normalizedTableId ||
        t.table_number.toLowerCase().replace('-', '') === normalizedTableId.replace('-', '')
    );
    if (!table) {
      return db;
    }

    // Verify assigned waiter actually exists in staff roster and is active
    const assignedStaff = (db.waiters || []).find(
      (w) => w.id === table.assigned_waiter_id && w.is_active
    );
    const validAssignedWaiterId = assignedStaff ? assignedStaff.id : null;
    const isUrgent = call_type === 'urgent';

    // Check if the assigned waiter is currently on call with another customer
    const isWaiterBusyWithAnotherCustomer = (db.waiter_calls || []).some((c) => {
      if (c.status !== 'accepted') return false;
      // Is it a DIFFERENT table?
      if (c.table_id === table.id || c.table_number === table.table_number) return false;
      if (validAssignedWaiterId) {
        return (
          c.accepted_by_waiter_id === validAssignedWaiterId ||
          c.assigned_waiter_id === validAssignedWaiterId
        );
      }
      return false; // If unassigned, floor staff on duty can accept it
    });

    const initialStatus: CallStatus = isWaiterBusyWithAnotherCustomer ? 'hold' : 'pending';

    // Archive / complete any previous pending, hold, or missed call for this table
    db.waiter_calls.forEach((c) => {
      if (
        (c.table_id === table.id || c.table_number === table.table_number) &&
        (c.status === 'pending' || c.status === 'hold' || c.status === 'missed')
      ) {
        c.status = 'completed';
        c.completed_at = new Date().toISOString();
      }
    });

    const newCall: WaiterCall = {
      id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      table_id: table.id,
      table_number: table.table_number,
      table_name: table.name,
      call_type: call_type as CallType,
      message: cleanMessage,
      status: initialStatus,
      assigned_waiter_id: validAssignedWaiterId,
      is_escalated: isUrgent || !validAssignedWaiterId || !assignedStaff?.is_on_duty,
      original_waiter_id: validAssignedWaiterId,
      created_at: new Date().toISOString(),
      held_at: initialStatus === 'hold' ? new Date().toISOString() : null,
      hold_reason: initialStatus === 'hold' ? 'Waiter currently attending another customer' : null,
    };

    db.waiter_calls.unshift(newCall);
    finalCall = newCall;
    isNew = true;
    return db;
  });

  if (!finalCall) {
    res.status(404).json({ error: 'VIP table not found.' });
    return;
  }

  broadcastWaiterUpdate(updatedDb);
  res.status(isNew ? 201 : 200).json(finalCall);
});

// 20.3 Waiter Accepts Call (Supports all endpoint aliases; places on hold if waiter is already in accepted status)
apiRouter.post(
  ['/waiter-calls/:id/accept', '/waiter/calls/:id/accept'],
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { waiter_id, waiter_name, force_hold, hold_reason } = req.body;
    let resultingCall: WaiterCall | null = null;

    const updatedDb = await mutateDatabaseAsync((db) => {
      if (!Array.isArray(db.waiter_calls)) db.waiter_calls = [];
      const call = db.waiter_calls.find((c) => c.id === id);
      if (call) {
        if (call.status !== 'completed' && call.status !== 'cancelled') {
          // Check if this waiter is already in 'accepted' status for another active call
          const alreadyAttendingCall = waiter_id
            ? db.waiter_calls.find(
                (c) =>
                  c.id !== id &&
                  c.status === 'accepted' &&
                  (c.accepted_by_waiter_id === waiter_id || c.assigned_waiter_id === waiter_id)
              )
            : null;

          if (alreadyAttendingCall || force_hold) {
            call.status = 'hold';
            call.held_at = new Date().toISOString();
            call.hold_reason =
              hold_reason ||
              `Waiter ${waiter_name || 'Staff'} is attending Table ${alreadyAttendingCall?.table_number || ''}`;
            call.accepted_by_waiter_id = waiter_id || call.accepted_by_waiter_id;
            call.accepted_by_name = waiter_name || call.accepted_by_name || 'Staff Member';
          } else {
            call.status = 'accepted';
            call.accepted_by_waiter_id = waiter_id || null;
            call.accepted_by_name = waiter_name || 'Staff Member';
            call.accepted_at = new Date().toISOString();
            call.held_at = null;
            call.hold_reason = null;
          }
        }
        resultingCall = call;
      }
      return db;
    });

    if (!resultingCall) {
      res.status(404).json({ error: 'Call not found.' });
      return;
    }

    broadcastWaiterUpdate(updatedDb);
    res.json(resultingCall);
  }
);

// 20.3b Waiter Places Call on HOLD (Explicit hold route)
apiRouter.post(
  ['/waiter-calls/:id/hold', '/waiter/calls/:id/hold'],
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { waiter_id, waiter_name, hold_reason } = req.body;
    let heldCall: WaiterCall | null = null;

    const updatedDb = await mutateDatabaseAsync((db) => {
      if (!Array.isArray(db.waiter_calls)) db.waiter_calls = [];
      const call = db.waiter_calls.find((c) => c.id === id);
      if (call) {
        if (call.status !== 'completed' && call.status !== 'cancelled') {
          call.status = 'hold';
          call.held_at = new Date().toISOString();
          call.hold_reason = hold_reason || 'Waiter currently attending another customer';
          if (waiter_id) call.accepted_by_waiter_id = waiter_id;
          if (waiter_name) call.accepted_by_name = waiter_name;
        }
        heldCall = call;
      }
      return db;
    });

    if (!heldCall) {
      res.status(404).json({ error: 'Call not found.' });
      return;
    }

    broadcastWaiterUpdate(updatedDb);
    res.json(heldCall);
  }
);

// 20.4 Complete Call (Supports all endpoint aliases and releases next held call)
apiRouter.post(['/waiter-calls/:id/complete', '/waiter/calls/:id/complete'], async (req: Request, res: Response) => {
  const { id } = req.params;
  let completedCall: WaiterCall | null = null;

  const updatedDb = await mutateDatabaseAsync((db) => {
    if (!Array.isArray(db.waiter_calls)) db.waiter_calls = [];
    const call = db.waiter_calls.find((c) => c.id === id);
    if (call) {
      call.status = 'completed';
      call.completed_at = new Date().toISOString();
      completedCall = call;

      // Automatically promote next queued held call to active ringing ('pending')
      const nextHeldCall = db.waiter_calls.find(
        (c) =>
          c.status === 'hold' &&
          (!c.assigned_waiter_id ||
            c.assigned_waiter_id === call.accepted_by_waiter_id ||
            c.accepted_by_waiter_id === call.accepted_by_waiter_id ||
            c.is_escalated)
      );
      if (nextHeldCall) {
        nextHeldCall.status = 'pending';
        nextHeldCall.held_at = null;
        nextHeldCall.hold_reason = null;
      }
    }
    return db;
  });

  if (!completedCall) {
    res.status(404).json({ error: 'Call not found.' });
    return;
  }

  broadcastWaiterUpdate(updatedDb);
  res.json(completedCall);
});

// 20.5 Cancel Call (Supports all endpoint aliases)
apiRouter.post(['/waiter-calls/:id/cancel', '/waiter/calls/:id/cancel'], async (req: Request, res: Response) => {
  const { id } = req.params;
  let cancelledCall: WaiterCall | null = null;

  const updatedDb = await mutateDatabaseAsync((db) => {
    if (!Array.isArray(db.waiter_calls)) db.waiter_calls = [];
    const call = db.waiter_calls.find((c) => c.id === id);
    if (call) {
      call.status = 'cancelled';
      call.completed_at = new Date().toISOString();
      cancelledCall = call;
    }
    return db;
  });

  if (!cancelledCall) {
    res.status(404).json({ error: 'Call not found.' });
    return;
  }

  broadcastWaiterUpdate(updatedDb);
  res.json(cancelledCall);
});

// 20.6 Clear History (Admin)
apiRouter.delete('/waiter-calls/history', requireAdmin, async (_req: Request, res: Response) => {
  let remainingCount = 0;
  await mutateDatabaseAsync((db) => {
    if (Array.isArray(db.waiter_calls)) {
      db.waiter_calls = db.waiter_calls.filter(
        (c) => c.status === 'pending' || c.status === 'accepted'
      );
      remainingCount = db.waiter_calls.length;
    }
    return db;
  });

  broadcastWaiterUpdate();
  res.json({ success: true, remaining: remainingCount });
});

// 21. Device Push Tokens
const registeredDevices = new Map<
  string,
  { waiter_id: string; token: string; platform: string; updated_at: string }
>();

apiRouter.post('/waiter-push-tokens', (req: Request, res: Response) => {
  const { waiter_id, token, platform = 'web' } = req.body;
  if (!waiter_id || !token) {
    res.status(400).json({ error: 'waiter_id and token are required.' });
    return;
  }
  registeredDevices.set(`${waiter_id}_${platform}`, {
    waiter_id,
    token,
    platform,
    updated_at: new Date().toISOString(),
  });
  res.json({
    success: true,
    message: 'Native device registered successfully for high-priority incoming calls',
    total_registered: registeredDevices.size,
  });
});

apiRouter.get('/waiter-push-tokens', (_req: Request, res: Response) => {
  res.json(Array.from(registeredDevices.values()));
});



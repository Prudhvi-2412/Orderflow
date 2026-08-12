import { pool } from '../config/db.js';

export async function seedDatabase() {
  console.log('🌱 Seeding initial products and inventory...');
  try {
    // Seed Users
    await pool.query(`
      INSERT INTO users (email, name)
      VALUES 
        ('alex.dev@example.com', 'Alex Developer'),
        ('sarah.tech@example.com', 'Sarah Tech')
      ON CONFLICT (email) DO NOTHING;
    `);

    // Seed Products
    await pool.query(`
      INSERT INTO products (sku, name, price)
      VALUES 
        ('ITEM-IPHONE-15', 'iPhone 15 Pro Max', 999.00),
        ('ITEM-GPU-4090', 'NVIDIA RTX 4090 GPU', 1599.00),
        ('ITEM-MACBOOK-M3', 'MacBook Pro M3 Max', 2499.00),
        ('ITEM-AIRPODS-PRO', 'AirPods Pro 2', 249.00)
      ON CONFLICT (sku) DO NOTHING;
    `);

    // Seed Inventory
    await pool.query(`
      INSERT INTO inventory (sku, stock_quantity, version)
      VALUES 
        ('ITEM-IPHONE-15', 5, 1),
        ('ITEM-GPU-4090', 3, 1),
        ('ITEM-MACBOOK-M3', 10, 1),
        ('ITEM-AIRPODS-PRO', 50, 1)
      ON CONFLICT (sku) DO UPDATE SET stock_quantity = EXCLUDED.stock_quantity;
    `);

    console.log('✅ PostgreSQL Database seeding completed.');
  } catch (err: any) {
    console.error('❌ Seeding Error:', err.message);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].includes('seed.ts')) {
  seedDatabase();
}

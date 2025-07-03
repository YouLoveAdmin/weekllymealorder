-- Migration to add timestamp columns to orders table
-- Run this after the initial schema has been applied

-- Add timestamp columns to orders table
ALTER TABLE orders ADD COLUMN created_at TEXT;
ALTER TABLE orders ADD COLUMN updated_at TEXT;

-- Create indexes for better performance on timestamp queries
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_updated_at ON orders(updated_at);

-- Optional: Add timestamp columns to other tables for audit trail
ALTER TABLE users ADD COLUMN created_at TEXT;
ALTER TABLE meal_variants ADD COLUMN created_at TEXT;
ALTER TABLE options ADD COLUMN created_at TEXT;
ALTER TABLE option_values ADD COLUMN created_at TEXT;
ALTER TABLE meal_order_pricing_rules ADD COLUMN created_at TEXT;

-- Add delivery locations table
CREATE TABLE delivery_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
);

-- Add delivery_location_id to orders table
ALTER TABLE orders ADD COLUMN delivery_location_id INTEGER REFERENCES delivery_locations(id);

-- Add preferred_delivery_location_id to users table
ALTER TABLE users ADD COLUMN preferred_delivery_location_id INTEGER REFERENCES delivery_locations(id);

-- Insert some sample delivery locations
INSERT INTO delivery_locations (name, address, is_active, created_at, updated_at) VALUES
('Main Office', '123 Main St, Suite 100', 1, datetime('now'), datetime('now')),
('North Branch', '456 North Ave, Floor 2', 1, datetime('now'), datetime('now')),
('South Branch', '789 South Blvd, Building A', 1, datetime('now'), datetime('now')),
('Downtown Office', '321 Downtown Plaza, 15th Floor', 1, datetime('now'), datetime('now'));

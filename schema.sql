PRAGMA foreign_keys = ON;
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);
-- Admin users table
CREATE TABLE admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- Meals table (versioned)
CREATE TABLE meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL,
    UNIQUE(ref_id, version),
    UNIQUE(ref_id)
);
-- Meal variants table (versioned)
CREATE TABLE meal_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_ref_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL, -- price in cents
    calories INTEGER,
    is_active INTEGER NOT NULL,
    UNIQUE(meal_ref_id, version, name),
    FOREIGN KEY(meal_ref_id) REFERENCES meals(ref_id)
);
-- Options table (versioned option groups)
CREATE TABLE options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    name TEXT NOT NULL,
    is_required INTEGER NOT NULL,
    is_multi_select INTEGER NOT NULL,
    is_active INTEGER NOT NULL,
    UNIQUE(ref_id, version),
    UNIQUE(ref_id)
);
-- Option values table (versioned option values)
CREATE TABLE option_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    option_ref_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    name TEXT NOT NULL,
    extra_cost INTEGER NOT NULL, -- extra cost in cents
    is_active INTEGER NOT NULL,
    UNIQUE(option_ref_id, version, name),
    FOREIGN KEY(option_ref_id) REFERENCES options(ref_id)
);
-- Linking table between meals and options
CREATE TABLE meal_options (
    meal_ref_id INTEGER NOT NULL,
    option_ref_id INTEGER NOT NULL,
    PRIMARY KEY (meal_ref_id, option_ref_id),
    FOREIGN KEY(meal_ref_id) REFERENCES meals(ref_id) ON DELETE CASCADE,
    FOREIGN KEY(option_ref_id) REFERENCES options(ref_id) ON DELETE CASCADE
);
-- Order weeks table
CREATE TABLE order_weeks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start_date TEXT NOT NULL,
    week_end_date TEXT NOT NULL,
    is_open INTEGER NOT NULL,
    cutoff_date TEXT NOT NULL
);
-- Orders table
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    order_week_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    total_price INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(order_week_id) REFERENCES order_weeks(id)
);
-- Order items table
CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    meal_variant_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    base_price INTEGER NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(meal_variant_id) REFERENCES meal_variants(id)
);
-- Order item options table (selected options for an order item)
CREATE TABLE order_item_options (
    order_item_id INTEGER NOT NULL,
    option_value_id INTEGER NOT NULL,
    PRIMARY KEY (order_item_id, option_value_id),
    FOREIGN KEY(order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
    FOREIGN KEY(option_value_id) REFERENCES option_values(id)
);
-- Meal order pricing rules table
CREATE TABLE meal_order_pricing_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_variant_id INTEGER NOT NULL,
    min_total_quantity INTEGER NOT NULL,
    price_per_unit INTEGER NOT NULL,
    FOREIGN KEY(meal_variant_id) REFERENCES meal_variants(id)
);
-- Seed Data
-- Users and admin users
INSERT INTO users (name, email) VALUES
('Alice Admin', 'alice@example.com'),
('Bob Manager', 'bob@example.com');
INSERT INTO admin_users (user_id, role, is_active) VALUES
(1, 'admin', 1),
(2, 'admin', 1);
-- Option groups and values
INSERT INTO options (ref_id, version, name, is_required, is_multi_select, is_active) VALUES
(1, 1, 'Spice Level', 1, 0, 1),
(2, 1, 'Add Sauce', 0, 0, 1);
INSERT INTO option_values (option_ref_id, version, name, extra_cost, is_active) VALUES
(1, 1, 'Mild', 0, 1),
(1, 1, 'Medium', 0, 1),
(1, 1, 'Hot', 0, 1),
(2, 1, 'BBQ Sauce', 100, 1);
-- Meals and variants
INSERT INTO meals (ref_id, version, name, description, is_active) VALUES
(1, 1, 'Grilled Chicken Salad', 'Fresh salad with grilled chicken, veggies, and dressing', 1),
(2, 1, 'Beef Taco', 'Spicy ground beef taco with lettuce, tomato, and cheese', 1),
(3, 1, 'Veggie Pasta', 'Pasta with seasonal vegetables in a light sauce', 1);
INSERT INTO meal_variants (meal_ref_id, version, name, price, calories, is_active) VALUES
-- Variants for Meal 1 (Grilled Chicken Salad)
(1, 1, 'Small', 1000, 300, 1),
(1, 1, 'Medium', 1500, 450, 1),
(1, 1, 'Large', 2000, 600, 1),
-- Variants for Meal 2 (Beef Taco)
(2, 1, 'Small', 800, 250, 1),
(2, 1, 'Medium', 1200, 400, 1),
(2, 1, 'Large', 1600, 550, 1),
-- Variants for Meal 3 (Veggie Pasta)
(3, 1, 'Small', 900, 200, 1),
(3, 1, 'Medium', 1300, 350, 1),
(3, 1, 'Large', 1700, 500, 1);
-- Link option groups to meals
INSERT INTO meal_options (meal_ref_id, option_ref_id) VALUES
(1, 1), (1, 2),
(2, 1), (2, 2),
(3, 1), (3, 2);
-- Active order week
INSERT INTO order_weeks (week_start_date, week_end_date, is_open, cutoff_date) VALUES
('2025-06-30', '2025-07-04', 1, '2025-07-02');
-- Sample pricing rule (e.g., discount for bulk order of Small Grilled Chicken Salad)
INSERT INTO meal_order_pricing_rules (meal_variant_id, min_total_quantity, price_per_unit) VALUES
(1, 3, 900);

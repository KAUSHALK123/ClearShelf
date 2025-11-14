-- Create an admin user (you'll need to sign up with this email first, then run this)
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@smartshelf.com';

-- Sample products for testing
INSERT INTO products (name, brand, category, default_mrp, gtin) VALUES
('Amul Toned Milk 1L', 'Amul', 'Dairy', 60, '8901234567890'),
('Bread - Whole Wheat', 'Modern', 'Bakery', 45, '8901234567891'),
('Chips - Classic Salted', 'Lays', 'Snacks', 20, '8901234567892'),
('Fresh Paneer 200g', 'Mother Dairy', 'Dairy', 85, '8901234567893'),
('Orange Juice 1L', 'Real', 'Beverages', 120, '8901234567894'),
('Butter 100g', 'Amul', 'Dairy', 55, '8901234567895'),
('Cookies - Chocolate Chip', 'Britannia', 'Snacks', 30, '8901234567896'),
('Yogurt 400g', 'Nestle', 'Dairy', 65, '8901234567897'),
('Green Tea Bags', 'Lipton', 'Beverages', 150, '8901234567898'),
('Pasta - Penne 500g', 'Barilla', 'Groceries', 180, '8901234567899')
ON CONFLICT (gtin) DO NOTHING;

-- Note: To create test shops and inventory, you'll need to:
-- 1. Sign up as a shopkeeper
-- 2. Create your shop
-- 3. Have an admin approve it
-- 4. Then add products either manually or by scanning
# SmartShelf - Complete Feature Demo Guide

## 🎯 Overview
SmartShelf is a full-stack food waste reduction platform connecting shopkeepers with customers through smart discounts on near-expiry products.

---

## 🚀 Quick Start Demo (10 minutes)

### Step 1: Create Test Accounts (3 min)

#### 1.1 Create Admin Account
1. Sign up at `/auth` with:
   - Email: `admin@smartshelf.com`
   - Password: `admin123`
   - Role: Customer (we'll upgrade it)

2. **Upgrade to Admin** (run in Backend SQL Editor):
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'admin@smartshelf.com';
```

#### 1.2 Create Shopkeeper Account
1. Sign up with:
   - Name: `Raj's Store`
   - Email: `shopkeeper@test.com`
   - Password: `shop123`
   - Phone: `9876543210`
   - Role: **Shopkeeper**

#### 1.3 Create Customer Account
1. Sign up with:
   - Name: `Customer Test`
   - Email: `customer@test.com`
   - Password: `cust123`
   - Role: **Customer**

---

### Step 2: Admin Workflow (2 min)

1. **Login as Admin** (`admin@smartshelf.com`)
2. Navigate to `/admin`
3. You'll see Raj's Store in "Pending Verifications"
4. Click **"Approve"** to verify the shop
5. ✅ Shop is now live!

---

### Step 3: Shopkeeper Workflow (3 min)

1. **Login as Shopkeeper** (`shopkeeper@test.com`)
2. **Complete Shop Setup:**
   - Shop Name: `Raj's Grocery Store`
   - Address: `123 MG Road, Bangalore`
   - Latitude: `12.9716` (Bangalore coordinates)
   - Longitude: `77.5946`
   - GST: `29ABCDE1234F1Z5` (optional)
   
3. **Add Products - Method 1: Manual Entry**
   - Click "Add Product"
   - Fill in product details:
     - Product: `Amul Toned Milk 1L`
     - Brand: `Amul`
     - Category: `Dairy`
     - MRP: `60`
     - Batch Code: `B1234`
     - Quantity: `24`
     - Expiry Date: *Set 25 days from today*
   - Click "Add Product"
   - ✅ **Auto-discount of 10% applied!** (because it expires in <30 days)

4. **Add Products - Method 2: AI Scanning**
   - Click "Scan Product"
   - Upload a product image (photo of any packaged product)
   - AI extracts:
     - Product name
     - Brand
     - Expiry date
     - Barcode (if visible)
     - Price
   - Review extracted data
   - Click "Add to Inventory"
   
5. **View Dashboard:**
   - Total Items count
   - Expiring Soon count
   - Monthly Revenue
   - Full inventory table with real-time updates

---

### Step 4: Customer Workflow (2 min)

1. **Login as Customer** (`customer@test.com`)

2. **Explore Map View:**
   - See all verified stores as cards
   - Each store shows:
     - Available discount deals
     - Top discounted products
     - Store location

3. **Browse Product Feed:**
   - Click "Products" tab
   - See all discounted items across all stores
   - Search by product name, brand, or category
   - Each product shows:
     - Original price (strikethrough)
     - Discounted price
     - Discount percentage
     - Days to expiry
     - Stock quantity
     - Store name

4. **Add to Wishlist:**
   - Click the **Heart icon** on any product
   - Product is added to wishlist
   - You'll receive notifications when it gets discounted!

5. **Check Notifications:**
   - Click the **Bell icon** (top right)
   - See real-time notifications
   - Unread count badge shows new alerts

6. **View Wishlist:**
   - Click "Wishlist" tab
   - See all saved products
   - Check which ones have active discounts
   - Remove products by clicking trash icon

---

## 🎨 Key Features Demonstrated

### ✅ Real-Time Updates
- Add a product as shopkeeper
- Immediately visible to customers (no refresh needed!)
- Powered by Supabase Realtime subscriptions

### ✅ Smart Auto-Discounts
Products automatically get discounts based on expiry:
- **30-15 days**: 10% OFF
- **15-7 days**: 20% OFF  
- **<7 days**: 30% OFF

### ✅ AI-Powered OCR Scanning
- Upload product image
- AI (Lovable AI with Gemini 2.5 Flash) extracts:
  - Product name & brand
  - Expiry date
  - Barcode/GTIN
  - Batch code
  - Price
- Confidence scores for accuracy

### ✅ Wishlist Notifications
1. Customer adds product to wishlist
2. Shopkeeper updates inventory (discount increases)
3. Customer receives instant notification: "Discount Alert!"
4. Notification shows in bell icon

### ✅ Admin Verification
- Shopkeepers must be approved before going live
- Prevents fake accounts
- Admin sees all pending shops with owner details

---

## 📊 Architecture Highlights

### Database Schema
```
Users (Supabase Auth)
  ↓
Profiles (customer/shopkeeper/admin)
  ↓
Shops (with verification status)
  ↓
Products (with GTIN barcodes)
  ↓
Inventory Batches (with auto-discounts)
  ↓
Transactions, Wishlists, Notifications
```

### Security (Row Level Security)
- ✅ Customers can only see verified shops
- ✅ Shopkeepers can only manage their own inventory
- ✅ Users can only edit their own profiles
- ✅ Admins have special verification permissions

### Real-Time Features
- **Inventory updates**: Via Supabase Realtime
- **Notifications**: Auto-created by database triggers
- **Wishlist alerts**: Triggered when discounts increase

---

## 🔧 Technical Stack

**Frontend:**
- React + TypeScript + Vite
- Tailwind CSS (custom green theme)
- shadcn/ui components
- TanStack Query for data fetching

**Backend:**
- Lovable Cloud (Supabase)
- PostgreSQL database
- Row-Level Security policies
- Database triggers & functions
- Edge Functions (Deno)

**AI/ML:**
- Lovable AI Gateway
- Google Gemini 2.5 Flash for OCR
- Vision API for product extraction

---

## 🧪 Testing Scenarios

### Scenario 1: Expiry-Based Discounts
1. Add product expiring in 25 days → 10% discount
2. Add product expiring in 10 days → 20% discount
3. Add product expiring in 5 days → 30% discount

### Scenario 2: Wishlist Notifications
1. Customer adds product to wishlist
2. Shopkeeper manually updates discount to 20%
3. Customer receives notification instantly

### Scenario 3: Multi-Store Discovery
1. Create 2-3 shopkeeper accounts
2. Each creates shops in different locations
3. Add products to each
4. Customer sees all stores on map
5. Filter products by search

### Scenario 4: OCR Accuracy Test
Upload different product images:
- Clear product labels → High confidence (>90%)
- Blurry images → Lower confidence (<70%)
- Multiple products → May detect one
- Test edit functionality for incorrect extractions

---

## 📈 Future Enhancements (Not Yet Implemented)

### Phase 2 Features:
- [ ] Demand forecasting ML model
- [ ] POS integration for automatic stock updates
- [ ] Stripe payment for reservations
- [ ] Customer reviews & ratings UI
- [ ] Eco-impact tracker (food saved, CO2 reduced)
- [ ] Advanced analytics charts
- [ ] Push notifications via FCM
- [ ] SMS alerts for customers

### Phase 3 Features:
- [ ] Mobile app (React Native)
- [ ] Store locator with GPS
- [ ] QR code generation for products
- [ ] Loyalty points system
- [ ] Bulk scanning (multiple products at once)
- [ ] API for third-party integrations

---

## 🐛 Troubleshooting

### Issue: Can't see products as customer
**Solution:** Make sure the shop is verified by admin

### Issue: OCR not extracting data correctly
**Solution:** 
- Use clear, well-lit product images
- Ensure text is readable
- Edit extracted data before confirming

### Issue: Notifications not appearing
**Solution:** 
- Check if wishlist item has discount
- Trigger must have discount increase
- Check browser console for errors

### Issue: Real-time updates not working
**Solution:**
- Check internet connection
- Reload page
- Check Supabase Realtime status

---

## 📞 Support

For issues or questions:
1. Check Backend logs (Lovable Cloud tab)
2. Check browser console for errors
3. Review database RLS policies
4. Check edge function logs

---

## 🎉 Success Criteria

You've successfully tested SmartShelf if:
- ✅ Admin can approve shopkeepers
- ✅ Shopkeepers can add products (manual + scan)
- ✅ Products auto-apply discounts
- ✅ Customers see stores on map
- ✅ Wishlist notifications work
- ✅ Real-time updates are instant
- ✅ All roles have proper access control

**Congratulations! SmartShelf MVP is fully operational! 🎊**
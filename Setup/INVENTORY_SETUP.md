# Inventory Management System Setup Guide

## Overview

This inventory management system is designed to replace your Google Sheets workflow with a modern, database-driven solution. It supports all the features from your Excel sheet including Master Rolls, Convertable Stock, Ready for Dispatch, and Cut & Roll tracking.

## Features

✅ **Complete Inventory Management**
- Track items with Serial Numbers, Dates, and Item Names
- Master Rolls with multiple dimensions (36*600, 20*300, etc.)
- Convertable Stock (Front, 5 Str, 7-str, Balance)
- Ready for Dispatch tracking with Rack Locations
- Cut & Roll operations tracking

✅ **Excel Import**
- Import your existing Excel/CSV files directly
- Automatic parsing and data import
- Error handling and reporting

✅ **User-Friendly Interface**
- Clean, modern design matching your workflow
- Search functionality
- Easy add/edit/delete operations
- Responsive design

## Setup Steps

### Step 1: Apply Database Schema

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open `inventory-schema.sql`
4. Copy the entire contents
5. Paste into SQL Editor
6. Click **Run** to execute

This will create the following tables:
- `inventory_items` - Main inventory items
- `master_rolls` - Master roll dimensions and quantities
- `convertable_stock` - Convertable stock levels
- `ready_for_dispatch` - Items ready for dispatch
- `cut_and_roll` - Cut and roll operations

### Step 2: Verify Installation

After running the SQL, verify the tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('inventory_items', 'master_rolls', 'convertable_stock', 'ready_for_dispatch', 'cut_and_roll')
ORDER BY table_name;
```

### Step 3: Access the Inventory Page

1. Navigate to `/dashboard/management/products` in your application
2. You should see the new inventory management interface

## How to Use

### Adding Items Manually

1. Click the **"Add Item"** button
2. Fill in:
   - Serial Number (optional)
   - Item Name (required)
   - Date (optional, defaults to today)
3. Click **"Add Item"** to save

### Importing from Excel

1. Click the **"Import Excel"** button
2. Select your Excel file (.xlsx, .xls, or .csv)
3. The system will automatically:
   - Parse the file
   - Extract item data
   - Import into the database
4. You'll see a success message with the number of items imported

**Excel File Format:**
- First row should be headers
- Columns: Date, Sr No, Item Name, [Master Rolls...], [Convertable Stock...], etc.
- The system will automatically detect and parse the structure

### Searching Items

- Use the search bar to find items by:
  - Item name
  - Serial number

### Viewing Inventory

The main table shows:
- **Sr No**: Serial number
- **Date**: Item date
- **Item Name**: Product name
- **Master Rolls**: All dimensions and quantities
- **Convertable Stock**: Front, 5 Str, 7-str, Balance
- **Ready for Dispatch**: Items, quantities, and rack locations
- **Cut & Roll**: In-hand quantities and dates

## Database Structure

### Inventory Items
- `id` - Unique identifier
- `sr_no` - Serial number
- `item_name` - Item name
- `date` - Date
- `is_active` - Active status
- `created_at`, `updated_at` - Timestamps

### Master Rolls
- `inventory_item_id` - Links to inventory item
- `dimension` - Roll dimension (e.g., "36*600")
- `quantity` - Quantity in stock

### Convertable Stock
- `inventory_item_id` - Links to inventory item
- `front` - Front quantity
- `five_str` - 5 Str quantity
- `seven_str` - 7-str quantity
- `balance` - Balance quantity

### Ready for Dispatch
- `inventory_item_id` - Links to inventory item
- `sr_no` - Serial number
- `item` - Item name
- `in_hand` - Quantity in hand
- `rack_location` - Rack location code

### Cut and Roll
- `inventory_item_id` - Links to inventory item
- `in_hand` - Quantity in hand
- `date` - Operation date

## Next Steps

1. **Import Your Existing Data**: Use the Excel import feature to migrate your current inventory
2. **Add Missing Features**: The system is designed to be extensible - you can add more fields as needed
3. **Customize Views**: Modify the table display to match your specific needs
4. **Add Edit Functionality**: Currently items can be added and deleted - edit functionality can be added

## Troubleshooting

### Import Fails
- Check that your Excel file is in the correct format
- Ensure the first row contains headers
- Verify that item names are in the correct column

### Items Not Showing
- Check that items are marked as `is_active = true`
- Verify RLS policies are correctly set up
- Check browser console for errors

### Database Errors
- Ensure all tables were created successfully
- Verify RLS policies are in place
- Check that the `is_admin()` function exists

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Verify database schema is correctly applied
3. Check Supabase logs for server-side errors


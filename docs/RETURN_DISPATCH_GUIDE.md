# Return Dispatch Guide

## Overview
When items have been dispatched to customers and need to be removed from an order, you must first create a **Return Dispatch** to maintain data integrity.

## Why This Protection Exists
The system prevents deletion of dispatched items because:
1. **Data Integrity**: Preserves accurate dispatch history
2. **Inventory Tracking**: Maintains correct inventory levels
3. **Audit Trail**: Keeps complete record of all item movements
4. **Financial Accuracy**: Ensures billing and payment records are correct

## What Happens When You Try to Delete a Dispatched Item

When you attempt to delete an item that has already been dispatched:

1. **System Check**: The system queries `dispatch_items` table for any dispatches
2. **Error Message**: You'll see: 
   ```
   Cannot delete this item - X units have already been dispatched. 
   To remove this item, first create a return dispatch for the 
   dispatched units, then try deleting again.
   ```
3. **Prompt**: A dialog asks if you want to create a return dispatch
4. **Options**:
   - **OK**: Proceed to create return dispatch (feature coming soon)
   - **Cancel**: Keep the item in the order

## How to Handle Dispatched Items

### Option 1: Create Return Dispatch (Recommended)

```typescript
// Backend: Use the createReturnDispatch function
import { createReturnDispatch } from "@/app/actions/orders"

await createReturnDispatch(orderId, [
  {
    order_item_id: "item-id",
    quantity: 50, // Number of units being returned
    reason: "Customer return - defective units"
  }
], "Return processed on 2026-01-28")
```

**Steps:**
1. Navigate to order details page
2. Try to delete the dispatched item
3. Click "OK" when prompted about return dispatch
4. System creates negative dispatch entry
5. You can now delete the item

### Option 2: Keep the Item
If items were dispatched correctly and shouldn't be removed:
- Click "Cancel" on the return dispatch prompt
- Item remains in order with dispatch history intact

### Option 3: Manual Override (Admin Only)
For special cases, admins can:
1. Manually update `dispatch_items` table in Supabase
2. Remove dispatch records (not recommended)
3. Then delete the order item

## Return Dispatch Technical Details

### Database Structure
```sql
-- Return dispatches are stored in the same table
-- with special indicators:

INSERT INTO dispatches (
  order_id,
  dispatch_type,  -- Set to 'return'
  dispatch_date,
  notes,
  shipment_status, -- Set to 'returned'
  created_by
)

-- Return items have negative quantities:
INSERT INTO dispatch_items (
  dispatch_id,
  order_item_id,
  quantity  -- Negative value (-50) indicates return
)
```

### Functions Available

#### `createReturnDispatch()`
Creates a return dispatch record for returned items.

**Parameters:**
- `orderId`: The order ID
- `returnItems`: Array of items being returned with quantities
- `notes`: Optional notes about the return

**Returns:**
```typescript
{
  success: boolean
  data?: Dispatch
  error?: string
}
```

#### `getOrderItemDispatchStatus()`
Checks if an item has been dispatched.

**Parameters:**
- `orderItemId`: The order item ID

**Returns:**
```typescript
{
  hasBeenDispatched: boolean
  totalDispatched: number
  dispatchCount: number
  dispatchDetails: Array<DispatchItem>
}
```

## Workflow Diagram

```
Try to Delete Item
       ↓
Has Been Dispatched?
   ↙         ↘
 NO          YES
  ↓           ↓
Delete    Show Error
 ✓         ↓
       Create Return?
         ↙      ↘
       YES      NO
        ↓       ↓
   Return      Cancel
   Dispatch    (Keep Item)
        ↓
   Delete Item
        ✓
```

## Future Enhancements

### Planned Features:
1. **Return Dispatch UI Modal**
   - Select items to return
   - Specify return quantities
   - Add return reason
   - Upload supporting documents

2. **Return Reasons Dropdown**
   - Defective/Damaged
   - Wrong item shipped
   - Customer cancellation
   - Quality issues
   - Other (with notes)

3. **Automatic Inventory Update**
   - Returns update inventory levels
   - Integration with inventory management
   - Stock location tracking

4. **Return Approval Workflow**
   - Manager approval for returns
   - QC inspection recording
   - Refund processing integration

5. **Return Analytics**
   - Return rate tracking
   - Common return reasons
   - Customer return patterns
   - Financial impact reports

## Troubleshooting

### "Cannot delete item that has already been dispatched"
**Solution**: Create a return dispatch first, then delete the item.

### Return dispatch not showing in history
**Check**: 
- Dispatches tab in order details
- Filter for `dispatch_type = 'return'`
- Look for negative quantities in dispatch_items

### Item deleted but dispatch history shows wrong total
**Issue**: Item was deleted without creating return dispatch
**Fix**: This is prevented by validation - if you see this, contact support

## Best Practices

1. **Always create return dispatch** before deleting dispatched items
2. **Document return reasons** in the notes field
3. **Verify quantities** match what was actually returned
4. **Check order status** after creating returns
5. **Review dispatch history** before and after deletions

## Support

If you need to:
- Override the validation (not recommended)
- Fix historical data issues
- Bulk process returns
- Access return analytics

Contact: development team or system administrator

---

**Last Updated**: January 28, 2026
**Version**: 1.0
**Related Files**: 
- `app/actions/orders.ts`
- `app/dashboard/orders/[id]/page.tsx`

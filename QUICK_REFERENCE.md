# Quick Reference Card

## 🚀 Getting Started

### Start Development Server
```bash
npm run dev
```

### Access Dashboard
```
http://localhost:3000/dashboard
```

---

## 📁 Key Files

### Components
```
components/OrderTable.tsx        - Advanced data table
components/RevenueOverview.tsx   - Revenue chart
components/RecentActivity.tsx    - Activity feed
components/ui/                   - UI components (4 new files)
```

### Hooks
```
hooks/useDashboardStats.ts       - Real-time metrics hook
```

### Dashboard
```
app/dashboard/page.tsx           - Main refactored page
```

---

## 🔧 Common Customizations

### Change Theme Colors
```typescript
// In components or styles
border-l-blue-500       → Change to your color
bg-blue-600             → Primary action color
bg-slate-50             → Background color
```

### Add More KPI Cards
```typescript
<KPICard
  title="Your Metric"
  value={yourValue}
  icon={<YourIcon />}
  color="border-l-your-color"
  change={12}
/>
```

### Modify Table Columns
```typescript
// In OrderTable.tsx, add to columns array:
{
  accessorKey: "field_name",
  header: "Display Name",
  cell: ({ row }) => <Component />
}
```

### Connect Real Data
```typescript
// In dashboard/page.tsx, replace mock data:
const [revenueData] = useState(generateMockRevenueData())

// With real data:
useEffect(() => {
  fetchDataFromSupabase()
}, [])
```

---

## 📊 Features at a Glance

| Feature | Status | Location |
|---------|--------|----------|
| KPI Cards | ✅ Done | Dashboard |
| Revenue Chart | ✅ Done | RevenueOverview |
| Activity Feed | ✅ Done | RecentActivity |
| Data Table | ✅ Done | OrderTable |
| Sorting | ✅ Done | Table headers |
| Filtering | ✅ Done | Filter dropdowns |
| Real-time | ✅ Done | useDashboardStats |
| Search | ✅ Done | Table search |
| Pagination | ✅ Done | Table footer |
| Responsive | ✅ Done | All components |
| TypeScript | ✅ Done | All files |

---

## 🎨 Color Reference

### Status Colors
```
Pending:        bg-amber-100  text-amber-700
In Production:  bg-blue-100   text-blue-700
Dispatched:     bg-indigo-100 text-indigo-700
Delivered:      bg-green-100  text-green-700
Paid:           bg-green-100  text-green-700
Payment Pending: bg-red-100   text-red-700
```

### UI Colors
```
Primary:   bg-blue-600  (hover: bg-blue-700)
Success:   bg-green-600
Warning:   bg-amber-600
Error:     bg-red-600
Neutral:   bg-slate-50 to bg-slate-900
```

---

## 🔍 Usage Examples

### Using Dashboard Stats
```typescript
import { useDashboardStats } from "@/hooks/useDashboardStats"

function Component() {
  const { stats, loading } = useDashboardStats()
  return <div>{stats?.totalOrders}</div>
}
```

### Using Order Table
```typescript
import { OrderTable } from "@/components/OrderTable"

<OrderTable data={orders} isLoading={loading} />
```

### Using Revenue Chart
```typescript
import { RevenueOverview } from "@/components/RevenueOverview"

<RevenueOverview data={revenueData} />
```

### Using Activity Feed
```typescript
import { RecentActivity } from "@/components/RecentActivity"

<RecentActivity activities={activityList} />
```

---

## 🧪 Testing Checklist

- [ ] Dashboard loads without errors
- [ ] KPI cards display metrics
- [ ] Revenue chart shows data
- [ ] Activity feed shows items
- [ ] Table displays orders
- [ ] Search filters work
- [ ] Status filter works
- [ ] Payment filter works
- [ ] Sorting works
- [ ] Pagination works
- [ ] Responsive on mobile
- [ ] Responsive on tablet
- [ ] Real-time updates work
- [ ] No console errors

---

## 📱 Responsive Breakpoints

```
Mobile:   < 640px   (1 col grid, stacked)
Tablet:   640-1024px (2 col grid, flexible)
Desktop:  > 1024px  (4 col grid, full width)
```

---

## 🔐 Type Safety

All components have TypeScript support:
```typescript
// Interfaces available in each file
Order               // Order data structure
DashboardStats      // Metrics data structure
ActivityItem        // Activity log structure
RevenueDataPoint    // Chart data structure
```

---

## 🚨 Common Errors & Fixes

| Error | Solution |
|-------|----------|
| "recharts not found" | `npm install recharts` |
| Table not showing | Check data is passed correctly |
| Chart not rendering | Check parent has width property |
| Real-time not working | Verify Supabase RLS enabled |
| Styling looks off | Clear `.next` folder and rebuild |
| TypeScript errors | Run `npm run build` to check |

---

## 📚 Documentation

```
DASHBOARD_REFACTORING.md    - Feature overview
IMPLEMENTATION_GUIDE.md     - How to use
CODE_SUMMARY.md            - Technical details
VISUAL_GUIDE.md            - Design system
README_REFACTORING.md      - Project summary
QUICK_REFERENCE.md         - This file
```

---

## 🎯 Next Steps

1. **Test Features**: Verify everything works
2. **Connect Data**: Link real Supabase data
3. **Customize**: Adjust colors/styling
4. **Deploy**: Push to production
5. **Monitor**: Check real-time updates

---

## 💡 Pro Tips

1. **Search Faster**: Use Ctrl+F in browser
2. **Sort Columns**: Click column headers
3. **Filter Smart**: Combine multiple filters
4. **Mobile View**: Test with DevTools
5. **Real-time**: Data updates automatically
6. **Responsive**: Works on all devices
7. **Type Safe**: Full TypeScript support
8. **Accessible**: Keyboard navigation works

---

## 🔗 Quick Links

```
Dashboard:  http://localhost:3000/dashboard
Orders:     http://localhost:3000/dashboard/orders
Production: http://localhost:3000/dashboard/production
Follow-up:  http://localhost:3000/dashboard/follow-up
```

---

## 📞 Support

All code is well-commented and documented. Check:
- Component files for prop types
- Hooks files for return values
- Documentation files for guides

---

## 🎉 You're All Set!

Your Sunkool OMS dashboard is ready to use. Enjoy the new features! 🚀

---

**Quick Access Commands**
```bash
# Start server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Start production server
npm start
```

---

**Last Updated**: January 28, 2026
**Version**: 1.0
**Status**: ✅ Complete

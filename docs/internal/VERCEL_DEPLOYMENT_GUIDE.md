# 🚀 Deployment Guide - Vercel

**Application**: Sunkool Order Management System  
**Platform**: Vercel  
**Status**: Ready for Production

---

## Quick Start (5 minutes)

### Step 1: Create GitHub Repository

```bash
# Navigate to project directory
cd /Users/piyush/Desktop/Projects/sunkool-management

# Initialize Git
git init

# Add all files
git add .

# Create initial commit
git commit -m "feat: Initial commit - Sunkool Order Management System ready for production"
```

### Step 2: Push to GitHub

```bash
# Create a new repository on GitHub (https://github.com/new)
# Then run:

git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sunkool-management.git
git push -u origin main
```

### Step 3: Deploy to Vercel

1. **Visit Vercel Dashboard**: https://vercel.com/dashboard
2. **Click "New Project"**
3. **Select Your GitHub Repository**
   - Search for "sunkool-management"
   - Click "Import"

4. **Configure Project Settings**:
   - **Framework**: Auto-detected (Next.js) ✓
   - **Build & Dev Settings**: Use defaults ✓
   - **Environment Variables**: See section below

5. **Add Environment Variables**:
   
   Click "Add Environment Variable" and add these (in Vercel dashboard):
   
   ```
   Name: NEXT_PUBLIC_SUPABASE_URL
   Value: https://kcvsnajryguxrrgdpqlk.supabase.co
   ```
   
   ```
   Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdnNuYWpyeWd1eHJyZ2RwcWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDM4MzAsImV4cCI6MjA3ODc3OTgzMH0.8w0z-LuVZPiXLEr4FZQamzxJfgRQ4R0QFcJmACFFNkw
   ```

6. **Click "Deploy"**
   - Wait 2-3 minutes for deployment to complete
   - You'll receive a unique Vercel URL

---

## Environment Variables Explained

### NEXT_PUBLIC_SUPABASE_URL
- **What it is**: Supabase project URL
- **Current Value**: `https://kcvsnajryguxrrgdpqlk.supabase.co`
- **Why public**: It's safe to expose (contains no secrets)
- **Used for**: Database and authentication connections

### NEXT_PUBLIC_SUPABASE_ANON_KEY
- **What it is**: Supabase anonymous/public key
- **Current Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Why public**: Used for client-side authentication
- **Security**: Row-Level Security (RLS) protects sensitive data
- **Used for**: API calls and real-time subscriptions

**IMPORTANT**: These are safe to expose. Real secrets like service keys are kept server-side.

---

## Verification Checklist

After deployment, verify everything works:

### ✅ Page Loading
- [ ] Visit your Vercel URL
- [ ] Page loads without errors
- [ ] No console errors (F12 → Console)

### ✅ Authentication
- [ ] Can navigate to `/dashboard`
- [ ] Redirects to login if not authenticated
- [ ] Login functionality works
- [ ] Session persists on refresh

### ✅ Core Features
- [ ] Orders page loads and displays data
- [ ] Can create a new order
- [ ] Can add items to order
- [ ] Can create dispatch
- [ ] Can update payment status
- [ ] Can manage customers
- [ ] Can manage couriers
- [ ] Alerts and notifications display correctly

### ✅ Database Connectivity
- [ ] All data loads from Supabase
- [ ] Create operations work
- [ ] Update operations work
- [ ] Delete operations work

### ✅ Performance
- [ ] Pages load in < 2 seconds
- [ ] PDFs generate without errors
- [ ] No 429 (rate limit) errors
- [ ] No 503 (service unavailable) errors

---

## Troubleshooting

### Issue: Deployment Failed

**Check Build Logs:**
1. Go to Vercel Dashboard
2. Click on your project
3. Go to "Deployments"
4. Click on failed deployment
5. Check "Build" logs for errors

**Common Causes:**
- Missing environment variables → Add them in Settings > Environment Variables
- TypeScript errors → Run `npm run build` locally to verify
- Dependency issues → Check `package.json` is committed

### Issue: Page Shows 404

**Solution:**
1. Ensure middleware.ts is committed
2. Check that all routes exist
3. Try hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

### Issue: Can't Connect to Database

**Check:**
1. Environment variables are set ✓
2. Supabase project is active
3. RLS policies allow client access
4. Network connection is working
5. Try accessing Supabase directly: https://kcvsnajryguxrrgdpqlk.supabase.co

### Issue: Authentication Not Working

**Solution:**
1. Clear browser cookies
2. Check Supabase auth configuration
3. Verify NEXT_PUBLIC_SUPABASE_URL is correct
4. Check browser console for auth errors
5. Ensure middleware.ts is deployed

### Issue: Slow Performance

**Optimize:**
1. Clear Vercel cache: Dashboard → Settings → Git → Clear Cache
2. Check bundle size: `npm run build` and review output
3. Enable Data Cache in Vercel (Premium feature)
4. Optimize database queries

---

## Continuous Deployment

### Automatic Deployments

Once connected to GitHub, Vercel automatically deploys:
- **On push to main** → Production deployment
- **On pull requests** → Preview deployment
- **On push to other branches** → Preview deployment

### Preview URLs

Each pull request gets a unique preview URL:
```
https://sunkool-management-pr-123.vercel.app
```

### Rollback

To rollback to previous version:
1. Go to Deployments
2. Click on previous successful deployment
3. Click "Promote to Production"

---

## Production Best Practices

### 1. Monitor Errors
```
Settings → Integrations → Add Slack
→ Get notifications for deployment failures
```

### 2. Set Up Custom Domain
```
Settings → Domains → Add Domain
→ Update DNS records
→ Verify domain
```

### 3. Enable Analytics
```
Analytics → Enable
→ Monitor:
  - Page views
  - Web vitals
  - Error tracking
```

### 4. Configure Build Settings
```
Settings → Build & Development Settings
→ Build Command: npm run build
→ Output Directory: .next
→ Install Command: npm ci
```

### 5. Environment Isolation
```
Settings → Environment Variables
→ Add separate vars for:
  - Production
  - Preview
  - Development (optional)
```

### 6. Automatic Backups
- Ensure Supabase backups are enabled
- Check backup schedule monthly
- Test restore procedure quarterly

### 7. Security Headers
- ✅ Already configured in vercel.json
- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN
- X-XSS-Protection enabled
- Referrer-Policy: strict-origin-when-cross-origin

---

## Monitoring & Maintenance

### Daily Monitoring
- Check Vercel deployment status
- Monitor error logs
- Verify key features are working

### Weekly Maintenance
- Review performance metrics
- Check for failed deployments
- Update dependencies (optional)

### Monthly Tasks
- Update `baseline-browser-mapping` (if desired)
- Review database performance
- Check Supabase usage quotas
- Review analytics

### Quarterly Tasks
- Security audit
- Backup verification
- Performance optimization review
- User feedback analysis

---

## Rollback Procedure

If something goes wrong in production:

### Quick Rollback (1 minute)
1. Go to Vercel Dashboard → Deployments
2. Find last successful deployment
3. Click "Promote to Production"
4. Site reverts to previous version instantly

### Code Rollback (GitHub)
```bash
# Find commit hash of last working version
git log --oneline | head -10

# Revert to that commit
git revert -n abc1234
git commit -m "revert: Rollback to stable version"
git push origin main

# Vercel will automatically redeploy
```

---

## Post-Launch Checklist

### Week 1
- [ ] Monitor error logs daily
- [ ] Test all critical workflows
- [ ] Gather user feedback
- [ ] Check performance metrics

### Month 1
- [ ] Review user analytics
- [ ] Optimize slow queries
- [ ] Plan improvements
- [ ] Train team members

### Quarterly
- [ ] Security review
- [ ] Performance audit
- [ ] Dependency updates
- [ ] Feature roadmap review

---

## Support Resources

### Vercel Documentation
- https://vercel.com/docs
- https://vercel.com/docs/deployments

### Next.js Documentation
- https://nextjs.org/docs
- https://nextjs.org/docs/deployment

### Supabase Documentation
- https://supabase.io/docs
- https://supabase.io/docs/guides/auth

### Project Documentation
- [VERCEL_DEPLOYMENT_CHECKLIST.md](./VERCEL_DEPLOYMENT_CHECKLIST.md)
- [README.md](./README.md)
- [SETUP_GUIDE.md](./Setup/SETUP_GUIDE.md)

---

## Emergency Contacts

For critical issues:
1. **Vercel Support**: https://vercel.com/support
2. **Supabase Support**: https://supabase.io/support
3. **GitHub Support**: https://github.com/support

---

## Success Metrics

After going live, track these metrics:

### Performance
- Page Load Time: Target < 2s
- First Contentful Paint: Target < 1.5s
- Largest Contentful Paint: Target < 2.5s

### Reliability
- Uptime: Target > 99.9%
- Error Rate: Target < 0.1%
- Deployment Success: Target > 99%

### User Experience
- Task Completion Rate: Target > 95%
- Error Recovery Time: Target < 1min
- User Satisfaction: Target > 4/5

---

## Next Steps

1. ✅ Verify application locally: `npm run dev`
2. ✅ Run production build: `npm run build`
3. ✅ Push to GitHub
4. ✅ Connect to Vercel
5. ✅ Add environment variables
6. ✅ Deploy
7. ✅ Monitor for 24 hours
8. ✅ Set up monitoring tools
9. ✅ Configure custom domain (optional)
10. ✅ Announce to users

---

**Happy Deploying! 🎉**

Your Sunkool Order Management System is ready for production.

Last Updated: January 28, 2026

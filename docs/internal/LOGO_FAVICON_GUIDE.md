# Logo & Favicon Placeholder Guide

## Overview
Placeholder logo and favicon files have been created for easy replacement with your actual Sunkool brand assets.

## Files to Replace

### 1. **Logo Files** (`/public/images/`)
- **`logo.svg`** - Light/default logo (used on dark backgrounds)
  - Dimensions: 200x60px
  - Replace with your main Sunkool logo
  - Used in: Dashboard sidebar, dashboard header

- **`logo-light.svg`** - Dark logo (used on light backgrounds)
  - Dimensions: 200x60px
  - Replace with your dark variant logo
  - Optional if you have a single logo that works for both

### 2. **Favicon** (`/public/favicon.svg`)
- Current: Placeholder SVG (32x32px)
- Replace with your Sunkool brand favicon
- This appears in the browser tab and bookmarks
- You can also create `public/favicon.ico` for maximum compatibility

### 3. **Alternative Formats** (Optional)
If you want to support more browsers, add these files to `/public/`:
- `favicon.ico` - Classic favicon format (16x16, 32x32, or 64x64px)
- `apple-touch-icon.png` - For iOS devices (192x192px)
- `android-chrome-*.png` - For Android devices

## How Components Use These Files

### SunkoolLogo Component (`/components/SunkoolLogo.tsx`)
Currently displays a styled text-based logo. You can optionally modify it to use image files:

```tsx
import Image from "next/image"

export default function SunkoolLogo({ 
  variant = "dark",
  size = "md" 
}) {
  return (
    <Image
      src={variant === "dark" ? "/images/logo.svg" : "/images/logo-light.svg"}
      alt="Sunkool OMS"
      width={200}
      height={60}
      className="w-auto h-auto"
    />
  )
}
```

### Favicon (`/app/layout.tsx`)
```tsx
export const metadata: Metadata = {
  icons: {
    icon: "/favicon.svg", // Replace favicon.svg with your file
  },
};
```

## Replacement Steps

1. **Prepare your logos**
   - Design or export your Sunkool logo in SVG or PNG format
   - Create dark and light variants if needed
   - Ensure dimensions are appropriate (200x60px for logos, 32x32+ for favicon)

2. **Replace files**
   - Replace `/public/images/logo.svg` with your main logo
   - Replace `/public/images/logo-light.svg` with your dark variant
   - Replace `/public/favicon.svg` with your favicon

3. **Test**
   - Refresh browser (hard refresh: Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
   - Check browser tab for favicon
   - Check sidebar and dashboard header for logo display

4. **Optional: Update component references**
   - If using image files in the SunkoolLogo component, update the component code as shown above
   - Update any hardcoded image paths in other components

## Current Placeholder Details

### Logo Placeholder Features
- Blue circle (SK text in orange)
- Orange circle (OMS text in blue)
- Text-based branding
- Scalable SVG format

### Favicon Placeholder Features
- White background
- Blue and orange circles
- "SK" text indicator
- 32x32px SVG

## File Locations Reference
```
public/
├── favicon.svg          # ← Replace this
├── images/
│   ├── logo.svg        # ← Replace this
│   └── logo-light.svg  # ← Replace this
└── (other files)
```

## Need Help?

- For SVG optimization, use tools like SVGO or TinyPNG
- For favicon generation, try: https://favicon.io/ or https://realfavicongenerator.net/
- Ensure logos maintain aspect ratio and are properly sized
- Test on multiple browsers for compatibility

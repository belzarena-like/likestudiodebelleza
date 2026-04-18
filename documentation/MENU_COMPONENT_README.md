# Menu Component - Like Studio

## 🎯 Problem Solved

**Before:** Menu HTML was duplicated across 25+ pages. Updating menu items required editing every single file.

**After:** Menu is defined once in JavaScript. All pages automatically get updates.

## 📦 What's Included

### New Files Created

1. **`static/js/menu-component.js`** - Menu logic and configuration
2. **`css/menu-component.css`** - Menu styles  
3. **`admin/menu-example.html`** - Working example template
4. **`MENU_MIGRATION_GUIDE.md`** - Detailed migration instructions
5. **`MENU_STRUCTURE.md`** - Visual structure documentation
6. **`migrate-menus.md`** - Quick reference guide

### Updated Files

- ✅ **`admin/settings.html`** - First page migrated as example

## 🚀 Quick Start

### For New Pages

```html
<!doctype html>
<html lang="es">
<head>
  <link rel="stylesheet" href="../css/site.css" />
  <link rel="stylesheet" href="../css/admin-common.css" />
  <link rel="stylesheet" href="../css/menu-component.css" />
</head>
<body>
  <header class="topbar"></header>
  
  <main>
    <!-- Your content -->
  </main>

  <script src="../static/js/admin-auth.js"></script>
  <script src="../static/js/menu-component.js"></script>
</body>
</html>
```

### To Update Existing Pages

1. Add CSS: `<link rel="stylesheet" href="../css/menu-component.css" />`
2. Replace header: `<header class="topbar"></header>`
3. Add script: `<script src="../static/js/menu-component.js"></script>`

## 📋 Menu Organization

### Admin Menu (Grouped)

```
┌─ GESTIÓN ─────────────────┐
│ • Consentimientos         │
│ • Clientes                │
│ • Sesiones                │
│ • Agenda                  │
│ • Pagos                   │
└───────────────────────────┘

┌─ CONFIGURACIÓN ───────────┐
│ • Servicios               │
│ • Horario                 │
│ • Email                   │
└───────────────────────────┘

┌─ HERRAMIENTAS ────────────┐
│ • Generador QR            │
│ • Videos                  │
│ • Formación               │
└───────────────────────────┘

────────────────────────────
Web pública | Cerrar sesión
```

### Public Menu (Flat)

```
Inicio | Servicios | Reserva | Galería | 
Instagram | Academia | Contacto | WhatsApp
```

## ✏️ How to Modify Menu

Edit **`static/js/menu-component.js`**:

```javascript
const MENU_CONFIGS = {
  admin: {
    groups: [
      {
        label: 'Gestión',
        items: [
          { label: 'Consentimientos', href: 'index.html' },
          // Add more items here
        ]
      }
    ]
  }
};
```

**That's it!** All pages update automatically.

## 🎨 Features

- ✅ **Auto-detection**: Knows if page is admin or public
- ✅ **Responsive**: Mobile-friendly dropdown menu
- ✅ **Grouped navigation**: Logical organization for admin
- ✅ **Keyboard accessible**: ESC key closes menu
- ✅ **Click outside**: Closes menu automatically
- ✅ **No duplication**: Single source of truth

## 📱 Responsive Behavior

| Screen | Menu Display |
|--------|--------------|
| Desktop (>1200px) | Horizontal with group separators |
| Tablet (768-1200px) | Dropdown button |
| Mobile (<768px) | Dropdown button |

## 🔧 Configuration Options

### Adding a New Group

```javascript
{
  label: 'New Group',
  items: [
    { label: 'Item 1', href: 'page1.html' },
    { label: 'Item 2', href: 'page2.html' }
  ]
}
```

### Adding External Link

```javascript
{ 
  label: 'WhatsApp', 
  href: 'https://wa.me/34603749744',
  target: '_blank'
}
```

### Adding Button Style

```javascript
{ 
  label: 'WhatsApp', 
  href: 'https://wa.me/34603749744',
  class: 'btn btn-sm',
  target: '_blank'
}
```

### Adding Click Handler

```javascript
{ 
  label: 'Cerrar sesión', 
  href: '#',
  onclick: 'likestudioAdminLogout(); return false;'
}
```

## 📊 Migration Status

### Admin Pages (19 total)
- [x] settings.html ✅
- [ ] index.html
- [ ] booking-draft.html
- [ ] clients.html
- [ ] payments.html
- [ ] qr-generator.html
- [ ] services.html
- [ ] sessions.html
- [ ] training.html
- [ ] videos.html
- [ ] working-hours.html
- [ ] consent-*.html (8 files)

### Public Pages (6 total)
- [ ] index.html
- [ ] servicios.html
- [ ] reserva.html
- [ ] gallery.html
- [ ] academia.html
- [ ] public-qr.html

## 🧪 Testing Checklist

After migrating a page, verify:

- [ ] Menu renders on page load
- [ ] All links work correctly
- [ ] Mobile toggle button appears on small screens
- [ ] Menu opens/closes on mobile
- [ ] Menu closes when clicking outside
- [ ] ESC key closes menu
- [ ] Grouped items display correctly (admin only)
- [ ] Logout works (admin only)

## 🐛 Troubleshooting

### Menu doesn't appear
- Check that `menu-component.js` is loaded
- Check browser console for errors
- Verify `<header class="topbar"></header>` exists

### Menu items wrong
- Check page location (admin vs public)
- Verify path to menu-component.js is correct

### Styles look wrong
- Check that `menu-component.css` is loaded
- Verify CSS load order (should be after site.css)

## 📚 Documentation Files

1. **MENU_COMPONENT_README.md** (this file) - Overview
2. **MENU_MIGRATION_GUIDE.md** - Step-by-step migration
3. **MENU_STRUCTURE.md** - Visual structure diagrams
4. **migrate-menus.md** - Quick reference

## 💡 Benefits

| Before | After |
|--------|-------|
| 25+ files to update | 1 file to update |
| Inconsistent menus | Always consistent |
| Hard to reorganize | Easy to reorganize |
| No grouping | Logical groups |
| Manual maintenance | Automatic updates |

## 🎯 Next Steps

1. Review `admin/settings.html` to see working example
2. Review `admin/menu-example.html` for template
3. Follow `MENU_MIGRATION_GUIDE.md` to update pages
4. Test each page after migration
5. Customize menu items in `menu-component.js` as needed

## 📞 Support

For questions about the menu component:
- Check `admin/menu-example.html` for working code
- Review `MENU_STRUCTURE.md` for visual reference
- See `MENU_MIGRATION_GUIDE.md` for detailed steps

---

**Created:** 2026-04-17  
**Status:** Ready for migration  
**Example:** admin/settings.html ✅

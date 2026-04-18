# Menu Component Migration Guide

## Overview

The new menu component provides a reusable, organized navigation system for both public and admin pages. It eliminates code duplication and groups admin menu items logically.

## Menu Organization

### Admin Menu Groups

The admin menu is now organized into logical groups:

1. **Gestión** (Management)
   - Consentimientos
   - Clientes
   - Sesiones
   - Agenda
   - Pagos

2. **Configuración** (Configuration)
   - Servicios
   - Horario
   - Email

3. **Herramientas** (Tools)
   - Generador QR
   - Videos
   - Formación

### Public Menu

The public menu remains flat and simple:
- Inicio
- Servicios
- Reserva online
- Galería
- Instagram
- Academia
- Contacto
- WhatsApp

## Migration Steps

### For Admin Pages

1. **Add CSS link** in the `<head>` section:
```html
<link rel="stylesheet" href="../css/menu-component.css" />
```

2. **Replace the entire header** with:
```html
<!-- Menu will be automatically rendered here by the component -->
<header class="topbar"></header>
```

3. **Add script** before closing `</body>` tag (after other scripts):
```html
<script src="../static/js/menu-component.js"></script>
```

### For Public Pages

1. **Add CSS link** in the `<head>` section:
```html
<link rel="stylesheet" href="css/menu-component.css" />
```

2. **Replace the entire header** with:
```html
<!-- Menu will be automatically rendered here by the component -->
<header class="topbar"></header>
```

3. **Add script** before closing `</body>` tag:
```html
<script src="static/js/menu-component.js"></script>
```

## Example: Before and After

### Before (Old Code)
```html
<header class="topbar">
  <a class="brand" href="index.html">Admin</a>
  <button class="menu-toggle" type="button" aria-label="Abrir menu" data-menu-toggle>Menu</button>
  <nav class="menu" data-menu>
    <a href="index.html">Consentimientos</a>
    <a href="clients.html">Clientes</a>
    <a href="sessions.html">Sesiones</a>
    <a href="booking-draft.html">Agenda</a>
    <a href="services.html">Servicios</a>
    <a href="working-hours.html">Horario</a>
    <a href="../index.html">Web publica</a>
    <a href="#" onclick="likestudioAdminLogout(); return false;">Cerrar sesion</a>
  </nav>
</header>
```

### After (New Code)
```html
<!-- Menu will be automatically rendered here by the component -->
<header class="topbar"></header>
```

## Files to Update

### Admin Pages (19 files)
- [x] admin/settings.html (✓ Already updated)
- [ ] admin/index.html
- [ ] admin/booking-draft.html
- [ ] admin/client-profiles.html
- [ ] admin/clients.html
- [ ] admin/consent-capilar-condiciones.html
- [ ] admin/consent-eliminacion-laser.html
- [ ] admin/consent-estetico.html
- [ ] admin/consent-laser.html
- [ ] admin/consent-micropigmentacion.html
- [ ] admin/consent-selector.html
- [ ] admin/consent-view.html
- [ ] admin/payments.html
- [ ] admin/qr-generator.html
- [ ] admin/services.html
- [ ] admin/sessions.html
- [ ] admin/training.html
- [ ] admin/videos.html
- [ ] admin/working-hours.html

### Public Pages (6 files)
- [ ] index.html
- [ ] servicios.html
- [ ] reserva.html
- [ ] gallery.html
- [ ] academia.html
- [ ] public-qr.html

## Benefits

1. **No Code Duplication**: Menu is defined once in `menu-component.js`
2. **Easy Updates**: Change menu items in one place
3. **Better Organization**: Grouped navigation for admin pages
4. **Consistent Behavior**: Same toggle and responsive behavior everywhere
5. **Maintainable**: Add/remove menu items without touching HTML files

## Customization

To modify menu items, edit `static/js/menu-component.js`:

```javascript
const MENU_CONFIGS = {
  admin: {
    groups: [
      {
        label: 'Your Group Name',
        items: [
          { label: 'Item Name', href: 'page.html' }
        ]
      }
    ]
  }
};
```

## Testing

After migration, verify:
1. Menu renders correctly on desktop
2. Mobile toggle works
3. All links navigate properly
4. Menu closes when clicking outside (mobile)
5. Grouped items display correctly (admin only)
6. Logout function works (admin only)

## Rollback

If issues occur, you can temporarily revert by:
1. Removing the menu-component.js script
2. Restoring the old header HTML
3. The old CSS in site.css/admin-common.css will still work

## Support

For questions or issues with the migration, check:
- `admin/menu-example.html` - Working example
- `css/menu-component.css` - Component styles
- `static/js/menu-component.js` - Component logic

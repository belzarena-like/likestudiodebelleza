# Quick Migration Instructions

## What Changed?

The menu is now a **reusable component** instead of being duplicated in every page. The admin menu is organized into **3 logical groups**:

### Admin Menu Groups:
- **Gestión**: Consentimientos, Clientes, Sesiones, Agenda, Pagos
- **Configuración**: Servicios, Horario, Email  
- **Herramientas**: Generador QR, Videos, Formación

## How to Update Each Page

### Step 1: Add CSS (in `<head>`)

**Admin pages:**
```html
<link rel="stylesheet" href="../css/menu-component.css" />
```

**Public pages:**
```html
<link rel="stylesheet" href="css/menu-component.css" />
```

### Step 2: Replace Header

Replace the entire `<header class="topbar">...</header>` block with:

```html
<!-- Menu will be automatically rendered here by the component -->
<header class="topbar"></header>
```

### Step 3: Add Script (before `</body>`)

**Admin pages:**
```html
<script src="../static/js/menu-component.js"></script>
```

**Public pages:**
```html
<script src="static/js/menu-component.js"></script>
```

## Example: settings.html (Already Done ✓)

See `admin/settings.html` for a complete working example.

## To Update Menu Items

Edit `static/js/menu-component.js` - all pages will update automatically!

## Visual Preview

**Desktop Admin Menu:**
```
[Gestión] Consentimientos Clientes Sesiones Agenda Pagos | 
[Configuración] Servicios Horario Email | 
[Herramientas] Generador QR Videos Formación | 
Web pública Cerrar sesión
```

**Mobile:** All items stack vertically with group labels.

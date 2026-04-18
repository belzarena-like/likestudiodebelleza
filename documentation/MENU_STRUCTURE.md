# Menu Structure Overview

## New Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Menu Component System                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  📁 static/js/menu-component.js  ← Single source of truth   │
│  📁 css/menu-component.css       ← Shared styles             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Auto-detects page type
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
        ┌───────────────┐          ┌──────────────┐
        │  Public Menu  │          │  Admin Menu  │
        └───────────────┘          └──────────────┘
```

## Admin Menu Structure (Grouped)

```
╔═══════════════════════════════════════════════════════════════╗
║  Like Studio Admin                                    [Menu]  ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────┐ ║
║  │  GESTIÓN    │  │  CONFIGURACIÓN   │  │  HERRAMIENTAS   │ ║
║  ├─────────────┤  ├──────────────────┤  ├─────────────────┤ ║
║  │ • Consentim.│  │ • Servicios      │  │ • Generador QR  │ ║
║  │ • Clientes  │  │ • Horario        │  │ • Videos        │ ║
║  │ • Sesiones  │  │ • Email          │  │ • Formación     │ ║
║  │ • Agenda    │  └──────────────────┘  └─────────────────┘ ║
║  │ • Pagos     │                                             ║
║  └─────────────┘                                             ║
║                                                               ║
║  ─────────────────────────────────────────────────────────   ║
║  Web pública  |  Cerrar sesión                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

## Public Menu Structure (Flat)

```
╔═══════════════════════════════════════════════════════════════╗
║  🏠 Like Studio Academy                           [Menu]     ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  Inicio  Servicios  Reserva  Galería  Instagram  Academia    ║
║  Contacto  [WhatsApp]                                         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

## Mobile View (Both Menus)

```
╔═══════════════════════════╗
║ Like Studio      [Menu ▼] ║
╠═══════════════════════════╣
║                           ║
║  ┌─────────────────────┐ ║
║  │  GESTIÓN            │ ║
║  │  • Consentimientos  │ ║
║  │  • Clientes         │ ║
║  │  • Sesiones         │ ║
║  │  • Agenda           │ ║
║  │  • Pagos            │ ║
║  │                     │ ║
║  │  CONFIGURACIÓN      │ ║
║  │  • Servicios        │ ║
║  │  • Horario          │ ║
║  │  • Email            │ ║
║  │                     │ ║
║  │  HERRAMIENTAS       │ ║
║  │  • Generador QR     │ ║
║  │  • Videos           │ ║
║  │  • Formación        │ ║
║  │  ─────────────────  │ ║
║  │  Web pública        │ ║
║  │  Cerrar sesión      │ ║
║  └─────────────────────┘ ║
║                           ║
╚═══════════════════════════╝
```

## Menu Item Mapping

### Before → After (Admin)

| Old Position | New Group | New Position |
|--------------|-----------|--------------|
| Consentimientos | Gestión | 1st item |
| Clientes | Gestión | 2nd item |
| Sesiones | Gestión | 3rd item |
| Agenda | Gestión | 4th item |
| (NEW) Pagos | Gestión | 5th item |
| Servicios | Configuración | 1st item |
| Horario | Configuración | 2nd item |
| (NEW) Email | Configuración | 3rd item |
| (NEW) Generador QR | Herramientas | 1st item |
| (NEW) Videos | Herramientas | 2nd item |
| (NEW) Formación | Herramientas | 3rd item |
| Web pública | Footer | 1st item |
| Cerrar sesión | Footer | 2nd item |

## Benefits of Grouping

### 1. **Gestión** (Management)
Daily operations and client-facing activities
- Quick access to most-used features
- Logical workflow: Consent → Client → Session → Booking → Payment

### 2. **Configuración** (Configuration)  
System settings and business rules
- Less frequently accessed
- Affects how the system operates

### 3. **Herramientas** (Tools)
Utility features and resources
- Supporting tools for business operations
- Training and marketing materials

## Responsive Behavior

| Screen Size | Menu Display | Groups |
|-------------|--------------|--------|
| > 1200px | Horizontal | Visible with separators |
| 768-1200px | Dropdown | Stacked vertically |
| < 768px | Dropdown | Stacked vertically |

## File Structure

```
likestudiodebelleza/
├── static/js/
│   └── menu-component.js      ← Menu logic & configuration
├── css/
│   └── menu-component.css     ← Menu styles
├── admin/
│   ├── settings.html          ← ✓ Updated example
│   ├── menu-example.html      ← ✓ Reference template
│   └── [other pages].html     ← To be updated
└── [public pages].html        ← To be updated
```

## Configuration Location

All menu items are configured in one place:

**File:** `static/js/menu-component.js`  
**Object:** `MENU_CONFIGS`

```javascript
const MENU_CONFIGS = {
  admin: {
    groups: [
      { label: 'Gestión', items: [...] },
      { label: 'Configuración', items: [...] },
      { label: 'Herramientas', items: [...] }
    ],
    footer: [...]
  },
  public: {
    items: [...]
  }
};
```

## Adding New Menu Items

### Example: Add "Reports" to Admin Menu

1. Open `static/js/menu-component.js`
2. Find the appropriate group
3. Add the item:

```javascript
{
  label: 'Gestión',
  items: [
    { label: 'Consentimientos', href: 'index.html' },
    { label: 'Clientes', href: 'clients.html' },
    { label: 'Sesiones', href: 'sessions.html' },
    { label: 'Agenda', href: 'booking-draft.html' },
    { label: 'Pagos', href: 'payments.html' },
    { label: 'Reportes', href: 'reports.html' }  // ← NEW
  ]
}
```

4. Save - all pages update automatically! 🎉

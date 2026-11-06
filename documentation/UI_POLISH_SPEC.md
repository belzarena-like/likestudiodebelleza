# Shared UI Polish Spec

## Goal

Improve consistency and usability across the public site and admin without replacing either area's established visual identity.

## Visual foundations

- Keep the public site's rose accent and the admin's violet accent.
- Share tokens for spacing, control sizing, focus rings, and quick transitions.
- Give links and form controls a visible keyboard-focus state.
- Add restrained hover feedback to buttons and honor reduced-motion preferences.
- Keep the existing typefaces and page layouts; avoid a broad redesign.

## Client history

- Keep all returned sessions visible, newest first, grouped by month and year.
- Add independent treatment and status filters with an empty filtered state.
- Keep sessions expanded by default and other history sections independently collapsible.
- Keep filters usable at narrow viewport widths.

## Acceptance criteria

- Shared styles apply through the existing `site.css` and `admin-common.css` imports.
- Public and admin accent colors remain distinct.
- Keyboard focus remains visible and reduced-motion preferences are respected.
- Session filters work independently and month groups hide when no matching sessions remain.
- JavaScript syntax, CSS diagnostics, and whitespace checks pass.
# Dark Mode Design

## Goal

Add a usable dark theme across the website while preserving its existing layout, church identity, and authored lesson formatting.

## User experience

- Add a light/dark toggle to the top navigation beside the account menu. Give it a visible focus state, a localized accessible name, and an `aria-pressed` state. Keep it reachable on narrow screens.
- Until the user chooses a theme, follow the device color-scheme preference. Save an explicit choice in `localStorage` so it survives reloads and applies to other tabs on the same browser.
- Apply the theme before the first page paint to avoid flashing the light theme before switching to dark.
- Keep the layout and brand imagery unchanged. Use dark navy and warm charcoal surfaces, readable light text, subdued borders, and the existing gold/teal accents with sufficient contrast.
- Apply dark colors to navigation, dashboard surfaces, lists, tables, inputs, dropdowns, dialogs, account/profile screens, and editor controls.
- Keep the rich-text lesson canvas on its warm paper surface in both modes. Lesson content can contain authored black text, colored text, and background colors; changing that canvas would make existing content unreadable or alter its intended appearance. The surrounding editor chrome follows the selected theme.
- Keep semantic status colors and user-authored formatting legible. Do not rewrite stored lesson content or affect print/export appearance.
- Respect the system's reduced-motion setting for any theme transition; a short color transition is optional and must not delay applying the theme.

## Implementation direction

Use one client-side theme provider and a root `dark` class on the document element. Store explicit choices under a versioned local-storage key; represent “follow system” by having no stored choice. A small pre-hydration initializer applies either the saved choice or the system preference before rendering. The toggle changes the root class, provider state, and stored choice together. Listen for storage and system preference changes so other tabs stay in sync unless the user has explicitly chosen a theme.

Use the existing CSS custom properties as the theme boundary. Add dark values for page, paper, text, muted text, border, and surface tokens, then replace light-only declarations in the shared application surfaces with tokens or narrowly scoped dark overrides. Keep image assets and lesson-document styling out of global recoloring rules.

## Acceptance criteria

1. The light/dark toggle is keyboard accessible and understandable to screen readers on desktop and mobile layouts.
2. With no saved choice, the first render follows the device preference without a visible flash.
3. A manual choice remains selected after reload and synchronizes across tabs; it takes precedence over later device preference changes.
4. Every shared route and overlay listed above has readable contrast in both themes, including form controls, tables, selected/disabled states, and account menus.
5. Rich-text editing controls follow the theme while the lesson canvas and authored content colors remain unchanged.
6. Existing layout, navigation, authentication, APIs, and lesson data are unaffected.

## Verification plan

- Inspect the dashboard, lessons, programs, catechist list, account/profile menu, dialogs, and editor in both themes.
- Check first paint with a saved theme, with no saved choice under both system preferences, and after toggling from another open tab.
- Check keyboard operation, focus visibility, mobile navigation, contrast for muted and semantic text, and the rich-text paper canvas.
- Confirm lesson content and print/export output are unchanged.

## Scope

This is a frontend presentation feature. It does not add server-side preferences, account-level synchronization, or new backend/API behavior.

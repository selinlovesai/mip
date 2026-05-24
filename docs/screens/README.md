# Screen captures — mip (reference) ↔ mip-tailwind (current)

Click any thumbnail to open it full-size. **mip** = original reference screenshots (`mip/`).
**mip-tailwind** = live captures of the rebuild (`mip-tailwind/`). See
`../migration-plan.md` (section I) for each screen's UI/UX description and status.

## Shell, dashboard & views

| Screen | mip (reference) | mip-tailwind (current) |
|---|---|---|
| Dashboard / Layout view | [![](mip/views-layout.webp)](mip/views-layout.webp) | [![](mip-tailwind/app-shell.png)](mip-tailwind/app-shell.png) |
| Feed view (responsive single-column) | [![](mip/views-feed-responsive.webp)](mip/views-feed-responsive.webp) | — (planned) |
| Sidebar user menu | [![](mip/sidebar-user-menu.png)](mip/sidebar-user-menu.png) | _(in app-shell)_ |
| Widget gallery | — | [![](mip-tailwind/gallery.png)](mip-tailwind/gallery.png) |
| Widget picker | — | [![](mip-tailwind/widget-picker.png)](mip-tailwind/widget-picker.png) |

## AI chat (3 modes + settings)

| Screen | mip (reference) | mip-tailwind (current) |
|---|---|---|
| Chat — sidebar | [![](mip/chat-sidebar.webp)](mip/chat-sidebar.webp) | [![](mip-tailwind/chat-sidebar.png)](mip-tailwind/chat-sidebar.png) |
| Chat — modular / floating | [![](mip/chat-modular.webp)](mip/chat-modular.webp) | _(built)_ |
| Chat — compact | [![](mip/chat-compact.webp)](mip/chat-compact.webp) | _(built)_ |
| Assistant settings (in-chat popover) | [![](mip/chat-assistant-settings.webp)](mip/chat-assistant-settings.webp) | — (planned) |

## Settings (system-wide — from user menu)

| Screen | mip (reference) | mip-tailwind (current) |
|---|---|---|
| Connections (list) | [![](mip/settings-connections.webp)](mip/settings-connections.webp) | [![](mip-tailwind/settings-connections.png)](mip-tailwind/settings-connections.png) |
| Connection — app/AI provider | [![](mip/settings-connections-app-connection.webp)](mip/settings-connections-app-connection.webp) | _(via connect modal)_ |
| Connection — custom REST | [![](mip/settings-connections-custom-connection-rest-api.webp)](mip/settings-connections-custom-connection-rest-api.webp) | [![](mip-tailwind/connection-editor.png)](mip-tailwind/connection-editor.png) |
| Connection — auth modes | [![](mip/settings-connections-custom-connection-auth.webp)](mip/settings-connections-custom-connection-auth.webp) | — |
| Connection — JSON payload | [![](mip/settings-connections-custom-connection-json.webp)](mip/settings-connections-custom-connection-json.webp) | — |
| Connection — CSV payload | [![](mip/settings-connections-custom-connection-csv.webp)](mip/settings-connections-custom-connection-csv.webp) | — |
| Connection — endpoint editor | [![](mip/settings-connections-custom-connection-endpoints.webp)](mip/settings-connections-custom-connection-endpoints.webp) | — |
| Connection — Postman import | [![](mip/settings-connections-custom-connection-postman-collection-import.webp)](mip/settings-connections-custom-connection-postman-collection-import.webp) | — |
| Apps | — | [![](mip-tailwind/settings-apps.png)](mip-tailwind/settings-apps.png) |
| Appearance (tokens) | — | [![](mip-tailwind/settings-appearance.png)](mip-tailwind/settings-appearance.png) |
| Assistant | [![](mip/settings-assistant.webp)](mip/settings-assistant.webp) | [![](mip-tailwind/settings-assistant.png)](mip-tailwind/settings-assistant.png) |
| Access (proxy tokens) | [![](mip/settings-access.webp)](mip/settings-access.webp) | — (planned) |

## Dashboard Settings (per-page — from topbar gear)

| Screen | mip (reference) | mip-tailwind (current) |
|---|---|---|
| General | [![](mip/dashboard-settings-general-1.webp)](mip/dashboard-settings-general-1.webp) [![](mip/dashboard-settings-general-2.webp)](mip/dashboard-settings-general-2.webp) | — (planned) |
| Access | [![](mip/dashboard-settings-access-1.webp)](mip/dashboard-settings-access-1.webp) [![](mip/dashboard-settings-access-2.webp)](mip/dashboard-settings-access-2.webp) | — (planned) |
| Dynamic Variables | [![](mip/dashboard-settings-dynamic-variables.webp)](mip/dashboard-settings-dynamic-variables.webp) | — (planned) |

## Dashboard Templates

| Screen | mip (reference) | mip-tailwind (current) |
|---|---|---|
| Templates listing | [![](mip/dashboard-templates-listing.webp)](mip/dashboard-templates-listing.webp) | — (planned) |
| Template import (confirm) | [![](mip/dashboard-templates-import.webp)](mip/dashboard-templates-import.webp) | — (planned) |

---

**"— (planned)"** marks mip screens not yet built in mip-tailwind (the ⬜ rows in
the migration plan). These are being recreated with Untitled UI components to
match the references above while keeping design consistency.

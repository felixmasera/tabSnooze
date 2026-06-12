# Chrome Web Store — Textos para el formulario

## Pestaña "Store listing"

**Title:** TabSnooze

**Summary / Short description** (máx. 132 caracteres):
```
Tab manager that snoozes tabs for later. Close tabs now, get them back on schedule. Declutter your browser without losing tabs.
```

**Category:** Productivity → Workflow & Planning

**Language:** English

**Detailed description:**
```
Too many open tabs? TabSnooze is a tab manager that lets you snooze tabs: close them now and have them reopen automatically at the right time. Save tabs for later, declutter your browser, and stop losing important pages in tab overload.

HOW IT WORKS
• Click the TabSnooze icon and pick when you want the tab back:
   ☀️ Today — returns at your chosen time (default 6 PM)
   📅 This Week — returns on your chosen day (default Friday)
   🌙 Someday — saved with no alarm, for whenever you get to it
   🔁 Daily Routine — the sites you open every day, ready each morning
• The tab closes, your browser stays clean, and a notification brings it back on schedule.

FEATURES
• Snooze the current tab with one click
• Snooze ALL other open tabs at once
• Right-click any link to snooze it without opening it
• Labels to organize and filter your saved tabs
• Reorderable daily routine list
• Badge counter shows how many tabs come back today
• Quick reschedule: +1h, +3h, +1d, +3d, +1w
• Archive of everything you've read or dismissed
• Available in English, Español and Português (auto-detected)

PERFECT FOR
• Tab hoarders who keep 30+ tabs open "to read later"
• Following up on emails, articles, flight prices or job posts at the right moment
• Replacing messy bookmarks with reminders that actually come back to you
• Keeping a clean, fast browser without losing anything

PRIVACY FIRST
TabSnooze stores everything locally in your browser. No accounts, no servers, no tracking, no data collection. See the privacy policy for details.

Snooze it now, see it when it matters. Try TabSnooze and reach tab inbox zero.
```

> Nota: estos textos optimizados con keywords (tab manager, snooze tabs, save tabs for later, declutter, read later) se aplican en el dashboard recién DESPUÉS de que aprueben la v1.0.0 — editar el listing durante la revisión puede cancelarla.

**Screenshots (1280×800):**
- `screenshot1.png` — popup con pestañas guardadas
- `screenshot2.png` — estado "inbox zero"
- `screenshot3.png` — grilla de funcionalidades

**Small promo tile (440×280):** `promo-small.png`

---

## Pestaña "Privacy"

**Single purpose description:**
```
TabSnooze's single purpose is tab management: it lets users close tabs now and have them reopened at a scheduled time, keeping the browser uncluttered.
```

**Permission justifications:**

- **tabs:**
```
Required to read the URL and title of tabs the user chooses to snooze, to close them after saving, and to reopen them when their schedule arrives.
```

- **storage:**
```
Required to save the user's snoozed tabs, labels and settings locally on the device. No data is transmitted anywhere.
```

- **alarms:**
```
Required to schedule when each snoozed tab should wake up and trigger its reminder.
```

- **notifications:**
```
Required to notify the user when a snoozed tab is due, with options to open it or snooze it again.
```

- **contextMenus:**
```
Required to offer a right-click option to snooze a link directly from any page without opening it.
```

**Remote code:** No, I am not using remote code.

**Data usage:** no marcar ninguna categoría (la extensión no recolecta ni transmite datos — todo es almacenamiento local). Marcar las tres certificaciones:
- ✓ I do not sell or transfer user data to third parties...
- ✓ I do not use or transfer user data for purposes that are unrelated...
- ✓ I do not use or transfer user data to determine creditworthiness...

**Privacy policy URL:**
```
https://felixmasera.github.io/tabSnooze/privacy.html
```

---

## Pestaña "Distribution"

- **Visibility:** Public
- **Distribution countries:** All regions
- **Pricing:** Free

---

## Para regenerar los screenshots

```powershell
cd store-assets
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --hide-scrollbars --window-size=1280,800 --virtual-time-budget=10000 --screenshot="screenshot1.png" "shot1.html"
```
(ídem shot2/shot3; promo-small con --window-size=440,280)

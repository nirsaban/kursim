# Kursim — Redesign Brief & Prompts for claude.ai

**Goal of this document:** give claude.ai (or any AI design tool) everything it needs to **redesign and improve** the Kursim UI/UX from scratch — *not* to clone the current app. The current design is documented below only as **context and a starting point**. The designer is expected to rethink layout, hierarchy, interaction, and polish, and to propose something better. Keep the **product intent, content, roles, flows, Hebrew language, and RTL direction**; reimagine the **look, feel, structure, and interactions**.

There are three things to copy-paste:
- **Part A — Master redesign prompt** (one paste → whole product, improved).
- **Part B — Per-screen redesign kit** (a shared header + one block per screen, to iterate screen by screen).
- **Part C — Reference appendix** (the *current* design system & screen inventory, so the AI knows what exists and what to improve — hand it over only if the AI asks for the current state, or append it to Part A for grounding).

---

## Part A — MASTER REDESIGN PROMPT (copy this)

```text
You are redesigning "Kursim", a multi-tenant online-course platform. Your job is
to REIMAGINE and IMPROVE its UI/UX from scratch — do NOT reproduce the existing
design. I want a fresh, modern, more delightful and more usable product that keeps
the same purpose, content, roles, flows, Hebrew language and RTL direction, but
rethinks everything visual and interactive. Surprise me with better ideas.

═══ THE PRODUCT (keep this intent) ═══
Each customer is an independent school living at /t/{school-slug}. A school owner
creates video courses, enrolls students, and publishes public marketing landing
pages. The SIGNATURE FEATURE is device-session limiting (anti-password-sharing):
each student is capped at N simultaneous logged-in devices (default 3); the N+1th
login is either blocked or evicts the oldest device in real time. This feature is
the reason the product exists — make it a visible, trustworthy, well-designed
thread across the product, not an afterthought.

ROLES (design a distinct, appropriate experience for each):
- SUPER_ADMIN — platform operator; manages schools only, never course content.
- OWNER — runs one school; full control of courses, media, students, sessions, marketing.
- INSTRUCTOR — content only (courses/lessons/media).
- STUDENT — watches enrolled courses, tracks progress, leaves reviews, shares referral links.

LANGUAGE & DIRECTION (non-negotiable): Hebrew UI, full RTL layout (text starts on
the right, navigation and menus flow right-to-left). Only Latin content — emails,
URLs, prices, durations, timestamps — stays LTR inside the RTL layout. Voice is
warm and encouraging (second-person-plural imperative), gender-inclusive
(e.g. תלמיד/ה), celebratory with emoji on wins (🎓 completion, 🪙 referral coins),
and calm/factual/remedy-oriented on errors and the device-limit screens — reassure,
never scold.

═══ WHAT TO IMPROVE (your redesign mandate) ═══
Treat these as goals, and go beyond them:
1. Elevate the visual craft — a distinctive, memorable, premium identity. You may
   evolve or entirely replace the current palette and type; propose what's best.
   (The current direction is warm/paper/teal/copper with Rubik + Heebo — use it as
   a jumping-off point, not a rule. If you keep a warm editorial feel, push it
   further; if you propose something bolder, justify it briefly.)
2. Sharpen information hierarchy and reduce clutter — especially the admin tables,
   the course editor, and the marketing/landing editor, which are dense today.
3. Make the device-limiting feature legible and reassuring — rethink how "active
   devices", eviction, and the block/evict policy are visualized and explained.
4. Modernize interactions — thoughtful micro-interactions, transitions, loading and
   empty states, optimistic feedback, and a real sense of "live" on the sessions
   screens. Respect reduced-motion.
5. Mobile-first RTL — every screen must be excellent on phone and desktop.
6. Accessibility — strong contrast, visible focus, proper semantics, large hit areas.
7. Delight on the emotional moments — course completion, the affiliate/referral
   share loop, and the onboarding wizard should feel rewarding.
8. Improve the marketing landing pages — they double as sales pages and are the
   product's shop window; make them convert and feel premium. Keep the idea of
   multiple selectable accent themes, but redesign the theming and sections.

═══ SCREENS TO REDESIGN (rethink each; reorganize/merge/split as you see fit) ═══
PUBLIC:
  1. Platform marketing home — pitch Kursim itself; feature the device-limit hook.
  2. Login (per-school + platform) — incl. the "device limit reached" blocked state
     (shows the account's active devices) and an "evicted from another device" notice.
  3. Accept-invitation / signup (from a one-time invite link).
  4. Course landing / sales page — the richest page: hero, who-it's-for, outcomes,
     benefits, media gallery with before/after comparison, curriculum accordion,
     testimonials, verified student reviews, FAQ, price + CTA. Theme-able.
STUDENT:
  5. "My courses" home — enrolled courses with progress + a catalog of others.
  6. Course detail — curriculum with per-lesson status (done / in-progress / new),
     resume button, and a completion celebration + review prompt at 100%.
  7. Video lesson player — dark video frame, notes, prev/next; loading/empty/error states.
  8. Change password (forced first-login variant + voluntary variant).
  9. Affiliate / referral share card — personal link, share buttons, coins earned,
     progress to next coin. (Can live on the course page or its own surface.)
OWNER / INSTRUCTOR:
  10. Dashboard — key stats (students, courses, live sessions, published pages) +
      a live "who's watching now" panel.
  11. Courses list.
  12. Course-creation wizard — a friendly multi-step flow (basics → audience &
      outcomes → benefits → social proof → pricing → page style with accent + emoji
      pickers) that ends by generating a ready landing page.
  13. Course editor — content (modules/lessons + media upload), enrollments, and the
      marketing/landing editor (with gallery, reviews moderation, affiliates).
  14. Students & invites — table + per-student device sessions + generate invite link.
  15. Live-sessions control room — all active devices across the school, with the
      ability to disconnect any; the device-limiting cockpit.
  16. Settings — school name + the device policy (device limit number, and BLOCK vs
      EVICT-OLDEST choice).
SUPER_ADMIN:
  17. Tenants manager — table of schools (create/suspend/delete), distinct admin chrome.
SHARED:
  18. A reusable component system + navigation (a UI kit: buttons, cards, fields,
      badges, modals, tables, stat cards, empty states, progress, page headers, nav,
      split-screen auth) — design it once so everything is consistent.

═══ DELIVERABLE ═══
Design a cohesive, responsive, RTL Hebrew system with a fresh identity and the
screens above. Lead with a short rationale for your design direction, then a
component/style foundation, then the key screens. Prioritize three showcase
screens: the course landing/sales page, the login + device-limit state, and the
live-sessions control room. Show at least one fully-themed landing page, both a
"light" and a "dark/admin" navigation chrome, and the celebration moments.
Make it better than the current version in look, clarity, and feel.
```

> **Tip:** for maximum grounding, append **Part C** (the current-state appendix) to the bottom of the prompt above under a line like `--- FOR CONTEXT, THE CURRENT DESIGN (improve on this, don't copy) ---`. Omit it if you want the AI to start with fewer preconceptions.

---

## Part B — PER-SCREEN REDESIGN KIT (iterate one screen at a time)

Paste the **SHARED HEADER** once, then append exactly **one SCREEN block**, and generate. Each block asks for a *redesign*, not a reproduction.

```text
━━━ SHARED HEADER (paste before every screen) ━━━
Redesign ONE screen for "Kursim", a Hebrew, right-to-left (RTL) multi-tenant
online-course platform. Reimagine and IMPROVE it — do not copy any existing design.
Keep: Hebrew UI, full RTL layout (Latin content like emails/URLs/prices/times stays
LTR), the product intent, and a warm/encouraging/gender-inclusive voice that turns
calm and factual on errors and the device-limit screens. Deliver a modern, polished,
mobile-first, accessible result with thoughtful micro-interactions, and strong
information hierarchy. You choose the palette, type, and layout — aim for a
distinctive premium identity (a warm editorial teal/copper direction with Rubik +
Heebo is one option, not a requirement). Context: Kursim's signature feature is
device-session limiting — students are capped at N simultaneous devices; extra
logins are blocked or evict the oldest device in real time. Now redesign this screen:
━━━ END HEADER ━━━


━━━ SCREEN 1 · Course landing / sales page (PUBLIC — showcase) ━━━
A public marketing sales page for one course, that must feel premium and convert.
Include (reorganize freely): a hero (headline, subheadline, key CTA, and quick
stats like modules/lessons/hours/instructor); who-it's-for; what-you'll-achieve
outcomes; benefits; a media gallery with a before/after comparison slider; a
curriculum accordion (modules → lessons + durations); testimonials; verified
student reviews (star ratings + a "verified student" badge); an FAQ; and a final
price + CTA band. Keep the idea of a selectable accent theme (multiple color
identities) — but redesign how theming looks. Sticky nav + sticky mobile CTA.
Make it your best, most modern sales-page design.


━━━ SCREEN 2 · Login + device-limit state (PUBLIC — showcase, signature feature) ━━━
Redesign the login. Show three states: (a) normal sign-in (email + password, LTR
fields, primary submit); (b) DEVICE LIMIT REACHED — the account is already on the
max number of devices, so the login is blocked; present the account's active
devices (device label + last-seen) and a calm explanation + remedy, with a clear
way to understand what to do; (c) an "your account was opened on another device"
evicted notice. This is the product's signature feature — make the device-limit
state feel trustworthy and well-designed, not like an error dump.


━━━ SCREEN 3 · Live-sessions control room (OWNER — showcase) ━━━
Redesign the owner's view of all active student devices across the school. It should
feel LIVE (real-time updating). For each active session show who (email), device, IP,
connected-since, and last-seen, with a clear, safe way to disconnect any device.
Rethink this beyond a plain table — help the owner spot sharing at a glance. Include
a great empty state. This is the device-limiting cockpit.


━━━ SCREEN 4 · Student "My courses" home (STUDENT) ━━━
Redesign the student's landing area: their enrolled courses with clear progress, an
inviting way to resume where they left off, and a discovery section for other
published courses they could take. Strong empty state for a brand-new student.


━━━ SCREEN 5 · Course-creation wizard (OWNER) ━━━
Redesign a friendly multi-step course-creation flow whose payoff is a ready-made
marketing landing page. Steps cover: basics; audience & outcomes; benefits; social
proof (testimonials + FAQ); pricing & enrollment; and page style (an accent-theme
picker + a course-emoji picker + about text). Make progress obvious, allow skipping
optional steps, and end on a rewarding success screen with a publish toggle and a
shareable landing URL. Prioritize clarity and momentum.


━━━ SCREEN 6 · Settings · device policy (OWNER) ━━━
Redesign the school settings, focused on the device policy: a device-limit number
per student, and a choice between BLOCK (refuse a new device) and EVICT-OLDEST
(auto-disconnect the least-active device). Make the trade-off between the two
policies easy to understand at a glance. Include the school-name field. Clear save
confirmation.


━━━ SCREEN 7 · Platform marketing home (PUBLIC, "/") ━━━
Redesign the marketing home for Kursim itself (the SaaS product). Pitch the core
promise — "your own digital school, without shared passwords" — and make the
device-limiting hook tangible (e.g. a live "who's connected now" visual that shows
a 4th device being blocked). Clear entry points for platform admin, and guidance
that schools live at /t/school-name. Make it convert.


━━━ SCREEN 8 · Accept invitation / signup (PUBLIC) ━━━
Redesign the invite-acceptance signup: a warm "you've been invited to learn with us"
welcome + a short account-creation form (email + password). Handle the
"email already registered" and "invite invalid/expired" states gracefully.


━━━ SCREEN 9 · Course detail + completion celebration (STUDENT) ━━━
Redesign the course detail page: overall progress + a prominent resume action, and a
curriculum where each lesson clearly shows done / in-progress / not-started, with
video indicators and durations. Design the 100%-complete state as a genuine
celebration (a recap of the journey), followed by a review prompt (interactive star
rating + optional text) and a referral "share & earn coins" moment. Make finishing
feel great.


━━━ SCREEN 10 · Video lesson player (STUDENT) ━━━
Redesign the lesson-watching experience: a focused video player, the lesson's notes,
and easy prev/next navigation, with clear breadcrumbs to the course. Design the
loading, "no video yet", and error states. Keep it distraction-free and elegant.


━━━ SCREEN 11 · Change password (any authed user) ━━━
Redesign a simple, reassuring change-password screen. Cover the forced first-login
variant (with a "you must change your password before continuing" message) and the
voluntary variant.


━━━ SCREEN 12 · Owner dashboard (OWNER) ━━━
Redesign the owner's dashboard: an at-a-glance overview of the school — students,
courses (with how many are published), live device sessions, and published landing
pages — plus a live "who's watching now" panel. Make the key numbers scannable and
give the owner an obvious next action. Rethink beyond a generic stat-card row.


━━━ SCREEN 13 · Courses list (OWNER/INSTRUCTOR) ━━━
Redesign the course catalog for staff: each course showing its state (draft/
published), module & enrollment counts, and landing-page status, with a clear path
to create a new course. Great empty state.


━━━ SCREEN 14 · Course editor (OWNER) ━━━
Redesign the course editor. It has three jobs — organize CONTENT (modules & lessons,
with video + attachment uploads and upload progress), manage ENROLLMENTS, and edit
the MARKETING landing page (hero copy, gallery with before/after, testimonials, FAQ,
reviews moderation, affiliates, pricing, and page style). This is the densest part
of the app today — your main task is to make it feel calm, organized, and easy to
navigate. Propose the best structure (tabs, panels, or a new pattern) and show at
least the content editing and the marketing editing.


━━━ SCREEN 15 · Students & invites (OWNER) ━━━
Redesign student management: a clear roster (role, active/suspended, courses
enrolled, how many devices are currently connected, last login) with per-student
actions (suspend, reset password, delete, and view/disconnect their devices), plus
a flow to add a student directly or generate a one-time 72-hour invite link. Make
the "connected devices per student" information a first-class, glanceable signal.


━━━ SCREEN 16 · Super-admin tenants manager (SUPER_ADMIN) ━━━
Redesign the platform operator's view: manage schools (create / suspend / delete),
each with its user count, course count, and device limit, and a quick link into each
school. Give this a distinct admin chrome that reads as "platform level", separate
from a school owner's view.


━━━ SCREEN 17 · Component system / UI kit (design once, reuse) ━━━
Design the foundational design system for Kursim: color and type scales, and every
shared component in its states — buttons (primary / secondary / subtle / destructive
/ a single high-emphasis conversion button), cards, form fields (default/focus/
error), badges/tags, modals, data tables, stat cards, empty states, progress
indicators, section headers, navigation (a light "in-school" chrome and a dark
"platform/admin" chrome), and a split-screen auth layout. This kit governs every
other screen — make it distinctive, accessible, and fully RTL.
```

**Suggested build order:** #17 (lock the system) → #2 & #3 (the signature feature) → #1 & #7 (the two front doors) → #5, #12, #14 (the heaviest owner flows) → then the rest. Each block is self-contained, so you can start anywhere.

---

## Part C — REFERENCE APPENDIX: the CURRENT design (improve on this, don't copy)

Hand this to the AI only for grounding — it describes what exists today so the redesign is an informed improvement, not a blind guess. Nothing here is a constraint except Hebrew + RTL + the product's roles and flows.

### Current visual direction (a starting point to push past)
- Feel: warm, editorial, calm; paper-toned off-white canvas, not a cold SaaS look.
- Fonts: **Rubik** (headings/numbers/buttons) + **Heebo** (body), both Hebrew-capable.
- Current palette: paper `#FAF9F7`, ink `#201D1A`, muted `#6F6A63`, line `#E7E3DC`;
  brand teal (primary `#12626E`, dark surfaces `#082A30`, tint `#DCEDEF`);
  copper `#AD5527` reserved for the single most important CTA;
  semantic ok `#2E7D4F` / danger `#B3382C` / warn `#A16207` used as ~10% fills.
- Current shapes: 20px rounded cards/modals/tables, soft warm shadows, teal focus rings.
- Five current landing accent themes (name → main/deep/soft/accent):
  petrol #177A87/#0B3B42/#F0F6F7/#C26A3B · copper #AD5527/#572A16/#FAF3EC/#12626E ·
  plum #7E4A8C/#43254C/#F7F2F8/#B08A3E · forest #3D7A4E/#1D3B26/#F1F6F2/#B0592D ·
  midnight #45508F/#1E2447/#F2F3F9/#C2703B.
- Current UI kit: Button (primary/secondary/ghost/danger/copper-cta), Card, Field,
  Badge, Modal, Table, StatCard, EmptyState, ProgressBar, PageHeader, sticky Navbar
  (light + dark tones), split-screen AuthShell.

### Known weak spots the redesign should address
- Admin tables (students, sessions, tenants) are dense and utilitarian.
- The course editor and the marketing/landing editor pack a lot into stacked cards +
  tabs + a sticky save bar — organization can be clearer.
- The device-limiting feature is powerful but currently surfaced as plain lists;
  it deserves a more legible, reassuring, and distinctive visualization.
- Empty/loading/error states exist but are conventional; they're an opportunity for
  more personality.

### Representative Hebrew copy (tone reference — keep the voice, improve the design)
- Login/auth: "התחברות", "כניסה", "אימייל או סיסמה שגויים", "יש להחליף את הסיסמה לפני שממשיכים".
- Device limit (the emotional core): "חריגה ממגבלת המכשירים",
  "החשבון מחובר כבר במספר המכשירים המרבי. יש להתנתק מאחד המכשירים ולנסות שוב.",
  "מכשירים מחוברים", "החשבון הופעל ממכשיר אחר".
- Sessions/admin: "מי מחובר עכשיו", "חיבורים פעילים", "ניתוק", "מחובר מאז", "נראה לאחרונה".
- Settings policy: "מגבלת מכשירים לתלמיד", "חסימת התחברות חדשה", "ניתוק המכשיר הישן ביותר".
- Empty states (gentle, instructive): "אין קורסים עדיין", "אין חיבורים פעילים כרגע",
  "עדיין אין שותפים — תלמידים שרכשו את הקורס יכולים לשתף קישור אישי ולצבור מטבעות".
- Celebration: "כל הכבוד, סיימתם את הקורס! 🎓".
- Affiliate (playful/gamified): "שתפו את הקורס וצברו מטבעות 🪙",
  "עוד {n} מבקרים למטבע הבא".
- Wizard: "אשף הקמת קורס",
  "כמה שאלות קצרות — ובסוף מחכה לכם גם דף נחיתה מוכן לשיווק".
- Reviews: "איך היה הקורס?", "תלמיד/ה מאומת/ת" (note the gender-inclusive slash form).
- Super-admin: "בתי ספר", "בית ספר חדש", "מעבר לבית הספר".

### Roles & flows (keep intact)
- SUPER_ADMIN creates schools (mints an owner) · OWNER runs a school end to end ·
  INSTRUCTOR edits content only · STUDENT consumes courses. Email is unique per
  school, not globally.
- Core journeys: platform bootstrap → owner onboarding (forced password change →
  6-step course wizard) → publish a themed public landing page → enroll students
  (direct or one-time invite link) → student watches lessons & tracks progress →
  device-limit enforcement (block or real-time eviction) → completion → review
  moderation → affiliate/referral loop (coins per unique visitors).
```

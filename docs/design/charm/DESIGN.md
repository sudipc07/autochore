---
name: Executive Operational Clarity
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#4b41e1'
  on-secondary: '#ffffff'
  secondary-container: '#645efb'
  on-secondary-container: '#fffbff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#271901'
  on-tertiary-container: '#98805d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#0f0069'
  on-secondary-fixed-variant: '#3323cc'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  status-success: '#10B981'
  status-warning: '#F59E0B'
  status-error: '#EF4444'
  bg-subtle: '#F8FAFC'
  border-light: '#E2E8F0'
  activity-transit: '#94A3B8'
  activity-idle: '#CBD5E1'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1440px
  margin-edge: 2rem
  gutter: 1.5rem
  stack-lg: 2rem
  stack-md: 1rem
  stack-sm: 0.5rem
---

## Brand & Style

The design system is engineered for facility-services executives who require high-level operational intelligence without technical friction. The brand personality is **authoritative, observant, and dependable**. It avoids the clutter of traditional analytics, opting instead for a "calm dashboard" approach that emphasizes outcomes over raw data.

The visual style is **Corporate / Modern** with a strong emphasis on **Minimalism**. It utilizes expansive whitespace to reduce cognitive load, allowing critical status indicators to stand out. The interface should feel like a high-end executive report—structured, clean, and intentional. Every element serves to answer three core questions: "Is the work done?", "Where are the gaps?", and "How is the team performing?"

## Colors

The palette is anchored by **Slate (Primary)** to provide a professional, architectural structure. **Indigo (Secondary)** is used sparingly for primary actions and to draw attention to interactive elements. 

Status colors are the "source of truth" in this design system:
- **Emerald (Success):** Represents full coverage and completed tasks.
- **Amber (Warning):** Indicates partial coverage or areas requiring attention.
- **Rose (Error):** Highlights missed areas, exceptions, or critical flags.

Backgrounds utilize a very light gray (`#F8FAFC`) to provide a soft canvas that reduces eye strain compared to pure white, while borders are kept subtle to maintain a "borderless" feel that relies on alignment and white space for grouping.

## Typography

This design system uses **Hanken Grotesk** exclusively to achieve a sharp, contemporary, and highly legible aesthetic. It provides the necessary "tech-forward" feel while remaining approachable for non-technical users.

- **Headlines:** Use tighter letter-spacing and heavier weights to anchor the page.
- **Body Text:** Optimized for readability with generous line heights.
- **Labels:** Used for metadata (e.g., "ZONE", "SHIFT TIME") in uppercase with slight tracking to differentiate from body content.
- **KPI Values:** Large, bold weights are used for primary metrics to ensure they are the first thing a user sees upon landing.

## Layout & Spacing

The layout follows a **Fixed Grid** model on desktop, centered within a 1440px container to ensure readability on large executive displays. 

- **Grid:** A 12-column system with 24px (1.5rem) gutters.
- **Rhythm:** A 4px/8px base scaling system.
- **Padding:** KPI cards and data containers use generous internal padding (min 24px) to emphasize the "non-technical," premium feel.
- **Breakpoints:**
  - **Desktop (1280px+):** Full 12-column view with persistent sidebar or top navigation.
  - **Tablet (768px - 1279px):** Content reflows to 1 or 2 columns; complex maps use horizontal scroll or zoom-to-fit.
  - **Mobile (Below 768px):** Single column stack; KPI cards move to a 2x2 grid or horizontal carousel.

## Elevation & Depth

Visual hierarchy is established through **Tonal Layers** and extremely **Ambient Shadows**.

1.  **Canvas:** The base background is `#F8FAFC`.
2.  **Surfaces:** Primary containers (cards, tables) are pure white (`#FFFFFF`) with a 1px border of `#E2E8F0`.
3.  **Elevation:** Use a single, very soft "Executive Shadow" for floating elements or to lift active KPI cards: `0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)`.
4.  **Interaction:** Elements do not "lift" significantly on hover; instead, they use subtle background color shifts (e.g., from White to Slate-50) to maintain a grounded, professional feel.

## Shapes

The shape language is **Rounded (0.5rem)**, providing a modern and friendly appearance that softens the industrial nature of facilities management.

- **KPI Cards & Containers:** Use `rounded-lg` (1rem) to create a distinct, modern "sheet" look.
- **Buttons & Inputs:** Use the base `rounded` (0.5rem).
- **Status Tags/Chips:** Use full pill-shaping (999px) to distinguish them from actionable buttons.
- **Data Visualizations:** Bar charts should have slight corner radii (2-4px) on the top/end of bars to maintain consistency with the UI.

## Components

### KPI Cards
The primary vehicle for executive insights. Must include:
- A clear label (Label-MD).
- Large value (Display-LG).
- A secondary trend indicator or status icon.
- High-contrast background for status-critical cards (e.g., a "Missed Exceptions" card may have a subtle red top-border).

### Data Tables
Clean and airy. 
- No vertical lines; only subtle horizontal dividers (`border-light`).
- Row height: 56px minimum for readability.
- Columns use `Label-SM` for headers.

### Status Chips
Used for "Covered", "Partial", and "Missed".
- Subdued background version: Light tint of the status color with high-saturation text.
- Example: "Covered" uses a light emerald background with dark emerald text.

### Horizontal Timelines (Shift View)
- Use a continuous 8px tall bar.
- Tasks are colored blocks within the bar.
- Transit/Idle use the named neutral colors (`activity-transit`, `activity-idle`) to visually "recede" compared to active cleaning tasks.

### Buttons
- **Primary:** Deep Navy background, white text.
- **Secondary:** White background, Slate-200 border, Slate-900 text.
- No heavy gradients or high-gloss effects.

### Narrative Summary
A specific component for AI-generated text. Use `body-lg` with increased line-height and a subtle Indigo-50 left-border accent to denote its "generated" nature.
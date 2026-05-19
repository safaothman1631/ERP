# Requirements Document

## Introduction

This feature covers a complete visual and infrastructure overhaul of the public-facing surface of the ERPIQ application. The scope includes:

1. **Landing Page** — full modern redesign from scratch, replacing the current dark-gradient hero with a richer, more unique visual identity while keeping all existing sections (Hero, Features, Plans, Testimonials, CTA).
2. **Login Page** — complete redesign using the existing split-screen `AuthLayout` shell, adding Apple Sign-In alongside the existing Google Sign-In, improving attempt-tracking UX, and ensuring full RTL/LTR support.
3. **Sign-Up Page** — same redesign treatment as Login, with Apple Sign-In, org-name field, and RTL/LTR support.
4. **Page Transitions** — upgrade from the current 200 ms fade+8 px slide to a richer, unique SPA animation system where the Navbar never reloads and route changes feel seamless.
5. **Vercel Deployment** — migrate the React/Vite frontend from Firebase Hosting + Google Cloud Run to Vercel (account `safaothman1631s-projects`), including `vercel.json` configuration and environment variable mapping.
6. **Auth Testing** — end-to-end verification that Google Sign-In and Apple Sign-In work correctly in the Vercel-hosted environment.

The backend (FastAPI on Cloud Run + Firestore) is **not** in scope; only the frontend deployment target changes.

---

## Glossary

| Term | Definition |
|------|-----------|
| **Landing_Page** | The public marketing page at `/` (unauthenticated route), containing Hero, Features, Plans, Testimonials, and CTA sections. |
| **Login_Page** | The authentication page at `/login`, using `AuthLayout` split-screen shell. |
| **SignUp_Page** | The registration page at `/signup`, using `AuthLayout` split-screen shell. |
| **AuthLayout** | The 50/50 split-screen wrapper component (`src/layouts/AuthLayout.tsx`) shared by Login and SignUp. |
| **Navbar** | The fixed top navigation bar rendered inside `Landing_Page` (not a separate route-level component). |
| **PageTransition** | The Framer Motion wrapper component (`src/components/PageTransition.tsx`) applied to every routed page. |
| **AnimatePresence** | Framer Motion's component that drives enter/exit animations when routes change inside `App.tsx`. |
| **Google_Sign_In** | OAuth 2.0 sign-in via Firebase Authentication using the Google provider. |
| **Apple_Sign_In** | OAuth 2.0 sign-in via Firebase Authentication using the Apple provider (`apple.com`). |
| **Vercel** | The target hosting platform for the frontend static build (account `safaothman1631s-projects`). |
| **vercel.json** | The Vercel project configuration file placed at `frontend/vercel.json`. |
| **SPA_Transition** | A client-side route change that does not trigger a full browser reload. |
| **Glass_Morphism** | A UI style using `backdrop-filter: blur()` with semi-transparent backgrounds and subtle borders. |
| **RTL** | Right-to-left text direction, used for Kurdish (`ku`) and Arabic (`ar`) languages. |
| **LTR** | Left-to-right text direction, used for English (`en`). |
| **Attempt_Tracker** | The client-side mechanism in `LoginPage` that counts failed login attempts and enforces a 15-minute lockout after 5 failures. |
| **MotionGate** | The `src/components/MotionGate.tsx` wrapper that disables animations when `prefers-reduced-motion` is set. |
| **Particles** | The `react-bits` particle canvas component used on the branding side of `AuthLayout`. |
| **Typewriter** | The `react-bits` typewriter text component used on the branding side of `AuthLayout`. |
| **EARS** | Easy Approach to Requirements Syntax — the pattern language used for all acceptance criteria. |

---

## Requirements

---

### Requirement 1: Landing Page — Visual Identity and Hero Section

**User Story:** As a potential customer visiting the site, I want to see a visually striking, modern hero section so that I immediately understand the product's value and feel confident in its quality.

#### Acceptance Criteria

1. THE `Landing_Page` SHALL render a full-viewport hero section (`min-height: 100vh`) with an animated background implemented as CSS keyframe animations or Framer Motion `animate` on SVG/canvas elements — the background SHALL NOT be a static linear-gradient or radial-gradient blob identical to the current implementation.
2. WHEN the `Landing_Page` first mounts, THE `Landing_Page` SHALL begin staggered Framer Motion entrance animations on the hero headline, sub-headline, CTA buttons, and stats row, with each child element delayed by 150–200 ms from the previous, and all animations completing within 1000 ms of mount.
3. THE `Landing_Page` SHALL display in the hero section: a headline (`h1`), a sub-headline paragraph, a "Get Started" button that navigates to `/signup`, a "Sign In" button that navigates to `/login`, and a stats row containing the values "500+", "50K+", and "99.9%" with their respective labels in the active language.
4. WHEN the viewport width is below 640 px, THE `Landing_Page` SHALL render all hero elements in a single vertical column and SHALL NOT render the desktop navigation links (language toggle, Login button, Get Started button).
5. WHEN the viewport width is 640 px or above, THE `Landing_Page` SHALL render the horizontal navigation bar containing the language toggle button, a Login button, and a Get Started button.
6. WHEN the user activates the language toggle button, THE `Landing_Page` SHALL update all visible text strings to the newly selected language (`ku`, `en`, or `ar`) without triggering a full browser reload.
7. WHEN the user activates the language toggle to `ku` or `ar`, THE `Landing_Page` SHALL set `dir="rtl"` on its root element; WHEN the user activates the language toggle to `en`, THE `Landing_Page` SHALL set `dir="ltr"` on its root element.
8. ON non-touch desktop devices (where `window.matchMedia('(pointer: coarse)').matches` is `false`), THE `Landing_Page` SHALL render a custom cursor consisting of an outer ring (32 × 32 px) and an inner dot (8 × 8 px), and the outer ring SHALL scale to at least 1.5× its default size when the pointer is over a button or anchor element.
9. WHEN the user clicks the "Get Started" button, THE `Landing_Page` SHALL play a fade-out + upward-slide exit animation with a total declared duration of no more than 320 ms before calling `navigate('/signup')`.
10. WHEN the user clicks the "Sign In" button, THE `Landing_Page` SHALL play a fade-out + upward-slide exit animation with a total declared duration of no more than 320 ms before calling `navigate('/login')`.

---

### Requirement 2: Landing Page — Features, Plans, Testimonials, and CTA Sections

**User Story:** As a potential customer, I want to read about features, pricing, and testimonials so that I can make an informed decision about signing up.

#### Acceptance Criteria

1. THE `Landing_Page` SHALL render a Features section containing at least 6 feature cards, each with an icon, a title, and a description in the active language.
2. WHEN a feature card enters the viewport, THE `Landing_Page` SHALL trigger a Framer Motion `whileInView` animation on that card with `once: true` so the animation plays exactly once per page load.
3. THE `Landing_Page` SHALL render a Plans section with at least 3 pricing tiers (Starter, Business, Enterprise), each showing a name, price, billing period, and a list of at least 4 features in the active language.
4. WHEN the user hovers over a pricing card, THE `Landing_Page` SHALL apply a visible hover state change (scale, border highlight, or box-shadow change) within 200 ms using CSS `transition` or Framer Motion `whileHover`.
5. THE `Landing_Page` SHALL render a Testimonials section with at least 3 testimonial cards, each showing a name, role, testimonial text, and a star rating.
6. THE `Landing_Page` SHALL render a CTA section at the bottom of the page with a headline and a "Get Started" button that navigates to `/signup`.
7. THE `Landing_Page` SHALL render a footer with copyright text and links labelled "Terms" and "Privacy".
8. WHEN the viewport width is below 640 px, THE `Landing_Page` SHALL display Features, Plans, and Testimonials in a single-column layout (1 card per row).
9. WHEN the viewport width is 640 px or above, THE `Landing_Page` SHALL display Features and Testimonials in a grid with a minimum of 2 columns using CSS `auto-fit` or explicit column definitions.

---

### Requirement 3: Landing Page — Navbar Persistence

**User Story:** As a user scrolling through the landing page, I want the navbar to remain visible and functional at all times so that I can navigate without scrolling back to the top.

#### Acceptance Criteria

1. THE `Landing_Page` Navbar SHALL be rendered with `position: fixed`, `top: 0`, and a `z-index` value greater than all other page content elements.
2. WHEN the user scrolls down more than 20 px from the top of the page, THE `Landing_Page` Navbar SHALL apply `backdrop-filter: blur()` and increase its background opacity to at least 0.85 so that text behind the navbar is not legible through it.
3. WHEN the user clicks the Login button in the Navbar, THE `Landing_Page` SHALL call React Router's `navigate('/login')` — no `window.location` assignment or `<a href>` full-page navigation SHALL be used.
4. WHEN the user clicks the Get Started button in the Navbar, THE `Landing_Page` SHALL call React Router's `navigate('/signup')` — no `window.location` assignment or `<a href>` full-page navigation SHALL be used.
5. WHEN the mobile menu is open and the user resizes the viewport to 640 px or above, THE `Landing_Page` SHALL set the mobile menu open state to `false` and hide the mobile dropdown.

---

### Requirement 4: Login Page — Redesign with Apple Sign-In

**User Story:** As a returning user, I want a beautiful, modern login page with Google and Apple sign-in options so that I can authenticate quickly and securely.

#### Acceptance Criteria

1. THE `Login_Page` SHALL use the `AuthLayout` split-screen shell with the branding panel occupying approximately 50% of the viewport width and the form panel occupying the remaining width.
2. THE `Login_Page` SHALL render an email input field, a password input field, a submit button, a Google Sign-In button, and an Apple Sign-In button.
3. WHEN the user submits the email/password form with a non-empty email value that matches the email format and a non-empty password value, THE `Login_Page` SHALL call `POST /api/auth/login` with the email and password, then call `useAuthStore.login()` with the returned token data, then call `navigate('/')`.
4. WHEN the user clicks the Google Sign-In button, THE `Login_Page` SHALL call Firebase `signInWithPopup` with the Google provider, obtain the `id_token` from the result, call `POST /api/auth/firebase-login` with the token, and on a 200 response call `useAuthStore.login()` and `navigate('/')`.
5. WHEN the user clicks the Apple Sign-In button, THE `Login_Page` SHALL call Firebase `signInWithPopup` with the `OAuthProvider('apple.com')` provider, obtain the `id_token` from the result, call `POST /api/auth/firebase-login` with the token, and on a 200 response call `useAuthStore.login()` and `navigate('/')`.
6. IF the Firebase `signInWithPopup` call fails with error code `auth/unauthorized-domain`, THEN THE `Login_Page` SHALL display an error message in the currently active language explaining that the domain is not authorised.
7. IF the Firebase `signInWithPopup` call fails with error code `auth/popup-blocked`, THEN THE `Login_Page` SHALL display an instruction in the currently active language telling the user to allow popups for this site.
8. THE `Login_Page` SHALL render the `LanguageSwitcher` component in the top-right corner when `dir="ltr"` and in the top-left corner when `dir="rtl"`, visible and interactive before the user authenticates.
9. WHEN the active language is `ku` or `ar`, THE `Login_Page` form panel SHALL render with `dir="rtl"`.
10. WHEN the active language is `en`, THE `Login_Page` form panel SHALL render with `dir="ltr"`.
11. THE `Login_Page` form panel SHALL have `backdrop-filter: blur(16px)` applied and a background with opacity less than 1 (semi-transparent).
12. IF the browser does not support `backdrop-filter`, THEN THE `Login_Page` form panel SHALL render with a fully opaque solid background colour.
13. IF `POST /api/auth/login` returns an error response (non-2xx), THEN THE `Login_Page` SHALL display the error detail from the response body in the currently active language.
14. IF `POST /api/auth/firebase-login` returns an error response (non-2xx), THEN THE `Login_Page` SHALL display the error detail from the response body in the currently active language.

---

### Requirement 5: Login Page — Attempt Tracking and Lockout

**User Story:** As a security-conscious administrator, I want failed login attempts to be tracked and the account temporarily locked after repeated failures so that brute-force attacks are mitigated.

#### Acceptance Criteria

1. THE `Attempt_Tracker` SHALL persist the failed attempt count and lockout expiry timestamp in `localStorage` so that the state survives page reloads.
2. WHEN the user fails to log in 5 times, THE `Attempt_Tracker` SHALL record a lockout expiry timestamp equal to `Date.now() + 15 * 60 * 1000` ms in the persisted state.
3. WHEN the lockout expiry timestamp is recorded, THE `Login_Page` SHALL disable the email input, password input, and submit button.
4. WHILE the account is locked, THE `Login_Page` SHALL display a countdown timer in `MM:SS` format showing `Math.ceil((lockedUntil - Date.now()) / 1000)` seconds remaining, updated every 1000 ms via `setInterval`.
5. WHEN the countdown reaches zero (remaining ms ≤ 0), THE `Attempt_Tracker` SHALL reset the failed attempt count to 0 and clear the lockout expiry timestamp from `localStorage`.
6. WHEN the countdown reaches zero, THE `Login_Page` SHALL re-enable the email input, password input, and submit button.
7. WHEN the user successfully authenticates, THE `Attempt_Tracker` SHALL remove the persisted attempt state from `localStorage`.
8. WHEN the `Login_Page` mounts and the persisted lockout expiry timestamp is in the future, THE `Login_Page` SHALL immediately disable the form and start the countdown from the remaining time.
9. WHEN the `Login_Page` mounts and the persisted lockout expiry timestamp is in the past, THE `Login_Page` SHALL reset the attempt state and render the form in its enabled state.
10. WHEN the user has 1–4 failed attempts, THE `Login_Page` SHALL display an error message that includes the value `(5 - currentFailedCount)` as the number of remaining attempts, in the currently active language.
11. IF the persisted attempt state in `localStorage` is missing, malformed, or unparseable, THE `Login_Page` SHALL treat it as a fresh state (count = 0, no lockout) and SHALL NOT throw an error or block the user.

---

### Requirement 6: Login Page — Keyboard Navigation and Accessibility

**User Story:** As a keyboard-only user, I want to navigate and submit the login form entirely with the keyboard so that the page is accessible.

#### Acceptance Criteria

1. THE `Login_Page` form SHALL have a logical Tab order: email field → password field → forgot-password link → submit button → Google Sign-In → Apple Sign-In → sign-up link.
2. WHEN the user presses Enter while the password field is focused, THE `Login_Page` SHALL submit the form.
3. THE `Login_Page` SHALL display a visible focus ring (outline or box-shadow) on all interactive elements when navigated via keyboard.
4. THE `Login_Page` SHALL include `aria-label` and `aria-required="true"` on the email and password input fields, and `aria-live="assertive"` on the error message container.
5. WHEN the lockout countdown is active, THE `Login_Page` SHALL render the countdown element with `aria-live="polite"` and `aria-atomic="true"` so screen readers announce updates.

---

### Requirement 7: Sign-Up Page — Redesign with Apple Sign-In

**User Story:** As a new user, I want a modern sign-up page with Google and Apple sign-in options so that I can register my organisation quickly.

#### Acceptance Criteria

1. THE `SignUp_Page` SHALL use the `AuthLayout` split-screen shell.
2. THE `SignUp_Page` SHALL render a registration form with five fields: Organisation Name, Full Name, Email, Password, and Confirm Password.
3. WHEN the user submits the form with all fields non-empty, a valid email format, a password of at least 8 characters, and matching Password and Confirm Password values, THE `SignUp_Page` SHALL call `POST /api/auth/register`, then call `useAuthStore.login()` with the returned token data, then call `markFreshSignup()`, then call `navigate('/')`.
4. IF any field is empty, the email format is invalid, the password is shorter than 8 characters, or the Password and Confirm Password values do not match, THEN THE `SignUp_Page` SHALL display a field-level validation error in the currently active language without calling `POST /api/auth/register`.
5. WHEN the user clicks the Google Sign-In button and Firebase `signInWithPopup` succeeds, THE `SignUp_Page` SHALL display a modal with an Organisation Name input field.
6. WHEN the user clicks the Apple Sign-In button, THE `SignUp_Page` SHALL call Firebase `signInWithPopup` with `OAuthProvider('apple.com')`, and on success SHALL display a modal with an Organisation Name input field.
7. IF the Firebase `signInWithPopup` call for Apple fails, THEN THE `SignUp_Page` SHALL display an error message indicating the reason for failure in the currently active language.
8. WHEN the active language is `ku` or `ar`, THE `SignUp_Page` SHALL render with `dir="rtl"`.
9. WHEN the active language is `en`, THE `SignUp_Page` SHALL render with `dir="ltr"`.
10. THE `SignUp_Page` form panel SHALL have `backdrop-filter: blur(16px)` applied and a background with opacity less than 1.
11. IF the browser does not support `backdrop-filter`, THEN THE `SignUp_Page` form panel SHALL render with a fully opaque solid background colour.
12. IF the user submits the Organisation Name modal with an empty or whitespace-only value, THEN THE `SignUp_Page` SHALL display a validation error and SHALL NOT call `POST /api/auth/firebase-register`.

---

### Requirement 8: Page Transitions — SPA Navigation Without Reload

**User Story:** As a user navigating between pages, I want smooth, unique animations between route changes so that the app feels like a polished single-page application.

#### Acceptance Criteria

1. THE `PageTransition` component SHALL wrap every routed page element in `App.routes.tsx` so that all route changes produce an animated transition.
2. WHEN the user navigates between any two routes, THE `AnimatePresence` in `App.tsx` (with `mode="wait"`) SHALL complete the exit animation of the leaving page before starting the enter animation of the entering page, without a full browser reload.
3. THE `PageTransition` component SHALL accept a `variant` prop that selects from a named set of at least 3 registered animation variants (e.g., `"fade"`, `"slide-up"`, `"scale-fade"`), defaulting to `"fade"` when no variant is specified.
4. WHEN `prefers-reduced-motion` is set (detected via `useReducedMotion()`), THE `PageTransition` component SHALL use variants with `duration: 0` and no `y`, `scale`, or `clipPath` changes.
5. THE `Navbar` inside `Landing_Page` SHALL be rendered as a `position: fixed` element that persists in the DOM during scroll-based navigation within the landing page and does not unmount on route changes within the landing page.
6. WHEN the user navigates from the `Landing_Page` to `/login` or `/signup`, THE `Landing_Page` SHALL play its exit animation (declared duration ≤ 320 ms) before React Router unmounts it.
7. THE `PageTransition` enter animation variants SHALL have a declared `duration` value of no greater than 400 ms.
8. THE `PageTransition` exit animation variants SHALL have a declared `duration` value of no greater than 300 ms.

---

### Requirement 9: Page Transitions — Unique Animation Design

**User Story:** As a user, I want the page transitions to feel unique and premium so that the application stands out from generic SPA templates.

#### Acceptance Criteria

1. THE `PageTransition` component SHALL register at least 3 named animation variants, each defining distinct `initial`, `animate`, and `exit` states using Framer Motion `variants` objects — CSS `transition` or `animation` properties SHALL NOT be used as the primary mechanism for these transitions.
2. WHEN the `Landing_Page` exits (user navigates away), THE `Landing_Page` SHALL use a variant whose `exit` state includes both an `opacity` change to 0 and a `y` translation of at least −20 px, making it visually distinct from a plain fade.
3. WHEN the `Login_Page` or `SignUp_Page` enters, THE page SHALL use a variant whose `initial` state includes `scale: 0.96` and `opacity: 0`, and whose `animate` state transitions to `scale: 1` and `opacity: 1` with an `ease` of `[0.22, 1, 0.36, 1]` or equivalent cubic-bezier.
4. WHEN the user navigates from `/login` or `/signup` back to the `Landing_Page`, THE `Landing_Page` SHALL enter using a variant whose `initial` state includes a positive `y` value (downward offset) and `opacity: 0`, creating a downward-slide-in effect.
5. THE `PageTransition` animation system SHALL use Framer Motion `variants` objects passed to `motion` components, and SHALL NOT rely on CSS `@keyframes`, `transition`, or `animation` properties as the primary transition mechanism.

---

### Requirement 10: Vercel Deployment — Configuration

**User Story:** As a developer, I want the frontend to be deployable to Vercel under the `safaothman1631s-projects` account so that we benefit from Vercel's global CDN, preview deployments, and zero-config CI/CD.

#### Acceptance Criteria

1. THE `Vercel` deployment SHALL use a `vercel.json` file located at `frontend/vercel.json` that specifies the build command, output directory, and SPA fallback rewrites.
2. THE `vercel.json` SHALL include a rewrite rule `{ "source": "/((?!_next|assets|favicon).*)", "destination": "/index.html" }` (or equivalent) so that all non-asset paths are served by `index.html`.
3. THE `vercel.json` SHALL set `"framework": "vite"`, `"buildCommand": "npm run build"`, and `"outputDirectory": "dist"` — running `vercel build` with this configuration SHALL produce a deployable artifact without additional manual configuration.
4. THE `Vercel` project SHALL be linked to the `safaothman1631s-projects` Vercel account via `vercel link` or the Vercel dashboard.
5. THE `Vercel` project SHALL have the following environment variables defined for both Production and Preview environments: `VITE_API_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_STORAGE_BUCKET`.
6. WHEN a commit is pushed to the `main` branch, THE `Vercel` deployment SHALL automatically trigger a build and complete deployment within 10 minutes, requiring no developer action beyond the git push.
7. WHEN a pull request is opened against `main`, THE `Vercel` deployment SHALL create a preview deployment with a unique URL scoped to that PR on the `vercel.app` domain.
8. THE `Vercel` deployment SHALL serve the frontend over HTTPS using a TLS certificate issued by a publicly trusted Certificate Authority that is not expired at the time of access.
9. IF the Vercel build fails, THE `Vercel` deployment SHALL report the failure on the triggering commit or PR and SHALL NOT replace the previously deployed production version.

---

### Requirement 11: Vercel Deployment — Domain and Routing

**User Story:** As a user, I want to access the application at `erpiq.systems` after the Vercel migration so that the domain remains unchanged.

#### Acceptance Criteria

1. THE `Vercel` project SHALL have `erpiq.systems` and `www.erpiq.systems` added as custom domains in the Vercel project settings.
2. WHEN a user navigates to `http://erpiq.systems`, THE `Vercel` deployment SHALL respond with a 301 redirect to `https://erpiq.systems`.
3. WHEN a user navigates to `https://www.erpiq.systems`, THE `Vercel` deployment SHALL respond with a 301 redirect to `https://erpiq.systems`.
4. THE `Vercel` deployment SHALL serve all hashed static asset files (JS, CSS, images with content-hash in filename) with a `Cache-Control: public, max-age=31536000, immutable` header.
5. THE `Vercel` deployment SHALL serve `index.html` with a `Cache-Control: no-cache` header so that browsers always revalidate before using a cached copy.
6. WHEN `erpiq.systems` and the Vercel deployment domain are added to the Firebase Authentication Authorized Domains list, THE `Google_Sign_In` and `Apple_Sign_In` flows SHALL complete without `auth/unauthorized-domain` errors.

---

### Requirement 12: Auth Testing — Google Sign-In Verification

**User Story:** As a QA engineer, I want automated and manual test coverage for Google Sign-In so that I can confirm it works end-to-end in the Vercel-hosted environment.

#### Acceptance Criteria

1. THE `Login_Page` Google Sign-In flow SHALL be verified by a Playwright end-to-end test that mocks `signInWithPopup` to return a fake Google credential, intercepts `POST /api/auth/firebase-login` to return a 200 response with a fake JWT, and asserts that the app navigates to `/`.
2. WHEN the mocked `POST /api/auth/firebase-login` returns HTTP 404, THE `Login_Page` SHALL display the `auth_not_registered` error message (or its i18n equivalent).
3. WHEN the mocked `POST /api/auth/firebase-login` returns HTTP 200, THE `Login_Page` SHALL call `useAuthStore.login()` with the returned token data and navigate to `/`.
4. THE `SignUp_Page` Google Sign-In flow SHALL be verified by a Playwright test that mocks `signInWithPopup`, asserts the Organisation Name modal appears, fills in the modal, intercepts `POST /api/auth/firebase-register` to return 200, and asserts navigation to `/`.
5. WHEN `VITE_FIREBASE_AUTH_DOMAIN` is set to the Vercel deployment domain, THE `Google_Sign_In` popup SHALL not produce `auth/unauthorized-domain` errors in the Vercel-hosted environment.

---

### Requirement 13: Auth Testing — Apple Sign-In Verification

**User Story:** As a QA engineer, I want automated and manual test coverage for Apple Sign-In so that I can confirm it works end-to-end in the Vercel-hosted environment.

#### Acceptance Criteria

1. THE `Login_Page` Apple Sign-In flow SHALL be verified by a Playwright end-to-end test that mocks `signInWithPopup` with `OAuthProvider('apple.com')` to return a fake Apple credential, intercepts `POST /api/auth/firebase-login` to return 200, and asserts navigation to `/`.
2. WHEN the Apple Sign-In popup is triggered, THE `Login_Page` SHALL instantiate `new OAuthProvider('apple.com')` and pass it to `signInWithPopup`.
3. WHEN the mocked `POST /api/auth/firebase-login` returns HTTP 404 for an Apple credential, THE `Login_Page` SHALL display a descriptive error message in the currently active language.
4. THE `SignUp_Page` Apple Sign-In flow SHALL be verified by a Playwright test that mocks the Apple provider response, asserts the Organisation Name modal appears, fills in the modal, intercepts `POST /api/auth/firebase-register` to return 200, and asserts navigation to `/`.
5. WHEN `erpiq.systems` is added to the Apple Developer Services ID allowed domains, THE `Apple_Sign_In` popup SHALL complete without domain errors in the production environment.
6. THE `Apple_Sign_In` button SHALL have an `aria-label` attribute containing the sign-in action text in the currently active language, and its foreground/background colour contrast ratio SHALL meet WCAG 2.1 AA (minimum 4.5:1 for normal text).

---

### Requirement 14: Apple Sign-In — Firebase Configuration

**User Story:** As a developer, I want Apple Sign-In configured correctly in Firebase so that the authentication provider works in both development and production environments.

#### Acceptance Criteria

1. THE Firebase project SHALL have the Apple provider enabled under Authentication → Sign-in method with provider ID `apple.com`.
2. THE Firebase project SHALL list `erpiq.systems` and the Vercel deployment domain under Authentication → Settings → Authorized domains.
3. WHEN the Apple Sign-In button is rendered, THE `Login_Page` and `SignUp_Page` SHALL initialise the provider as `new OAuthProvider('apple.com')` and call `provider.addScope('email')` and `provider.addScope('name')` before passing it to `signInWithPopup`.
4. IF the Apple Sign-In popup returns a credential where the user's email is absent (Apple privacy relay), THEN THE `Login_Page` SHALL display an error message in the currently active language indicating that an email address is required.
5. THE Apple Developer account SHALL have a Services ID configured with the Vercel deployment domain and `erpiq.systems` as return URLs for Sign In with Apple.

---

### Requirement 15: Responsive Design and Accessibility

**User Story:** As a user on any device, I want all redesigned pages to be fully responsive and accessible so that I can use the application regardless of screen size or assistive technology.

#### Acceptance Criteria

1. THE `Landing_Page`, `Login_Page`, and `SignUp_Page` SHALL be fully usable (no horizontal overflow, no clipped content, no overlapping elements) at viewport widths from 320 px to 1920 px.
2. THE `Landing_Page` SHALL use `clamp()` for font sizes and CSS `auto-fit` grid columns for section layouts so that layout adapts fluidly without requiring explicit breakpoint overrides for every intermediate width.
3. THE `Login_Page` and `SignUp_Page` SHALL hide the `AuthLayout` branding panel and render the form panel at 100% width on viewports narrower than 880 px.
4. THE `Landing_Page`, `Login_Page`, and `SignUp_Page` SHALL achieve a Lighthouse Accessibility score of 90 or above when audited with Lighthouse in a Chromium browser.
5. ALL interactive elements (buttons, links, inputs) on the `Landing_Page`, `Login_Page`, and `SignUp_Page` SHALL have a minimum touch target size of 44 × 44 px on mobile viewports (320–767 px).
6. WHEN `prefers-color-scheme: dark` is active, THE `Landing_Page` text elements SHALL maintain a contrast ratio of at least 4.5:1 against their background (WCAG 2.1 AA).
7. THE `Landing_Page` Navbar SHALL include a visually hidden skip-to-content link as the first focusable element in the DOM that becomes visible on keyboard focus.

---

### Requirement 16: Performance

**User Story:** As a user on a slow connection, I want the landing and auth pages to load quickly so that I am not frustrated by long wait times.

#### Acceptance Criteria

1. THE `Landing_Page` SHALL achieve a Lighthouse Performance score of 80 or above when audited on a simulated 4G connection (Lighthouse "Mobile" preset).
2. THE `Landing_Page` initial HTML response SHALL include a `Content-Security-Policy` header that permits scripts and connections from Firebase Authentication domains (`*.googleapis.com`, `*.firebaseapp.com`).
3. THE `Landing_Page` sections below the fold (Features, Plans, Testimonials, CTA) SHALL be code-split using React `lazy()` and `Suspense` or dynamic `import()` so they are not included in the initial JS bundle.
4. WHEN `prefers-reduced-motion` is set, THE `MotionGate` wrapper SHALL prevent the `Particles` component from mounting, reducing canvas rendering CPU usage.
5. THE `Vercel` Edge Network SHALL serve cached static assets with a Time to First Byte (TTFB) of under 200 ms as measured from the nearest Vercel edge node to the client.

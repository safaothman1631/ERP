# Requirements Document

## Introduction

This document defines requirements for a comprehensive settings documentation and management system for the Zoho ERP project. The system currently has scattered configuration across multiple files (environment variables, TypeScript configs, theme tokens, i18n, etc.) that need to be centralized, documented, and managed through a unified interface.

## Glossary

- **System**: The Zoho ERP application (both frontend and backend)
- **Settings_Store**: The centralized Zustand store for managing application settings
- **Configuration_File**: Any file that controls application behavior (env, JSON, TOML, etc.)
- **Design_Tokens**: The design system values defined in theme/tokens.ts
- **Locale**: Language and regional settings (Kurdish, Arabic, English)
- **Environment**: The execution context (development, production)
- **RBAC**: Role-Based Access Control system
- **Feature_Flag**: A boolean toggle that enables/disables functionality

## Requirements

### Requirement 1: Settings Inventory and Documentation

**User Story:** As a developer, I want a complete inventory of all configuration files and settings in the system, so that I can understand what each setting does and how it affects the application.

#### Acceptance Criteria

1. THE Settings_Documentation_System SHALL maintain a complete inventory of all configuration files in the project
2. THE Inventory SHALL include for each config file: file path, purpose, key parameters, and whether it contains sensitive data
3. THE System SHALL document the following config file categories:
   - Environment configuration files (.env, .env.example)
   - Framework configurations (package.json, tsconfig.json, vite.config.ts, etc.)
   - Authentication/authorization configs
   - API configurations
   - Database/firestore configurations
   - Localization/i18n configs
   - Theme/styling configs
4. THE Documentation SHALL be auto-generated from code comments and actual config values
5. THE System SHALL flag any configuration that contains hardcoded secrets or credentials

### Requirement 2: Environment Configuration Management

**User Story:** As an administrator, I want to manage environment configurations across different deployment contexts, so that I can safely configure the application for development, staging, and production.

#### Acceptance Criteria

1. WHEN a backend service starts, THE System SHALL validate required environment variables using the validate_env() function
2. THE System SHALL support the following environment variables:
   - DATABASE_URL: SQLite connection string
   - SECRET_KEY: Authentication secret
   - ENVIRONMENT: deployment context (development/production)
   - DEBUG: boolean for debug mode
   - CORS_ORIGINS: comma-separated list of allowed origins
   - FIREBASE_CREDENTIALS_PATH: path to Firebase credentials
   - APP_NAME: application display name
3. IF ENVIRONMENT is set to "production" and required vars are missing, THE System SHALL fail startup with clear error messages
4. IF ENVIRONMENT is "development" and insecure defaults are used, THE System SHALL log warnings but continue startup
5. THE System SHALL never expose SECRET_KEY in API responses or logs

### Requirement 3: Theme and Design Token Management

**User Story:** As a designer, I want all design tokens (colors, spacing, typography) centralized and documented, so that I can maintain consistency across the application.

#### Acceptance Criteria

1. THE Theme_System SHALL define design tokens in a single source of truth: `frontend/src/theme/tokens.ts`
2. THE Tokens SHALL include: color palette (primary, semantic, neutrals), spacing scale, typography, motion/duration, shadows, z-index scale, elevation
3. THE AppConfigProvider SHALL consume tokens from theme/tokens.ts and apply to Ant Design
4. THE System SHALL support light and dark themes with distinct token sets
5. THE System SHALL support RTL languages (Kurdish, Arabic) with appropriate font stacks
6. THE User_Store SHALL persist theme preference in localStorage under key "theme"
7. WHEN user toggles theme, THE System SHALL update localStorage and document.documentElement attribute

### Requirement 4: Localization (i18n) Configuration

**User Story:** As a user, I want the application available in Kurdish, Arabic, and English with proper RTL support, so that I can work in my preferred language.

#### Acceptance Criteria

1. THE i18n_System SHALL support three languages: Kurdish (ku), Arabic (ar), English (en)
2. THE System SHALL store translations in JSON files under `frontend/src/locales/`
3. WHEN application loads, THE System SHALL read saved language from localStorage key "app_language"
4. IF no language is saved, THE System SHALL default to Kurdish ("ku")
5. WHEN language changes, THE System SHALL:
   - Update localStorage with new language
   - Set document.documentElement.dir to "rtl" for Kurdish/Arabic, "ltr" otherwise
   - Set document.documentElement.lang to the language code
6. THE System SHALL provide a missing key handler that humanizes translation keys

### Requirement 5: API and CORS Configuration

**User Story:** As a developer, I want API endpoints and CORS policies documented and configurable, so that I can properly integrate frontend with backend services.

#### Acceptance Criteria

1. THE Backend SHALL serve API routes under /api/ prefix
2. THE CORS configuration SHALL be read from CORS_ORIGINS environment variable
3. THE System SHALL parse CORS_ORIGINS as comma-separated list and apply to FastAPI middleware
4. THE Backend SHALL include security headers on all responses:
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - X-XSS-Protection: 1; mode=block
   - Referrer-Policy: strict-origin-when-cross-origin
   - Strict-Transport-Security: max-age=31536000
   - Content-Security-Policy: comprehensive policy
   - Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
5. THE Frontend vite dev server SHALL proxy /api requests to http://127.0.0.1:8000

### Requirement 6: Authentication Configuration

**User Story:** As a security engineer, I want authentication mechanisms documented and centralized, so that I can ensure proper security across the application.

#### Acceptance Criteria

1. THE Firebase_Auth SHALL be initialized with config embedded in `frontend/src/firebase.ts`
2. THE Config SHALL include: apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId
3. THE Backend SHALL use JWT with HS256 algorithm for API authentication
4. THE Token expiration SHALL be set to 1440 minutes (24 hours) by default
5. THE Auth_Store SHALL manage session state including token, userId, orgId, userName
6. THE Logout function SHALL attempt to revoke JWT via backend and clear Firebase auth
7. THE Auth state SHALL be persisted in localStorage under keys: token, userId, orgId, userName

### Requirement 7: Feature Flag System

**User Story:** As a product manager, I want a feature flag system to enable/disable functionality, so that I can control rollout of new features.

#### Acceptance Criteria

1. THE Feature_Flag_System SHALL support boolean flags that control feature visibility
2. THE System SHALL store feature flags in the backend settings or Firestore
3. WHEN a feature flag is queried, THE System SHALL return the flag value for the current user's organization
4. THE Frontend SHALL have access to feature flags via API endpoint
5. IF a feature is disabled, THE System SHALL either hide UI elements or return appropriate error messages
6. THE System SHALL support gradual rollout by percentage (e.g., "enable for 10% of users")

### Requirement 8: Layout and Shell Configuration

**User Story:** As a user, I want customizable interface layouts, so that I can work in my preferred navigation style.

#### Acceptance Criteria

1. THE Layout_System SHALL support multiple layout modes:
   - classic-sidebar
   - top-megamenu
   - dual-rail
   - icon-rail
   - dashboard-first
   - command-centric
   - workspace-tabs
   - apps-launcher
   - split-master-detail
   - mobile-bottom-nav
2. THE Default layout SHALL be "classic-sidebar"
3. THE User_Store SHALL persist layout preference in localStorage under key "shell.layoutMode"
4. THE Layout SHALL apply via document.documentElement attribute "data-layout"

### Requirement 9: Build and Development Configuration

**User Story:** As a developer, I want build configurations documented, so that I can properly build and deploy the application.

#### Acceptance Criteria

1. THE Frontend build SHALL use Vite with the following scripts:
   - dev: start development server
   - build: compile TypeScript and build for production
   - test: run Vitest tests
   - e2e: run Playwright tests
   - lint: run ESLint
2. THE TypeScript config SHALL use strict mode with ES2023 target
3. THE Vite build SHALL split vendor chunks for: antd-core, antd-icons, react, recharts, firebase
4. THE Dev server SHALL run on port 5173 by default
5. THE Playwright tests SHALL use locale "ku-IQ" for Kurdish Iraq testing

### Requirement 10: Rate Limiting Configuration

**User Story:** As an ops engineer, I want rate limiting to protect the API, so that I can prevent abuse and ensure fair usage.

#### Acceptance Criteria

1. THE Backend SHALL use slowapi for rate limiting
2. THE Default rate limit SHALL be based on IP address via get_remote_address
3. THE Rate limit middleware SHALL be optional (opt-in via settings)
4. WHEN rate limit is exceeded, THE System SHALL return 429 status with RateLimitExceeded error
5. THE Configuration SHALL be adjustable via backend settings

### Requirement 11: Settings Persistence and Sync

**User Story:** As a user, I want my settings to persist across sessions and sync across devices, so that I have a consistent experience.

#### Acceptance Criteria

1. THE Settings_Store SHALL use localStorage for client-side persistence
2. THE Backend settings (org preferences, feature flags) SHALL be stored in Firestore
3. WHEN user logs in, THE System SHALL sync server settings to client
4. THE Settings SHALL be organization-scoped (same org = same settings)
5. IF local settings conflict with server settings, THE Server SHALL take precedence

### Requirement 12: Settings UI Management

**User Story:** As an administrator, I want a UI to view and modify application settings, so that I can configure the system without editing code.

#### Acceptance Criteria

1. THE System SHALL provide a Settings page accessible from the navigation
2. THE Settings page SHALL include sections for:
   - General (app name, language, timezone)
   - Appearance (theme, layout, density)
   - Security (2FA, session timeout)
   - Integrations (API keys, webhooks)
   - Feature flags
3. THE UI SHALL validate input before saving
4. THE Changes SHALL require appropriate permission (admin/owner)
5. THE System SHALL log all setting changes for audit purposes
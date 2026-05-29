/* eslint-disable react-refresh/only-export-components -- This file exports
 * the application's `RouteObject[]` route tree alongside a large number of
 * file-local `lazyWithRetry()`-wrapped page aliases. The route array is a
 * legitimate non-component export that must coexist with these component
 * bindings, so Fast Refresh's "only-export-components" heuristic does not
 * apply here. Edits to the route tree correctly trigger a full reload.
 */
/**
 * App route tree
 * --------------
 * Every route-level page is dynamically imported via `lazyWithRetry` (see
 * `src/utils/lazyWithRetry.ts`) instead of `React.lazy`. This is enforced by
 * `scripts/audit-lazy.mjs` and is required by R3.1, R3.4, R3.5 of the
 * world-class-performance spec:
 *
 *   - **Convention:** `lazyWithRetry(() => import('./pages/Foo'), 'foo')`.
 *     The second argument is a short, file-unique **kebab-case** chunk name
 *     used as a Sentry tag when the chunk-load retries are exhausted.
 *   - **Why retries:** Iraqi mobile networks drop the chunk request often
 *     enough that a 3-step exponential backoff (500ms / 2s / 8s) recovers
 *     the page on the second try in the common case.
 *   - **Failure mode:** if all retries fail, the lazy promise resolves to a
 *     localized `ChunkLoadErrorFallback` (`components/ChunkLoadErrorFallback`)
 *     so the surrounding route shell stays mounted and the user sees a
 *     "Reload page" CTA instead of a blank screen.
 */
import React, { Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import { readSessionClaims } from './platform/utils/sessionClaims';
import { postLoginPath } from './platform/utils/postLoginPath';
import AppLayout from './layouts/AppShell';
import Login from './pages/Login';
import PageTransition from './components/PageTransition';
import LandingPage from './pages/LandingPage';
import { LoadingSkeleton } from './design-system/LoadingSkeleton';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { useFeatureFlag } from './hooks/useFeatureFlag';

/**
 * Shared Suspense fallback for all feature routes.
 * Uses LoadingSkeleton variant="table" per spec requirement 4.1, 18.2.
 */
const FeatureFallback = <LoadingSkeleton variant="table" />;

// Task 19: Form Pages — feature-sliced form templates (Requirements 15.1–15.7)
const InvoiceFormRedesign = lazyWithRetry(() => import('./features/sales/invoices/InvoiceForm'), 'invoice-form');
const BillFormRedesign = lazyWithRetry(() => import('./features/purchases/bills/BillForm'), 'bill-form');
const PurchaseOrderFormRedesign = lazyWithRetry(() => import('./features/purchases/purchase-orders/PurchaseOrderForm'), 'purchase-order-form');

// Lazy-loaded pages
const Dashboard = lazyWithRetry(() => import('./pages/dashboard/DashboardRouter'), 'dashboard-router');
const Contacts = lazyWithRetry(() => import('./pages/Contacts'), 'contacts');
const Items = lazyWithRetry(() => import('./pages/Items'), 'items');
const ItemForm = lazyWithRetry(() => import('./pages/ItemForm'), 'item-form');
const Invoices = lazyWithRetry(() => import('./pages/Invoices'), 'invoices');
const InvoiceForm = lazyWithRetry(() => import('./pages/InvoiceForm'), 'pages-invoice-form');
const Expenses = lazyWithRetry(() => import('./pages/Expenses'), 'expenses');
const Accounts = lazyWithRetry(() => import('./pages/Accounts'), 'accounts');
const Reports = lazyWithRetry(() => import('./pages/Reports'), 'reports');
const AdvancedReports = lazyWithRetry(() => import('./pages/AdvancedReports'), 'advanced-reports');
const ScheduledReports = lazyWithRetry(() => import('./pages/reports/ScheduledReports'), 'scheduled-reports');
const CustomReportBuilder = lazyWithRetry(() => import('./pages/reports/CustomReportBuilder'), 'custom-report-builder');
const CustomReportsList = lazyWithRetry(() => import('./pages/reports/CustomReportsList'), 'custom-reports-list');
const EmbeddedAnalyticsDashboard = lazyWithRetry(() => import('./pages/reports/EmbeddedAnalyticsDashboard'), 'embedded-analytics-dashboard');
// Wave U: Custom Dashboards
const MyDashboards = lazyWithRetry(() => import('./pages/dashboards/MyDashboards'), 'my-dashboards');
const DashboardView = lazyWithRetry(() => import('./pages/dashboards/DashboardView'), 'dashboard-view');
const DashboardEditor = lazyWithRetry(() => import('./pages/dashboards/DashboardEditor'), 'dashboard-editor');
const SharedDashboards = lazyWithRetry(() => import('./pages/dashboards/SharedDashboards'), 'shared-dashboards');
const CRMLeads = lazyWithRetry(() => import('./pages/CRMLeads'), 'crm-leads');
const CRMPipeline = lazyWithRetry(() => import('./pages/CRMPipeline'), 'crm-pipeline');
const CRMActivities = lazyWithRetry(() => import('./pages/CRMActivities'), 'crm-activities');
const CRMInsights = lazyWithRetry(() => import('./pages/CRMInsights'), 'crm-insights');
const MyActivities = lazyWithRetry(() => import('./pages/activities/MyActivities'), 'my-activities');
const ActivitiesDashboard = lazyWithRetry(() => import('./pages/activities/ActivitiesDashboard'), 'activities-dashboard');
const EInvoiceDashboard = lazyWithRetry(() => import('./pages/EInvoiceDashboard'), 'e-invoice-dashboard');
const WhatsApp = lazyWithRetry(() => import('./pages/WhatsApp'), 'whats-app');
const OCRReceipts = lazyWithRetry(() => import('./pages/OCRReceipts'), 'ocr-receipts');
const HRDashboard = lazyWithRetry(() => import('./pages/HRDashboard'), 'hr-dashboard');
const HREmployees = lazyWithRetry(() => import('./pages/HREmployees'), 'hr-employees');
const HRContracts = lazyWithRetry(() => import('./pages/HRContracts'), 'hr-contracts');
const HRAttendance = lazyWithRetry(() => import('./pages/HRAttendance'), 'hr-attendance');
const HRTimeOff = lazyWithRetry(() => import('./pages/HRTimeOff'), 'hr-time-off');
const PayrollRules = lazyWithRetry(() => import('./pages/PayrollRules'), 'payroll-rules');
const PayrollRuns = lazyWithRetry(() => import('./pages/PayrollRuns'), 'payroll-runs');
// Wave AE: Onboarding + Mileage
const OnboardingWizard = lazyWithRetry(() => import('./pages/onboarding/OnboardingWizard'), 'onboarding-wizard');
const OnboardingChecklist = lazyWithRetry(() => import('./pages/onboarding/OnboardingChecklist'), 'onboarding-checklist');
// growth-to-100 § R3 "first 60 seconds" wizard (distinct from the modal above).
const GetStartedWizard = lazyWithRetry(() => import('./onboarding/OnboardingShell'), 'get-started-wizard');
// growth-to-100 § G4a — Iraq e-Fakhata pages.
const EFakhataDashboard = lazyWithRetry(() => import('./pages/efakhata/EFakhataDashboard'), 'efakhata-dashboard');
const EFakhataSubmissionDetail = lazyWithRetry(() => import('./pages/efakhata/SubmissionDetail'), 'efakhata-submission-detail');
const EFakhataCertManagement = lazyWithRetry(() => import('./pages/settings/efakhata/CertManagement'), 'efakhata-cert-management');
const EFakhataAuditorExport = lazyWithRetry(() => import('./pages/settings/efakhata/AuditorExport'), 'efakhata-auditor-export');
// growth-to-100 § G2 — super-admin tenant impersonation launcher.
const ImpersonateTenant = lazyWithRetry(() => import('./pages/admin/ImpersonateTenant'), 'impersonate-tenant');
const MileageLog = lazyWithRetry(() => import('./pages/mileage/MileageLog'), 'mileage-log');
const MileageRates = lazyWithRetry(() => import('./pages/mileage/MileageRates'), 'mileage-rates');
const MfgBOMs = lazyWithRetry(() => import('./pages/MfgBOMs'), 'mfg-bo-ms');
const MfgOrders = lazyWithRetry(() => import('./pages/MfgOrders'), 'mfg-orders');
const MfgWorkCenters = lazyWithRetry(() => import('./pages/MfgWorkCenters'), 'mfg-work-centers');
const Companies = lazyWithRetry(() => import('./pages/Companies'), 'companies');
const ConsolidatedReports = lazyWithRetry(() => import('./pages/ConsolidatedReports'), 'consolidated-reports');
const BranchesComparison = lazyWithRetry(() => import('./pages/BranchesComparison'), 'branches-comparison');
const Projects = lazyWithRetry(() => import('./pages/Projects'), 'projects');
const ProjectGantt = lazyWithRetry(() => import('./pages/ProjectGantt'), 'project-gantt');
const Bills = lazyWithRetry(() => import('./pages/Bills'), 'bills');
const Journals = lazyWithRetry(() => import('./pages/Journals'), 'journals');
const Banking = lazyWithRetry(() => import('./pages/Banking'), 'banking');
const Quotes = lazyWithRetry(() => import('./pages/Quotes'), 'quotes');
const QuoteForm = lazyWithRetry(() => import('./pages/QuoteForm'), 'quote-form');
const SalesOrders = lazyWithRetry(() => import('./pages/SalesOrders'), 'sales-orders');
const PurchaseOrders = lazyWithRetry(() => import('./pages/PurchaseOrders'), 'purchase-orders');
const CreditNotes = lazyWithRetry(() => import('./pages/CreditNotes'), 'credit-notes');
const VendorCredits = lazyWithRetry(() => import('./pages/VendorCredits'), 'vendor-credits');
const RecurringInvoices = lazyWithRetry(() => import('./pages/RecurringInvoices'), 'recurring-invoices');
const Inventory = lazyWithRetry(() => import('./pages/Inventory'), 'inventory');
const TaxSettings = lazyWithRetry(() => import('./pages/TaxSettings'), 'tax-settings');
const Settings = lazyWithRetry(() => import('./pages/Settings'), 'settings');
// New decomposed Settings shell (P5). Currently flag-gated behind
// `settings.new_shell` — see `SettingsRouter` below.
const SettingsShellNext = lazyWithRetry(() => import('./pages/settings/SettingsShell'), 'settings-shell-next');
const Trash = lazyWithRetry(() => import('./pages/Trash'), 'trash');
const DocsHub = lazyWithRetry(() => import('./pages/DocsHub'), 'docs-hub');
const UIGallery = lazyWithRetry(() => import('./pages/UIGallery'), 'ui-gallery');
// Wave N: Fixed Assets
const AssetCategories = lazyWithRetry(() => import('./pages/assets/AssetCategories'), 'asset-categories');
const FixedAssets = lazyWithRetry(() => import('./pages/assets/FixedAssets'), 'fixed-assets');
const AssetDetail = lazyWithRetry(() => import('./pages/assets/AssetDetail'), 'asset-detail');
const DepreciationRun = lazyWithRetry(() => import('./pages/assets/DepreciationRun'), 'depreciation-run');
const AssetReports = lazyWithRetry(() => import('./pages/assets/AssetReports'), 'asset-reports');
const BankRules = lazyWithRetry(() => import('./pages/BankRules'), 'bank-rules');
const BankReconciliation = lazyWithRetry(() => import('./pages/BankReconciliation'), 'bank-reconciliation');
const ImportStatement = lazyWithRetry(() => import('./pages/banking/ImportStatement'), 'import-statement');
const SmartMatch = lazyWithRetry(() => import('./pages/banking/SmartMatch'), 'smart-match');
const BankImportHistory = lazyWithRetry(() => import('./pages/banking/BankImportHistory'), 'bank-import-history');
const Warehouses = lazyWithRetry(() => import('./pages/Warehouses'), 'warehouses');
const StockLocations = lazyWithRetry(() => import('./pages/StockLocations'), 'stock-locations');
const PutawayRules = lazyWithRetry(() => import('./pages/PutawayRules'), 'putaway-rules');
const CycleCounts = lazyWithRetry(() => import('./pages/CycleCounts'), 'cycle-counts');
const PriceLists = lazyWithRetry(() => import('./pages/PriceLists'), 'price-lists');
const SerialNumbers = lazyWithRetry(() => import('./pages/SerialNumbers'), 'serial-numbers');
const TaxReturns = lazyWithRetry(() => import('./pages/TaxReturns'), 'tax-returns');
const Shipments = lazyWithRetry(() => import('./pages/Shipments'), 'shipments');
const DeliveryChallans = lazyWithRetry(() => import('./pages/DeliveryChallans'), 'delivery-challans');
const SalesReturns = lazyWithRetry(() => import('./pages/SalesReturns'), 'sales-returns');
const PurchaseReturns = lazyWithRetry(() => import('./pages/PurchaseReturns'), 'purchase-returns');
const CustomFields = lazyWithRetry(() => import('./pages/CustomFields'), 'custom-fields');
const Approvals = lazyWithRetry(() => import('./pages/Approvals'), 'approvals');
const ApprovalRules = lazyWithRetry(() => import('./pages/approvals/ApprovalRules'), 'approval-rules');
const MyApprovals = lazyWithRetry(() => import('./pages/approvals/MyApprovals'), 'my-approvals');
const ApprovalDetail = lazyWithRetry(() => import('./pages/approvals/ApprovalDetail'), 'approval-detail');
const ExpenseClaims = lazyWithRetry(() => import('./pages/ExpenseClaims'), 'expense-claims');
const Branches = lazyWithRetry(() => import('./pages/Branches'), 'branches');
const AuditLog = lazyWithRetry(() => import('./pages/AuditLog'), 'audit-log');
const JobRunsLog = lazyWithRetry(() => import('./pages/admin/JobRunsLog'), 'job-runs-log');
const PaymentLinks = lazyWithRetry(() => import('./pages/PaymentLinks'), 'payment-links');
const IraqLocalization = lazyWithRetry(() => import('./pages/IraqLocalization'), 'iraq-localization');
const RbacRoles = lazyWithRetry(() => import('./pages/RbacRoles'), 'rbac-roles');
const UserRoles = lazyWithRetry(() => import('./pages/UserRoles'), 'user-roles');
const Users = lazyWithRetry(() => import('./pages/Users'), 'users');
const AcceptInvite = lazyWithRetry(() => import('./pages/AcceptInvite'), 'accept-invite');
const SignUp = lazyWithRetry(() => import('./pages/auth/RegisterPage'), 'register-page');
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'), 'forgot-password');
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'), 'reset-password');
// Auth module pages (Task 3.3)
const RegisterPage = lazyWithRetry(() => import('./pages/auth/RegisterPage'), 'register-page');
const LoginPage = lazyWithRetry(() => import('./pages/auth/LoginPage'), 'login-page');
// Task 16: Login Page Redesign — features/auth/LoginPage with split-screen, Particles, glass morphism
const LoginPageRedesign = lazyWithRetry(() => import('./features/auth/LoginPage'), 'auth-login-page');
const MFAPage = lazyWithRetry(() => import('./pages/auth/MFAPage'), 'mfa-page');
const NotFound = lazyWithRetry(() => import('./pages/NotFound'), 'not-found');
const ServerError = lazyWithRetry(() => import('./pages/ServerError'), 'server-error');
// POS Pages
const POSHub = lazyWithRetry(() => import('./pages/pos/POSHub'), 'pos-hub');
const POSTerminal = lazyWithRetry(() => import('./pages/pos/POSTerminal'), 'pos-terminal');
const POSSessions = lazyWithRetry(() => import('./pages/pos/POSSessions'), 'pos-sessions');
const POSSessionDetail = lazyWithRetry(() => import('./pages/pos/POSSessionDetail'), 'pos-session-detail');
const POSOrders = lazyWithRetry(() => import('./pages/pos/POSOrders'), 'pos-orders');
const POSConfigs = lazyWithRetry(() => import('./pages/pos/POSConfigs'), 'pos-configs');
const POSCategories = lazyWithRetry(() => import('./pages/pos/POSCategories'), 'pos-categories');
const POSProducts = lazyWithRetry(() => import('./pages/pos/POSProducts'), 'pos-products');
const POSPricelists = lazyWithRetry(() => import('./pages/pos/POSPricelists'), 'pos-pricelists');
const POSFloors = lazyWithRetry(() => import('./pages/pos/POSFloors'), 'pos-floors');
// Marketing Pages
const MarketingDashboard = lazyWithRetry(() => import('./pages/marketing/MarketingDashboard'), 'marketing-dashboard');
const EmailCampaigns = lazyWithRetry(() => import('./pages/marketing/EmailCampaigns'), 'email-campaigns');
const SmsCampaigns = lazyWithRetry(() => import('./pages/marketing/SmsCampaigns'), 'sms-campaigns');
const Segments = lazyWithRetry(() => import('./pages/marketing/Segments'), 'segments');
const Automations = lazyWithRetry(() => import('./pages/marketing/Automations'), 'automations');
const POSFloorPlan = lazyWithRetry(() => import('./pages/pos/POSFloorPlan'), 'pos-floor-plan');
const POSKitchen = lazyWithRetry(() => import('./pages/pos/POSKitchen'), 'pos-kitchen');
const POSEmployees = lazyWithRetry(() => import('./pages/pos/POSEmployees'), 'pos-employees');
const POSLoyalty = lazyWithRetry(() => import('./pages/pos/POSLoyalty'), 'pos-loyalty');
const POSGiftCards = lazyWithRetry(() => import('./pages/pos/POSGiftCards'), 'pos-gift-cards');
const POSSelfOrder = lazyWithRetry(() => import('./pages/pos/POSSelfOrder'), 'pos-self-order');
const POSReports = lazyWithRetry(() => import('./pages/pos/POSReports'), 'pos-reports');
const POSCustomerDisplay = lazyWithRetry(() => import('./pages/pos/POSCustomerDisplay'), 'pos-customer-display');
const ModuleHub = lazyWithRetry(() => import('./pages/modules/ModuleHub'), 'module-hub');
// Wave-A Pages
const Helpdesk = lazyWithRetry(() => import('./pages/wave-a/Helpdesk'), 'helpdesk');
const FieldService = lazyWithRetry(() => import('./pages/wave-a/FieldService'), 'field-service');
const Subscriptions = lazyWithRetry(() => import('./pages/wave-a/Subscriptions'), 'subscriptions');
const Documents = lazyWithRetry(() => import('./pages/wave-a/Documents'), 'documents');
const Knowledge = lazyWithRetry(() => import('./pages/wave-a/Knowledge'), 'knowledge');
const Quality = lazyWithRetry(() => import('./pages/wave-a/Quality'), 'quality');
const Maintenance = lazyWithRetry(() => import('./pages/wave-a/Maintenance'), 'maintenance');
const PLM = lazyWithRetry(() => import('./pages/wave-a/PLM'), 'plm');
const Repairs = lazyWithRetry(() => import('./pages/wave-a/Repairs'), 'repairs');
const HRExtended = lazyWithRetry(() => import('./pages/wave-a/HRExtended'), 'hr-extended');
const Studio = lazyWithRetry(() => import('./pages/wave-a/Studio'), 'studio');
// Wave AD: Studio (No-Code)
const StudioHome = lazyWithRetry(() => import('./pages/studio/StudioHome'), 'studio-home');
const CustomFieldsBuilder = lazyWithRetry(() => import('./pages/studio/CustomFieldsBuilder'), 'custom-fields-builder');
const ViewLayoutEditor = lazyWithRetry(() => import('./pages/studio/ViewLayoutEditor'), 'view-layout-editor');
const AutomationFromStudio = lazyWithRetry(() => import('./pages/studio/AutomationFromStudio'), 'automation-from-studio');
// Wave R: Maintenance Module (Full)
const MaintenanceDashboard = lazyWithRetry(() => import('./pages/maintenance/MaintenanceDashboard'), 'maintenance-dashboard');
const Equipment = lazyWithRetry(() => import('./pages/maintenance/Equipment'), 'equipment');
const EquipmentDetail = lazyWithRetry(() => import('./pages/maintenance/EquipmentDetail'), 'equipment-detail');
const EquipmentCategories = lazyWithRetry(() => import('./pages/maintenance/EquipmentCategories'), 'equipment-categories');
const MaintenanceRequests = lazyWithRetry(() => import('./pages/maintenance/MaintenanceRequests'), 'maintenance-requests');
const MaintenanceSchedules = lazyWithRetry(() => import('./pages/maintenance/MaintenanceSchedules'), 'maintenance-schedules');
// Subscription Billing (Wave G)
const SubscriptionPlans = lazyWithRetry(() => import('./pages/subscriptions/SubscriptionPlans'), 'subscription-plans');
const SubscriptionsList = lazyWithRetry(() => import('./pages/subscriptions/SubscriptionsList'), 'subscriptions-list');
const SubscriptionDetail = lazyWithRetry(() => import('./pages/subscriptions/SubscriptionDetail'), 'subscription-detail');
const SubscriptionDunning = lazyWithRetry(() => import('./pages/subscriptions/SubscriptionDunning'), 'subscription-dunning');
const SubscriptionReports = lazyWithRetry(() => import('./pages/subscriptions/SubscriptionReports'), 'subscription-reports');
// Additional Pages
const AuditLogViewer = lazyWithRetry(() => import('./pages/AuditLogViewer'), 'audit-log-viewer');
const AutomationRules = lazyWithRetry(() => import('./pages/AutomationRules'), 'automation-rules');
// Wave T: Visual Workflow Automation
const WorkflowsList = lazyWithRetry(() => import('./pages/automation/WorkflowsList'), 'workflows-list');
const WorkflowBuilder = lazyWithRetry(() => import('./pages/automation/WorkflowBuilder'), 'workflow-builder');
const WorkflowRunHistory = lazyWithRetry(() => import('./pages/automation/WorkflowRunHistory'), 'workflow-run-history');
const AutomationLogs = lazyWithRetry(() => import('./pages/automation/AutomationLogs'), 'automation-logs');
// Wave B: Accounting Power Features
const AnalyticAccounts = lazyWithRetry(() => import('./pages/AnalyticAccounts'), 'analytic-accounts');
const AnalyticReport = lazyWithRetry(() => import('./pages/AnalyticReport'), 'analytic-report');
const Budgets = lazyWithRetry(() => import('./pages/Budgets'), 'budgets');
const BudgetVariance = lazyWithRetry(() => import('./pages/BudgetVariance'), 'budget-variance');
const CashflowForecast = lazyWithRetry(() => import('./pages/CashflowForecast'), 'cashflow-forecast');
const CustomerStatements = lazyWithRetry(() => import('./pages/CustomerStatements'), 'customer-statements');
const EmailTemplates = lazyWithRetry(() => import('./pages/EmailTemplates'), 'email-templates');
// Wave E: Storefront + Customer Portal
const StoreHome = lazyWithRetry(() => import('./pages/storefront/StoreHome'), 'store-home');
// Wave O: Multi-Currency Revaluation
const CurrencyRates = lazyWithRetry(() => import('./pages/fx/CurrencyRates'), 'currency-rates');
const FXExposure = lazyWithRetry(() => import('./pages/fx/FXExposure'), 'fx-exposure');
const RevaluationRuns = lazyWithRetry(() => import('./pages/fx/RevaluationRuns'), 'revaluation-runs');
const StoreProduct = lazyWithRetry(() => import('./pages/storefront/StoreProduct'), 'store-product');
const SalesReturnsRefund = lazyWithRetry(() => import('./pages/returns/SalesReturns'), 'returns-sales-returns');
const VendorReturnsRefund = lazyWithRetry(() => import('./pages/returns/VendorReturns'), 'vendor-returns');
const NumberingSequences = lazyWithRetry(() => import('./pages/settings/NumberingSequences'), 'numbering-sequences');
const TenantSystemHealthRedirect = lazyWithRetry(() => import('./pages/settings/TenantSystemHealthRedirect'), 'tenant-system-health-redirect');
const ModuleRequestsPage = lazyWithRetry(() => import('./pages/settings/ModuleRequestsPage'), 'module-requests-page');
const PlatformShell = lazyWithRetry(() => import('./platform/layout/PlatformShell'), 'platform-shell');
const PlatformDashboard = lazyWithRetry(() => import('./platform/pages/PlatformDashboard'), 'platform-dashboard');
const OrgListPage = lazyWithRetry(() => import('./platform/pages/OrgListPage'), 'org-list-page');
const OrgDetailPage = lazyWithRetry(() => import('./platform/pages/OrgDetailPage'), 'org-detail-page');
const LicenseEditorPage = lazyWithRetry(() => import('./platform/pages/LicenseEditorPage'), 'license-editor-page');
const GlobalModuleRequestsPage = lazyWithRetry(() => import('./platform/pages/GlobalModuleRequestsPage'), 'global-module-requests-page');
const GlobalUsersPage = lazyWithRetry(() => import('./platform/pages/GlobalUsersPage'), 'global-users-page');
const PlatformAuditPage = lazyWithRetry(() => import('./platform/pages/PlatformAuditPage'), 'platform-audit-page');
const PlatformHealthPage = lazyWithRetry(() => import('./platform/pages/PlatformHealthPage'), 'platform-health-page');
// scale-foundation (Tier 3 § SF3): super-admin DR restore console (4-eyes + diff preview).
const DrRestorePage = lazyWithRetry(() => import('./platform/pages/DrRestorePage'), 'dr-restore-page');
const FeatureFlagsPage = lazyWithRetry(() => import('./platform/pages/FeatureFlagsPage'), 'feature-flags-page');
const AnnouncementsPage = lazyWithRetry(() => import('./platform/pages/AnnouncementsPage'), 'announcements-page');
const PlatformRoute = lazyWithRetry(() => import('./platform/guards/PlatformRoute'), 'platform-route');
const TenantRoute = lazyWithRetry(() => import('./platform/guards/TenantRoute'), 'tenant-route');
const StoreCart = lazyWithRetry(() => import('./pages/storefront/StoreCart'), 'store-cart');
const StoreCheckout = lazyWithRetry(() => import('./pages/storefront/StoreCheckout'), 'store-checkout');
const StoreOrderConfirm = lazyWithRetry(() => import('./pages/storefront/StoreOrderConfirm'), 'store-order-confirm');
const PortalLogin = lazyWithRetry(() => import('./pages/portal/PortalLogin'), 'portal-login');
const PortalDashboard = lazyWithRetry(() => import('./pages/portal/PortalDashboard'), 'portal-dashboard');
const PortalInvoices = lazyWithRetry(() => import('./pages/portal/PortalInvoices'), 'portal-invoices');
const PortalOrders = lazyWithRetry(() => import('./pages/portal/PortalOrders'), 'portal-orders');
const PortalStatements = lazyWithRetry(() => import('./pages/portal/PortalStatements'), 'portal-statements');
// Wave J: Vendor Portal
const VendorPortalLogin = lazyWithRetry(() => import('./pages/vendor-portal/VendorPortalLogin'), 'vendor-portal-login');
const VendorPortalDashboard = lazyWithRetry(() => import('./pages/vendor-portal/VendorPortalDashboard'), 'vendor-portal-dashboard');
const VendorPortalPOs = lazyWithRetry(() => import('./pages/vendor-portal/VendorPortalPOs'), 'vendor-portal-p-os');
const VendorPortalSubmitBill = lazyWithRetry(() => import('./pages/vendor-portal/VendorPortalSubmitBill'), 'vendor-portal-submit-bill');
const VendorPortalBills = lazyWithRetry(() => import('./pages/vendor-portal/VendorPortalBills'), 'vendor-portal-bills');
const VendorPortalPayments = lazyWithRetry(() => import('./pages/vendor-portal/VendorPortalPayments'), 'vendor-portal-payments');
// Wave S: DMS / Document Vault
const DocumentVault = lazyWithRetry(() => import('./pages/dms/DocumentVault'), 'document-vault');
const DocumentDetail = lazyWithRetry(() => import('./pages/dms/DocumentDetail'), 'document-detail');
const SignatureRequests = lazyWithRetry(() => import('./pages/dms/SignatureRequests'), 'signature-requests');
// Wave V: IoT Telemetry & Device Management
const IoTDashboard = lazyWithRetry(() => import('./pages/iot/IoTDashboard'), 'io-t-dashboard');
const IoTDevices = lazyWithRetry(() => import('./pages/iot/IoTDevices'), 'io-t-devices');
const DeviceDetail = lazyWithRetry(() => import('./pages/iot/DeviceDetail'), 'device-detail');
const AlertRules = lazyWithRetry(() => import('./pages/iot/AlertRules'), 'alert-rules');
const AlertHistory = lazyWithRetry(() => import('./pages/iot/AlertHistory'), 'alert-history');
// Wave X: Quality Management
const QualityDashboard = lazyWithRetry(() => import('./pages/quality/QualityDashboard'), 'quality-dashboard');
const QCPlans = lazyWithRetry(() => import('./pages/quality/QCPlans'), 'qc-plans');
const QCChecks = lazyWithRetry(() => import('./pages/quality/QCChecks'), 'qc-checks');
const NonConformances = lazyWithRetry(() => import('./pages/quality/NonConformances'), 'non-conformances');
const CAPAList = lazyWithRetry(() => import('./pages/quality/CAPAList'), 'capa-list');
// Wave Y: Field Service Management
const FieldServiceDashboard = lazyWithRetry(() => import('./pages/field-service/FieldServiceDashboard'), 'field-service-dashboard');
const ServiceOrders = lazyWithRetry(() => import('./pages/field-service/ServiceOrders'), 'service-orders');
const ServiceOrderDetail = lazyWithRetry(() => import('./pages/field-service/ServiceOrderDetail'), 'service-order-detail');
const Technicians = lazyWithRetry(() => import('./pages/field-service/Technicians'), 'technicians');
const DispatchBoard = lazyWithRetry(() => import('./pages/field-service/DispatchBoard'), 'dispatch-board');
// Wave W: Helpdesk & Knowledge Base
const HelpdeskDashboard = lazyWithRetry(() => import('./pages/helpdesk/HelpdeskDashboard'), 'helpdesk-dashboard');
const TicketsList = lazyWithRetry(() => import('./pages/helpdesk/TicketsList'), 'tickets-list');
const TicketDetail = lazyWithRetry(() => import('./pages/helpdesk/TicketDetail'), 'ticket-detail');
const HelpdeskSettings = lazyWithRetry(() => import('./pages/helpdesk/HelpdeskSettings'), 'helpdesk-settings');
const KnowledgeBase = lazyWithRetry(() => import('./pages/kb/KnowledgeBase'), 'knowledge-base');
const ArticleEditor = lazyWithRetry(() => import('./pages/kb/ArticleEditor'), 'article-editor');
const ArticleView = lazyWithRetry(() => import('./pages/kb/ArticleView'), 'article-view');
// Wave Z: Rental & Repairs
const RentalProducts = lazyWithRetry(() => import('./pages/rental/RentalProducts'), 'rental-products');
const RentalContracts = lazyWithRetry(() => import('./pages/rental/RentalContracts'), 'rental-contracts');
const RentalContractDetail = lazyWithRetry(() => import('./pages/rental/RentalContractDetail'), 'rental-contract-detail');
const RepairOrders = lazyWithRetry(() => import('./pages/repairs/RepairOrders'), 'repair-orders');
const RepairOrderDetail = lazyWithRetry(() => import('./pages/repairs/RepairOrderDetail'), 'repair-order-detail');
const WarrantyCheck = lazyWithRetry(() => import('./pages/repairs/WarrantyCheck'), 'warranty-check');
// Wave AB: AI Assist
const AIAssistDashboard = lazyWithRetry(() => import('./pages/ai/AIAssistDashboard'), 'ai-assist-dashboard');
const AnomaliesList = lazyWithRetry(() => import('./pages/ai/AnomaliesList'), 'anomalies-list');
const SuggestionsInbox = lazyWithRetry(() => import('./pages/ai/SuggestionsInbox'), 'suggestions-inbox');
const OCRReceiptsAdvanced = lazyWithRetry(() => import('./pages/ai/OCRReceiptsAdvanced'), 'ocr-receipts-advanced');
const PredictionsExplorer = lazyWithRetry(() => import('./pages/ai/PredictionsExplorer'), 'predictions-explorer');
// Wave AA: Multi-Entity Management
const CompaniesList = lazyWithRetry(() => import('./pages/multi-entity/CompaniesList'), 'companies-list');
const IntercompanyTransactions = lazyWithRetry(() => import('./pages/multi-entity/IntercompanyTransactions'), 'intercompany-transactions');
const ConsolidatedPL = lazyWithRetry(() => import('./pages/multi-entity/ConsolidatedPL'), 'consolidated-pl');
const ConsolidatedBS = lazyWithRetry(() => import('./pages/multi-entity/ConsolidatedBS'), 'consolidated-bs');
const EliminationsWorkbench = lazyWithRetry(() => import('./pages/multi-entity/EliminationsWorkbench'), 'eliminations-workbench');
// Wave AF: Hotel & Restaurant
const HotelDashboard = lazyWithRetry(() => import('./pages/hotel/HotelDashboard'), 'hotel-dashboard');
const RoomsBookings = lazyWithRetry(() => import('./pages/hotel/RoomsBookings'), 'rooms-bookings');
const TablesView = lazyWithRetry(() => import('./pages/restaurant/TablesView'), 'tables-view');
const KitchenDisplay = lazyWithRetry(() => import('./pages/restaurant/KitchenDisplay'), 'kitchen-display');
const MenuManager = lazyWithRetry(() => import('./pages/restaurant/MenuManager'), 'menu-manager');
// Wave AG: Healthcare, Hospital, Pharmacy
const ClinicDashboard = lazyWithRetry(() => import('./pages/healthcare/ClinicDashboard'), 'clinic-dashboard');
const PatientsList = lazyWithRetry(() => import('./pages/healthcare/PatientsList'), 'patients-list');
const AppointmentsCalendar = lazyWithRetry(() => import('./pages/healthcare/AppointmentsCalendar'), 'appointments-calendar');
const WardsAdmissions = lazyWithRetry(() => import('./pages/hospital/WardsAdmissions'), 'wards-admissions');
const PharmacyDispense = lazyWithRetry(() => import('./pages/pharmacy/PharmacyDispense'), 'pharmacy-dispense');
// Wave AH: Industry Modules (Real Estate, Construction, Agriculture, PLM)
const PropertiesAndLeases = lazyWithRetry(() => import('./pages/real-estate/PropertiesAndLeases'), 'properties-and-leases');
const ConstructionProjects = lazyWithRetry(() => import('./pages/construction/ConstructionProjects'), 'construction-projects');
const BOQEditor = lazyWithRetry(() => import('./pages/construction/BOQEditor'), 'boq-editor');
const FieldsAndYield = lazyWithRetry(() => import('./pages/agriculture/FieldsAndYield'), 'fields-and-yield');
const PLMEngineeringChanges = lazyWithRetry(() => import('./pages/plm/PLMEngineeringChanges'), 'plm-engineering-changes');
// Task 18: List Pages — modern redesigned list page templates (Requirements 14.1–14.9)
const InvoicesListModern = lazyWithRetry(() => import('./features/sales/invoices/InvoicesList'), 'invoices-list');
const CustomersListModern = lazyWithRetry(() => import('./features/sales/customers/CustomersList'), 'customers-list');
const ItemsListModern = lazyWithRetry(() => import('./features/inventory/items/ItemsList'), 'items-list');
const BillsListModern = lazyWithRetry(() => import('./features/purchases/bills/BillsList'), 'bills-list');
const PurchaseOrdersListModern = lazyWithRetry(() => import('./features/purchases/purchase-orders/PurchaseOrdersList'), 'purchase-orders-list');
const PaymentsListModern = lazyWithRetry(() => import('./features/banking/payments/PaymentsList'), 'payments-list');

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  // Requirement 1.1: unauthenticated users visiting any protected route are
  // redirected to the public landing page first (not directly to /login).
  if (!isAuthenticated) return <Navigate to="/landing" replace />;
  return <>{children}</>;
};

/**
 * LandingRoute — shows the public landing page for unauthenticated visitors.
 * Authenticated users are redirected straight to the dashboard.
 * Requirement 1.1: WHEN بەکارهێنەر بچێتە `/` بەبێ لۆگئین، THE سیستەم SHALL
 * ئەوان بگەیەنێت بۆ پەرەی سەرەتای گشتی.
 */
const LandingRoute: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) {
    const claims = readSessionClaims();
    return <Navigate to={postLoginPath(claims.role || undefined, claims.isPlatformAdmin)} replace />;
  }
  return <PageTransition><LandingPage /></PageTransition>;
};

/**
 * SettingsRouter — feature-flagged toggle between the legacy settings
 * shell (`src/settings/shell/SettingsShell.tsx`, currently the prod
 * default with 50+ sections wired up) and the new decomposed shell
 * (`src/pages/settings/SettingsShell.tsx`, P5).
 *
 * Flag key:  `settings.new_shell`
 *   - OFF (default): legacy shell is rendered. Behaviour is byte-equivalent
 *     to the route as it existed before the migration started.
 *   - ON: new shell is rendered. Only the sections registered in
 *     `pages/settings/sections.registry.ts` will be reachable from the
 *     sidebar; the rest of the migration is tracked in
 *     `docs/settings/migration-plan.md`.
 *
 * While the flag is being fetched (`isLoading === true`), we render the
 * LEGACY shell so the first paint is unchanged for everyone. Once the
 * flag resolves, the user is opted in if their org has the flag on.
 *
 * Parallel route `/settings/next` always renders the new shell so the
 * team can dogfood it without flipping the flag organisation-wide.
 */
const SettingsRouter: React.FC = () => {
  const { isEnabled, isLoading } = useFeatureFlag('settings.new_shell');
  // Until the flag resolves, default to the legacy shell — this keeps the
  // first paint identical for every user and avoids flicker on cold start.
  if (isLoading || !isEnabled) {
    return <PageTransition><Settings /></PageTransition>;
  }
  return <PageTransition><SettingsShellNext /></PageTransition>;
};

/**
 * The application's authoritative route tree as a `RouteObject[]` consumed by
 * `useRoutes` in `App.tsx`. The audit (`scripts/nav-audit.mjs`) and the
 * Playwright sweep (`tests/e2e/nav-sweep.spec.ts`) MUST import this same
 * array so audit semantics, sweep semantics, and runtime semantics are
 * identical.
 *
 * Invariants:
 *   - The catch-all `{ path: '*', element: <NotFound /> }` MUST be the LAST entry.
 *   - The protected branch (path: '/') MUST be wrapped with <ProtectedRoute>.
 *   - All public routes are siblings of the protected branch (so unauthenticated
 *     users can reach them without redirect).
 *   - Every lazy page is wrapped in <PageTransition>; routes that previously
 *     had inner <Suspense fallback={FeatureFallback}> wrappers retain them so the
 *     visual fallback is unchanged.
 */
export const routes: RouteObject[] = [
  // Public landing page — unauthenticated visitors see the marketing page;
  // authenticated users are redirected to /dashboard (Requirement 1.1)
  { path: '/landing', element: <LandingRoute /> },
  { path: '/', element: <LandingRoute /> },
  // Task 16: Login Page Redesign — modern split-screen with Particles, glass morphism, attempt tracking
  { path: '/login', element: <Suspense fallback={FeatureFallback}><PageTransition><LoginPageRedesign /></PageTransition></Suspense> },
  { path: '/signup', element: <Suspense fallback={FeatureFallback}><PageTransition><SignUp /></PageTransition></Suspense> },
  { path: '/forgot-password', element: <Suspense fallback={FeatureFallback}><PageTransition><ForgotPassword /></PageTransition></Suspense> },
  { path: '/reset-password', element: <Suspense fallback={FeatureFallback}><PageTransition><ResetPassword /></PageTransition></Suspense> },
  { path: '/accept-invite', element: <Suspense fallback={FeatureFallback}><PageTransition><AcceptInvite /></PageTransition></Suspense> },
  // Auth module pages (Task 3.3) — dedicated auth pages with enhanced validation and MFA
  { path: '/register', element: <Suspense fallback={FeatureFallback}><PageTransition><RegisterPage /></PageTransition></Suspense> },
  { path: '/auth/login', element: <Suspense fallback={FeatureFallback}><PageTransition><LoginPage /></PageTransition></Suspense> },
  { path: '/mfa', element: <Suspense fallback={FeatureFallback}><PageTransition><MFAPage /></PageTransition></Suspense> },
  {
    path: '/platform',
    element: (
      <ProtectedRoute>
        <Suspense fallback={FeatureFallback}>
          <PlatformRoute>
            <PlatformShell />
          </PlatformRoute>
        </Suspense>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Suspense fallback={FeatureFallback}><PlatformDashboard /></Suspense> },
      { path: 'orgs', element: <Suspense fallback={FeatureFallback}><OrgListPage /></Suspense> },
      { path: 'orgs/:orgId', element: <Suspense fallback={FeatureFallback}><OrgDetailPage /></Suspense> },
      { path: 'licenses', element: <Suspense fallback={FeatureFallback}><LicenseEditorPage /></Suspense> },
      { path: 'requests', element: <Suspense fallback={FeatureFallback}><GlobalModuleRequestsPage /></Suspense> },
      { path: 'users', element: <Suspense fallback={FeatureFallback}><GlobalUsersPage /></Suspense> },
      { path: 'audit', element: <Suspense fallback={FeatureFallback}><PlatformAuditPage /></Suspense> },
      { path: 'health', element: <Suspense fallback={FeatureFallback}><PlatformHealthPage /></Suspense> },
      { path: 'dr-restore', element: <Suspense fallback={FeatureFallback}><DrRestorePage /></Suspense> },
      { path: 'flags', element: <Suspense fallback={FeatureFallback}><FeatureFlagsPage /></Suspense> },
      { path: 'announcements', element: <Suspense fallback={FeatureFallback}><AnnouncementsPage /></Suspense> },
    ],
  },
  // Wave E: Public Storefront Routes
  { path: '/store', element: <Suspense fallback={FeatureFallback}><PageTransition><StoreHome /></PageTransition></Suspense> },
  { path: '/store/product/:id', element: <Suspense fallback={FeatureFallback}><PageTransition><StoreProduct /></PageTransition></Suspense> },
  { path: '/store/cart', element: <Suspense fallback={FeatureFallback}><PageTransition><StoreCart /></PageTransition></Suspense> },
  { path: '/store/checkout', element: <Suspense fallback={FeatureFallback}><PageTransition><StoreCheckout /></PageTransition></Suspense> },
  { path: '/store/order/:orderId', element: <Suspense fallback={FeatureFallback}><PageTransition><StoreOrderConfirm /></PageTransition></Suspense> },
  // Wave E: Customer Portal Routes
  { path: '/portal/login', element: <Suspense fallback={FeatureFallback}><PageTransition><PortalLogin /></PageTransition></Suspense> },
  { path: '/portal', element: <Suspense fallback={FeatureFallback}><PageTransition><PortalDashboard /></PageTransition></Suspense> },
  { path: '/portal/invoices', element: <Suspense fallback={FeatureFallback}><PageTransition><PortalInvoices /></PageTransition></Suspense> },
  { path: '/portal/orders', element: <Suspense fallback={FeatureFallback}><PageTransition><PortalOrders /></PageTransition></Suspense> },
  { path: '/portal/statements', element: <Suspense fallback={FeatureFallback}><PageTransition><PortalStatements /></PageTransition></Suspense> },
  // Wave J: Vendor Portal Routes
  { path: '/vendor-portal/login', element: <Suspense fallback={FeatureFallback}><PageTransition><VendorPortalLogin /></PageTransition></Suspense> },
  { path: '/vendor-portal', element: <Suspense fallback={FeatureFallback}><PageTransition><VendorPortalDashboard /></PageTransition></Suspense> },
  { path: '/vendor-portal/purchase-orders', element: <Suspense fallback={FeatureFallback}><PageTransition><VendorPortalPOs /></PageTransition></Suspense> },
  { path: '/vendor-portal/submit-bill', element: <Suspense fallback={FeatureFallback}><PageTransition><VendorPortalSubmitBill /></PageTransition></Suspense> },
  { path: '/vendor-portal/bills', element: <Suspense fallback={FeatureFallback}><PageTransition><VendorPortalBills /></PageTransition></Suspense> },
  { path: '/vendor-portal/payments', element: <Suspense fallback={FeatureFallback}><PageTransition><VendorPortalPayments /></PageTransition></Suspense> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Suspense fallback={FeatureFallback}>
          <TenantRoute />
        </Suspense>
      </ProtectedRoute>
    ),
    children: [
      { element: <AppLayout />, children: [
      { index: true, element: <PageTransition><Dashboard /></PageTransition> },
      { path: 'contacts', element: <PageTransition><Contacts /></PageTransition> },
      // Task 18: Modern Customers List Page (PageHeader + FilterBar + BulkActionBar + DataTable + Pagination)
      { path: 'customers/list', element: <Suspense fallback={FeatureFallback}><CustomersListModern /></Suspense> },
      { path: 'items', element: <PageTransition><Items /></PageTransition> },
      { path: 'items/new', element: <PageTransition><ItemForm /></PageTransition> },
      { path: 'items/:id/edit', element: <PageTransition><ItemForm /></PageTransition> },
      // Task 18: Modern Items List Page (PageHeader + FilterBar + BulkActionBar + DataTable + Pagination)
      { path: 'items/list', element: <Suspense fallback={FeatureFallback}><ItemsListModern /></Suspense> },
      { path: 'invoices', element: <PageTransition><Invoices /></PageTransition> },
      { path: 'invoices/new', element: <PageTransition><InvoiceForm /></PageTransition> },
      // Task 18: Modern Invoices List Page (PageHeader + FilterBar + BulkActionBar + DataTable + Pagination)
      { path: 'invoices/list', element: <Suspense fallback={FeatureFallback}><InvoicesListModern /></Suspense> },
      // Task 19: Modern Invoice Form (FormLayout + EditableLineItems + useAutoSave + split save)
      { path: 'invoices/create', element: <Suspense fallback={FeatureFallback}><InvoiceFormRedesign /></Suspense> },
      { path: 'invoices/:id/edit', element: <Suspense fallback={FeatureFallback}><InvoiceFormRedesign /></Suspense> },
      { path: 'quotes', element: <PageTransition><Quotes /></PageTransition> },
      { path: 'quotes/new', element: <PageTransition><QuoteForm /></PageTransition> },
      { path: 'sales-orders', element: <PageTransition><SalesOrders /></PageTransition> },
      { path: 'credit-notes', element: <PageTransition><CreditNotes /></PageTransition> },
      { path: 'expenses', element: <PageTransition><Expenses /></PageTransition> },
      { path: 'bills', element: <PageTransition><Bills /></PageTransition> },
      // Task 18: Modern Bills List Page (PageHeader + FilterBar + BulkActionBar + DataTable + Pagination)
      { path: 'bills/list', element: <Suspense fallback={FeatureFallback}><BillsListModern /></Suspense> },
      // Task 19: Modern Bill Form (FormLayout + EditableLineItems + useAutoSave + split save)
      { path: 'bills/create', element: <Suspense fallback={FeatureFallback}><BillFormRedesign /></Suspense> },
      { path: 'bills/:id/edit', element: <Suspense fallback={FeatureFallback}><BillFormRedesign /></Suspense> },
      { path: 'purchase-orders', element: <PageTransition><PurchaseOrders /></PageTransition> },
      // Task 18: Modern Purchase Orders List Page (PageHeader + FilterBar + BulkActionBar + DataTable + Pagination)
      { path: 'purchase-orders/list', element: <Suspense fallback={FeatureFallback}><PurchaseOrdersListModern /></Suspense> },
      // Task 19: Modern Purchase Order Form (FormLayout + EditableLineItems + useAutoSave + split save)
      { path: 'purchase-orders/create', element: <Suspense fallback={FeatureFallback}><PurchaseOrderFormRedesign /></Suspense> },
      { path: 'purchase-orders/:id/edit', element: <Suspense fallback={FeatureFallback}><PurchaseOrderFormRedesign /></Suspense> },
      { path: 'vendor-credits', element: <PageTransition><VendorCredits /></PageTransition> },
      { path: 'recurring-invoices', element: <PageTransition><RecurringInvoices /></PageTransition> },
      { path: 'inventory', element: <PageTransition><Inventory /></PageTransition> },
      { path: 'accounts', element: <PageTransition><Accounts /></PageTransition> },
      { path: 'journals', element: <PageTransition><Journals /></PageTransition> },
      { path: 'banking', element: <PageTransition><Banking /></PageTransition> },
      // Task 18: Modern Payments List Page (PageHeader + FilterBar + BulkActionBar + DataTable + Pagination)
      { path: 'payments/list', element: <Suspense fallback={FeatureFallback}><PaymentsListModern /></Suspense> },
      { path: 'banking/rules', element: <PageTransition><BankRules /></PageTransition> },
      { path: 'banking/reconciliation', element: <PageTransition><BankReconciliation /></PageTransition> },
      { path: 'banking/:accountId/import', element: <PageTransition><ImportStatement /></PageTransition> },
      { path: 'banking/:accountId/match', element: <PageTransition><SmartMatch /></PageTransition> },
      { path: 'banking/:accountId/import-history', element: <PageTransition><BankImportHistory /></PageTransition> },
      { path: 'inventory/warehouses', element: <PageTransition><Warehouses /></PageTransition> },
      { path: 'inventory/locations', element: <PageTransition><StockLocations /></PageTransition> },
      { path: 'inventory/putaway-rules', element: <PageTransition><PutawayRules /></PageTransition> },
      { path: 'inventory/cycle-counts', element: <PageTransition><CycleCounts /></PageTransition> },
      { path: 'inventory/price-lists', element: <PageTransition><PriceLists /></PageTransition> },
      { path: 'inventory/serials', element: <PageTransition><SerialNumbers /></PageTransition> },
      { path: 'manufacturing/boms', element: <PageTransition><MfgBOMs /></PageTransition> },
      { path: 'manufacturing/orders', element: <PageTransition><MfgOrders /></PageTransition> },
      { path: 'manufacturing/work-centers', element: <PageTransition><MfgWorkCenters /></PageTransition> },
      // Wave N: Fixed Assets
      { path: 'assets', element: <PageTransition><FixedAssets /></PageTransition> },
      { path: 'assets/categories', element: <PageTransition><AssetCategories /></PageTransition> },
      { path: 'assets/:id', element: <PageTransition><AssetDetail /></PageTransition> },
      { path: 'assets/depreciation-run', element: <PageTransition><DepreciationRun /></PageTransition> },
      { path: 'assets/reports', element: <PageTransition><AssetReports /></PageTransition> },
      { path: 'tax-returns', element: <PageTransition><TaxReturns /></PageTransition> },
      { path: 'reports', element: <PageTransition><Reports /></PageTransition> },
      { path: 'reports/advanced', element: <PageTransition><AdvancedReports /></PageTransition> },
      { path: 'reports/scheduled', element: <PageTransition><ScheduledReports /></PageTransition> },
      { path: 'reports/custom', element: <PageTransition><CustomReportBuilder /></PageTransition> },
      { path: 'reports/custom-list', element: <PageTransition><CustomReportsList /></PageTransition> },
      { path: 'reports/analytics', element: <PageTransition><EmbeddedAnalyticsDashboard /></PageTransition> },
      // Wave U: Custom Dashboards
      { path: 'dashboards', element: <PageTransition><MyDashboards /></PageTransition> },
      { path: 'dashboards/shared', element: <PageTransition><SharedDashboards /></PageTransition> },
      { path: 'dashboards/:id', element: <PageTransition><DashboardView /></PageTransition> },
      { path: 'dashboards/:id/edit', element: <PageTransition><DashboardEditor /></PageTransition> },
      { path: 'crm/leads', element: <PageTransition><CRMLeads /></PageTransition> },
      { path: 'crm/pipeline', element: <PageTransition><CRMPipeline /></PageTransition> },
      { path: 'crm/activities', element: <PageTransition><CRMActivities /></PageTransition> },
      { path: 'crm/insights', element: <PageTransition><CRMInsights /></PageTransition> },
      { path: 'activities/my', element: <PageTransition><MyActivities /></PageTransition> },
      { path: 'activities', element: <PageTransition><ActivitiesDashboard /></PageTransition> },
      { path: 'einvoice/dashboard', element: <PageTransition><EInvoiceDashboard /></PageTransition> },
      // growth-to-100 § G4a — Iraq e-Fakhata
      { path: 'efakhata', element: <PageTransition><EFakhataDashboard /></PageTransition> },
      { path: 'efakhata/submissions/:sid', element: <PageTransition><EFakhataSubmissionDetail /></PageTransition> },
      { path: 'settings/efakhata/cert', element: <PageTransition><EFakhataCertManagement /></PageTransition> },
      { path: 'settings/efakhata/export', element: <PageTransition><EFakhataAuditorExport /></PageTransition> },
      // growth-to-100 § G2 — super-admin tenant impersonation launcher
      { path: 'admin/impersonate', element: <PageTransition><ImpersonateTenant /></PageTransition> },
      // growth-to-100 § R3 — "first 60 seconds" onboarding wizard
      { path: 'get-started', element: <PageTransition><GetStartedWizard /></PageTransition> },
      { path: 'whatsapp', element: <PageTransition><WhatsApp /></PageTransition> },
      { path: 'ocr/receipts', element: <PageTransition><OCRReceipts /></PageTransition> },
      { path: 'hr', element: <PageTransition><HRDashboard /></PageTransition> },
      { path: 'hr/employees', element: <PageTransition><HREmployees /></PageTransition> },
      { path: 'hr/contracts', element: <PageTransition><HRContracts /></PageTransition> },
      { path: 'hr/attendance', element: <PageTransition><HRAttendance /></PageTransition> },
      { path: 'hr/time-off', element: <PageTransition><HRTimeOff /></PageTransition> },
      { path: 'payroll/rules', element: <PageTransition><PayrollRules /></PageTransition> },
      { path: 'payroll/runs', element: <PageTransition><PayrollRuns /></PageTransition> },
      // Wave AE: Onboarding + Mileage
      { path: 'onboarding', element: <PageTransition><OnboardingWizard /></PageTransition> },
      { path: 'onboarding/checklist', element: <PageTransition><OnboardingChecklist /></PageTransition> },
      { path: 'mileage', element: <PageTransition><MileageLog /></PageTransition> },
      { path: 'mileage/rates', element: <PageTransition><MileageRates /></PageTransition> },
      { path: 'companies', element: <PageTransition><Companies /></PageTransition> },
      { path: 'reports/consolidated', element: <PageTransition><ConsolidatedReports /></PageTransition> },
      { path: 'reports/branches', element: <PageTransition><BranchesComparison /></PageTransition> },
      // Wave AA: Multi-Entity Management
      { path: 'multi-entity/companies', element: <PageTransition><CompaniesList /></PageTransition> },
      { path: 'multi-entity/intercompany', element: <PageTransition><IntercompanyTransactions /></PageTransition> },
      { path: 'multi-entity/consolidated-pl', element: <PageTransition><ConsolidatedPL /></PageTransition> },
      { path: 'multi-entity/consolidated-bs', element: <PageTransition><ConsolidatedBS /></PageTransition> },
      { path: 'multi-entity/eliminations', element: <PageTransition><EliminationsWorkbench /></PageTransition> },
      { path: 'projects', element: <PageTransition><Projects /></PageTransition> },
      { path: 'projects/:projectId/gantt', element: <PageTransition><ProjectGantt /></PageTransition> },
      { path: 'tax-settings', element: <PageTransition><TaxSettings /></PageTransition> },
      // ------------------------------------------------------------------
      // Settings — P5 migration in progress (see docs/settings/migration-plan.md)
      // ------------------------------------------------------------------
      // The default `/settings` route is routed through `SettingsRouter`
      // which renders the new decomposed shell when the
      // `settings.new_shell` feature flag is ON, and the legacy shell
      // otherwise. The parallel `/settings/next` route ALWAYS renders the
      // new shell so the team can dogfood it without flipping the flag.
      // Only 3/56 sections are migrated today (CompanyInfo, Localization,
      // Branding) — keep the flag OFF in prod until the rest land.
      { path: 'settings', element: <SettingsRouter /> },
      { path: 'settings/next', element: <Suspense fallback={FeatureFallback}><PageTransition><SettingsShellNext /></PageTransition></Suspense> },
      { path: 'settings/numbering', element: <PageTransition><NumberingSequences /></PageTransition> },
      { path: 'settings/module-requests', element: <PageTransition><ModuleRequestsPage /></PageTransition> },
      { path: 'settings/system-health', element: <PageTransition><TenantSystemHealthRedirect /></PageTransition> },
      { path: 'platform/orgs', element: <Navigate to="/platform/orgs" replace /> },
      { path: 'trash', element: <PageTransition><Trash /></PageTransition> },
      { path: 'docs', element: <PageTransition><DocsHub /></PageTransition> },
      { path: 'ui-gallery', element: <PageTransition><UIGallery /></PageTransition> },
      { path: 'shipments', element: <PageTransition><Shipments /></PageTransition> },
      { path: 'delivery-challans', element: <PageTransition><DeliveryChallans /></PageTransition> },
      { path: 'returns/sales', element: <PageTransition><SalesReturnsRefund /></PageTransition> },
      { path: 'returns/vendor', element: <PageTransition><VendorReturnsRefund /></PageTransition> },
      { path: 'sales-returns', element: <PageTransition><SalesReturns /></PageTransition> },
      { path: 'purchase-returns', element: <PageTransition><PurchaseReturns /></PageTransition> },
      { path: 'custom-fields', element: <PageTransition><CustomFields /></PageTransition> },
      { path: 'approvals', element: <PageTransition><Approvals /></PageTransition> },
      { path: 'approval-rules', element: <PageTransition><ApprovalRules /></PageTransition> },
      { path: 'my-approvals', element: <PageTransition><MyApprovals /></PageTransition> },
      { path: 'approvals/:id', element: <PageTransition><ApprovalDetail /></PageTransition> },
      { path: 'expense-claims', element: <PageTransition><ExpenseClaims /></PageTransition> },
      { path: 'branches', element: <PageTransition><Branches /></PageTransition> },
      { path: 'audit-log', element: <PageTransition><AuditLog /></PageTransition> },
      { path: 'admin/job-runs', element: <PageTransition><JobRunsLog /></PageTransition> },
      { path: 'payment-links', element: <PageTransition><PaymentLinks /></PageTransition> },
      { path: 'l10n-iq', element: <PageTransition><IraqLocalization /></PageTransition> },
      { path: 'rbac-roles', element: <PageTransition><RbacRoles /></PageTransition> },
      { path: 'user-roles', element: <PageTransition><UserRoles /></PageTransition> },
      { path: 'users', element: <PageTransition><Users /></PageTransition> },
      // Wave B: Accounting Power Features
      { path: 'analytic-accounts', element: <PageTransition><AnalyticAccounts /></PageTransition> },
      { path: 'analytic-report', element: <PageTransition><AnalyticReport /></PageTransition> },
      { path: 'budgets', element: <PageTransition><Budgets /></PageTransition> },
      { path: 'budget-variance', element: <PageTransition><BudgetVariance /></PageTransition> },
      { path: 'cashflow-forecast', element: <PageTransition><CashflowForecast /></PageTransition> },
      { path: 'customer-statements', element: <PageTransition><CustomerStatements /></PageTransition> },
      { path: 'email-templates', element: <PageTransition><EmailTemplates /></PageTransition> },
      // Wave O: Multi-Currency Revaluation
      { path: 'fx/rates', element: <PageTransition><CurrencyRates /></PageTransition> },
      { path: 'fx/exposure', element: <PageTransition><FXExposure /></PageTransition> },
      { path: 'fx/revaluations', element: <PageTransition><RevaluationRuns /></PageTransition> },
      // POS Routes
      { path: 'pos', element: <PageTransition><POSHub /></PageTransition> },
      { path: 'pos/terminal/:sessionId', element: <PageTransition><POSTerminal /></PageTransition> },
      { path: 'pos/sessions', element: <PageTransition><POSSessions /></PageTransition> },
      { path: 'pos/sessions/:sessionId', element: <PageTransition><POSSessionDetail /></PageTransition> },
      { path: 'pos/orders', element: <PageTransition><POSOrders /></PageTransition> },
      { path: 'pos/configs', element: <PageTransition><POSConfigs /></PageTransition> },
      { path: 'pos/categories', element: <PageTransition><POSCategories /></PageTransition> },
      { path: 'pos/products', element: <PageTransition><POSProducts /></PageTransition> },
      { path: 'pos/pricelists', element: <PageTransition><POSPricelists /></PageTransition> },
      { path: 'pos/floors', element: <PageTransition><POSFloors /></PageTransition> },
      { path: 'pos/floor-plan/:configId', element: <PageTransition><POSFloorPlan /></PageTransition> },
      { path: 'pos/employees', element: <PageTransition><POSEmployees /></PageTransition> },
      { path: 'pos/loyalty', element: <PageTransition><POSLoyalty /></PageTransition> },
      { path: 'pos/gift-cards', element: <PageTransition><POSGiftCards /></PageTransition> },
      { path: 'pos/reports', element: <PageTransition><POSReports /></PageTransition> },
      // Marketing Routes
      { path: 'marketing', element: <PageTransition><MarketingDashboard /></PageTransition> },
      { path: 'marketing/campaigns/email', element: <PageTransition><EmailCampaigns /></PageTransition> },
      { path: 'marketing/campaigns/sms', element: <PageTransition><SmsCampaigns /></PageTransition> },
      { path: 'marketing/segments', element: <PageTransition><Segments /></PageTransition> },
      { path: 'marketing/automations', element: <PageTransition><Automations /></PageTransition> },
      // Wave-A Routes
      { path: 'wave-a/helpdesk', element: <PageTransition><Helpdesk /></PageTransition> },
      { path: 'wave-a/field-service', element: <PageTransition><FieldService /></PageTransition> },
      { path: 'wave-a/subscriptions', element: <PageTransition><Subscriptions /></PageTransition> },
      { path: 'wave-a/documents', element: <PageTransition><Documents /></PageTransition> },
      { path: 'wave-a/knowledge', element: <PageTransition><Knowledge /></PageTransition> },
      { path: 'wave-a/quality', element: <PageTransition><Quality /></PageTransition> },
      { path: 'wave-a/maintenance', element: <PageTransition><Maintenance /></PageTransition> },
      { path: 'wave-a/plm', element: <PageTransition><PLM /></PageTransition> },
      { path: 'wave-a/repairs', element: <PageTransition><Repairs /></PageTransition> },
      { path: 'wave-a/hr-extended', element: <PageTransition><HRExtended /></PageTransition> },
      { path: 'wave-a/studio', element: <PageTransition><Studio /></PageTransition> },
      // Wave AD: Studio (No-Code)
      { path: 'studio', element: <PageTransition><StudioHome /></PageTransition> },
      { path: 'studio/:entity/fields', element: <PageTransition><CustomFieldsBuilder /></PageTransition> },
      { path: 'studio/:entity/layout', element: <PageTransition><ViewLayoutEditor /></PageTransition> },
      { path: 'studio/:entity/automation', element: <PageTransition><AutomationFromStudio /></PageTransition> },
      // Wave R: Maintenance Module (Full)
      { path: 'maintenance', element: <PageTransition><MaintenanceDashboard /></PageTransition> },
      { path: 'maintenance/equipment', element: <PageTransition><Equipment /></PageTransition> },
      { path: 'maintenance/equipment/:id', element: <PageTransition><EquipmentDetail /></PageTransition> },
      { path: 'maintenance/categories', element: <PageTransition><EquipmentCategories /></PageTransition> },
      { path: 'maintenance/requests', element: <PageTransition><MaintenanceRequests /></PageTransition> },
      { path: 'maintenance/schedules', element: <PageTransition><MaintenanceSchedules /></PageTransition> },
      // Wave S: DMS / Document Vault Routes
      { path: 'dms', element: <PageTransition><DocumentVault /></PageTransition> },
      { path: 'dms/:docId', element: <PageTransition><DocumentDetail /></PageTransition> },
      { path: 'dms/signatures', element: <PageTransition><SignatureRequests /></PageTransition> },
      // Subscription Billing (Wave G) Routes
      { path: 'subscriptions', element: <PageTransition><SubscriptionsList /></PageTransition> },
      { path: 'subscriptions/plans', element: <PageTransition><SubscriptionPlans /></PageTransition> },
      { path: 'subscriptions/dunning', element: <PageTransition><SubscriptionDunning /></PageTransition> },
      { path: 'subscriptions/reports', element: <PageTransition><SubscriptionReports /></PageTransition> },
      { path: 'subscriptions/:id', element: <PageTransition><SubscriptionDetail /></PageTransition> },
      // Additional Routes
      { path: 'audit-log-viewer', element: <PageTransition><AuditLogViewer /></PageTransition> },
      { path: 'automation-rules', element: <PageTransition><AutomationRules /></PageTransition> },
      { path: 'automation/workflows', element: <PageTransition><WorkflowsList /></PageTransition> },
      { path: 'automation/workflows/:id', element: <PageTransition><WorkflowBuilder /></PageTransition> },
      { path: 'automation/workflows/:id/runs', element: <PageTransition><WorkflowRunHistory /></PageTransition> },
      { path: 'automation/logs', element: <PageTransition><AutomationLogs /></PageTransition> },
      // Wave V: IoT Routes
      { path: 'iot', element: <PageTransition><IoTDashboard /></PageTransition> },
      { path: 'iot/devices', element: <PageTransition><IoTDevices /></PageTransition> },
      { path: 'iot/devices/:id', element: <PageTransition><DeviceDetail /></PageTransition> },
      { path: 'iot/alert-rules', element: <PageTransition><AlertRules /></PageTransition> },
      { path: 'iot/alerts', element: <PageTransition><AlertHistory /></PageTransition> },
      // Wave Y: Field Service Management Routes
      { path: 'field-service', element: <PageTransition><FieldServiceDashboard /></PageTransition> },
      { path: 'field-service/orders', element: <PageTransition><ServiceOrders /></PageTransition> },
      { path: 'field-service/orders/:id', element: <PageTransition><ServiceOrderDetail /></PageTransition> },
      { path: 'field-service/technicians', element: <PageTransition><Technicians /></PageTransition> },
      { path: 'field-service/dispatch', element: <PageTransition><DispatchBoard /></PageTransition> },
      // Wave X: Quality Management Routes
      { path: 'quality', element: <PageTransition><QualityDashboard /></PageTransition> },
      { path: 'quality/plans', element: <PageTransition><QCPlans /></PageTransition> },
      { path: 'quality/checks', element: <PageTransition><QCChecks /></PageTransition> },
      { path: 'quality/ncr', element: <PageTransition><NonConformances /></PageTransition> },
      { path: 'quality/capa', element: <PageTransition><CAPAList /></PageTransition> },
      // Wave W: Helpdesk & Knowledge Base Routes
      { path: 'helpdesk', element: <PageTransition><HelpdeskDashboard /></PageTransition> },
      { path: 'helpdesk/tickets', element: <PageTransition><TicketsList /></PageTransition> },
      { path: 'helpdesk/tickets/:id', element: <PageTransition><TicketDetail /></PageTransition> },
      { path: 'helpdesk/settings', element: <PageTransition><HelpdeskSettings /></PageTransition> },
      { path: 'kb', element: <PageTransition><KnowledgeBase /></PageTransition> },
      { path: 'kb/articles/new', element: <PageTransition><ArticleEditor /></PageTransition> },
      { path: 'kb/articles/:id', element: <PageTransition><ArticleView /></PageTransition> },
      { path: 'kb/articles/:id/edit', element: <PageTransition><ArticleEditor /></PageTransition> },
      // Wave Z: Rental & Repairs Routes
      { path: 'rental/products', element: <PageTransition><RentalProducts /></PageTransition> },
      { path: 'rental/contracts', element: <PageTransition><RentalContracts /></PageTransition> },
      { path: 'rental/contracts/:id', element: <PageTransition><RentalContractDetail /></PageTransition> },
      { path: 'repairs/orders', element: <PageTransition><RepairOrders /></PageTransition> },
      { path: 'repairs/orders/:id', element: <PageTransition><RepairOrderDetail /></PageTransition> },
      { path: 'repairs/warranty-check', element: <PageTransition><WarrantyCheck /></PageTransition> },
      // Wave AB: AI Assist Routes
      { path: 'ai', element: <PageTransition><AIAssistDashboard /></PageTransition> },
      { path: 'ai/anomalies', element: <PageTransition><AnomaliesList /></PageTransition> },
      { path: 'ai/suggestions', element: <PageTransition><SuggestionsInbox /></PageTransition> },
      { path: 'ai/ocr', element: <PageTransition><OCRReceiptsAdvanced /></PageTransition> },
      { path: 'ai/predictions', element: <PageTransition><PredictionsExplorer /></PageTransition> },
      // Wave AF: Hotel & Restaurant Routes
      { path: 'hotel', element: <PageTransition><HotelDashboard /></PageTransition> },
      { path: 'hotel/rooms', element: <PageTransition><RoomsBookings /></PageTransition> },
      { path: 'restaurant/tables', element: <PageTransition><TablesView /></PageTransition> },
      { path: 'restaurant/kds', element: <PageTransition><KitchenDisplay /></PageTransition> },
      { path: 'restaurant/menu', element: <PageTransition><MenuManager /></PageTransition> },
      // Wave AG: Healthcare, Hospital, Pharmacy Routes
      { path: 'healthcare', element: <PageTransition><ClinicDashboard /></PageTransition> },
      { path: 'healthcare/patients', element: <PageTransition><PatientsList /></PageTransition> },
      { path: 'healthcare/appointments', element: <PageTransition><AppointmentsCalendar /></PageTransition> },
      { path: 'hospital/wards', element: <PageTransition><WardsAdmissions /></PageTransition> },
      { path: 'pharmacy/dispense', element: <PageTransition><PharmacyDispense /></PageTransition> },
      // Wave AH: Industry Modules Routes
      { path: 'real-estate', element: <PageTransition><PropertiesAndLeases /></PageTransition> },
      { path: 'construction/projects', element: <PageTransition><ConstructionProjects /></PageTransition> },
      { path: 'construction/boq', element: <PageTransition><BOQEditor /></PageTransition> },
      { path: 'agriculture', element: <PageTransition><FieldsAndYield /></PageTransition> },
      { path: 'plm/ecn', element: <PageTransition><PLMEngineeringChanges /></PageTransition> },
      { path: 'ext/:slug', element: <PageTransition><ModuleHub /></PageTransition> },
      // navigation-404-fix: aliases for real `navigate(...)` calls / surfaces that
      // historically fell through to the catch-all NotFound. Each alias resolves to
      // its canonical route so the seven-surface enumeration in
      // `nav-audit.exploration.mjs` and the runtime sweep both pass.
      // - /dashboard: cited by Settings.tsx (landing_page default), OnboardingWizard.tsx,
      //   OnboardingChecklist.tsx — Dashboard lives at the index '/'.
      { path: 'dashboard', element: <Navigate to="/" replace /> },
      // - /warehouses: cited by docs/sections/inventory.ts; canonical route is
      //   /inventory/warehouses.
      { path: 'warehouses', element: <Navigate to="/inventory/warehouses" replace /> },
      // - /crm: cited by moduleMap.ts and breadcrumb segments; the CRM module's
      //   default landing surface is the leads list.
      { path: 'crm', element: <Navigate to="/crm/leads" replace /> },
      // - /timesheets: cited by RouteTitleSync.tsx::TITLES and Settings copy;
      //   timesheets are tracked under the projects module.
      { path: 'timesheets', element: <Navigate to="/projects" replace /> },
      ]},
    ],
  },
  // navigation-404-fix: public storefront aliases for in-page-link surfaces
  // that previously fell through to NotFound. The parameterized canonical
  // routes (`/store/product/:id`, `/store/order/:orderId`) remain unchanged
  // and are still siblings here — these aliases only handle the bare paths.
  { path: '/store/product', element: <Navigate to="/store" replace /> },
  { path: '/store/order', element: <Navigate to="/portal/orders" replace /> },
  // POS Fullscreen pages - outside main layout
  { path: '/pos/kitchen/:displayId', element: <PageTransition><POSKitchen /></PageTransition> },
  { path: '/pos/self-order/:configId', element: <PageTransition><POSSelfOrder /></PageTransition> },
  { path: '/pos/customer-display/:configId', element: <PageTransition><POSCustomerDisplay /></PageTransition> },
  { path: '/server-error', element: <PageTransition><ServerError /></PageTransition> },
  // MUST be the last entry — catch-all `*` falls through here.
  { path: '*', element: <PageTransition><NotFound /></PageTransition> },
];

/* eslint-disable react-refresh/only-export-components -- This file exports
 * the application's `RouteObject[]` route tree alongside a large number of
 * file-local `lazy()`-wrapped page aliases. The route array is a legitimate
 * non-component export that must coexist with these component bindings, so
 * Fast Refresh's "only-export-components" heuristic does not apply here.
 * Edits to the route tree correctly trigger a full reload.
 */
import React, { lazy as _reactLazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import AppLayout from './layouts/AppShell';
import Login from './pages/Login';
import PageTransition from './components/PageTransition';
import LandingPage from './pages/LandingPage';
import { LoadingSkeleton } from './design-system/LoadingSkeleton';

/**
 * Shared Suspense fallback for all feature routes.
 * Uses LoadingSkeleton variant="table" per spec requirement 4.1, 18.2.
 */
const FeatureFallback = <LoadingSkeleton variant="table" />;

// Hardened lazy loader: surfaces stringifiable errors so React's error reporter
// cannot crash with "Cannot convert object to primitive value" when a chunk
// fails to load or a module has the wrong shape.
function lazy<T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T } | T>
) {
  return _reactLazy(async () => {
    let modulePath = '';
    try {
      // Best-effort: extract module path from the loader's source for diagnostics
      modulePath = (loader.toString().match(/import\(['"`]([^'"`]+)['"`]\)/) || [])[1] || '';
    } catch { /* noop */ }
    try {
      const mod: any = await loader();
      if (typeof mod === 'function') return { default: mod as T };
      if (mod && typeof mod === 'object') {
        // Use `in` check so HMR proxies with getter-defined `default` also pass
        if ('default' in mod && mod.default) return mod as { default: T };
        // Heuristic fallback: if there is exactly one named export that looks like a component, use it
        const keys = Object.keys(mod).filter((k) => k !== '__esModule');
        if (keys.length === 1 && typeof mod[keys[0]] === 'function') {
          return { default: mod[keys[0]] as T };
        }
        throw new Error(
          `module "${modulePath || 'unknown'}" has no default export. exports=[${keys.join(',')}]`
        );
      }
      throw new Error(`module "${modulePath || 'unknown'}" returned ${typeof mod}`);
    } catch (err: any) {
      let msg = 'unknown error';
      try {
        if (err == null) msg = 'null/undefined';
        else if (typeof err === 'string') msg = err;
        else if (err.message) msg = String(err.message);
        else if (typeof err.toString === 'function') msg = err.toString();
      } catch { msg = 'unstringifiable error'; }
      // eslint-disable-next-line no-console
      console.error(`[lazy] failed to load "${modulePath || 'unknown'}": ${msg}`);
      throw new Error(`Lazy load failed: ${modulePath || 'unknown'} — ${msg}`);
    }
  });
}

// Task 19: Form Pages — feature-sliced form templates (Requirements 15.1–15.7)
const InvoiceFormRedesign = lazy(() => import('./features/sales/invoices/InvoiceForm'));
const BillFormRedesign = lazy(() => import('./features/purchases/bills/BillForm'));
const PurchaseOrderFormRedesign = lazy(() => import('./features/purchases/purchase-orders/PurchaseOrderForm'));

// Lazy-loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Items = lazy(() => import('./pages/Items'));
const ItemForm = lazy(() => import('./pages/ItemForm'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InvoiceForm = lazy(() => import('./pages/InvoiceForm'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Reports = lazy(() => import('./pages/Reports'));
const AdvancedReports = lazy(() => import('./pages/AdvancedReports'));
const ScheduledReports = lazy(() => import('./pages/reports/ScheduledReports'));
const CustomReportBuilder = lazy(() => import('./pages/reports/CustomReportBuilder'));
const CustomReportsList = lazy(() => import('./pages/reports/CustomReportsList'));
// Wave U: Custom Dashboards
const MyDashboards = lazy(() => import('./pages/dashboards/MyDashboards'));
const DashboardView = lazy(() => import('./pages/dashboards/DashboardView'));
const DashboardEditor = lazy(() => import('./pages/dashboards/DashboardEditor'));
const SharedDashboards = lazy(() => import('./pages/dashboards/SharedDashboards'));
const CRMLeads = lazy(() => import('./pages/CRMLeads'));
const CRMPipeline = lazy(() => import('./pages/CRMPipeline'));
const CRMActivities = lazy(() => import('./pages/CRMActivities'));
const CRMInsights = lazy(() => import('./pages/CRMInsights'));
const MyActivities = lazy(() => import('./pages/activities/MyActivities'));
const ActivitiesDashboard = lazy(() => import('./pages/activities/ActivitiesDashboard'));
const EInvoiceDashboard = lazy(() => import('./pages/EInvoiceDashboard'));
const WhatsApp = lazy(() => import('./pages/WhatsApp'));
const OCRReceipts = lazy(() => import('./pages/OCRReceipts'));
const HRDashboard = lazy(() => import('./pages/HRDashboard'));
const HREmployees = lazy(() => import('./pages/HREmployees'));
const HRContracts = lazy(() => import('./pages/HRContracts'));
const HRAttendance = lazy(() => import('./pages/HRAttendance'));
const HRTimeOff = lazy(() => import('./pages/HRTimeOff'));
const PayrollRules = lazy(() => import('./pages/PayrollRules'));
const PayrollRuns = lazy(() => import('./pages/PayrollRuns'));
// Wave AE: Onboarding + Mileage
const OnboardingWizard = lazy(() => import('./pages/onboarding/OnboardingWizard'));
const OnboardingChecklist = lazy(() => import('./pages/onboarding/OnboardingChecklist'));
const MileageLog = lazy(() => import('./pages/mileage/MileageLog'));
const MileageRates = lazy(() => import('./pages/mileage/MileageRates'));
const MfgBOMs = lazy(() => import('./pages/MfgBOMs'));
const MfgOrders = lazy(() => import('./pages/MfgOrders'));
const MfgWorkCenters = lazy(() => import('./pages/MfgWorkCenters'));
const Companies = lazy(() => import('./pages/Companies'));
const ConsolidatedReports = lazy(() => import('./pages/ConsolidatedReports'));
const BranchesComparison = lazy(() => import('./pages/BranchesComparison'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectGantt = lazy(() => import('./pages/ProjectGantt'));
const Bills = lazy(() => import('./pages/Bills'));
const Journals = lazy(() => import('./pages/Journals'));
const Banking = lazy(() => import('./pages/Banking'));
const Quotes = lazy(() => import('./pages/Quotes'));
const QuoteForm = lazy(() => import('./pages/QuoteForm'));
const SalesOrders = lazy(() => import('./pages/SalesOrders'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const CreditNotes = lazy(() => import('./pages/CreditNotes'));
const VendorCredits = lazy(() => import('./pages/VendorCredits'));
const RecurringInvoices = lazy(() => import('./pages/RecurringInvoices'));
const Inventory = lazy(() => import('./pages/Inventory'));
const TaxSettings = lazy(() => import('./pages/TaxSettings'));
const Settings = lazy(() => import('./pages/Settings'));
const Trash = lazy(() => import('./pages/Trash'));
const DocsHub = lazy(() => import('./pages/DocsHub'));
const UIGallery = lazy(() => import('./pages/UIGallery'));
// Wave N: Fixed Assets
const AssetCategories = lazy(() => import('./pages/assets/AssetCategories'));
const FixedAssets = lazy(() => import('./pages/assets/FixedAssets'));
const AssetDetail = lazy(() => import('./pages/assets/AssetDetail'));
const DepreciationRun = lazy(() => import('./pages/assets/DepreciationRun'));
const AssetReports = lazy(() => import('./pages/assets/AssetReports'));
const BankRules = lazy(() => import('./pages/BankRules'));
const BankReconciliation = lazy(() => import('./pages/BankReconciliation'));
const ImportStatement = lazy(() => import('./pages/banking/ImportStatement'));
const SmartMatch = lazy(() => import('./pages/banking/SmartMatch'));
const BankImportHistory = lazy(() => import('./pages/banking/BankImportHistory'));
const Warehouses = lazy(() => import('./pages/Warehouses'));
const StockLocations = lazy(() => import('./pages/StockLocations'));
const PutawayRules = lazy(() => import('./pages/PutawayRules'));
const CycleCounts = lazy(() => import('./pages/CycleCounts'));
const PriceLists = lazy(() => import('./pages/PriceLists'));
const SerialNumbers = lazy(() => import('./pages/SerialNumbers'));
const TaxReturns = lazy(() => import('./pages/TaxReturns'));
const Shipments = lazy(() => import('./pages/Shipments'));
const DeliveryChallans = lazy(() => import('./pages/DeliveryChallans'));
const SalesReturns = lazy(() => import('./pages/SalesReturns'));
const PurchaseReturns = lazy(() => import('./pages/PurchaseReturns'));
const CustomFields = lazy(() => import('./pages/CustomFields'));
const Approvals = lazy(() => import('./pages/Approvals'));
const ApprovalRules = lazy(() => import('./pages/approvals/ApprovalRules'));
const MyApprovals = lazy(() => import('./pages/approvals/MyApprovals'));
const ApprovalDetail = lazy(() => import('./pages/approvals/ApprovalDetail'));
const ExpenseClaims = lazy(() => import('./pages/ExpenseClaims'));
const Branches = lazy(() => import('./pages/Branches'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const JobRunsLog = lazy(() => import('./pages/admin/JobRunsLog'));
const PaymentLinks = lazy(() => import('./pages/PaymentLinks'));
const IraqLocalization = lazy(() => import('./pages/IraqLocalization'));
const RbacRoles = lazy(() => import('./pages/RbacRoles'));
const UserRoles = lazy(() => import('./pages/UserRoles'));
const Users = lazy(() => import('./pages/Users'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const SignUp = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
// Auth module pages (Task 3.3)
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
// Task 16: Login Page Redesign — features/auth/LoginPage with split-screen, Particles, glass morphism
const LoginPageRedesign = lazy(() => import('./features/auth/LoginPage'));
const MFAPage = lazy(() => import('./pages/auth/MFAPage'));
const NotFound = lazy(() => import('./pages/NotFound'));
const ServerError = lazy(() => import('./pages/ServerError'));
// POS Pages
const POSHub = lazy(() => import('./pages/pos/POSHub'));
const POSTerminal = lazy(() => import('./pages/pos/POSTerminal'));
const POSSessions = lazy(() => import('./pages/pos/POSSessions'));
const POSSessionDetail = lazy(() => import('./pages/pos/POSSessionDetail'));
const POSOrders = lazy(() => import('./pages/pos/POSOrders'));
const POSConfigs = lazy(() => import('./pages/pos/POSConfigs'));
const POSCategories = lazy(() => import('./pages/pos/POSCategories'));
const POSProducts = lazy(() => import('./pages/pos/POSProducts'));
const POSPricelists = lazy(() => import('./pages/pos/POSPricelists'));
const POSFloors = lazy(() => import('./pages/pos/POSFloors'));
// Marketing Pages
const MarketingDashboard = lazy(() => import('./pages/marketing/MarketingDashboard'));
const EmailCampaigns = lazy(() => import('./pages/marketing/EmailCampaigns'));
const SmsCampaigns = lazy(() => import('./pages/marketing/SmsCampaigns'));
const Segments = lazy(() => import('./pages/marketing/Segments'));
const Automations = lazy(() => import('./pages/marketing/Automations'));
const POSFloorPlan = lazy(() => import('./pages/pos/POSFloorPlan'));
const POSKitchen = lazy(() => import('./pages/pos/POSKitchen'));
const POSEmployees = lazy(() => import('./pages/pos/POSEmployees'));
const POSLoyalty = lazy(() => import('./pages/pos/POSLoyalty'));
const POSGiftCards = lazy(() => import('./pages/pos/POSGiftCards'));
const POSSelfOrder = lazy(() => import('./pages/pos/POSSelfOrder'));
const POSReports = lazy(() => import('./pages/pos/POSReports'));
const POSCustomerDisplay = lazy(() => import('./pages/pos/POSCustomerDisplay'));
const ModuleHub = lazy(() => import('./pages/modules/ModuleHub'));
// Wave-A Pages
const Helpdesk = lazy(() => import('./pages/wave-a/Helpdesk'));
const FieldService = lazy(() => import('./pages/wave-a/FieldService'));
const Subscriptions = lazy(() => import('./pages/wave-a/Subscriptions'));
const Documents = lazy(() => import('./pages/wave-a/Documents'));
const Knowledge = lazy(() => import('./pages/wave-a/Knowledge'));
const Quality = lazy(() => import('./pages/wave-a/Quality'));
const Maintenance = lazy(() => import('./pages/wave-a/Maintenance'));
const PLM = lazy(() => import('./pages/wave-a/PLM'));
const Repairs = lazy(() => import('./pages/wave-a/Repairs'));
const HRExtended = lazy(() => import('./pages/wave-a/HRExtended'));
const Studio = lazy(() => import('./pages/wave-a/Studio'));
// Wave AD: Studio (No-Code)
const StudioHome = lazy(() => import('./pages/studio/StudioHome'));
const CustomFieldsBuilder = lazy(() => import('./pages/studio/CustomFieldsBuilder'));
const ViewLayoutEditor = lazy(() => import('./pages/studio/ViewLayoutEditor'));
const AutomationFromStudio = lazy(() => import('./pages/studio/AutomationFromStudio'));
// Wave R: Maintenance Module (Full)
const MaintenanceDashboard = lazy(() => import('./pages/maintenance/MaintenanceDashboard'));
const Equipment = lazy(() => import('./pages/maintenance/Equipment'));
const EquipmentDetail = lazy(() => import('./pages/maintenance/EquipmentDetail'));
const EquipmentCategories = lazy(() => import('./pages/maintenance/EquipmentCategories'));
const MaintenanceRequests = lazy(() => import('./pages/maintenance/MaintenanceRequests'));
const MaintenanceSchedules = lazy(() => import('./pages/maintenance/MaintenanceSchedules'));
// Subscription Billing (Wave G)
const SubscriptionPlans = lazy(() => import('./pages/subscriptions/SubscriptionPlans'));
const SubscriptionsList = lazy(() => import('./pages/subscriptions/SubscriptionsList'));
const SubscriptionDetail = lazy(() => import('./pages/subscriptions/SubscriptionDetail'));
const SubscriptionDunning = lazy(() => import('./pages/subscriptions/SubscriptionDunning'));
const SubscriptionReports = lazy(() => import('./pages/subscriptions/SubscriptionReports'));
// Additional Pages
const AuditLogViewer = lazy(() => import('./pages/AuditLogViewer'));
const AutomationRules = lazy(() => import('./pages/AutomationRules'));
// Wave T: Visual Workflow Automation
const WorkflowsList = lazy(() => import('./pages/automation/WorkflowsList'));
const WorkflowBuilder = lazy(() => import('./pages/automation/WorkflowBuilder'));
const WorkflowRunHistory = lazy(() => import('./pages/automation/WorkflowRunHistory'));
const AutomationLogs = lazy(() => import('./pages/automation/AutomationLogs'));
// Wave B: Accounting Power Features
const AnalyticAccounts = lazy(() => import('./pages/AnalyticAccounts'));
const AnalyticReport = lazy(() => import('./pages/AnalyticReport'));
const Budgets = lazy(() => import('./pages/Budgets'));
const BudgetVariance = lazy(() => import('./pages/BudgetVariance'));
const CashflowForecast = lazy(() => import('./pages/CashflowForecast'));
const CustomerStatements = lazy(() => import('./pages/CustomerStatements'));
const EmailTemplates = lazy(() => import('./pages/EmailTemplates'));
// Wave E: Storefront + Customer Portal
const StoreHome = lazy(() => import('./pages/storefront/StoreHome'));
// Wave O: Multi-Currency Revaluation
const CurrencyRates = lazy(() => import('./pages/fx/CurrencyRates'));
const FXExposure = lazy(() => import('./pages/fx/FXExposure'));
const RevaluationRuns = lazy(() => import('./pages/fx/RevaluationRuns'));
const StoreProduct = lazy(() => import('./pages/storefront/StoreProduct'));
const SalesReturnsRefund = lazy(() => import('./pages/returns/SalesReturns'));
const VendorReturnsRefund = lazy(() => import('./pages/returns/VendorReturns'));
const NumberingSequences = lazy(() => import('./pages/settings/NumberingSequences'));
const SystemHealthPage = lazy(() => import('./pages/settings/SystemHealthPage'));
const StoreCart = lazy(() => import('./pages/storefront/StoreCart'));
const StoreCheckout = lazy(() => import('./pages/storefront/StoreCheckout'));
const StoreOrderConfirm = lazy(() => import('./pages/storefront/StoreOrderConfirm'));
const PortalLogin = lazy(() => import('./pages/portal/PortalLogin'));
const PortalDashboard = lazy(() => import('./pages/portal/PortalDashboard'));
const PortalInvoices = lazy(() => import('./pages/portal/PortalInvoices'));
const PortalOrders = lazy(() => import('./pages/portal/PortalOrders'));
const PortalStatements = lazy(() => import('./pages/portal/PortalStatements'));
// Wave J: Vendor Portal
const VendorPortalLogin = lazy(() => import('./pages/vendor-portal/VendorPortalLogin'));
const VendorPortalDashboard = lazy(() => import('./pages/vendor-portal/VendorPortalDashboard'));
const VendorPortalPOs = lazy(() => import('./pages/vendor-portal/VendorPortalPOs'));
const VendorPortalSubmitBill = lazy(() => import('./pages/vendor-portal/VendorPortalSubmitBill'));
const VendorPortalBills = lazy(() => import('./pages/vendor-portal/VendorPortalBills'));
const VendorPortalPayments = lazy(() => import('./pages/vendor-portal/VendorPortalPayments'));
// Wave S: DMS / Document Vault
const DocumentVault = lazy(() => import('./pages/dms/DocumentVault'));
const DocumentDetail = lazy(() => import('./pages/dms/DocumentDetail'));
const SignatureRequests = lazy(() => import('./pages/dms/SignatureRequests'));
// Wave V: IoT Telemetry & Device Management
const IoTDashboard = lazy(() => import('./pages/iot/IoTDashboard'));
const IoTDevices = lazy(() => import('./pages/iot/IoTDevices'));
const DeviceDetail = lazy(() => import('./pages/iot/DeviceDetail'));
const AlertRules = lazy(() => import('./pages/iot/AlertRules'));
const AlertHistory = lazy(() => import('./pages/iot/AlertHistory'));
// Wave X: Quality Management
const QualityDashboard = lazy(() => import('./pages/quality/QualityDashboard'));
const QCPlans = lazy(() => import('./pages/quality/QCPlans'));
const QCChecks = lazy(() => import('./pages/quality/QCChecks'));
const NonConformances = lazy(() => import('./pages/quality/NonConformances'));
const CAPAList = lazy(() => import('./pages/quality/CAPAList'));
// Wave Y: Field Service Management
const FieldServiceDashboard = lazy(() => import('./pages/field-service/FieldServiceDashboard'));
const ServiceOrders = lazy(() => import('./pages/field-service/ServiceOrders'));
const ServiceOrderDetail = lazy(() => import('./pages/field-service/ServiceOrderDetail'));
const Technicians = lazy(() => import('./pages/field-service/Technicians'));
const DispatchBoard = lazy(() => import('./pages/field-service/DispatchBoard'));
// Wave W: Helpdesk & Knowledge Base
const HelpdeskDashboard = lazy(() => import('./pages/helpdesk/HelpdeskDashboard'));
const TicketsList = lazy(() => import('./pages/helpdesk/TicketsList'));
const TicketDetail = lazy(() => import('./pages/helpdesk/TicketDetail'));
const HelpdeskSettings = lazy(() => import('./pages/helpdesk/HelpdeskSettings'));
const KnowledgeBase = lazy(() => import('./pages/kb/KnowledgeBase'));
const ArticleEditor = lazy(() => import('./pages/kb/ArticleEditor'));
const ArticleView = lazy(() => import('./pages/kb/ArticleView'));
// Wave Z: Rental & Repairs
const RentalProducts = lazy(() => import('./pages/rental/RentalProducts'));
const RentalContracts = lazy(() => import('./pages/rental/RentalContracts'));
const RentalContractDetail = lazy(() => import('./pages/rental/RentalContractDetail'));
const RepairOrders = lazy(() => import('./pages/repairs/RepairOrders'));
const RepairOrderDetail = lazy(() => import('./pages/repairs/RepairOrderDetail'));
const WarrantyCheck = lazy(() => import('./pages/repairs/WarrantyCheck'));
// Wave AB: AI Assist
const AIAssistDashboard = lazy(() => import('./pages/ai/AIAssistDashboard'));
const AnomaliesList = lazy(() => import('./pages/ai/AnomaliesList'));
const SuggestionsInbox = lazy(() => import('./pages/ai/SuggestionsInbox'));
const OCRReceiptsAdvanced = lazy(() => import('./pages/ai/OCRReceiptsAdvanced'));
const PredictionsExplorer = lazy(() => import('./pages/ai/PredictionsExplorer'));
// Wave AA: Multi-Entity Management
const CompaniesList = lazy(() => import('./pages/multi-entity/CompaniesList'));
const IntercompanyTransactions = lazy(() => import('./pages/multi-entity/IntercompanyTransactions'));
const ConsolidatedPL = lazy(() => import('./pages/multi-entity/ConsolidatedPL'));
const ConsolidatedBS = lazy(() => import('./pages/multi-entity/ConsolidatedBS'));
const EliminationsWorkbench = lazy(() => import('./pages/multi-entity/EliminationsWorkbench'));
// Wave AF: Hotel & Restaurant
const HotelDashboard = lazy(() => import('./pages/hotel/HotelDashboard'));
const RoomsBookings = lazy(() => import('./pages/hotel/RoomsBookings'));
const TablesView = lazy(() => import('./pages/restaurant/TablesView'));
const KitchenDisplay = lazy(() => import('./pages/restaurant/KitchenDisplay'));
const MenuManager = lazy(() => import('./pages/restaurant/MenuManager'));
// Wave AG: Healthcare, Hospital, Pharmacy
const ClinicDashboard = lazy(() => import('./pages/healthcare/ClinicDashboard'));
const PatientsList = lazy(() => import('./pages/healthcare/PatientsList'));
const AppointmentsCalendar = lazy(() => import('./pages/healthcare/AppointmentsCalendar'));
const WardsAdmissions = lazy(() => import('./pages/hospital/WardsAdmissions'));
const PharmacyDispense = lazy(() => import('./pages/pharmacy/PharmacyDispense'));
// Wave AH: Industry Modules (Real Estate, Construction, Agriculture, PLM)
const PropertiesAndLeases = lazy(() => import('./pages/real-estate/PropertiesAndLeases'));
const ConstructionProjects = lazy(() => import('./pages/construction/ConstructionProjects'));
const BOQEditor = lazy(() => import('./pages/construction/BOQEditor'));
const FieldsAndYield = lazy(() => import('./pages/agriculture/FieldsAndYield'));
const PLMEngineeringChanges = lazy(() => import('./pages/plm/PLMEngineeringChanges'));
// Task 18: List Pages — modern redesigned list page templates (Requirements 14.1–14.9)
const InvoicesListModern = lazy(() => import('./features/sales/invoices/InvoicesList'));
const CustomersListModern = lazy(() => import('./features/sales/customers/CustomersList'));
const ItemsListModern = lazy(() => import('./features/inventory/items/ItemsList'));
const BillsListModern = lazy(() => import('./features/purchases/bills/BillsList'));
const PurchaseOrdersListModern = lazy(() => import('./features/purchases/purchase-orders/PurchaseOrdersList'));
const PaymentsListModern = lazy(() => import('./features/banking/payments/PaymentsList'));

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
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <PageTransition><LandingPage /></PageTransition>;
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
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
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
      { path: 'settings', element: <PageTransition><Settings /></PageTransition> },
      { path: 'settings/numbering', element: <PageTransition><NumberingSequences /></PageTransition> },
      { path: 'settings/system-health', element: <PageTransition><SystemHealthPage /></PageTransition> },
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

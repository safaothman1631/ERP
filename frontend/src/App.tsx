import React, { lazy as _reactLazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { App as AntApp, ConfigProvider, Spin, theme as antTheme } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from './store';
import { useSettingsStore } from './store/settingsStore';
import AppLayout from './layouts/AppShell';
import Login from './pages/Login';
import PageTransition from './components/PageTransition';
import { setMessageInstance } from './utils/message';

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
const SignUp = lazy(() => import('./pages/SignUp'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
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

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  const { i18n } = useTranslation();
  const { theme: appTheme, isAuthenticated } = useAuthStore();
  const loadSettings = useSettingsStore((s) => s.load);
  const isRTL = i18n.language === 'ku';
  const isDark = appTheme === 'dark';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appTheme);
  }, [appTheme]);

  useEffect(() => {
    if (isAuthenticated) loadSettings();
  }, [isAuthenticated, loadSettings]);

  return (
    <ConfigProvider
      direction={isRTL ? 'rtl' : 'ltr'}
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: isDark ? {
          colorPrimary: '#60A5FA',
          colorBgBase: '#0a0a0f',
          colorBgContainer: 'rgba(255,255,255,0.03)',
          colorBgElevated: 'rgba(255,255,255,0.06)',
          colorBgLayout: '#0a0a0f',
          colorBorder: 'rgba(255,255,255,0.08)',
          colorBorderSecondary: 'rgba(255,255,255,0.05)',
          colorText: '#f8fafc',
          colorTextSecondary: '#94a3b8',
          colorTextTertiary: '#64748b',
          borderRadius: 12,
          fontFamily: isRTL ? "'Noto Sans Arabic', sans-serif" : "'Inter', sans-serif",
        } : {
          colorPrimary: '#1F6FEB',
          colorInfo: '#0EA5E9',
          colorSuccess: '#16A34A',
          colorWarning: '#F59E0B',
          colorError: '#DC2626',
          colorBgBase: '#FFFFFF',
          colorBgLayout: '#F8FAFC',
          colorBgContainer: '#FFFFFF',
          colorBgElevated: '#FFFFFF',
          colorBorder: '#E5E7EB',
          colorBorderSecondary: '#EEF1F5',
          colorText: '#0F172A',
          colorTextSecondary: '#334155',
          colorTextTertiary: '#64748B',
          colorTextQuaternary: '#94A3B8',
          borderRadius: 8,
          borderRadiusLG: 14,
          borderRadiusSM: 6,
          fontSize: 14,
          fontFamily: isRTL ? "'Noto Sans Arabic', sans-serif" : "'Inter', sans-serif",
          controlHeight: 36,
          wireframe: false,
        },
        components: isDark ? {
          Card: { colorBgContainer: 'rgba(255,255,255,0.03)', borderRadiusLG: 16 },
          Table: { colorBgContainer: 'transparent', headerBg: 'rgba(255,255,255,0.04)' },
          Menu: { darkItemBg: 'transparent', darkItemSelectedBg: 'rgba(99,102,241,0.15)' },
          Button: { primaryShadow: '0 4px 12px rgba(99,102,241,0.3)' },
          Input: { colorBgContainer: 'rgba(255,255,255,0.03)' },
          Select: { colorBgContainer: 'rgba(255,255,255,0.03)' },
          Modal: { contentBg: '#12121a' },
        } : {
          Card: { borderRadiusLG: 14, paddingLG: 20 },
          Table: { headerBg: '#FBFCFD', headerColor: '#334155', rowHoverBg: 'rgba(31,111,235,0.04)', borderRadius: 10, headerSplitColor: 'transparent' },
          Button: { borderRadius: 6, controlHeight: 36, fontWeight: 500 },
          Modal: { borderRadiusLG: 14, paddingContentHorizontalLG: 24 },
          Drawer: { paddingLG: 24 },
          Menu: { itemBorderRadius: 8, subMenuItemBg: 'transparent', itemHeight: 38 },
          Tabs: { titleFontSize: 14, horizontalItemPadding: '10px 4px', inkBarColor: '#1F6FEB' },
          Input: { borderRadius: 6, controlHeight: 36 },
          Select: { borderRadius: 6, controlHeight: 36 },
          DatePicker: { borderRadius: 6 },
          Tag: { borderRadiusSM: 6 },
          Tooltip: { borderRadius: 6, colorBgSpotlight: 'rgba(15,23,42,0.92)' },
          Popover: { borderRadiusLG: 10 },
          Dropdown: { borderRadiusLG: 10, paddingBlock: 6 },
          Segmented: { borderRadius: 6 },
        },
      }}
    >
      <AntApp>
        <AppInitializer />
      <BrowserRouter>
        <Suspense fallback={<PageTransition><Spin size="large" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }} /></PageTransition>}>
          <Routes>
            <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
            <Route path="/signup" element={<Suspense fallback={<Spin />}><PageTransition><SignUp /></PageTransition></Suspense>} />
            <Route path="/forgot-password" element={<Suspense fallback={<Spin />}><PageTransition><ForgotPassword /></PageTransition></Suspense>} />
            <Route path="/reset-password" element={<Suspense fallback={<Spin />}><PageTransition><ResetPassword /></PageTransition></Suspense>} />
            <Route path="/accept-invite" element={<Suspense fallback={<Spin />}><PageTransition><AcceptInvite /></PageTransition></Suspense>} />
            {/* Wave E: Public Storefront Routes */}
            <Route path="/store" element={<Suspense fallback={<Spin />}><PageTransition><StoreHome /></PageTransition></Suspense>} />
            <Route path="/store/product/:id" element={<Suspense fallback={<Spin />}><PageTransition><StoreProduct /></PageTransition></Suspense>} />
            <Route path="/store/cart" element={<Suspense fallback={<Spin />}><PageTransition><StoreCart /></PageTransition></Suspense>} />
            <Route path="/store/checkout" element={<Suspense fallback={<Spin />}><PageTransition><StoreCheckout /></PageTransition></Suspense>} />
            <Route path="/store/order/:orderId" element={<Suspense fallback={<Spin />}><PageTransition><StoreOrderConfirm /></PageTransition></Suspense>} />
            {/* Wave E: Customer Portal Routes */}
            <Route path="/portal/login" element={<Suspense fallback={<Spin />}><PageTransition><PortalLogin /></PageTransition></Suspense>} />
            <Route path="/portal" element={<Suspense fallback={<Spin />}><PageTransition><PortalDashboard /></PageTransition></Suspense>} />
            <Route path="/portal/invoices" element={<Suspense fallback={<Spin />}><PageTransition><PortalInvoices /></PageTransition></Suspense>} />
            <Route path="/portal/orders" element={<Suspense fallback={<Spin />}><PageTransition><PortalOrders /></PageTransition></Suspense>} />
            <Route path="/portal/statements" element={<Suspense fallback={<Spin />}><PageTransition><PortalStatements /></PageTransition></Suspense>} />
            {/* Wave J: Vendor Portal Routes */}
            <Route path="/vendor-portal/login" element={<Suspense fallback={<Spin />}><PageTransition><VendorPortalLogin /></PageTransition></Suspense>} />
            <Route path="/vendor-portal" element={<Suspense fallback={<Spin />}><PageTransition><VendorPortalDashboard /></PageTransition></Suspense>} />
            <Route path="/vendor-portal/purchase-orders" element={<Suspense fallback={<Spin />}><PageTransition><VendorPortalPOs /></PageTransition></Suspense>} />
            <Route path="/vendor-portal/submit-bill" element={<Suspense fallback={<Spin />}><PageTransition><VendorPortalSubmitBill /></PageTransition></Suspense>} />
            <Route path="/vendor-portal/bills" element={<Suspense fallback={<Spin />}><PageTransition><VendorPortalBills /></PageTransition></Suspense>} />
            <Route path="/vendor-portal/payments" element={<Suspense fallback={<Spin />}><PageTransition><VendorPortalPayments /></PageTransition></Suspense>} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<PageTransition><Dashboard /></PageTransition>} />
              <Route path="contacts" element={<PageTransition><Contacts /></PageTransition>} />
              <Route path="items" element={<PageTransition><Items /></PageTransition>} />
              <Route path="items/new" element={<PageTransition><ItemForm /></PageTransition>} />
              <Route path="items/:id/edit" element={<PageTransition><ItemForm /></PageTransition>} />
              <Route path="invoices" element={<PageTransition><Invoices /></PageTransition>} />
              <Route path="invoices/new" element={<PageTransition><InvoiceForm /></PageTransition>} />
              <Route path="quotes" element={<PageTransition><Quotes /></PageTransition>} />
              <Route path="quotes/new" element={<PageTransition><QuoteForm /></PageTransition>} />
              <Route path="sales-orders" element={<PageTransition><SalesOrders /></PageTransition>} />
              <Route path="credit-notes" element={<PageTransition><CreditNotes /></PageTransition>} />
              <Route path="expenses" element={<PageTransition><Expenses /></PageTransition>} />
              <Route path="bills" element={<PageTransition><Bills /></PageTransition>} />
              <Route path="purchase-orders" element={<PageTransition><PurchaseOrders /></PageTransition>} />
              <Route path="vendor-credits" element={<PageTransition><VendorCredits /></PageTransition>} />
              <Route path="recurring-invoices" element={<PageTransition><RecurringInvoices /></PageTransition>} />
              <Route path="inventory" element={<PageTransition><Inventory /></PageTransition>} />
              <Route path="accounts" element={<PageTransition><Accounts /></PageTransition>} />
              <Route path="journals" element={<PageTransition><Journals /></PageTransition>} />
              <Route path="banking" element={<PageTransition><Banking /></PageTransition>} />
              <Route path="banking/rules" element={<PageTransition><BankRules /></PageTransition>} />
              <Route path="banking/reconciliation" element={<PageTransition><BankReconciliation /></PageTransition>} />
              <Route path="banking/:accountId/import" element={<PageTransition><ImportStatement /></PageTransition>} />
              <Route path="banking/:accountId/match" element={<PageTransition><SmartMatch /></PageTransition>} />
              <Route path="banking/:accountId/import-history" element={<PageTransition><BankImportHistory /></PageTransition>} />
              <Route path="inventory/warehouses" element={<PageTransition><Warehouses /></PageTransition>} />
              <Route path="inventory/locations" element={<PageTransition><StockLocations /></PageTransition>} />
              <Route path="inventory/putaway-rules" element={<PageTransition><PutawayRules /></PageTransition>} />
              <Route path="inventory/cycle-counts" element={<PageTransition><CycleCounts /></PageTransition>} />
              <Route path="inventory/price-lists" element={<PageTransition><PriceLists /></PageTransition>} />
              <Route path="inventory/serials" element={<PageTransition><SerialNumbers /></PageTransition>} />
              <Route path="manufacturing/boms" element={<PageTransition><MfgBOMs /></PageTransition>} />
              <Route path="manufacturing/orders" element={<PageTransition><MfgOrders /></PageTransition>} />
              <Route path="manufacturing/work-centers" element={<PageTransition><MfgWorkCenters /></PageTransition>} />
              {/* Wave N: Fixed Assets */}
              <Route path="assets" element={<PageTransition><FixedAssets /></PageTransition>} />
              <Route path="assets/categories" element={<PageTransition><AssetCategories /></PageTransition>} />
              <Route path="assets/:id" element={<PageTransition><AssetDetail /></PageTransition>} />
              <Route path="assets/depreciation-run" element={<PageTransition><DepreciationRun /></PageTransition>} />
              <Route path="assets/reports" element={<PageTransition><AssetReports /></PageTransition>} />
              <Route path="tax-returns" element={<PageTransition><TaxReturns /></PageTransition>} />
              <Route path="reports" element={<PageTransition><Reports /></PageTransition>} />
              <Route path="reports/advanced" element={<PageTransition><AdvancedReports /></PageTransition>} />
              <Route path="reports/scheduled" element={<PageTransition><ScheduledReports /></PageTransition>} />
              <Route path="reports/custom" element={<PageTransition><CustomReportBuilder /></PageTransition>} />
              <Route path="reports/custom-list" element={<PageTransition><CustomReportsList /></PageTransition>} />
              {/* Wave U: Custom Dashboards */}
              <Route path="dashboards" element={<PageTransition><MyDashboards /></PageTransition>} />
              <Route path="dashboards/shared" element={<PageTransition><SharedDashboards /></PageTransition>} />
              <Route path="dashboards/:id" element={<PageTransition><DashboardView /></PageTransition>} />
              <Route path="dashboards/:id/edit" element={<PageTransition><DashboardEditor /></PageTransition>} />
              <Route path="crm/leads" element={<PageTransition><CRMLeads /></PageTransition>} />
              <Route path="crm/pipeline" element={<PageTransition><CRMPipeline /></PageTransition>} />
              <Route path="crm/activities" element={<PageTransition><CRMActivities /></PageTransition>} />
              <Route path="crm/insights" element={<PageTransition><CRMInsights /></PageTransition>} />
              <Route path="activities/my" element={<PageTransition><MyActivities /></PageTransition>} />
              <Route path="activities" element={<PageTransition><ActivitiesDashboard /></PageTransition>} />
              <Route path="einvoice/dashboard" element={<PageTransition><EInvoiceDashboard /></PageTransition>} />
              <Route path="whatsapp" element={<PageTransition><WhatsApp /></PageTransition>} />
              <Route path="ocr/receipts" element={<PageTransition><OCRReceipts /></PageTransition>} />
              <Route path="hr" element={<PageTransition><HRDashboard /></PageTransition>} />
              <Route path="hr/employees" element={<PageTransition><HREmployees /></PageTransition>} />
              <Route path="hr/contracts" element={<PageTransition><HRContracts /></PageTransition>} />
              <Route path="hr/attendance" element={<PageTransition><HRAttendance /></PageTransition>} />
              <Route path="hr/time-off" element={<PageTransition><HRTimeOff /></PageTransition>} />
              <Route path="payroll/rules" element={<PageTransition><PayrollRules /></PageTransition>} />
              <Route path="payroll/runs" element={<PageTransition><PayrollRuns /></PageTransition>} />
              {/* Wave AE: Onboarding + Mileage */}
              <Route path="onboarding" element={<PageTransition><OnboardingWizard /></PageTransition>} />
              <Route path="onboarding/checklist" element={<PageTransition><OnboardingChecklist /></PageTransition>} />
              <Route path="mileage" element={<PageTransition><MileageLog /></PageTransition>} />
              <Route path="mileage/rates" element={<PageTransition><MileageRates /></PageTransition>} />
              <Route path="companies" element={<PageTransition><Companies /></PageTransition>} />
              <Route path="reports/consolidated" element={<PageTransition><ConsolidatedReports /></PageTransition>} />
              <Route path="reports/branches" element={<PageTransition><BranchesComparison /></PageTransition>} />
              {/* Wave AA: Multi-Entity Management */}
              <Route path="multi-entity/companies" element={<PageTransition><CompaniesList /></PageTransition>} />
              <Route path="multi-entity/intercompany" element={<PageTransition><IntercompanyTransactions /></PageTransition>} />
              <Route path="multi-entity/consolidated-pl" element={<PageTransition><ConsolidatedPL /></PageTransition>} />
              <Route path="multi-entity/consolidated-bs" element={<PageTransition><ConsolidatedBS /></PageTransition>} />
              <Route path="multi-entity/eliminations" element={<PageTransition><EliminationsWorkbench /></PageTransition>} />
              <Route path="projects" element={<PageTransition><Projects /></PageTransition>} />
              <Route path="projects/:projectId/gantt" element={<PageTransition><ProjectGantt /></PageTransition>} />
              <Route path="tax-settings" element={<PageTransition><TaxSettings /></PageTransition>} />
              <Route path="settings" element={<PageTransition><Settings /></PageTransition>} />
              <Route path="settings/numbering" element={<PageTransition><NumberingSequences /></PageTransition>} />
              <Route path="trash" element={<PageTransition><Trash /></PageTransition>} />
              <Route path="docs" element={<PageTransition><DocsHub /></PageTransition>} />
              <Route path="ui-gallery" element={<PageTransition><UIGallery /></PageTransition>} />
              <Route path="shipments" element={<PageTransition><Shipments /></PageTransition>} />
              <Route path="delivery-challans" element={<PageTransition><DeliveryChallans /></PageTransition>} />
              <Route path="returns/sales" element={<PageTransition><SalesReturnsRefund /></PageTransition>} />
              <Route path="returns/vendor" element={<PageTransition><VendorReturnsRefund /></PageTransition>} />
              <Route path="sales-returns" element={<PageTransition><SalesReturns /></PageTransition>} />
              <Route path="purchase-returns" element={<PageTransition><PurchaseReturns /></PageTransition>} />
              <Route path="custom-fields" element={<PageTransition><CustomFields /></PageTransition>} />
              <Route path="approvals" element={<PageTransition><Approvals /></PageTransition>} />
              <Route path="approval-rules" element={<PageTransition><ApprovalRules /></PageTransition>} />
              <Route path="my-approvals" element={<PageTransition><MyApprovals /></PageTransition>} />
              <Route path="approvals/:id" element={<PageTransition><ApprovalDetail /></PageTransition>} />
              <Route path="expense-claims" element={<PageTransition><ExpenseClaims /></PageTransition>} />
              <Route path="branches" element={<PageTransition><Branches /></PageTransition>} />
              <Route path="audit-log" element={<PageTransition><AuditLog /></PageTransition>} />
              <Route path="admin/job-runs" element={<PageTransition><JobRunsLog /></PageTransition>} />
              <Route path="payment-links" element={<PageTransition><PaymentLinks /></PageTransition>} />
              <Route path="l10n-iq" element={<PageTransition><IraqLocalization /></PageTransition>} />
              <Route path="rbac-roles" element={<PageTransition><RbacRoles /></PageTransition>} />
              <Route path="user-roles" element={<PageTransition><UserRoles /></PageTransition>} />
              <Route path="users" element={<PageTransition><Users /></PageTransition>} />
              {/* Wave B: Accounting Power Features */}
              <Route path="analytic-accounts" element={<PageTransition><AnalyticAccounts /></PageTransition>} />
              <Route path="analytic-report" element={<PageTransition><AnalyticReport /></PageTransition>} />
              <Route path="budgets" element={<PageTransition><Budgets /></PageTransition>} />
              <Route path="budget-variance" element={<PageTransition><BudgetVariance /></PageTransition>} />
              <Route path="cashflow-forecast" element={<PageTransition><CashflowForecast /></PageTransition>} />
              <Route path="customer-statements" element={<PageTransition><CustomerStatements /></PageTransition>} />
              <Route path="email-templates" element={<PageTransition><EmailTemplates /></PageTransition>} />
              {/* Wave O: Multi-Currency Revaluation */}
              <Route path="fx/rates" element={<PageTransition><CurrencyRates /></PageTransition>} />
              <Route path="fx/exposure" element={<PageTransition><FXExposure /></PageTransition>} />
              <Route path="fx/revaluations" element={<PageTransition><RevaluationRuns /></PageTransition>} />
              {/* POS Routes */}
              <Route path="pos" element={<PageTransition><POSHub /></PageTransition>} />
              <Route path="pos/terminal/:sessionId" element={<PageTransition><POSTerminal /></PageTransition>} />
              <Route path="pos/sessions" element={<PageTransition><POSSessions /></PageTransition>} />
              <Route path="pos/sessions/:sessionId" element={<PageTransition><POSSessionDetail /></PageTransition>} />
              <Route path="pos/orders" element={<PageTransition><POSOrders /></PageTransition>} />
              <Route path="pos/configs" element={<PageTransition><POSConfigs /></PageTransition>} />
              <Route path="pos/categories" element={<PageTransition><POSCategories /></PageTransition>} />
              <Route path="pos/products" element={<PageTransition><POSProducts /></PageTransition>} />
              <Route path="pos/pricelists" element={<PageTransition><POSPricelists /></PageTransition>} />
              <Route path="pos/floors" element={<PageTransition><POSFloors /></PageTransition>} />
              <Route path="pos/floor-plan/:configId" element={<PageTransition><POSFloorPlan /></PageTransition>} />
              <Route path="pos/employees" element={<PageTransition><POSEmployees /></PageTransition>} />
              <Route path="pos/loyalty" element={<PageTransition><POSLoyalty /></PageTransition>} />
              <Route path="pos/gift-cards" element={<PageTransition><POSGiftCards /></PageTransition>} />
              <Route path="pos/reports" element={<PageTransition><POSReports /></PageTransition>} />
              {/* Marketing Routes */}
              <Route path="marketing" element={<PageTransition><MarketingDashboard /></PageTransition>} />
              <Route path="marketing/campaigns/email" element={<PageTransition><EmailCampaigns /></PageTransition>} />
              <Route path="marketing/campaigns/sms" element={<PageTransition><SmsCampaigns /></PageTransition>} />
              <Route path="marketing/segments" element={<PageTransition><Segments /></PageTransition>} />
              <Route path="marketing/automations" element={<PageTransition><Automations /></PageTransition>} />
              {/* Wave-A Routes */}
              <Route path="wave-a/helpdesk" element={<PageTransition><Helpdesk /></PageTransition>} />
              <Route path="wave-a/field-service" element={<PageTransition><FieldService /></PageTransition>} />
              <Route path="wave-a/subscriptions" element={<PageTransition><Subscriptions /></PageTransition>} />
              <Route path="wave-a/documents" element={<PageTransition><Documents /></PageTransition>} />
              <Route path="wave-a/knowledge" element={<PageTransition><Knowledge /></PageTransition>} />
              <Route path="wave-a/quality" element={<PageTransition><Quality /></PageTransition>} />
              <Route path="wave-a/maintenance" element={<PageTransition><Maintenance /></PageTransition>} />
              <Route path="wave-a/plm" element={<PageTransition><PLM /></PageTransition>} />
              <Route path="wave-a/repairs" element={<PageTransition><Repairs /></PageTransition>} />
              <Route path="wave-a/hr-extended" element={<PageTransition><HRExtended /></PageTransition>} />
              <Route path="wave-a/studio" element={<PageTransition><Studio /></PageTransition>} />
              {/* Wave AD: Studio (No-Code) */}
              <Route path="studio" element={<PageTransition><StudioHome /></PageTransition>} />
              <Route path="studio/:entity/fields" element={<PageTransition><CustomFieldsBuilder /></PageTransition>} />
              <Route path="studio/:entity/layout" element={<PageTransition><ViewLayoutEditor /></PageTransition>} />
              <Route path="studio/:entity/automation" element={<PageTransition><AutomationFromStudio /></PageTransition>} />
              {/* Wave R: Maintenance Module (Full) */}
              <Route path="maintenance" element={<PageTransition><MaintenanceDashboard /></PageTransition>} />
              <Route path="maintenance/equipment" element={<PageTransition><Equipment /></PageTransition>} />
              <Route path="maintenance/equipment/:id" element={<PageTransition><EquipmentDetail /></PageTransition>} />
              <Route path="maintenance/categories" element={<PageTransition><EquipmentCategories /></PageTransition>} />
              <Route path="maintenance/requests" element={<PageTransition><MaintenanceRequests /></PageTransition>} />
              <Route path="maintenance/schedules" element={<PageTransition><MaintenanceSchedules /></PageTransition>} />
              {/* Wave S: DMS / Document Vault Routes */}
              <Route path="dms" element={<PageTransition><DocumentVault /></PageTransition>} />
              <Route path="dms/:docId" element={<PageTransition><DocumentDetail /></PageTransition>} />
              <Route path="dms/signatures" element={<PageTransition><SignatureRequests /></PageTransition>} />
              {/* Subscription Billing (Wave G) Routes */}
              <Route path="subscriptions" element={<PageTransition><SubscriptionsList /></PageTransition>} />
              <Route path="subscriptions/plans" element={<PageTransition><SubscriptionPlans /></PageTransition>} />
              <Route path="subscriptions/dunning" element={<PageTransition><SubscriptionDunning /></PageTransition>} />
              <Route path="subscriptions/reports" element={<PageTransition><SubscriptionReports /></PageTransition>} />
              <Route path="subscriptions/:id" element={<PageTransition><SubscriptionDetail /></PageTransition>} />
              {/* Additional Routes */}
              <Route path="audit-log-viewer" element={<PageTransition><AuditLogViewer /></PageTransition>} />
              <Route path="automation-rules" element={<PageTransition><AutomationRules /></PageTransition>} />
              <Route path="automation/workflows" element={<PageTransition><WorkflowsList /></PageTransition>} />
              <Route path="automation/workflows/:id" element={<PageTransition><WorkflowBuilder /></PageTransition>} />
              <Route path="automation/workflows/:id/runs" element={<PageTransition><WorkflowRunHistory /></PageTransition>} />
              <Route path="automation/logs" element={<PageTransition><AutomationLogs /></PageTransition>} />
              {/* Wave V: IoT Routes */}
              <Route path="iot" element={<PageTransition><IoTDashboard /></PageTransition>} />
              <Route path="iot/devices" element={<PageTransition><IoTDevices /></PageTransition>} />
              <Route path="iot/devices/:id" element={<PageTransition><DeviceDetail /></PageTransition>} />
              <Route path="iot/alert-rules" element={<PageTransition><AlertRules /></PageTransition>} />
              <Route path="iot/alerts" element={<PageTransition><AlertHistory /></PageTransition>} />
              {/* Wave Y: Field Service Management Routes */}
              <Route path="field-service" element={<PageTransition><FieldServiceDashboard /></PageTransition>} />
              <Route path="field-service/orders" element={<PageTransition><ServiceOrders /></PageTransition>} />
              <Route path="field-service/orders/:id" element={<PageTransition><ServiceOrderDetail /></PageTransition>} />
              <Route path="field-service/technicians" element={<PageTransition><Technicians /></PageTransition>} />
              <Route path="field-service/dispatch" element={<PageTransition><DispatchBoard /></PageTransition>} />
              {/* Wave X: Quality Management Routes */}
              <Route path="quality" element={<PageTransition><QualityDashboard /></PageTransition>} />
              <Route path="quality/plans" element={<PageTransition><QCPlans /></PageTransition>} />
              <Route path="quality/checks" element={<PageTransition><QCChecks /></PageTransition>} />
              <Route path="quality/ncr" element={<PageTransition><NonConformances /></PageTransition>} />
              <Route path="quality/capa" element={<PageTransition><CAPAList /></PageTransition>} />
              {/* Wave W: Helpdesk & Knowledge Base Routes */}
              <Route path="helpdesk" element={<PageTransition><HelpdeskDashboard /></PageTransition>} />
              <Route path="helpdesk/tickets" element={<PageTransition><TicketsList /></PageTransition>} />
              <Route path="helpdesk/tickets/:id" element={<PageTransition><TicketDetail /></PageTransition>} />
              <Route path="helpdesk/settings" element={<PageTransition><HelpdeskSettings /></PageTransition>} />
              <Route path="kb" element={<PageTransition><KnowledgeBase /></PageTransition>} />
              <Route path="kb/articles/new" element={<PageTransition><ArticleEditor /></PageTransition>} />
              <Route path="kb/articles/:id" element={<PageTransition><ArticleView /></PageTransition>} />
              <Route path="kb/articles/:id/edit" element={<PageTransition><ArticleEditor /></PageTransition>} />
              {/* Wave Z: Rental & Repairs Routes */}
              <Route path="rental/products" element={<PageTransition><RentalProducts /></PageTransition>} />
              <Route path="rental/contracts" element={<PageTransition><RentalContracts /></PageTransition>} />
              <Route path="rental/contracts/:id" element={<PageTransition><RentalContractDetail /></PageTransition>} />
              <Route path="repairs/orders" element={<PageTransition><RepairOrders /></PageTransition>} />
              <Route path="repairs/orders/:id" element={<PageTransition><RepairOrderDetail /></PageTransition>} />
              <Route path="repairs/warranty-check" element={<PageTransition><WarrantyCheck /></PageTransition>} />
              {/* Wave AB: AI Assist Routes */}
              <Route path="ai" element={<PageTransition><AIAssistDashboard /></PageTransition>} />
              <Route path="ai/anomalies" element={<PageTransition><AnomaliesList /></PageTransition>} />
              <Route path="ai/suggestions" element={<PageTransition><SuggestionsInbox /></PageTransition>} />
              <Route path="ai/ocr" element={<PageTransition><OCRReceiptsAdvanced /></PageTransition>} />
              <Route path="ai/predictions" element={<PageTransition><PredictionsExplorer /></PageTransition>} />
              {/* Wave AF: Hotel & Restaurant Routes */}
              <Route path="hotel" element={<PageTransition><HotelDashboard /></PageTransition>} />
              <Route path="hotel/rooms" element={<PageTransition><RoomsBookings /></PageTransition>} />
              <Route path="restaurant/tables" element={<PageTransition><TablesView /></PageTransition>} />
              <Route path="restaurant/kds" element={<PageTransition><KitchenDisplay /></PageTransition>} />
              <Route path="restaurant/menu" element={<PageTransition><MenuManager /></PageTransition>} />
              {/* Wave AG: Healthcare, Hospital, Pharmacy Routes */}
              <Route path="healthcare" element={<PageTransition><ClinicDashboard /></PageTransition>} />
              <Route path="healthcare/patients" element={<PageTransition><PatientsList /></PageTransition>} />
              <Route path="healthcare/appointments" element={<PageTransition><AppointmentsCalendar /></PageTransition>} />
              <Route path="hospital/wards" element={<PageTransition><WardsAdmissions /></PageTransition>} />
              <Route path="pharmacy/dispense" element={<PageTransition><PharmacyDispense /></PageTransition>} />
              {/* Wave AH: Industry Modules Routes */}
              <Route path="real-estate" element={<PageTransition><PropertiesAndLeases /></PageTransition>} />
              <Route path="construction/projects" element={<PageTransition><ConstructionProjects /></PageTransition>} />
              <Route path="construction/boq" element={<PageTransition><BOQEditor /></PageTransition>} />
              <Route path="agriculture" element={<PageTransition><FieldsAndYield /></PageTransition>} />
              <Route path="plm/ecn" element={<PageTransition><PLMEngineeringChanges /></PageTransition>} />
              <Route path="ext/:slug" element={<PageTransition><ModuleHub /></PageTransition>} />
            </Route>
            {/* POS Fullscreen pages - outside main layout */}
            <Route path="/pos/kitchen/:displayId" element={<PageTransition><POSKitchen /></PageTransition>} />
            <Route path="/pos/self-order/:configId" element={<PageTransition><POSSelfOrder /></PageTransition>} />
            <Route path="/pos/customer-display/:configId" element={<PageTransition><POSCustomerDisplay /></PageTransition>} />
            <Route path="/server-error" element={<PageTransition><ServerError /></PageTransition>} />
            <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
};

/**
 * Registers the App.useApp() message instance globally so pages can import
 * from '../utils/message' without hooks.
 */
const AppInitializer: React.FC = () => {
  const { message } = AntApp.useApp();
  useEffect(() => { setMessageInstance(message); }, [message]);
  return null;
};

export default App;

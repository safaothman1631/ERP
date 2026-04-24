import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { App as AntApp, Spin } from 'antd';
import { useAuthStore } from './store';
import { useUiStore } from './stores/uiStore';
import AppShell from './layouts/AppShell';
import Login from './pages/Login';
import PageTransition from './components/PageTransition';
import ErrorBoundary from './components/ErrorBoundary';
import { setMessageInstance } from './utils/message';
import AppConfigProvider from './theme/AppConfigProvider';

// Lazy-loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Items = lazy(() => import('./pages/Items'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InvoiceForm = lazy(() => import('./pages/InvoiceForm'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Reports = lazy(() => import('./pages/Reports'));
const AdvancedReports = lazy(() => import('./pages/AdvancedReports'));
const CRMLeads = lazy(() => import('./pages/CRMLeads'));
const CRMPipeline = lazy(() => import('./pages/CRMPipeline'));
const CRMActivities = lazy(() => import('./pages/CRMActivities'));
const CRMInsights = lazy(() => import('./pages/CRMInsights'));
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
const MfgBOMs = lazy(() => import('./pages/MfgBOMs'));
const MfgOrders = lazy(() => import('./pages/MfgOrders'));
const MfgWorkCenters = lazy(() => import('./pages/MfgWorkCenters'));
const Companies = lazy(() => import('./pages/Companies'));
const ConsolidatedReports = lazy(() => import('./pages/ConsolidatedReports'));
const BranchesComparison = lazy(() => import('./pages/BranchesComparison'));
const Projects = lazy(() => import('./pages/Projects'));
const Bills = lazy(() => import('./pages/Bills'));
const BillForm = lazy(() => import('./pages/BillForm'));
const ContactForm = lazy(() => import('./pages/ContactForm'));
const ItemForm = lazy(() => import('./pages/ItemForm'));
const ExpenseForm = lazy(() => import('./pages/ExpenseForm'));
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
const UIKit = lazy(() => import('./pages/UIKit'));
const Assets = lazy(() => import('./pages/Assets'));
const BankRules = lazy(() => import('./pages/BankRules'));
const BankReconciliation = lazy(() => import('./pages/BankReconciliation'));
const Warehouses = lazy(() => import('./pages/Warehouses'));
const PriceLists = lazy(() => import('./pages/PriceLists'));
const SerialNumbers = lazy(() => import('./pages/SerialNumbers'));
const TaxReturns = lazy(() => import('./pages/TaxReturns'));
const Shipments = lazy(() => import('./pages/Shipments'));
const DeliveryChallans = lazy(() => import('./pages/DeliveryChallans'));
const SalesReturns = lazy(() => import('./pages/SalesReturns'));
const PurchaseReturns = lazy(() => import('./pages/PurchaseReturns'));
const CustomFields = lazy(() => import('./pages/CustomFields'));
const Approvals = lazy(() => import('./pages/Approvals'));
const ExpenseClaims = lazy(() => import('./pages/ExpenseClaims'));
const Branches = lazy(() => import('./pages/Branches'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const PaymentLinks = lazy(() => import('./pages/PaymentLinks'));
const IraqLocalization = lazy(() => import('./pages/IraqLocalization'));
const RbacRoles = lazy(() => import('./pages/RbacRoles'));
const UserRoles = lazy(() => import('./pages/UserRoles'));
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
const POSFloorPlan = lazy(() => import('./pages/pos/POSFloorPlan'));
const POSKitchen = lazy(() => import('./pages/pos/POSKitchen'));
const POSEmployees = lazy(() => import('./pages/pos/POSEmployees'));
const POSLoyalty = lazy(() => import('./pages/pos/POSLoyalty'));
const POSGiftCards = lazy(() => import('./pages/pos/POSGiftCards'));
const POSSelfOrder = lazy(() => import('./pages/pos/POSSelfOrder'));
const POSReports = lazy(() => import('./pages/pos/POSReports'));
const POSCustomerDisplay = lazy(() => import('./pages/pos/POSCustomerDisplay'));
const ModuleHub = lazy(() => import('./pages/modules/ModuleHub'));

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  const { theme: appTheme } = useAuthStore();
  const highContrast = useUiStore((s) => s.highContrast);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appTheme);
  }, [appTheme]);

  useEffect(() => {
    if (highContrast) {
      document.documentElement.setAttribute('data-high-contrast', 'true');
    } else {
      document.documentElement.removeAttribute('data-high-contrast');
    }
  }, [highContrast]);

  return (
    <AppConfigProvider>
      <AntApp>
        <AppInitializer />
      <BrowserRouter>
        <ErrorBoundary>
        <Suspense fallback={<PageTransition><Spin size="large" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }} /></PageTransition>}>
          <Routes>
            <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
            <Route path="/signup" element={<Suspense fallback={<Spin />}><PageTransition><SignUp /></PageTransition></Suspense>} />
            <Route path="/forgot-password" element={<Suspense fallback={<Spin />}><PageTransition><ForgotPassword /></PageTransition></Suspense>} />
            <Route path="/reset-password" element={<Suspense fallback={<Spin />}><PageTransition><ResetPassword /></PageTransition></Suspense>} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<PageTransition><Dashboard /></PageTransition>} />
              <Route path="contacts" element={<PageTransition><Contacts /></PageTransition>} />
              <Route path="contacts/new" element={<PageTransition><ContactForm /></PageTransition>} />
              <Route path="contacts/:id/edit" element={<PageTransition><ContactForm /></PageTransition>} />
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
              <Route path="expenses/new" element={<PageTransition><ExpenseForm /></PageTransition>} />
              <Route path="bills" element={<PageTransition><Bills /></PageTransition>} />
              <Route path="bills/new" element={<PageTransition><BillForm /></PageTransition>} />
              <Route path="purchase-orders" element={<PageTransition><PurchaseOrders /></PageTransition>} />
              <Route path="vendor-credits" element={<PageTransition><VendorCredits /></PageTransition>} />
              <Route path="recurring-invoices" element={<PageTransition><RecurringInvoices /></PageTransition>} />
              <Route path="inventory" element={<PageTransition><Inventory /></PageTransition>} />
              <Route path="accounts" element={<PageTransition><Accounts /></PageTransition>} />
              <Route path="journals" element={<PageTransition><Journals /></PageTransition>} />
              <Route path="banking" element={<PageTransition><Banking /></PageTransition>} />
              <Route path="banking/rules" element={<PageTransition><BankRules /></PageTransition>} />
              <Route path="banking/reconciliation" element={<PageTransition><BankReconciliation /></PageTransition>} />
              <Route path="inventory/warehouses" element={<PageTransition><Warehouses /></PageTransition>} />
              <Route path="inventory/price-lists" element={<PageTransition><PriceLists /></PageTransition>} />
              <Route path="inventory/serials" element={<PageTransition><SerialNumbers /></PageTransition>} />
              <Route path="assets" element={<PageTransition><Assets /></PageTransition>} />
              <Route path="tax-returns" element={<PageTransition><TaxReturns /></PageTransition>} />
              <Route path="reports" element={<PageTransition><Reports /></PageTransition>} />
              <Route path="reports/advanced" element={<PageTransition><AdvancedReports /></PageTransition>} />
              <Route path="crm/leads" element={<PageTransition><CRMLeads /></PageTransition>} />
              <Route path="crm/pipeline" element={<PageTransition><CRMPipeline /></PageTransition>} />
              <Route path="crm/activities" element={<PageTransition><CRMActivities /></PageTransition>} />
              <Route path="crm/insights" element={<PageTransition><CRMInsights /></PageTransition>} />
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
              <Route path="manufacturing/boms" element={<PageTransition><MfgBOMs /></PageTransition>} />
              <Route path="manufacturing/orders" element={<PageTransition><MfgOrders /></PageTransition>} />
              <Route path="manufacturing/work-centers" element={<PageTransition><MfgWorkCenters /></PageTransition>} />
              <Route path="companies" element={<PageTransition><Companies /></PageTransition>} />
              <Route path="reports/consolidated" element={<PageTransition><ConsolidatedReports /></PageTransition>} />
              <Route path="reports/branches" element={<PageTransition><BranchesComparison /></PageTransition>} />
              <Route path="projects" element={<PageTransition><Projects /></PageTransition>} />
              <Route path="tax-settings" element={<PageTransition><TaxSettings /></PageTransition>} />
              <Route path="settings" element={<PageTransition><Settings /></PageTransition>} />
              <Route path="trash" element={<PageTransition><Trash /></PageTransition>} />
              <Route path="docs" element={<PageTransition><DocsHub /></PageTransition>} />
              <Route path="ui-gallery" element={<PageTransition><UIGallery /></PageTransition>} />
              <Route path="ui-kit" element={<PageTransition><UIKit /></PageTransition>} />
              <Route path="shipments" element={<PageTransition><Shipments /></PageTransition>} />
              <Route path="delivery-challans" element={<PageTransition><DeliveryChallans /></PageTransition>} />
              <Route path="sales-returns" element={<PageTransition><SalesReturns /></PageTransition>} />
              <Route path="purchase-returns" element={<PageTransition><PurchaseReturns /></PageTransition>} />
              <Route path="custom-fields" element={<PageTransition><CustomFields /></PageTransition>} />
              <Route path="approvals" element={<PageTransition><Approvals /></PageTransition>} />
              <Route path="expense-claims" element={<PageTransition><ExpenseClaims /></PageTransition>} />
              <Route path="branches" element={<PageTransition><Branches /></PageTransition>} />
              <Route path="audit-log" element={<PageTransition><AuditLog /></PageTransition>} />
              <Route path="payment-links" element={<PageTransition><PaymentLinks /></PageTransition>} />
              <Route path="l10n-iq" element={<PageTransition><IraqLocalization /></PageTransition>} />
              <Route path="rbac-roles" element={<PageTransition><RbacRoles /></PageTransition>} />
              <Route path="user-roles" element={<PageTransition><UserRoles /></PageTransition>} />
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
              {/* Extended Modules (Waves B/C/D) — generic hub */}
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
        </ErrorBoundary>
      </BrowserRouter>
      </AntApp>
    </AppConfigProvider>
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

# Endpoint Audit Report

Generated: 2026-05-25T20:22:48.402Z

- Backend routes registered: **600**
- Distinct frontend API calls: **829** (across 1143 call sites)
- ✅ Healthy: **367**
- ⚠️  Method mismatch: **5**
- ❌ Endpoint not registered: **457**

## ❌ Missing endpoints (frontend calls a path that the backend does not expose)

| Method | Path | Hits | First call site |
|--------|------|------|-----------------|
| GET | `/api/agriculture/fields` | 1 | frontend\src\pages\agriculture\FieldsAndYield.tsx:48 |
| POST | `/api/agriculture/fields` | 1 | frontend\src\pages\agriculture\FieldsAndYield.tsx:83 |
| DELETE | `/api/agriculture/fields/{x}` | 1 | frontend\src\pages\agriculture\FieldsAndYield.tsx:95 |
| GET | `/api/agriculture/fields/{x}/yield` | 1 | frontend\src\pages\agriculture\FieldsAndYield.tsx:60 |
| GET | `/api/ai/anomalies` | 2 | frontend\src\pages\ai\AIAssistDashboard.tsx:37 |
| PATCH | `/api/ai/anomalies/{x}` | 2 | frontend\src\pages\ai\AnomaliesList.tsx:49 |
| GET | `/api/ai/forecasts` | 2 | frontend\src\pages\ai\AIAssistDashboard.tsx:40 |
| GET | `/api/ai/ocr` | 2 | frontend\src\pages\ai\AIAssistDashboard.tsx:39 |
| POST | `/api/ai/ocr` | 1 | frontend\src\pages\ai\OCRReceiptsAdvanced.tsx:83 |
| POST | `/api/ai/ocr/{x}/complete` | 1 | frontend\src\pages\ai\OCRReceiptsAdvanced.tsx:89 |
| GET | `/api/ai/recommendations` | 2 | frontend\src\pages\ai\AIAssistDashboard.tsx:38 |
| PATCH | `/api/ai/recommendations/{x}` | 2 | frontend\src\pages\ai\SuggestionsInbox.tsx:48 |
| GET | `/api/analytic/accounts` | 2 | frontend\src\pages\AnalyticAccounts.tsx:22 |
| POST | `/api/analytic/accounts` | 1 | frontend\src\pages\AnalyticAccounts.tsx:40 |
| PUT | `/api/analytic/accounts/{x}` | 1 | frontend\src\pages\AnalyticAccounts.tsx:38 |
| DELETE | `/api/analytic/accounts/{x}` | 1 | frontend\src\pages\AnalyticAccounts.tsx:56 |
| GET | `/api/analytic/summary/{x}` | 1 | frontend\src\pages\AnalyticReport.tsx:34 |
| GET | `/api/approvals/approval-requests` | 1 | frontend\src\pages\approvals\MyApprovals.tsx:68 |
| GET | `/api/approvals/approval-requests/{x}` | 1 | frontend\src\pages\approvals\ApprovalDetail.tsx:60 |
| POST | `/api/approvals/approval-requests/{x}/approve` | 1 | frontend\src\pages\approvals\MyApprovals.tsx:99 |
| POST | `/api/approvals/approval-requests/{x}/delegate` | 1 | frontend\src\pages\approvals\MyApprovals.tsx:109 |
| POST | `/api/approvals/approval-requests/{x}/reject` | 1 | frontend\src\pages\approvals\MyApprovals.tsx:104 |
| GET | `/api/approvals/approval-requests/inbox` | 1 | frontend\src\pages\approvals\MyApprovals.tsx:57 |
| GET | `/api/approvals/approval-rules` | 2 | frontend\src\pages\approvals\ApprovalRules.tsx:50 |
| POST | `/api/approvals/approval-rules` | 1 | frontend\src\pages\approvals\ApprovalRules.tsx:90 |
| PUT | `/api/approvals/approval-rules/{x}` | 1 | frontend\src\pages\approvals\ApprovalRules.tsx:87 |
| DELETE | `/api/approvals/approval-rules/{x}` | 2 | frontend\src\pages\approvals\ApprovalRules.tsx:103 |
| POST | `/api/approvals/approval-rules/{x}/toggle` | 2 | frontend\src\pages\approvals\ApprovalRules.tsx:113 |
| GET | `/api/automation/actions` | 1 | frontend\src\pages\automation\WorkflowBuilder.tsx:94 |
| GET | `/api/automation/automated-actions` | 1 | frontend\src\pages\AutomationRules.tsx:26 |
| POST | `/api/automation/automated-actions` | 1 | frontend\src\pages\AutomationRules.tsx:48 |
| PATCH | `/api/automation/automated-actions/{x}` | 2 | frontend\src\pages\AutomationRules.tsx:46 |
| DELETE | `/api/automation/automated-actions/{x}` | 1 | frontend\src\pages\AutomationRules.tsx:84 |
| POST | `/api/automation/automated-actions/{x}/run` | 1 | frontend\src\pages\AutomationRules.tsx:72 |
| GET | `/api/automation/logs` | 1 | frontend\src\pages\automation\AutomationLogs.tsx:27 |
| GET | `/api/automation/triggers` | 1 | frontend\src\pages\automation\WorkflowsList.tsx:37 |
| GET | `/api/automation/workflows` | 3 | frontend\src\pages\automation\AutomationLogs.tsx:55 |
| POST | `/api/automation/workflows` | 2 | frontend\src\pages\automation\WorkflowsList.tsx:60 |
| GET | `/api/automation/workflows/{x}` | 1 | frontend\src\pages\automation\WorkflowBuilder.tsx:56 |
| PUT | `/api/automation/workflows/{x}` | 1 | frontend\src\pages\automation\WorkflowBuilder.tsx:153 |
| DELETE | `/api/automation/workflows/{x}` | 2 | frontend\src\pages\automation\WorkflowsList.tsx:101 |
| GET | `/api/automation/workflows/{x}/run-history` | 1 | frontend\src\pages\automation\WorkflowRunHistory.tsx:25 |
| POST | `/api/automation/workflows/{x}/test-run` | 1 | frontend\src\pages\automation\WorkflowBuilder.tsx:176 |
| POST | `/api/automation/workflows/{x}/toggle` | 3 | frontend\src\pages\automation\WorkflowBuilder.tsx:188 |
| POST | `/api/banking/accounts/{x}/auto-match-new` | 1 | frontend\src\pages\banking\SmartMatch.tsx:106 |
| POST | `/api/banking/accounts/{x}/import-preview` | 1 | frontend\src\pages\banking\ImportStatement.tsx:105 |
| POST | `/api/banking/accounts/{x}/import-statement` | 1 | frontend\src\pages\banking\ImportStatement.tsx:128 |
| GET | `/api/banking/transactions/{x}/match-candidates` | 1 | frontend\src\pages\banking\SmartMatch.tsx:75 |
| PUT | `/api/bills/{x}` | 1 | frontend\src\features\purchases\bills\BillForm.tsx:256 |
| GET | `/api/budgets` | 1 | frontend\src\pages\Budgets.tsx:24 |
| POST | `/api/budgets` | 1 | frontend\src\pages\Budgets.tsx:42 |
| PUT | `/api/budgets/{x}` | 1 | frontend\src\pages\Budgets.tsx:40 |
| DELETE | `/api/budgets/{x}` | 1 | frontend\src\pages\Budgets.tsx:58 |
| GET | `/api/budgets/{x}/variance` | 1 | frontend\src\pages\BudgetVariance.tsx:20 |
| GET | `/api/cashflow/forecast/{x}` | 1 | frontend\src\pages\CashflowForecast.tsx:22 |
| GET | `/api/chatter/{x}/{x}/activities` | 1 | frontend\src\components\ChatterPanel.tsx:81 |
| POST | `/api/chatter/{x}/{x}/activities` | 2 | frontend\src\components\ChatterPanel.tsx:114 |
| GET | `/api/chatter/{x}/{x}/followers` | 1 | frontend\src\components\ChatterPanel.tsx:93 |
| POST | `/api/chatter/{x}/{x}/followers` | 1 | frontend\src\components\ChatterPanel.tsx:149 |
| DELETE | `/api/chatter/{x}/{x}/followers/{x}` | 1 | frontend\src\components\ChatterPanel.tsx:167 |
| GET | `/api/chatter/{x}/{x}/messages` | 1 | frontend\src\components\chatter\ChatterWidget.tsx:36 |
| POST | `/api/chatter/{x}/{x}/messages` | 1 | frontend\src\components\chatter\ChatterWidget.tsx:44 |
| DELETE | `/api/chatter/activities/{x}` | 2 | frontend\src\components\ChatterPanel.tsx:138 |
| POST | `/api/chatter/activities/{x}/done` | 2 | frontend\src\components\ChatterPanel.tsx:128 |
| GET | `/api/chatter/activities/my-due` | 2 | frontend\src\pages\activities\ActivitiesDashboard.tsx:53 |
| POST | `/api/companies/intercompany/{x}/eliminate` | 2 | frontend\src\pages\multi-entity\EliminationsWorkbench.tsx:120 |
| GET | `/api/construction/boq` | 1 | frontend\src\pages\construction\BOQEditor.tsx:57 |
| POST | `/api/construction/boq` | 1 | frontend\src\pages\construction\BOQEditor.tsx:86 |
| DELETE | `/api/construction/boq/{x}` | 1 | frontend\src\pages\construction\BOQEditor.tsx:102 |
| PATCH | `/api/construction/boq/{x}` | 1 | frontend\src\pages\construction\BOQEditor.tsx:114 |
| GET | `/api/construction/projects` | 2 | frontend\src\pages\construction\BOQEditor.tsx:47 |
| POST | `/api/construction/projects` | 1 | frontend\src\pages\construction\ConstructionProjects.tsx:65 |
| GET | `/api/construction/projects/{x}/cost-summary` | 1 | frontend\src\pages\construction\ConstructionProjects.tsx:81 |
| POST | `/api/credit-notes/{x}/{x}` | 1 | frontend\src\pages\CreditNotes.tsx:57 |
| GET | `/api/credit-notes/{x}/applications` | 3 | frontend\src\pages\CreditNotes.tsx:98 |
| DELETE | `/api/credit-notes/{x}/applications/{x}` | 1 | frontend\src\pages\CreditNotes.tsx:131 |
| GET | `/api/credit-notes/{x}/pdf` | 1 | frontend\src\pages\CreditNotes.tsx:62 |
| GET | `/api/currency-rates` | 1 | frontend\src\pages\fx\CurrencyRates.tsx:50 |
| POST | `/api/currency-rates` | 1 | frontend\src\pages\fx\CurrencyRates.tsx:73 |
| DELETE | `/api/currency-rates/{x}` | 1 | frontend\src\pages\fx\CurrencyRates.tsx:91 |
| POST | `/api/custom-reports` | 2 | frontend\src\pages\reports\CustomReportBuilder.tsx:99 |
| GET | `/api/custom-reports` | 1 | frontend\src\pages\reports\CustomReportsList.tsx:40 |
| DELETE | `/api/custom-reports/{x}` | 2 | frontend\src\pages\reports\CustomReportBuilder.tsx:125 |
| POST | `/api/custom-reports/{x}/run` | 2 | frontend\src\pages\reports\CustomReportBuilder.tsx:103 |
| GET | `/api/custom-reports/sources/{x}/fields` | 1 | frontend\src\pages\reports\CustomReportBuilder.tsx:52 |
| GET | `/api/customer-statements/{x}` | 1 | frontend\src\pages\CustomerStatements.tsx:31 |
| POST | `/api/customer-statements/{x}/email` | 1 | frontend\src\pages\CustomerStatements.tsx:51 |
| GET | `/api/customer-statements/{x}/pdf` | 1 | frontend\src\pages\CustomerStatements.tsx:66 |
| GET | `/api/dashboards` | 2 | frontend\src\pages\dashboards\MyDashboards.tsx:30 |
| POST | `/api/dashboards` | 1 | frontend\src\pages\dashboards\MyDashboards.tsx:45 |
| GET | `/api/dashboards/{x}` | 2 | frontend\src\pages\dashboards\DashboardEditor.tsx:43 |
| PUT | `/api/dashboards/{x}` | 1 | frontend\src\pages\dashboards\DashboardEditor.tsx:70 |
| DELETE | `/api/dashboards/{x}` | 1 | frontend\src\pages\dashboards\MyDashboards.tsx:65 |
| POST | `/api/dashboards/{x}/clone` | 2 | frontend\src\pages\dashboards\MyDashboards.tsx:77 |
| GET | `/api/dashboards/{x}/data` | 1 | frontend\src\pages\dashboards\DashboardView.tsx:75 |
| POST | `/api/dashboards/{x}/set-default` | 1 | frontend\src\pages\dashboards\MyDashboards.tsx:87 |
| GET | `/api/dashboards/widget-catalog` | 1 | frontend\src\pages\dashboards\DashboardEditor.tsx:57 |
| GET | `/api/documents/files` | 3 | frontend\src\pages\dms\DocumentVault.tsx:44 |
| POST | `/api/documents/files` | 2 | frontend\src\pages\dms\DocumentVault.tsx:70 |
| GET | `/api/documents/files/{x}` | 1 | frontend\src\pages\dms\DocumentDetail.tsx:38 |
| DELETE | `/api/documents/files/{x}` | 4 | frontend\src\pages\dms\DocumentDetail.tsx:77 |
| PATCH | `/api/documents/files/{x}` | 1 | frontend\src\pages\dms\DocumentVault.tsx:148 |
| GET | `/api/documents/files/{x}/versions` | 1 | frontend\src\pages\dms\DocumentDetail.tsx:50 |
| POST | `/api/documents/files/{x}/versions` | 1 | frontend\src\pages\dms\DocumentDetail.tsx:123 |
| GET | `/api/documents/folders` | 2 | frontend\src\pages\dms\DocumentVault.tsx:57 |
| POST | `/api/documents/folders` | 1 | frontend\src\pages\dms\DocumentVault.tsx:89 |
| GET | `/api/documents/shares` | 1 | frontend\src\pages\dms\DocumentDetail.tsx:58 |
| POST | `/api/documents/shares` | 1 | frontend\src\pages\dms\DocumentDetail.tsx:93 |
| DELETE | `/api/documents/shares/{x}` | 1 | frontend\src\pages\dms\DocumentDetail.tsx:113 |
| GET | `/api/documents/sign-requests` | 1 | frontend\src\pages\dms\SignatureRequests.tsx:34 |
| POST | `/api/documents/sign-requests` | 1 | frontend\src\pages\dms\SignatureRequests.tsx:66 |
| GET | `/api/documents/sign-requests/{x}` | 1 | frontend\src\pages\dms\SignatureRequests.tsx:116 |
| POST | `/api/documents/sign-requests/{x}/cancel` | 1 | frontend\src\pages\dms\SignatureRequests.tsx:103 |
| POST | `/api/documents/signatures` | 1 | frontend\src\pages\dms\SignatureRequests.tsx:85 |
| GET | `/api/email-templates` | 1 | frontend\src\pages\EmailTemplates.tsx:49 |
| POST | `/api/email-templates` | 1 | frontend\src\pages\EmailTemplates.tsx:67 |
| PUT | `/api/email-templates/{x}` | 1 | frontend\src\pages\EmailTemplates.tsx:65 |
| DELETE | `/api/email-templates/{x}` | 1 | frontend\src\pages\EmailTemplates.tsx:83 |
| POST | `/api/email-templates/{x}/preview` | 1 | frontend\src\pages\EmailTemplates.tsx:98 |
| GET | `/api/feature-flags` | 1 | frontend\src\pages\Settings.tsx:768 |
| POST | `/api/feature-flags/{x}` | 2 | frontend\src\pages\Settings.tsx:787 |
| GET | `/api/field-service/dashboard` | 1 | frontend\src\pages\field-service\FieldServiceDashboard.tsx:50 |
| GET | `/api/field-service/orders` | 3 | frontend\src\pages\field-service\DispatchBoard.tsx:53 |
| POST | `/api/field-service/orders` | 1 | frontend\src\pages\field-service\ServiceOrders.tsx:83 |
| PATCH | `/api/field-service/orders/{x}` | 2 | frontend\src\pages\field-service\DispatchBoard.tsx:113 |
| GET | `/api/field-service/orders/{x}` | 1 | frontend\src\pages\field-service\ServiceOrderDetail.tsx:50 |
| POST | `/api/field-service/orders/{x}/cancel` | 1 | frontend\src\pages\field-service\ServiceOrderDetail.tsx:100 |
| POST | `/api/field-service/orders/{x}/complete` | 1 | frontend\src\pages\field-service\ServiceOrderDetail.tsx:87 |
| POST | `/api/field-service/orders/{x}/start` | 1 | frontend\src\pages\field-service\ServiceOrderDetail.tsx:76 |
| GET | `/api/field-service/service-orders` | 1 | frontend\src\pages\wave-a\FieldService.tsx:28 |
| POST | `/api/field-service/service-orders` | 1 | frontend\src\pages\wave-a\FieldService.tsx:54 |
| PATCH | `/api/field-service/service-orders/{x}` | 3 | frontend\src\pages\wave-a\FieldService.tsx:52 |
| DELETE | `/api/field-service/service-orders/{x}` | 1 | frontend\src\pages\wave-a\FieldService.tsx:96 |
| GET | `/api/field-service/workers` | 6 | frontend\src\pages\field-service\DispatchBoard.tsx:52 |
| POST | `/api/field-service/workers` | 1 | frontend\src\pages\field-service\Technicians.tsx:94 |
| DELETE | `/api/field-service/workers/{x}` | 1 | frontend\src\pages\field-service\Technicians.tsx:71 |
| PATCH | `/api/field-service/workers/{x}` | 1 | frontend\src\pages\field-service\Technicians.tsx:91 |
| GET | `/api/fiscal/budgets` | 1 | frontend\src\pages\Settings.tsx:2107 |
| POST | `/api/fiscal/budgets` | 1 | frontend\src\pages\Settings.tsx:2126 |
| DELETE | `/api/fiscal/budgets/{x}` | 1 | frontend\src\pages\Settings.tsx:2132 |
| POST | `/api/fiscal/years/{x}/close` | 1 | frontend\src\pages\Settings.tsx:2023 |
| GET | `/api/fixed-assets/asset-categories` | 2 | frontend\src\pages\assets\AssetCategories.tsx:35 |
| POST | `/api/fixed-assets/asset-categories` | 1 | frontend\src\pages\assets\AssetCategories.tsx:77 |
| PUT | `/api/fixed-assets/asset-categories/{x}` | 1 | frontend\src\pages\assets\AssetCategories.tsx:75 |
| DELETE | `/api/fixed-assets/asset-categories/{x}` | 1 | frontend\src\pages\assets\AssetCategories.tsx:92 |
| GET | `/api/fixed-assets/assets` | 1 | frontend\src\pages\assets\FixedAssets.tsx:70 |
| POST | `/api/fixed-assets/assets` | 1 | frontend\src\pages\assets\FixedAssets.tsx:161 |
| GET | `/api/fixed-assets/assets/{x}` | 1 | frontend\src\pages\assets\AssetDetail.tsx:72 |
| PUT | `/api/fixed-assets/assets/{x}` | 1 | frontend\src\pages\assets\FixedAssets.tsx:159 |
| DELETE | `/api/fixed-assets/assets/{x}` | 1 | frontend\src\pages\assets\FixedAssets.tsx:176 |
| POST | `/api/fixed-assets/assets/{x}/dispose` | 1 | frontend\src\pages\assets\AssetDetail.tsx:101 |
| GET | `/api/fixed-assets/assets/reports/depreciation-schedule` | 1 | frontend\src\pages\assets\AssetDetail.tsx:85 |
| GET | `/api/fixed-assets/assets/reports/summary` | 1 | frontend\src\pages\assets\AssetReports.tsx:38 |
| POST | `/api/fixed-assets/assets/run-monthly` | 1 | frontend\src\pages\assets\DepreciationRun.tsx:33 |
| GET | `/api/healthcare/appointments` | 2 | frontend\src\pages\healthcare\AppointmentsCalendar.tsx:45 |
| POST | `/api/healthcare/appointments` | 1 | frontend\src\pages\healthcare\AppointmentsCalendar.tsx:103 |
| PATCH | `/api/healthcare/appointments/{x}` | 2 | frontend\src\pages\healthcare\AppointmentsCalendar.tsx:100 |
| DELETE | `/api/healthcare/appointments/{x}` | 1 | frontend\src\pages\healthcare\AppointmentsCalendar.tsx:116 |
| GET | `/api/healthcare/patients` | 5 | frontend\src\pages\healthcare\AppointmentsCalendar.tsx:57 |
| POST | `/api/healthcare/patients` | 1 | frontend\src\pages\healthcare\PatientsList.tsx:70 |
| PATCH | `/api/healthcare/patients/{x}` | 1 | frontend\src\pages\healthcare\PatientsList.tsx:67 |
| DELETE | `/api/healthcare/patients/{x}` | 1 | frontend\src\pages\healthcare\PatientsList.tsx:83 |
| GET | `/api/healthcare/prescriptions` | 1 | frontend\src\pages\pharmacy\PharmacyDispense.tsx:63 |
| POST | `/api/helpdesk/{x}` | 1 | frontend\src\pages\helpdesk\HelpdeskSettings.tsx:97 |
| PATCH | `/api/helpdesk/{x}/{x}` | 1 | frontend\src\pages\helpdesk\HelpdeskSettings.tsx:94 |
| DELETE | `/api/helpdesk/{x}/{x}` | 1 | frontend\src\pages\helpdesk\HelpdeskSettings.tsx:114 |
| GET | `/api/helpdesk/categories` | 1 | frontend\src\pages\helpdesk\HelpdeskSettings.tsx:50 |
| GET | `/api/helpdesk/sla-policies` | 1 | frontend\src\pages\helpdesk\HelpdeskSettings.tsx:74 |
| GET | `/api/helpdesk/stats` | 1 | frontend\src\pages\helpdesk\HelpdeskDashboard.tsx:47 |
| GET | `/api/helpdesk/tags` | 1 | frontend\src\pages\helpdesk\HelpdeskSettings.tsx:62 |
| GET | `/api/helpdesk/teams` | 2 | frontend\src\pages\helpdesk\HelpdeskSettings.tsx:38 |
| GET | `/api/helpdesk/tickets` | 3 | frontend\src\pages\helpdesk\HelpdeskDashboard.tsx:48 |
| POST | `/api/helpdesk/tickets` | 2 | frontend\src\pages\helpdesk\TicketsList.tsx:62 |
| GET | `/api/helpdesk/tickets/{x}` | 1 | frontend\src\pages\helpdesk\TicketDetail.tsx:50 |
| PATCH | `/api/helpdesk/tickets/{x}` | 2 | frontend\src\pages\wave-a\Helpdesk.tsx:43 |
| DELETE | `/api/helpdesk/tickets/{x}` | 1 | frontend\src\pages\wave-a\Helpdesk.tsx:61 |
| POST | `/api/helpdesk/tickets/{x}/assign` | 1 | frontend\src\pages\helpdesk\TicketDetail.tsx:128 |
| POST | `/api/helpdesk/tickets/{x}/close` | 2 | frontend\src\pages\helpdesk\TicketDetail.tsx:80 |
| POST | `/api/helpdesk/tickets/{x}/escalate` | 1 | frontend\src\pages\helpdesk\TicketDetail.tsx:102 |
| POST | `/api/helpdesk/tickets/{x}/reopen` | 1 | frontend\src\pages\helpdesk\TicketDetail.tsx:91 |
| GET | `/api/helpdesk/tickets/{x}/replies` | 1 | frontend\src\pages\helpdesk\TicketDetail.tsx:51 |
| POST | `/api/helpdesk/tickets/{x}/replies` | 1 | frontend\src\pages\helpdesk\TicketDetail.tsx:114 |
| POST | `/api/helpdesk/tickets/{x}/resolve` | 1 | frontend\src\pages\helpdesk\TicketDetail.tsx:69 |
| GET | `/api/hospital/admissions` | 1 | frontend\src\pages\hospital\WardsAdmissions.tsx:61 |
| POST | `/api/hospital/admissions` | 1 | frontend\src\pages\hospital\WardsAdmissions.tsx:130 |
| PATCH | `/api/hospital/admissions/{x}` | 1 | frontend\src\pages\hospital\WardsAdmissions.tsx:128 |
| POST | `/api/hospital/admissions/{x}/discharge` | 1 | frontend\src\pages\hospital\WardsAdmissions.tsx:148 |
| GET | `/api/hospital/beds` | 1 | frontend\src\pages\hospital\WardsAdmissions.tsx:60 |
| GET | `/api/hospital/wards` | 1 | frontend\src\pages\hospital\WardsAdmissions.tsx:59 |
| POST | `/api/hospital/wards` | 1 | frontend\src\pages\hospital\WardsAdmissions.tsx:124 |
| PATCH | `/api/hospital/wards/{x}` | 1 | frontend\src\pages\hospital\WardsAdmissions.tsx:122 |
| DELETE | `/api/hospital/wards/{x}` | 1 | frontend\src\pages\hospital\WardsAdmissions.tsx:161 |
| GET | `/api/hotel/guests` | 1 | frontend\src\pages\hotel\RoomsBookings.tsx:74 |
| GET | `/api/hotel/reservations` | 2 | frontend\src\pages\hotel\HotelDashboard.tsx:42 |
| POST | `/api/hotel/reservations/{x}/checkin` | 1 | frontend\src\pages\hotel\RoomsBookings.tsx:138 |
| POST | `/api/hotel/reservations/{x}/checkout` | 1 | frontend\src\pages\hotel\RoomsBookings.tsx:148 |
| GET | `/api/hotel/room-types` | 1 | frontend\src\pages\hotel\RoomsBookings.tsx:72 |
| GET | `/api/hotel/rooms` | 2 | frontend\src\pages\hotel\HotelDashboard.tsx:41 |
| POST | `/api/hotel/rooms` | 1 | frontend\src\pages\hotel\RoomsBookings.tsx:112 |
| PATCH | `/api/hotel/rooms/{x}` | 1 | frontend\src\pages\hotel\RoomsBookings.tsx:109 |
| DELETE | `/api/hotel/rooms/{x}` | 1 | frontend\src\pages\hotel\RoomsBookings.tsx:124 |
| DELETE | `/api/hr-extended/{x}/{x}` | 1 | frontend\src\pages\wave-a\HRExtended.tsx:93 |
| GET | `/api/hr-extended/applications` | 1 | frontend\src\pages\wave-a\HRExtended.tsx:26 |
| POST | `/api/hr-extended/applications` | 1 | frontend\src\pages\wave-a\HRExtended.tsx:60 |
| PATCH | `/api/hr-extended/applications/{x}` | 1 | frontend\src\pages\wave-a\HRExtended.tsx:58 |
| GET | `/api/hr-extended/appraisals` | 1 | frontend\src\pages\wave-a\HRExtended.tsx:38 |
| POST | `/api/hr-extended/appraisals` | 1 | frontend\src\pages\wave-a\HRExtended.tsx:77 |
| PATCH | `/api/hr-extended/appraisals/{x}` | 1 | frontend\src\pages\wave-a\HRExtended.tsx:75 |
| POST | `/api/invoices/{x}/apply-retainer` | 1 | frontend\src\pages\Invoices.tsx:127 |
| GET | `/api/iot/alert-rules` | 1 | frontend\src\pages\iot\AlertRules.tsx:47 |
| POST | `/api/iot/alert-rules` | 1 | frontend\src\pages\iot\AlertRules.tsx:88 |
| PUT | `/api/iot/alert-rules/{x}` | 1 | frontend\src\pages\iot\AlertRules.tsx:85 |
| DELETE | `/api/iot/alert-rules/{x}` | 1 | frontend\src\pages\iot\AlertRules.tsx:100 |
| GET | `/api/iot/alerts` | 2 | frontend\src\pages\iot\AlertHistory.tsx:69 |
| POST | `/api/iot/alerts/{x}/ack` | 2 | frontend\src\pages\iot\AlertHistory.tsx:90 |
| GET | `/api/iot/devices` | 4 | frontend\src\pages\iot\AlertHistory.tsx:81 |
| POST | `/api/iot/devices` | 1 | frontend\src\pages\iot\IoTDevices.tsx:84 |
| GET | `/api/iot/devices/{x}` | 1 | frontend\src\pages\iot\DeviceDetail.tsx:65 |
| PUT | `/api/iot/devices/{x}` | 2 | frontend\src\pages\iot\DeviceDetail.tsx:123 |
| DELETE | `/api/iot/devices/{x}` | 1 | frontend\src\pages\iot\IoTDevices.tsx:99 |
| GET | `/api/iot/devices/{x}/latest` | 1 | frontend\src\pages\iot\DeviceDetail.tsx:76 |
| POST | `/api/iot/devices/{x}/regenerate-key` | 1 | frontend\src\pages\iot\IoTDevices.tsx:109 |
| GET | `/api/iot/devices/{x}/telemetry` | 1 | frontend\src\pages\iot\DeviceDetail.tsx:87 |
| POST | `/api/jobs/{x}/trigger` | 1 | frontend\src\pages\admin\JobRunsLog.tsx:93 |
| GET | `/api/jobs/runs` | 1 | frontend\src\pages\admin\JobRunsLog.tsx:72 |
| GET | `/api/jobs/runs/{x}` | 1 | frontend\src\pages\admin\JobRunsLog.tsx:106 |
| GET | `/api/jobs/status` | 1 | frontend\src\pages\admin\JobRunsLog.tsx:57 |
| POST | `/api/knowledge/articles` | 2 | frontend\src\pages\kb\ArticleEditor.tsx:62 |
| GET | `/api/knowledge/articles` | 2 | frontend\src\pages\kb\KnowledgeBase.tsx:47 |
| GET | `/api/knowledge/articles/{x}` | 2 | frontend\src\pages\kb\ArticleEditor.tsx:39 |
| PATCH | `/api/knowledge/articles/{x}` | 2 | frontend\src\pages\kb\ArticleEditor.tsx:59 |
| DELETE | `/api/knowledge/articles/{x}` | 1 | frontend\src\pages\wave-a\Knowledge.tsx:69 |
| GET | `/api/knowledge/articles/{x}/comments` | 1 | frontend\src\pages\kb\ArticleView.tsx:47 |
| POST | `/api/knowledge/articles/{x}/comments` | 1 | frontend\src\pages\kb\ArticleView.tsx:76 |
| POST | `/api/knowledge/articles/{x}/publish` | 1 | frontend\src\pages\kb\ArticleEditor.tsx:80 |
| POST | `/api/knowledge/articles/{x}/unpublish` | 1 | frontend\src\pages\kb\ArticleEditor.tsx:76 |
| GET | `/api/knowledge/articles/{x}/versions` | 1 | frontend\src\pages\kb\ArticleEditor.tsx:41 |
| POST | `/api/knowledge/articles/{x}/vote` | 1 | frontend\src\pages\kb\ArticleView.tsx:65 |
| GET | `/api/knowledge/categories` | 3 | frontend\src\pages\kb\ArticleEditor.tsx:36 |
| GET | `/api/locations/cycle-counts` | 1 | frontend\src\pages\CycleCounts.tsx:96 |
| POST | `/api/locations/cycle-counts` | 1 | frontend\src\pages\CycleCounts.tsx:126 |
| GET | `/api/locations/cycle-counts/{x}` | 1 | frontend\src\pages\CycleCounts.tsx:139 |
| POST | `/api/locations/cycle-counts/{x}/complete` | 1 | frontend\src\pages\CycleCounts.tsx:168 |
| POST | `/api/locations/cycle-counts/{x}/lines` | 1 | frontend\src\pages\CycleCounts.tsx:180 |
| POST | `/api/locations/cycle-counts/{x}/start` | 1 | frontend\src\pages\CycleCounts.tsx:155 |
| GET | `/api/locations/putaway-rules` | 1 | frontend\src\pages\PutawayRules.tsx:92 |
| POST | `/api/locations/putaway-rules` | 1 | frontend\src\pages\PutawayRules.tsx:131 |
| PUT | `/api/locations/putaway-rules/{x}` | 1 | frontend\src\pages\PutawayRules.tsx:129 |
| DELETE | `/api/locations/putaway-rules/{x}` | 1 | frontend\src\pages\PutawayRules.tsx:145 |
| GET | `/api/locations/stock-locations` | 2 | frontend\src\pages\CycleCounts.tsx:89 |
| POST | `/api/locations/stock-locations` | 1 | frontend\src\pages\StockLocations.tsx:84 |
| PUT | `/api/locations/stock-locations/{x}` | 1 | frontend\src\pages\StockLocations.tsx:82 |
| DELETE | `/api/locations/stock-locations/{x}` | 1 | frontend\src\pages\StockLocations.tsx:98 |
| GET | `/api/locations/stock-locations/tree/{x}` | 1 | frontend\src\pages\StockLocations.tsx:59 |
| GET | `/api/maintenance/categories` | 2 | frontend\src\pages\maintenance\Equipment.tsx:73 |
| POST | `/api/maintenance/categories` | 1 | frontend\src\pages\maintenance\EquipmentCategories.tsx:60 |
| PATCH | `/api/maintenance/categories/{x}` | 1 | frontend\src\pages\maintenance\EquipmentCategories.tsx:58 |
| DELETE | `/api/maintenance/categories/{x}` | 1 | frontend\src\pages\maintenance\EquipmentCategories.tsx:76 |
| GET | `/api/maintenance/categories/{x}` | 1 | frontend\src\pages\maintenance\EquipmentDetail.tsx:52 |
| GET | `/api/maintenance/dashboard` | 1 | frontend\src\pages\maintenance\MaintenanceDashboard.tsx:39 |
| GET | `/api/maintenance/equipment` | 4 | frontend\src\pages\maintenance\Equipment.tsx:55 |
| POST | `/api/maintenance/equipment` | 1 | frontend\src\pages\maintenance\Equipment.tsx:117 |
| PATCH | `/api/maintenance/equipment/{x}` | 1 | frontend\src\pages\maintenance\Equipment.tsx:115 |
| DELETE | `/api/maintenance/equipment/{x}` | 1 | frontend\src\pages\maintenance\Equipment.tsx:133 |
| GET | `/api/maintenance/equipment/{x}` | 1 | frontend\src\pages\maintenance\EquipmentDetail.tsx:49 |
| GET | `/api/maintenance/logs` | 1 | frontend\src\pages\maintenance\EquipmentDetail.tsx:87 |
| POST | `/api/maintenance/logs` | 1 | frontend\src\pages\maintenance\EquipmentDetail.tsx:107 |
| GET | `/api/maintenance/requests` | 4 | frontend\src\pages\maintenance\EquipmentDetail.tsx:65 |
| POST | `/api/maintenance/requests` | 3 | frontend\src\pages\maintenance\MaintenanceRequests.tsx:108 |
| PATCH | `/api/maintenance/requests/{x}` | 4 | frontend\src\pages\maintenance\MaintenanceRequests.tsx:106 |
| DELETE | `/api/maintenance/requests/{x}` | 2 | frontend\src\pages\maintenance\MaintenanceRequests.tsx:154 |
| POST | `/api/maintenance/requests/{x}/complete` | 1 | frontend\src\pages\maintenance\MaintenanceRequests.tsx:134 |
| POST | `/api/maintenance/requests/{x}/start` | 1 | frontend\src\pages\maintenance\MaintenanceRequests.tsx:124 |
| GET | `/api/maintenance/schedules` | 4 | frontend\src\pages\maintenance\EquipmentDetail.tsx:76 |
| POST | `/api/maintenance/schedules` | 1 | frontend\src\pages\maintenance\MaintenanceSchedules.tsx:87 |
| PATCH | `/api/maintenance/schedules/{x}` | 1 | frontend\src\pages\maintenance\MaintenanceSchedules.tsx:85 |
| DELETE | `/api/maintenance/schedules/{x}` | 1 | frontend\src\pages\maintenance\MaintenanceSchedules.tsx:103 |
| GET | `/api/marketing/audiences` | 3 | frontend\src\pages\marketing\EmailCampaigns.tsx:41 |
| POST | `/api/marketing/audiences` | 1 | frontend\src\pages\marketing\Segments.tsx:42 |
| DELETE | `/api/marketing/audiences/{x}` | 1 | frontend\src\pages\marketing\Segments.tsx:56 |
| GET | `/api/marketing/audiences/{x}/preview` | 1 | frontend\src\pages\marketing\Segments.tsx:68 |
| GET | `/api/marketing/automations` | 2 | frontend\src\pages\marketing\Automations.tsx:25 |
| POST | `/api/marketing/automations` | 1 | frontend\src\pages\marketing\Automations.tsx:46 |
| DELETE | `/api/marketing/automations/{x}` | 1 | frontend\src\pages\marketing\Automations.tsx:60 |
| POST | `/api/marketing/automations/{x}/activate` | 1 | frontend\src\pages\marketing\Automations.tsx:70 |
| GET | `/api/marketing/campaigns` | 2 | frontend\src\pages\marketing\EmailCampaigns.tsx:30 |
| POST | `/api/marketing/campaigns` | 2 | frontend\src\pages\marketing\EmailCampaigns.tsx:54 |
| DELETE | `/api/marketing/campaigns/{x}` | 1 | frontend\src\pages\marketing\EmailCampaigns.tsx:78 |
| POST | `/api/marketing/campaigns/{x}/send` | 1 | frontend\src\pages\marketing\EmailCampaigns.tsx:68 |
| GET | `/api/marketing/campaigns/{x}/stats` | 1 | frontend\src\pages\marketing\EmailCampaigns.tsx:105 |
| GET | `/api/marketing/sms-campaigns` | 1 | frontend\src\pages\marketing\SmsCampaigns.tsx:27 |
| POST | `/api/marketing/sms-campaigns` | 1 | frontend\src\pages\marketing\SmsCampaigns.tsx:55 |
| DELETE | `/api/marketing/sms-campaigns/{x}` | 1 | frontend\src\pages\marketing\SmsCampaigns.tsx:79 |
| POST | `/api/marketing/sms-campaigns/{x}/send` | 1 | frontend\src\pages\marketing\SmsCampaigns.tsx:69 |
| PUT | `/api/mileage/rates/{x}` | 1 | frontend\src\pages\mileage\MileageRates.tsx:65 |
| DELETE | `/api/mileage/rates/{x}` | 1 | frontend\src\pages\mileage\MileageRates.tsx:80 |
| GET | `/api/onboarding/checklist` | 1 | frontend\src\pages\onboarding\OnboardingChecklist.tsx:68 |
| POST | `/api/onboarding/load-sample-data` | 1 | frontend\src\pages\onboarding\OnboardingWizard.tsx:236 |
| PUT | `/api/onboarding/preferences` | 2 | frontend\src\onboarding\store.ts:121 |
| DELETE | `/api/onboarding/preferences` | 1 | frontend\src\onboarding\store.ts:140 |
| GET | `/api/onboarding/preferences` | 1 | frontend\src\pages\onboarding\OnboardingWizard.tsx:144 |
| PUT | `/api/organizations/current` | 1 | frontend\src\pages\onboarding\OnboardingWizard.tsx:205 |
| GET | `/api/pharmacy/dispenses` | 1 | frontend\src\pages\pharmacy\PharmacyDispense.tsx:64 |
| POST | `/api/pharmacy/dispenses` | 1 | frontend\src\pages\pharmacy\PharmacyDispense.tsx:115 |
| GET | `/api/pharmacy/drugs` | 1 | frontend\src\pages\pharmacy\PharmacyDispense.tsx:65 |
| GET | `/api/plm/ecos` | 2 | frontend\src\pages\plm\PLMEngineeringChanges.tsx:48 |
| POST | `/api/plm/ecos` | 2 | frontend\src\pages\plm\PLMEngineeringChanges.tsx:77 |
| PATCH | `/api/plm/ecos/{x}` | 2 | frontend\src\pages\plm\PLMEngineeringChanges.tsx:74 |
| DELETE | `/api/plm/ecos/{x}` | 2 | frontend\src\pages\plm\PLMEngineeringChanges.tsx:97 |
| GET | `/api/portal/me/invoices` | 2 | frontend\src\pages\portal\PortalDashboard.tsx:48 |
| GET | `/api/portal/me/orders` | 2 | frontend\src\pages\portal\PortalDashboard.tsx:51 |
| GET | `/api/portal/me/statements` | 2 | frontend\src\pages\portal\PortalDashboard.tsx:45 |
| POST | `/api/portal/request-link` | 1 | frontend\src\pages\portal\PortalLogin.tsx:24 |
| POST | `/api/portal/verify-link` | 1 | frontend\src\pages\portal\PortalLogin.tsx:42 |
| POST | `/api/projects/{x}/dependencies` | 1 | frontend\src\pages\ProjectGantt.tsx:106 |
| GET | `/api/projects/{x}/gantt` | 1 | frontend\src\pages\ProjectGantt.tsx:65 |
| POST | `/api/projects/{x}/milestones` | 1 | frontend\src\pages\ProjectGantt.tsx:123 |
| PUT | `/api/projects/milestones/{x}/complete` | 1 | frontend\src\pages\ProjectGantt.tsx:135 |
| POST | `/api/purchase-orders/{x}/{x}` | 1 | frontend\src\pages\PurchaseOrders.tsx:59 |
| GET | `/api/quality/capa` | 1 | frontend\src\pages\quality\CAPAList.tsx:38 |
| POST | `/api/quality/capa` | 1 | frontend\src\pages\quality\CAPAList.tsx:61 |
| PATCH | `/api/quality/capa/{x}` | 1 | frontend\src\pages\quality\CAPAList.tsx:58 |
| DELETE | `/api/quality/capa/{x}` | 1 | frontend\src\pages\quality\CAPAList.tsx:85 |
| POST | `/api/quality/capa/{x}/close` | 1 | frontend\src\pages\quality\CAPAList.tsx:95 |
| GET | `/api/quality/checks` | 3 | frontend\src\pages\quality\QCChecks.tsx:39 |
| POST | `/api/quality/checks` | 2 | frontend\src\pages\quality\QCChecks.tsx:54 |
| PATCH | `/api/quality/checks/{x}` | 3 | frontend\src\pages\wave-a\Quality.tsx:47 |
| DELETE | `/api/quality/checks/{x}` | 1 | frontend\src\pages\wave-a\Quality.tsx:85 |
| POST | `/api/quality/checks/{x}/fail` | 1 | frontend\src\pages\quality\QCChecks.tsx:76 |
| POST | `/api/quality/checks/{x}/pass` | 1 | frontend\src\pages\quality\QCChecks.tsx:66 |
| GET | `/api/quality/dashboard` | 1 | frontend\src\pages\quality\QualityDashboard.tsx:45 |
| GET | `/api/quality/non-conformities` | 1 | frontend\src\pages\quality\NonConformances.tsx:36 |
| POST | `/api/quality/non-conformities` | 1 | frontend\src\pages\quality\NonConformances.tsx:55 |
| PATCH | `/api/quality/non-conformities/{x}` | 1 | frontend\src\pages\quality\NonConformances.tsx:52 |
| DELETE | `/api/quality/non-conformities/{x}` | 1 | frontend\src\pages\quality\NonConformances.tsx:75 |
| GET | `/api/quality/points` | 2 | frontend\src\pages\quality\QCPlans.tsx:35 |
| POST | `/api/quality/points` | 1 | frontend\src\pages\quality\QCPlans.tsx:54 |
| PATCH | `/api/quality/points/{x}` | 1 | frontend\src\pages\quality\QCPlans.tsx:51 |
| DELETE | `/api/quality/points/{x}` | 1 | frontend\src\pages\quality\QCPlans.tsx:74 |
| POST | `/api/quotes/{x}/{x}` | 1 | frontend\src\pages\Quotes.tsx:47 |
| DELETE | `/api/real-estate/${type === ` | 1 | frontend\src\pages\real-estate\PropertiesAndLeases.tsx:130 |
| GET | `/api/real-estate/leases` | 1 | frontend\src\pages\real-estate\PropertiesAndLeases.tsx:85 |
| POST | `/api/real-estate/leases` | 1 | frontend\src\pages\real-estate\PropertiesAndLeases.tsx:118 |
| GET | `/api/real-estate/properties` | 1 | frontend\src\pages\real-estate\PropertiesAndLeases.tsx:72 |
| POST | `/api/real-estate/properties` | 1 | frontend\src\pages\real-estate\PropertiesAndLeases.tsx:106 |
| POST | `/api/real-estate/rent-invoices` | 1 | frontend\src\pages\real-estate\PropertiesAndLeases.tsx:144 |
| GET | `/api/real-estate/tenants` | 1 | frontend\src\pages\real-estate\PropertiesAndLeases.tsx:87 |
| GET | `/api/real-estate/units` | 1 | frontend\src\pages\real-estate\PropertiesAndLeases.tsx:86 |
| POST | `/api/recurring-invoices/{x}/{x}` | 1 | frontend\src\pages\RecurringInvoices.tsx:62 |
| GET | `/api/rental/contracts` | 1 | frontend\src\pages\rental\RentalContracts.tsx:41 |
| POST | `/api/rental/contracts` | 1 | frontend\src\pages\rental\RentalContracts.tsx:71 |
| GET | `/api/rental/contracts/{x}` | 1 | frontend\src\pages\rental\RentalContractDetail.tsx:25 |
| POST | `/api/rental/contracts/{x}/close` | 1 | frontend\src\pages\rental\RentalContractDetail.tsx:62 |
| POST | `/api/rental/contracts/{x}/start` | 1 | frontend\src\pages\rental\RentalContractDetail.tsx:47 |
| GET | `/api/rental/products` | 2 | frontend\src\pages\rental\RentalContracts.tsx:52 |
| POST | `/api/rental/products` | 1 | frontend\src\pages\rental\RentalProducts.tsx:73 |
| GET | `/api/rental/products/{x}` | 1 | frontend\src\pages\rental\RentalContractDetail.tsx:28 |
| PATCH | `/api/rental/products/{x}` | 1 | frontend\src\pages\rental\RentalProducts.tsx:71 |
| DELETE | `/api/rental/products/{x}` | 2 | frontend\src\pages\rental\RentalProducts.tsx:89 |
| GET | `/api/repairs/orders` | 2 | frontend\src\pages\repairs\RepairOrders.tsx:40 |
| POST | `/api/repairs/orders` | 2 | frontend\src\pages\repairs\RepairOrders.tsx:55 |
| GET | `/api/repairs/orders/{x}` | 1 | frontend\src\pages\repairs\RepairOrderDetail.tsx:30 |
| PATCH | `/api/repairs/orders/{x}` | 2 | frontend\src\pages\wave-a\Repairs.tsx:40 |
| DELETE | `/api/repairs/orders/{x}` | 1 | frontend\src\pages\wave-a\Repairs.tsx:68 |
| POST | `/api/repairs/orders/{x}/complete` | 1 | frontend\src\pages\repairs\RepairOrderDetail.tsx:94 |
| POST | `/api/repairs/orders/{x}/deliver` | 1 | frontend\src\pages\repairs\RepairOrderDetail.tsx:109 |
| POST | `/api/repairs/orders/{x}/diagnose` | 1 | frontend\src\pages\repairs\RepairOrderDetail.tsx:55 |
| POST | `/api/repairs/orders/{x}/repair` | 1 | frontend\src\pages\repairs\RepairOrderDetail.tsx:70 |
| GET | `/api/repairs/warranties/check/{x}` | 1 | frontend\src\pages\repairs\WarrantyCheck.tsx:26 |
| GET | `/api/reports/{x}/{x}` | 1 | frontend\src\pages\Reports.tsx:81 |
| GET | `/api/restaurant/kds` | 1 | frontend\src\pages\restaurant\KitchenDisplay.tsx:36 |
| POST | `/api/restaurant/kds/{x}/ready` | 1 | frontend\src\pages\restaurant\KitchenDisplay.tsx:57 |
| POST | `/api/restaurant/kds/{x}/start` | 1 | frontend\src\pages\restaurant\KitchenDisplay.tsx:47 |
| GET | `/api/restaurant/menu-items` | 1 | frontend\src\pages\restaurant\MenuManager.tsx:48 |
| POST | `/api/restaurant/menu-items` | 1 | frontend\src\pages\restaurant\MenuManager.tsx:79 |
| PATCH | `/api/restaurant/menu-items/{x}` | 1 | frontend\src\pages\restaurant\MenuManager.tsx:76 |
| DELETE | `/api/restaurant/menu-items/{x}` | 1 | frontend\src\pages\restaurant\MenuManager.tsx:91 |
| GET | `/api/restaurant/menus` | 1 | frontend\src\pages\restaurant\MenuManager.tsx:49 |
| POST | `/api/restaurant/orders` | 1 | frontend\src\pages\restaurant\TablesView.tsx:72 |
| GET | `/api/restaurant/orders/{x}` | 1 | frontend\src\pages\restaurant\TablesView.tsx:59 |
| GET | `/api/restaurant/tables` | 1 | frontend\src\pages\restaurant\TablesView.tsx:45 |
| GET | `/api/revaluations` | 1 | frontend\src\pages\fx\RevaluationRuns.tsx:96 |
| GET | `/api/revaluations/{x}` | 1 | frontend\src\pages\fx\RevaluationRuns.tsx:171 |
| POST | `/api/revaluations/{x}/reverse` | 1 | frontend\src\pages\fx\RevaluationRuns.tsx:159 |
| GET | `/api/revaluations/exposure/current` | 1 | frontend\src\pages\fx\FXExposure.tsx:45 |
| POST | `/api/revaluations/preview` | 1 | frontend\src\pages\fx\RevaluationRuns.tsx:121 |
| POST | `/api/revaluations/run` | 1 | frontend\src\pages\fx\RevaluationRuns.tsx:135 |
| POST | `/api/sales-orders/{x}/{x}` | 1 | frontend\src\pages\SalesOrders.tsx:61 |
| GET | `/api/saved-filters` | 1 | frontend\src\components\SavedFiltersBar.tsx:44 |
| POST | `/api/saved-filters` | 1 | frontend\src\components\SavedFiltersBar.tsx:82 |
| PUT | `/api/saved-filters/{x}` | 1 | frontend\src\components\SavedFiltersBar.tsx:86 |
| DELETE | `/api/saved-filters/{x}` | 1 | frontend\src\components\SavedFiltersBar.tsx:118 |
| POST | `/api/saved-filters/{x}/set-default` | 1 | frontend\src\components\SavedFiltersBar.tsx:107 |
| GET | `/api/scheduled-reports` | 1 | frontend\src\pages\reports\ScheduledReports.tsx:47 |
| POST | `/api/scheduled-reports` | 1 | frontend\src\pages\reports\ScheduledReports.tsx:85 |
| PUT | `/api/scheduled-reports/{x}` | 1 | frontend\src\pages\reports\ScheduledReports.tsx:82 |
| DELETE | `/api/scheduled-reports/{x}` | 1 | frontend\src\pages\reports\ScheduledReports.tsx:102 |
| POST | `/api/scheduled-reports/{x}/run-now` | 1 | frontend\src\pages\reports\ScheduledReports.tsx:124 |
| POST | `/api/scheduled-reports/{x}/toggle` | 1 | frontend\src\pages\reports\ScheduledReports.tsx:113 |
| POST | `/api/storefront/cart` | 3 | frontend\src\pages\storefront\StoreCart.tsx:42 |
| PUT | `/api/storefront/cart/{x}` | 2 | frontend\src\pages\storefront\StoreCart.tsx:77 |
| POST | `/api/storefront/cart/{x}/checkout` | 1 | frontend\src\pages\storefront\StoreCheckout.tsx:54 |
| GET | `/api/storefront/categories` | 1 | frontend\src\pages\storefront\StoreHome.tsx:46 |
| GET | `/api/storefront/orders/{x}/status` | 1 | frontend\src\pages\storefront\StoreOrderConfirm.tsx:30 |
| GET | `/api/storefront/products` | 1 | frontend\src\pages\storefront\StoreHome.tsx:45 |
| GET | `/api/storefront/products/{x}` | 3 | frontend\src\pages\storefront\StoreCart.tsx:50 |
| GET | `/api/studio/fields` | 1 | frontend\src\pages\wave-a\Studio.tsx:32 |
| GET | `/api/studio/models` | 1 | frontend\src\pages\wave-a\Studio.tsx:20 |
| GET | `/api/studio/view-layouts/{x}` | 1 | frontend\src\pages\studio\ViewLayoutEditor.tsx:44 |
| PUT | `/api/studio/view-layouts/{x}` | 1 | frontend\src\pages\studio\ViewLayoutEditor.tsx:115 |
| GET | `/api/subscriptions` | 1 | frontend\src\pages\subscriptions\SubscriptionsList.tsx:52 |
| POST | `/api/subscriptions` | 1 | frontend\src\pages\subscriptions\SubscriptionsList.tsx:87 |
| GET | `/api/subscriptions/{x}` | 1 | frontend\src\pages\subscriptions\SubscriptionDetail.tsx:44 |
| POST | `/api/subscriptions/{x}/cancel` | 2 | frontend\src\pages\subscriptions\SubscriptionDetail.tsx:103 |
| GET | `/api/subscriptions/{x}/dunning` | 1 | frontend\src\pages\subscriptions\SubscriptionDetail.tsx:56 |
| POST | `/api/subscriptions/{x}/dunning/run` | 1 | frontend\src\pages\subscriptions\SubscriptionDunning.tsx:45 |
| POST | `/api/subscriptions/{x}/generate-invoice` | 2 | frontend\src\pages\subscriptions\SubscriptionDetail.tsx:116 |
| POST | `/api/subscriptions/{x}/pause` | 2 | frontend\src\pages\subscriptions\SubscriptionDetail.tsx:77 |
| POST | `/api/subscriptions/{x}/resume` | 2 | frontend\src\pages\subscriptions\SubscriptionDetail.tsx:88 |
| POST | `/api/subscriptions/{x}/upgrade` | 1 | frontend\src\pages\subscriptions\SubscriptionDetail.tsx:127 |
| GET | `/api/subscriptions/dunning/queue` | 1 | frontend\src\pages\subscriptions\SubscriptionDunning.tsx:30 |
| GET | `/api/subscriptions/plans` | 3 | frontend\src\pages\subscriptions\SubscriptionDetail.tsx:63 |
| POST | `/api/subscriptions/plans` | 1 | frontend\src\pages\subscriptions\SubscriptionPlans.tsx:67 |
| PUT | `/api/subscriptions/plans/{x}` | 1 | frontend\src\pages\subscriptions\SubscriptionPlans.tsx:65 |
| DELETE | `/api/subscriptions/plans/{x}` | 1 | frontend\src\pages\subscriptions\SubscriptionPlans.tsx:84 |
| GET | `/api/subscriptions/reports/arr` | 1 | frontend\src\pages\subscriptions\SubscriptionReports.tsx:41 |
| GET | `/api/subscriptions/reports/churn` | 1 | frontend\src\pages\subscriptions\SubscriptionReports.tsx:42 |
| GET | `/api/subscriptions/reports/mrr` | 1 | frontend\src\pages\subscriptions\SubscriptionReports.tsx:40 |
| GET | `/api/system/backup/{x}/download` | 2 | frontend\src\pages\settings\SystemHealthPage.tsx:364 |
| POST | `/api/system/backup/run` | 2 | frontend\src\pages\settings\SystemHealthPage.tsx:350 |
| GET | `/api/system/branches` | 1 | frontend\src\layouts\BranchSwitcher.tsx:39 |
| POST | `/api/system/notification-preferences/test` | 1 | frontend\src\pages\Settings.tsx:1485 |
| GET | `/api/system/organizations` | 1 | frontend\src\layouts\OrgSwitcher.tsx:38 |
| GET | `/api/system/public-config` | 2 | frontend\src\store\settingsStore.ts:196 |
| GET | `/api/system/settings/appearance` | 1 | frontend\src\pages\Settings.tsx:636 |
| PUT | `/api/system/settings/appearance` | 1 | frontend\src\pages\Settings.tsx:654 |
| GET | `/api/system/settings/general` | 1 | frontend\src\pages\Settings.tsx:505 |
| PUT | `/api/system/settings/general` | 1 | frontend\src\pages\Settings.tsx:515 |
| POST | `/api/system/switch-organization/{x}` | 1 | frontend\src\layouts\OrgSwitcher.tsx:51 |
| POST | `/api/tax-settings` | 1 | frontend\src\pages\onboarding\OnboardingWizard.tsx:219 |
| GET | `/api/taxes` | 2 | frontend\src\pages\BillForm.tsx:44 |
| GET | `/api/users` | 6 | frontend\src\components\ChatterPanel.tsx:72 |
| POST | `/api/users` | 1 | frontend\src\pages\Users.tsx:192 |
| DELETE | `/api/users/{x}` | 2 | frontend\src\pages\Settings.tsx:3572 |
| PUT | `/api/users/{x}` | 1 | frontend\src\pages\Users.tsx:208 |
| POST | `/api/users/{x}/activate` | 2 | frontend\src\pages\Settings.tsx:3571 |
| POST | `/api/users/{x}/reset-password` | 1 | frontend\src\pages\Users.tsx:269 |
| POST | `/api/users/{x}/suspend` | 2 | frontend\src\pages\Settings.tsx:3570 |
| POST | `/api/users/accept-invite` | 1 | frontend\src\pages\AcceptInvite.tsx:53 |
| POST | `/api/users/invite` | 2 | frontend\src\pages\Settings.tsx:3567 |
| POST | `/api/users/invite/{x}/resend` | 1 | frontend\src\pages\Users.tsx:246 |
| POST | `/api/v1/auth/firebase-login` | 1 | frontend\src\pages\auth\LoginPage.tsx:85 |
| POST | `/api/v1/auth/firebase-register` | 1 | frontend\src\pages\auth\RegisterPage.tsx:206 |
| POST | `/api/v1/auth/login` | 1 | frontend\src\pages\auth\LoginPage.tsx:40 |
| POST | `/api/v1/auth/mfa/verify` | 1 | frontend\src\pages\auth\MFAPage.tsx:155 |
| POST | `/api/v1/auth/register` | 1 | frontend\src\pages\auth\RegisterPage.tsx:175 |
| POST | `/api/vendor-credits/{x}/{x}` | 1 | frontend\src\pages\VendorCredits.tsx:58 |

## ⚠️  Method mismatch (path exists, but wrong HTTP verb)

| Called | Path | Allowed | Hits | First call site |
|--------|------|---------|------|-----------------|
| POST | `/api/accounts/setup-preset` | GET | 1 | frontend\src\pages\onboarding\OnboardingWizard.tsx:212 |
| POST | `/api/fiscal/years` | GET | 1 | frontend\src\pages\Settings.tsx:2013 |
| POST | `/api/mileage/rates` | GET,PUT,DELETE | 1 | frontend\src\pages\mileage\MileageRates.tsx:68 |
| PUT | `/api/purchase-orders/{x}` | GET | 1 | frontend\src\features\purchases\purchase-orders\PurchaseOrderForm.tsx:284 |
| DELETE | `/api/recurring-invoices/{x}` | GET | 1 | frontend\src\pages\RecurringInvoices.tsx:66 |

## ✅ Healthy endpoints (sample, first 60)

| Method | Path | Hits |
|--------|------|------|
| GET | `/api/contacts` | 24 |
| GET | `/api/items` | 21 |
| GET | `/api/accounts` | 16 |
| GET | `/api/companies` | 6 |
| GET | `/api/invoices` | 5 |
| GET | `/api/inventory/warehouses` | 5 |
| GET | `/api/pos/configs` | 5 |
| GET | `/api/rbac/roles` | 5 |
| GET | `/api/branches` | 4 |
| GET | `/api/banking/accounts` | 4 |
| GET | `/api/custom-fields` | 4 |
| PUT | `/api/expense-claims/{x}` | 4 |
| GET | `/api/hr/employees` | 4 |
| GET | `/api/dashboard` | 3 |
| POST | `/api/bills` | 3 |
| GET | `/api/bills` | 3 |
| PUT | `/api/branches/{x}` | 3 |
| GET | `/api/credit-notes/{x}/available-invoices` | 3 |
| PUT | `/api/custom-fields/{x}` | 3 |
| PUT | `/api/items/{x}` | 3 |
| PUT | `/api/mileage/{x}` | 3 |
| GET | `/api/pos/categories` | 3 |
| PUT | `/api/pos/employees/{x}` | 3 |
| PUT | `/api/rbac/roles/{x}` | 3 |
| GET | `/api/pos/loyalty/cards` | 2 |
| GET | `/api/inventory/serials` | 2 |
| POST | `/api/auth/login` | 2 |
| POST | `/api/auth/firebase-login` | 2 |
| POST | `/api/purchase-orders` | 2 |
| GET | `/api/purchase-orders` | 2 |
| POST | `/api/invoices` | 2 |
| GET | `/api/audit` | 2 |
| POST | `/api/branches` | 2 |
| DELETE | `/api/branches/{x}` | 2 |
| PUT | `/api/companies/{x}` | 2 |
| POST | `/api/companies` | 2 |
| POST | `/api/companies/{x}/switch` | 2 |
| DELETE | `/api/companies/{x}` | 2 |
| GET | `/api/companies/consolidated/pl` | 2 |
| GET | `/api/companies/consolidated/bs` | 2 |
| PUT | `/api/contacts/{x}` | 2 |
| POST | `/api/contacts` | 2 |
| DELETE | `/api/contacts/{x}` | 2 |
| GET | `/api/crm/stages` | 2 |
| POST | `/api/custom-fields` | 2 |
| DELETE | `/api/custom-fields/{x}` | 2 |
| GET | `/api/einvoice/report/monthly` | 2 |
| GET | `/api/einvoice/report/errors` | 2 |
| POST | `/api/einvoice/submit/{x}` | 2 |
| GET | `/api/einvoice/qr/{x}` | 2 |
| GET | `/api/projects` | 2 |
| POST | `/api/expenses` | 2 |
| POST | `/api/invoices/{x}/send` | 2 |
| POST | `/api/items` | 2 |
| DELETE | `/api/items/{x}` | 2 |
| GET | `/api/manufacturing/boms` | 2 |
| GET | `/api/manufacturing/work-centers` | 2 |
| DELETE | `/api/mileage/{x}` | 2 |
| GET | `/api/companies/intercompany` | 2 |
| GET | `/api/pos/pricelists` | 2 |

# Dialog Audit — Phase 3

Generated: 2026-04-22T20:21:52.713Z

Total dialogs scanned: **84**
Backend schemas available: **111**

Legend:
- ✅ field present in dialog
- ❌ field missing in dialog (backend expects it)
- ⚠️ no schema mapped — manual review
## Summary

- Dialogs matched to a schema: **26**
- Dialogs without a schema (manual review): **58**
- Total **required** fields missing: **37**

### Top gaps (required fields missing)

- **Assets** / Modal `FixedAssetCreate` → missing: `name`, `asset_account_id`, `depreciation_account_id`, `accumulated_depreciation_account_id`, `purchase_date`, `purchase_price`, `useful_life_months`
- **BankRules** / Modal `BankRuleCreate` → missing: `rule_type`, `condition_value`
- **Bills** / Modal `BillCreate` → missing: `lines`
- **CreditNotes** / Modal `CreditNoteCreate` → missing: `lines`
- **CreditNotes** / Modal `CreditNoteCreate` → missing: `contact_id`, `date`, `lines`
- **Inventory** / Modal `InventoryAdjustmentCreate` → missing: `date`, `lines`
- **Inventory** / Modal `InventoryAdjustmentCreate` → missing: `date`, `lines`
- **Invoices** / Modal `InvoiceCreate` → missing: `date`, `lines`
- **Invoices** / Modal `InvoiceCreate` → missing: `contact_id`, `date`, `lines`
- **Invoices** / Modal `InvoiceCreate` → missing: `contact_id`, `date`, `lines`
- **Invoices** / Modal `InvoiceCreate` → missing: `contact_id`, `date`, `lines`
- **PurchaseOrders** / Modal `PurchaseOrderCreate` → missing: `lines`
- **SalesOrders** / Modal `SalesOrderCreate` → missing: `lines`
- **TaxReturns** / Modal `TaxReturnCreate` → missing: `name`, `period_start`, `period_end`
- **TaxSettings** / Modal `TaxRateCreate` → missing: `rate`
- **VendorCredits** / Modal `VendorCreditCreate` → missing: `lines`
- **Warehouses** / Modal `WarehouseCreate` → missing: `name`


## Approvals
File: `src/pages/Approvals.tsx`  
Schema: ⚠️ none mapped

### Modal — t:create_workflow
Dialog fields (4): `condition`, `description`, `entity_type`, `name`

⚠️ Skipped — no schema mapped.

### Modal — t:reject_reason
Dialog fields (1): `reason`

⚠️ Skipped — no schema mapped.

---

## Assets
File: `src/pages/Assets.tsx`  
Schema: `FixedAssetCreate`

### Modal — (no title)
Dialog fields (11): `accumulated_depreciation_account_id`, `asset_account_id`, `asset_number`, `depreciation_account_id`, `depreciation_method`, `description`, `name`, `purchase_date`, `purchase_price`, `salvage_value`, `useful_life_months`

Required (7):
- ✅ `name`
- ✅ `asset_account_id`
- ✅ `depreciation_account_id`
- ✅ `accumulated_depreciation_account_id`
- ✅ `purchase_date`
- ✅ `purchase_price`
- ✅ `useful_life_months`

Missing optional (1): `paid_through_account_id`

Frontend-only fields (1): `asset_number`

### Modal — (no title)
Dialog fields (2): `disposal_amount`, `disposal_date`

Required (7):
- ❌ `name`
- ❌ `asset_account_id`
- ❌ `depreciation_account_id`
- ❌ `accumulated_depreciation_account_id`
- ❌ `purchase_date`
- ❌ `purchase_price`
- ❌ `useful_life_months`

Missing optional (4): `description`, `salvage_value`, `depreciation_method`, `paid_through_account_id`

Frontend-only fields (2): `disposal_amount`, `disposal_date`

---

## BankRules
File: `src/pages/BankRules.tsx`  
Schema: `BankRuleCreate`

### Modal — (no title)
Dialog fields (7): `contact_id`, `field`, `name`, `operator`, `target_account_id`, `transaction_type`, `value`

Required (3):
- ✅ `name`
- ❌ `rule_type`
- ❌ `condition_value`

Missing optional (4): `apply_to`, `condition_type`, `target_contact_id`, `target_tax_id`

Frontend-only fields (5): `contact_id`, `field`, `operator`, `transaction_type`, `value`

---

## Bills
File: `src/pages/Bills.tsx`  
Schema: `BillCreate`

### Modal — t:new_bill
Dialog fields (5): `account_id`, `contact_id`, `date`, `due_date`, `notes`

Required (3):
- ✅ `contact_id`
- ✅ `date`
- ❌ `lines`

Missing optional (4): `vendor_bill_number`, `reference`, `currency_code`, `exchange_rate`

Frontend-only fields (1): `account_id`

---

## Branches
File: `src/pages/Branches.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (5): `address`, `code`, `is_head_office`, `name`, `phone`

⚠️ Skipped — no schema mapped.

---

## CRMActivities
File: `src/pages/CRMActivities.tsx`  
Schema: ⚠️ none mapped

### Modal — t:new_activity
Dialog fields (5): `due_date`, `lead_id`, `opportunity_id`, `summary`, `type`

⚠️ Skipped — no schema mapped.

---

## CRMLeads
File: `src/pages/CRMLeads.tsx`  
Schema: ⚠️ none mapped

### Modal — t:new_lead
Dialog fields (8): `company`, `email`, `expected_revenue`, `name`, `phone`, `probability`, `source`, `stage_id`

⚠️ Skipped — no schema mapped.

### Modal — t:convert_to_opportunity
Dialog fields (4): `amount`, `close_date`, `probability`, `stage_id`

⚠️ Skipped — no schema mapped.

---

## CRMPipeline
File: `src/pages/CRMPipeline.tsx`  
Schema: ⚠️ none mapped

### Modal — t:new_opportunity
Dialog fields (6): `amount`, `close_date`, `name`, `notes`, `probability`, `stage_id`

⚠️ Skipped — no schema mapped.

---

## Companies
File: `src/pages/Companies.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (8): `address`, `code`, `currency`, `email`, `is_active`, `name`, `phone`, `tax_id`

⚠️ Skipped — no schema mapped.

---

## Contacts
File: `src/pages/Contacts.tsx`  
Schema: `ContactCreate`

### Modal — (no title)
Dialog fields (5): `company_name`, `contact_type`, `display_name`, `email`, `phone`

Required (1):
- ✅ `display_name`

Missing optional (7): `first_name`, `last_name`, `mobile`, `currency_code`, `payment_terms`, `tax_number`, `notes`

---

## CreditNotes
File: `src/pages/CreditNotes.tsx`  
Schema: `CreditNoteCreate`

### Modal — (no title)
Dialog fields (4): `contact_id`, `date`, `notes`, `reference`

Required (3):
- ✅ `contact_id`
- ✅ `date`
- ❌ `lines`

Missing optional (2): `invoice_id`, `currency_code`

Frontend-only fields (1): `reference`

### Modal — (no title)
Dialog fields (2): `amount`, `invoice_id`

Required (3):
- ❌ `contact_id`
- ❌ `date`
- ❌ `lines`

Missing optional (2): `currency_code`, `notes`

Frontend-only fields (1): `amount`

---

## CustomFields
File: `src/pages/CustomFields.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (5): `entity_type`, `field_name`, `field_type`, `is_required`, `options`

⚠️ Skipped — no schema mapped.

---

## DeliveryChallans
File: `src/pages/DeliveryChallans.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (4): `contact_id`, `date`, `notes`, `reference`

⚠️ Skipped — no schema mapped.

---

## EInvoiceDashboard
File: `src/pages/EInvoiceDashboard.tsx`  
Schema: ⚠️ none mapped

### Modal — t:qr_code
Dialog fields (0): _none_

⚠️ Skipped — no schema mapped.

---

## ExpenseClaims
File: `src/pages/ExpenseClaims.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (3): `date`, `description`, `employee`

⚠️ Skipped — no schema mapped.

### Modal — t:reject_reason
Dialog fields (1): `reason`

⚠️ Skipped — no schema mapped.

---

## Expenses
File: `src/pages/Expenses.tsx`  
Schema: `ExpenseCreate`

### Modal — t:new_expense
Dialog fields (6): `account_id`, `amount`, `currency_code`, `date`, `description`, `exchange_rate`

Required (3):
- ✅ `date`
- ✅ `account_id`
- ✅ `amount`

Missing optional (6): `tax_id`, `paid_through_account_id`, `contact_id`, `reference`, `is_billable`, `project_id`

---

## HRContracts
File: `src/pages/HRContracts.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (7): `currency`, `employee_id`, `end_date`, `payment_frequency`, `start_date`, `type`, `wage`

⚠️ Skipped — no schema mapped.

---

## HREmployees
File: `src/pages/HREmployees.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (7): `department_id`, `email`, `hire_date`, `job_title`, `name`, `phone`, `status`

⚠️ Skipped — no schema mapped.

---

## HRTimeOff
File: `src/pages/HRTimeOff.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (4): `employee_id`, `leave_type_id`, `range`, `reason`

⚠️ Skipped — no schema mapped.

### Modal — (no title)
Dialog fields (3): `days_per_year`, `name`, `paid`

⚠️ Skipped — no schema mapped.

---

## Inventory
File: `src/pages/Inventory.tsx`  
Schema: `InventoryAdjustmentCreate`

### Modal — (no title)
Dialog fields (4): `adjustment_account_id`, `item_id`, `quantity_adjusted`, `reason`

Required (2):
- ❌ `date`
- ❌ `lines`

Missing optional (2): `adjustment_type`, `account_id`

Frontend-only fields (3): `adjustment_account_id`, `item_id`, `quantity_adjusted`

### Modal — (no title)
Dialog fields (2): `description`, `name`

Required (2):
- ❌ `date`
- ❌ `lines`

Missing optional (3): `reason`, `adjustment_type`, `account_id`

Frontend-only fields (2): `description`, `name`

---

## Invoices
File: `src/pages/Invoices.tsx`  
Schema: `InvoiceCreate`

### Modal — (no title)
Dialog fields (2): `amount`, `contact_id`

Required (3):
- ✅ `contact_id`
- ❌ `date`
- ❌ `lines`

Missing optional (10): `due_date`, `reference`, `currency_code`, `exchange_rate`, `discount_type`, `discount_amount`, `shipping_charge`, `adjustment`, `notes`, `terms`

Frontend-only fields (1): `amount`

### Modal — (no title)
Dialog fields (2): `amount`, `retainer_invoice_id`

Required (3):
- ❌ `contact_id`
- ❌ `date`
- ❌ `lines`

Missing optional (10): `due_date`, `reference`, `currency_code`, `exchange_rate`, `discount_type`, `discount_amount`, `shipping_charge`, `adjustment`, `notes`, `terms`

Frontend-only fields (2): `amount`, `retainer_invoice_id`

### Modal — (no title)
Dialog fields (3): `message`, `subject`, `to_email`

Required (3):
- ❌ `contact_id`
- ❌ `date`
- ❌ `lines`

Missing optional (10): `due_date`, `reference`, `currency_code`, `exchange_rate`, `discount_type`, `discount_amount`, `shipping_charge`, `adjustment`, `notes`, `terms`

Frontend-only fields (3): `message`, `subject`, `to_email`

### Modal — (no title)
Dialog fields (0): _none_

Required (3):
- ❌ `contact_id`
- ❌ `date`
- ❌ `lines`

Missing optional (10): `due_date`, `reference`, `currency_code`, `exchange_rate`, `discount_type`, `discount_amount`, `shipping_charge`, `adjustment`, `notes`, `terms`

---

## Items
File: `src/pages/Items.tsx`  
Schema: `ItemCreate`

### Modal — (no title)
Dialog fields (5): `cost_price`, `description`, `name`, `selling_price`, `sku`

Required (1):
- ✅ `name`

Missing optional (8): `item_type`, `unit`, `tax_id`, `sales_account_id`, `purchase_account_id`, `is_trackable`, `reorder_point`, `group_id`

---

## MfgBOMs
File: `src/pages/MfgBOMs.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (5): `code`, `product_id`, `quantity`, `routing`, `status`

⚠️ Skipped — no schema mapped.

---

## MfgOrders
File: `src/pages/MfgOrders.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (4): `bom_id`, `notes`, `quantity`, `scheduled_date`

⚠️ Skipped — no schema mapped.

### Drawer — (no title)
Dialog fields (0): _none_

⚠️ Skipped — no schema mapped.

---

## MfgWorkCenters
File: `src/pages/MfgWorkCenters.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (5): `active`, `capacity_per_hour`, `code`, `cost_per_hour`, `name`

⚠️ Skipped — no schema mapped.

---

## POSCategories
File: `src/pages/pos/POSCategories.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (6): `color`, `image_url`, `name`, `name_ku`, `parent_id`, `sequence`

⚠️ Skipped — no schema mapped.

---

## POSConfigs
File: `src/pages/pos/POSConfigs.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (0): _none_

⚠️ Skipped — no schema mapped.

---

## POSEmployees
File: `src/pages/pos/POSEmployees.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (7): `barcode`, `config_ids`, `is_active`, `name`, `name_ku`, `pin`, `role`

⚠️ Skipped — no schema mapped.

---

## POSFloorPlan
File: `src/pages/pos/POSFloorPlan.tsx`  
Schema: ⚠️ none mapped

### Drawer — t:pos.table_details
Dialog fields (0): _none_

⚠️ Skipped — no schema mapped.

### Modal — t:pos.enter_guests
Dialog fields (0): _none_

⚠️ Skipped — no schema mapped.

---

## POSFloors
File: `src/pages/pos/POSFloors.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (6): `background_image_url`, `config_id`, `is_active`, `name`, `name_ku`, `sequence`

⚠️ Skipped — no schema mapped.

### Drawer — t:pos.floor_plan_editor
Dialog fields (0): _none_

⚠️ Skipped — no schema mapped.

### Modal — (no title)
Dialog fields (11): `color`, `config_id`, `floor_id`, `height`, `is_active`, `name`, `position_x`, `position_y`, `seats`, `shape`, `width`

⚠️ Skipped — no schema mapped.

---

## POSGiftCards
File: `src/pages/pos/POSGiftCards.tsx`  
Schema: ⚠️ none mapped

### Modal — t:issue_single_gift_card
Dialog fields (3): `expiration_date`, `initial_value`, `partner_id`

⚠️ Skipped — no schema mapped.

### Modal — t:issue_batch_gift_cards
Dialog fields (3): `batch_count`, `expiration_date`, `initial_value`

⚠️ Skipped — no schema mapped.

### Drawer — t:gift_card_details
Dialog fields (0): _none_

⚠️ Skipped — no schema mapped.

---

## POSLoyalty
File: `src/pages/pos/POSLoyalty.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (9): `applies_on`, `date_from`, `date_to`, `is_active`, `min_amount`, `name`, `name_ku`, `point_ratio`, `program_type`

⚠️ Skipped — no schema mapped.

### Modal — t:issue_loyalty_card
Dialog fields (0): _none_

⚠️ Skipped — no schema mapped.

---

## POSOrders
File: `src/pages/pos/POSOrders.tsx`  
Schema: ⚠️ none mapped

### Drawer — (no title)
Dialog fields (0): _none_

⚠️ Skipped — no schema mapped.

---

## POSPricelists
File: `src/pages/pos/POSPricelists.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (4): `currency`, `discount_policy`, `name`, `name_ku`

⚠️ Skipped — no schema mapped.

---

## POSProducts
File: `src/pages/pos/POSProducts.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (3): `available_in_pos`, `image_url`, `pos_category_id`

⚠️ Skipped — no schema mapped.

---

## POSSessionDetail
File: `src/pages/pos/POSSessionDetail.tsx`  
Schema: ⚠️ none mapped

### Modal — t:pos.close_session
Dialog fields (2): `closing_cash_counted`, `notes`

⚠️ Skipped — no schema mapped.

### Modal — t:pos.cash_in
Dialog fields (2): `amount`, `reason`

⚠️ Skipped — no schema mapped.

### Modal — t:pos.cash_out
Dialog fields (2): `amount`, `reason`

⚠️ Skipped — no schema mapped.

---

## POSTerminal
File: `src/pages/pos/POSTerminal.tsx`  
Schema: ⚠️ none mapped

### Modal — t:pos.payment
Dialog fields (0): _none_

⚠️ Skipped — no schema mapped.

---

## PaymentLinks
File: `src/pages/PaymentLinks.tsx`  
Schema: ⚠️ none mapped

### Modal — t:create_payment_link
Dialog fields (4): `amount`, `description`, `expiry_days`, `notes`

⚠️ Skipped — no schema mapped.

---

## PayrollRules
File: `src/pages/PayrollRules.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (6): `active`, `amount`, `amount_type`, `code`, `name`, `type`

⚠️ Skipped — no schema mapped.

---

## PayrollRuns
File: `src/pages/PayrollRuns.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (2): `name`, `range`

⚠️ Skipped — no schema mapped.

### Drawer — (no title)
Dialog fields (0): _none_

⚠️ Skipped — no schema mapped.

### Modal — (no title)
Dialog fields (0): _none_

⚠️ Skipped — no schema mapped.

---

## PriceLists
File: `src/pages/PriceLists.tsx`  
Schema: `PriceListCreate`

### Modal — (no title)
Dialog fields (3): `currency_code`, `name`, `type`

Required (1):
- ✅ `name`

Missing optional (4): `description`, `price_type`, `round_off_to`, `items`

Frontend-only fields (2): `currency_code`, `type`

---

## Projects
File: `src/pages/Projects.tsx`  
Schema: `ProjectCreate`

### Modal — t:new_project
Dialog fields (3): `contact_id`, `description`, `name`

Required (1):
- ✅ `name`

Missing optional (7): `billing_type`, `budget_amount`, `hourly_rate`, `fixed_cost`, `start_date`, `end_date`, `currency_code`

---

## PurchaseOrders
File: `src/pages/PurchaseOrders.tsx`  
Schema: `PurchaseOrderCreate`

### Modal — (no title)
Dialog fields (5): `contact_id`, `date`, `expected_delivery_date`, `notes`, `reference`

Required (3):
- ✅ `contact_id`
- ✅ `date`
- ❌ `lines`

Missing optional (4): `delivery_date`, `currency_code`, `exchange_rate`, `terms`

Frontend-only fields (1): `expected_delivery_date`

---

## PurchaseReturns
File: `src/pages/PurchaseReturns.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (5): `bill_id`, `contact_id`, `date`, `notes`, `reason`

⚠️ Skipped — no schema mapped.

---

## RbacRoles
File: `src/pages/RbacRoles.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (4): `code`, `name`, `name_ku`, `permissions`

⚠️ Skipped — no schema mapped.

---

## RecurringInvoices
File: `src/pages/RecurringInvoices.tsx`  
Schema: `RecurringInvoiceCreate`

### Modal — (no title)
Dialog fields (6): `contact_id`, `end_date`, `frequency`, `notes`, `payment_terms_days`, `start_date`

Required (2):
- ✅ `contact_id`
- ✅ `start_date`

Missing optional (4): `profile_name`, `payment_terms`, `currency_code`, `lines`

Frontend-only fields (1): `payment_terms_days`

---

## SalesOrders
File: `src/pages/SalesOrders.tsx`  
Schema: `SalesOrderCreate`

### Modal — (no title)
Dialog fields (5): `contact_id`, `date`, `expected_shipment_date`, `notes`, `reference`

Required (3):
- ✅ `contact_id`
- ✅ `date`
- ❌ `lines`

Missing optional (5): `delivery_date`, `currency_code`, `exchange_rate`, `terms`, `quote_id`

Frontend-only fields (1): `expected_shipment_date`

---

## SalesReturns
File: `src/pages/SalesReturns.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (5): `contact_id`, `date`, `invoice_id`, `notes`, `reason`

⚠️ Skipped — no schema mapped.

---

## Settings
File: `src/pages/Settings.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (3): `end_date`, `name`, `start_date`

⚠️ Skipped — no schema mapped.

### Modal — (no title)
Dialog fields (2): `fiscal_year_id`, `name`

⚠️ Skipped — no schema mapped.

### Modal — (no title)
Dialog fields (4): `date`, `from_currency`, `rate`, `to_currency`

⚠️ Skipped — no schema mapped.

### Modal — (no title)
Dialog fields (5): `colors`, `footer_text`, `layout`, `name`, `show_logo`

⚠️ Skipped — no schema mapped.

---

## Shipments
File: `src/pages/Shipments.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (7): `carrier`, `contact_id`, `invoice_id`, `notes`, `ship_date`, `status`, `tracking_number`

⚠️ Skipped — no schema mapped.

---

## SignUp
File: `src/pages/SignUp.tsx`  
Schema: ⚠️ none mapped

### Modal — t:auth_org_name
Dialog fields (0): _none_

⚠️ Skipped — no schema mapped.

---

## TaxReturns
File: `src/pages/TaxReturns.tsx`  
Schema: `TaxReturnCreate`

### Modal — (no title)
Dialog fields (2): `period_from`, `period_to`

Required (3):
- ❌ `name`
- ❌ `period_start`
- ❌ `period_end`

Missing optional (1): `notes`

Frontend-only fields (2): `period_from`, `period_to`

---

## TaxSettings
File: `src/pages/TaxSettings.tsx`  
Schema: `TaxRateCreate`

### Modal — (no title)
Dialog fields (4): `description`, `name`, `rate`, `tax_type`

Required (2):
- ✅ `name`
- ✅ `rate`

Missing optional (2): `name_ku`, `is_compound`

Frontend-only fields (1): `description`

### Modal — (no title)
Dialog fields (2): `name`, `tax_rate_ids`

Required (2):
- ✅ `name`
- ❌ `rate`

Missing optional (3): `name_ku`, `tax_type`, `is_compound`

Frontend-only fields (1): `tax_rate_ids`

---

## UserRoles
File: `src/pages/UserRoles.tsx`  
Schema: ⚠️ none mapped

### Modal — ${t(
Dialog fields (0): _none_

⚠️ Skipped — no schema mapped.

---

## VendorCredits
File: `src/pages/VendorCredits.tsx`  
Schema: `VendorCreditCreate`

### Modal — (no title)
Dialog fields (4): `contact_id`, `date`, `notes`, `reference`

Required (3):
- ✅ `contact_id`
- ✅ `date`
- ❌ `lines`

Missing optional (2): `bill_id`, `currency_code`

Frontend-only fields (1): `reference`

---

## Warehouses
File: `src/pages/Warehouses.tsx`  
Schema: `WarehouseCreate`

### Modal — (no title)
Dialog fields (3): `address`, `is_primary`, `name`

Required (1):
- ✅ `name`

### Modal — (no title)
Dialog fields (3): `date`, `from_warehouse_id`, `to_warehouse_id`

Required (1):
- ❌ `name`

Missing optional (2): `address`, `is_primary`

Frontend-only fields (3): `date`, `from_warehouse_id`, `to_warehouse_id`

---

## WhatsApp
File: `src/pages/WhatsApp.tsx`  
Schema: ⚠️ none mapped

### Modal — (no title)
Dialog fields (4): `body`, `description`, `locale`, `name`

⚠️ Skipped — no schema mapped.

### Modal — t:send_message
Dialog fields (2): `body`, `to`

⚠️ Skipped — no schema mapped.

---

export interface Contact {
  id: string;
  org_id: string;
  contact_type: string;
  display_name: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  currency_code: string;
  payment_terms?: number;
  tax_number?: string;
  notes?: string;
  is_active: boolean;
  opening_balance: number;
  created_at: string;
}

export interface Item {
  id: string;
  org_id: string;
  name: string;
  sku?: string;
  item_type: string;
  unit?: string;
  description?: string;
  selling_price: number;
  cost_price: number;
  tax_id?: string;
  sales_account_id?: string;
  purchase_account_id?: string;
  is_trackable: boolean;
  reorder_point?: number;
  stock_on_hand: number;
  is_active: boolean;
  created_at: string;
}

export interface InvoiceLine {
  id: string;
  item_id?: string;
  description?: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  tax_id?: string;
  tax_amount: number;
  account_id?: string;
  line_total: number;
}

export interface Invoice {
  id: string;
  org_id: string;
  contact_id: string;
  invoice_number: string;
  reference?: string;
  date: string;
  due_date?: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  shipping_charge: number;
  adjustment: number;
  total: number;
  balance_due: number;
  currency_code: string;
  exchange_rate: number;
  notes?: string;
  terms?: string;
  lines: InvoiceLine[];
  created_at: string;
}

export interface Expense {
  id: string;
  org_id: string;
  expense_number: string;
  date: string;
  account_id: string;
  amount: number;
  tax_amount: number;
  total: number;
  paid_through_account_id?: string;
  contact_id?: string;
  description?: string;
  reference?: string;
  status: string;
  is_billable: boolean;
  project_id?: string;
  currency_code: string;
  created_at: string;
}

export interface Quote {
  id: string;
  org_id: string;
  contact_id: string;
  quote_number: string;
  reference?: string;
  date: string;
  expiry_date?: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  currency_code: string;
  notes?: string;
  terms?: string;
  created_at: string;
}

export interface Bill {
  id: string;
  org_id: string;
  contact_id: string;
  bill_number: string;
  vendor_bill_number?: string;
  date: string;
  due_date?: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  balance_due: number;
  currency_code: string;
  created_at: string;
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  contact_id?: string;
  description?: string;
  status: string;
  billing_type: string;
  budget_amount: number;
  total_hours: number;
  total_cost: number;
  total_billed: number;
  currency_code: string;
  created_at: string;
}

export interface Account {
  id: string;
  org_id: string;
  name: string;
  name_ku?: string;
  code?: string;
  account_type: string;
  parent_id?: string;
  balance: number;
  is_system: boolean;
  is_active: boolean;
}

export interface ApiListResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

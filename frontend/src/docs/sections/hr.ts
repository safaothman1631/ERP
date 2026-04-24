import type { SectionDoc } from '../types';

export const hrDoc: SectionDoc = {
  key: 'hr',
  title: 'بەڕێوەبردنی کارمەندان (HR)',
  purpose: 'مۆدیوولی HR ی تەواو: کارمەند، گرێبەست، مانەوە (attendance)، وەستانی مانەوە (time-off)، خەرجی کاری (expenses)، و payroll. دانەی دارایی دەچێتە ئاکاونتینگ.',
  whoUses: ['HR Manager', 'Payroll Officer', 'Employee', 'Manager'],
  subAreas: [
    {
      name: 'کارمەندان',
      purpose: 'تۆماری زانیاری کارمەند، مەقام، و بەش.',
      route: '/hr/employees',
    },
    {
      name: 'گرێبەستەکان',
      purpose: 'بەڕێوەبردنی گرێبەستی کار و تاریخی کارکردن.',
      route: '/hr/contracts',
    },
    {
      name: 'مانەوەی رۆژانە (Attendance)',
      purpose: 'تۆماری ماوەی کارکردن و check-in/out ی ڕۆژانە.',
      route: '/hr/attendance',
    },
    {
      name: 'وەستانەکان (Time Off)',
      purpose: 'داواکردن و قبولکردنی مانی leave ـەکان.',
      route: '/hr/time-off',
    },
    {
      name: 'خەرجی کارمەند (Expenses)',
      purpose: 'رووتینی submit، approve، و reimburse ی خەرجی.',
      dataFlow: 'Expense → Approval → Reimbursement → Journal Entry',
      route: '/hr/expenses',
    },
    {
      name: 'Payroll',
      purpose: 'مەوادی مووچە — ڕانگ، کەمکردنەوە، و journal entry ی مووچە.',
      dataFlow: 'Payroll Run → Rules calculation → Net pay → Journal Entry (Payroll Liability)',
      route: '/hr/payroll-runs',
    },
  ],
  dataDestination: 'Firestore: employees, hr_contracts, attendance, time_off, expenses, payroll_runs, payroll_rules, journal_entries',
  related: ['accounting', 'reports-mgt'],
  kpis: ['Headcount', 'Payroll total MTD', 'Leave days taken', 'Expense amount pending'],
  tips: [
    'Payroll Rules دروستبکە پێش هەر payroll run ـێک.',
    'Expense claim approval workflow بە Approvals module پیوەست دەبێت.',
  ],
};

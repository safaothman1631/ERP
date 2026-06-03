# ڕێبەری ماستەری جێبەجێکردن (ئەوەی لەسەر Claude بوو) — ERPIQ

> **مەبەست:** ئەمە کۆکراوەی هەموو ئەو ڕێنماییە تەکنیکییانەیە کە دەکرا بە بێ مەترسی لێرە دروست بکرێن بۆ گەیاندنی سیستەم بۆ ئاستی world-class بەپێی کتێبەکە. هەمووی **ڕێنمایی پشتڕاستکراون بنچینەی لەسەر کۆدی ڕاستەقینە** — بەڵام **جێبەجێ نەکراون** لێرە، چونکە تاقیکردنەوەی backend پێویستی بە Windows ـی تۆ هەیە. هەر بەشێک: کۆدی copy-paste + خاڵی دانان + پلانی تێست + ڕێگەی پشتڕاستکردنەوە لەسەر Windows.
>
> **هاوبەشی ئەم دیکۆمێنتە:** `OWNER_ACTION_PLAN_KU.md` — هەموو ئەوەی لەسەر تۆ دەمێنێت (Windows + دەرەکی/مرۆڤ).

---

## 📚 ئەندێکسی هەموو ڕێنمایی-دروستکراوەکان

ئەمانە پێشتر دروستکراون و لەگەڵ ئەم ماستەرە تەواوکارن:

| ڕێنمایی | شوێن | ناوەڕۆک |
|---------|------|---------|
| دروستیی دارایی (P0) | `_deltas/P0-finance-correctness-IMPLEMENTATION.md` | GL خۆکار لە فاکتورا/پارە + Decimal |
| ئەرکیتێکچەری P1 | `_deltas/P1-architecture-IMPLEMENTATION.md` | event backbone، saga، Clean Core، API gateway، workflow engine |
| مۆدیوولی P1 | `_deltas/P1-modules-IMPLEMENTATION.md` | WMS، TMS، costing+WIP JE، consolidation، perpetual valuation |
| ADRـەکان | `docs/adr/0021–0024` | کۆگای داتا، event backbone، microservices، Decimal policy |
| **ئەم ماستەرە (٥ بەش)** | ↓ خوارەوە | analytics/EPM/UX · AI/MLOps · DevOps/SRE/DR · migration/QA · payments/e-Fakhata/finance |

---

## 🗺️ ناوەڕۆکی ئەم دیکۆمێنتە

1. **بەشی ١ — شیکاری · EPM · BI · UX/مۆبایل/Accessibility**
2. **بەشی ٢ — AI · فێربوونی ئامێر · MLOps**
3. **بەشی ٣ — DevOps · SRE · Observability · DR**
4. **بەشی ٤ — کۆچکردنی داتا (ETL) · ستراتیژیی تێست/QA**
5. **بەشی ٥ — پارەدانی عێراقی · e-Fakhata · GL/Decimal**

> هەر بەشێک بنچینەی لەسەر فایلی ڕاستەقینەی کۆدە (ناوی فەنکشن/فایل دیقەن کراون). پێش جێبەجێکردن: لە برانچێک کاری لەسەر بکە، `pytest` تەواو ڕان بکە، پاشان deploy.

---

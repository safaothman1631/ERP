# فەیز ٤ — PDF RTL + فۆنتی کوردی ✅

## پوختە
باکئێند PDF generator دروستکرا بۆ پشتگیری فۆنتی عەرەبی/کوردی و RTL layout.

---

## ١. فۆنتەکان ✅

### دابەزێنرا:
- `NotoSansArabic-Regular.ttf` (234 KB)
- `NotoSansArabic-Bold.ttf` (261 KB)

### شوێن:
```
c:\Users\SAFA\zoho\backend\fonts\
```

### سەرچاوە:
Google Fonts - NotoSansArabic (GitHub repository)

---

## ٢. Dependencies ✅

### زیادکرا بۆ `requirements.txt`:
```
reportlab>=4.0.0
arabic-reshaper>=3.0.0
python-bidi>=0.6.0
```

### نصبکرا:
```bash
pip install arabic-reshaper python-bidi reportlab
```

---

## ٣. PDF Generator تەواو کرا ✅

### فایل:
`c:\Users\SAFA\zoho\backend\app\services\pdf_generator.py`

### تایبەتمەندییە نوێکان:

#### ١. فۆنت Registration
```python
def _register_fonts():
    """Register NotoSansArabic fonts for RTL support"""
    regular_path = FONTS_DIR / "NotoSansArabic-Regular.ttf"
    bold_path = FONTS_DIR / "NotoSansArabic-Bold.ttf"
    pdfmetrics.registerFont(TTFont("NotoArabic", str(regular_path)))
    pdfmetrics.registerFont(TTFont("NotoArabic-Bold", str(bold_path)))
```

#### ٢. RTL Text Reshaping
```python
def _reshape_text(text: str, lang: str = "en") -> str:
    """Reshape Arabic/Kurdish text for RTL display"""
    if lang == "ku":
        reshaped = arabic_reshaper.reshape(text)
        return get_display(reshaped)
    return text
```

#### ٣. Language-Aware Styles
```python
def _get_styles(lang: str = "en"):
    if lang == "ku":
        base_font = "NotoArabic"
        alignment = TA_RIGHT
    else:
        base_font = "Helvetica"
        alignment = TA_LEFT
```

#### ٤. RTL Table Layout
بۆ `lang=ku`:
- ستوونەکان reversed: `کۆ | باج | نرخ | بڕ | وەسف | #`
- تێکست: `TA_RIGHT`
- ژمارەکان: `TA_LEFT`

بۆ `lang=en`:
- ستوونەکان normal: `# | Description | Qty | Price | Tax | Total`
- تێکست: `TA_LEFT`
- ژمارەکان: `TA_RIGHT`

---

## ٤. API Endpoints باشترکرا ✅

### ١. Invoice PDF
```
GET /api/invoices/{invoice_id}/pdf?lang=ku
GET /api/invoices/{invoice_id}/pdf?lang=en
```

**نموونە:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:8000/api/invoices/123/pdf?lang=ku" \
  -o invoice_ku.pdf
```

### ٢. Quote PDF
```
GET /api/quotes/{quote_id}/pdf?lang=ku
GET /api/quotes/{quote_id}/pdf?lang=en
```

### ٣. Purchase Order PDF
```
GET /api/purchase-orders/{po_id}/pdf?lang=ku
GET /api/purchase-orders/{po_id}/pdf?lang=en
```

---

## ٥. بەکارهێنان

### لە Frontend:
```typescript
// PDF دابەزێنە بە کوردی
const downloadInvoicePDF = async (invoiceId: string) => {
  const response = await api.get(
    `/api/invoices/${invoiceId}/pdf?lang=ku`,
    { responseType: 'blob' }
  );
  
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `invoice_${invoiceId}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};
```

---

## ٦. تاقیکردنەوە ✅

### Import Check
```bash
python -c "from app.services.pdf_generator import generate_invoice_pdf; print('✓')"
# ✓ PDF generator imported successfully
```

### Arabic Reshaper Test
```bash
python -c "import arabic_reshaper; from bidi.algorithm import get_display; print('✓')"
# ✓ arabic-reshaper + python-bidi کاردەکەن
```

### Font Files
```
NotoSansArabic-Regular.ttf  →  234,892 bytes
NotoSansArabic-Bold.ttf     →  261,460 bytes
```

---

## ٧. فۆرماتی PDF

### Header (RTL):
```
───────────────────────────────────────
         ناوی کۆمپانیا
     ناونیشان - شار - وڵات
   Tel: ... | Email: ... | Tax#: ...
───────────────────────────────────────
```

### Document Info (RTL):
```
پسووڵە / Invoice
ژمارە / Number:   INV-2026-001
بەروار / Date:     2026-04-14
بەرواری دوایی:    2026-05-14
```

### Items Table (RTL):
```
┌──────┬──────┬────────┬─────┬─────────────┬───┐
│  کۆ  │ باج  │ نرخ    │ بڕ  │   وەسف      │ # │
├──────┼──────┼────────┼─────┼─────────────┼───┤
│50,000│5,000 │50,000  │ 1.0 │ کاڵای یەکەم │ 1 │
└──────┴──────┴────────┴─────┴─────────────┴───┘
```

### Totals (RTL):
```
          ٤٥,٠٠٠ د.ع  :کۆی ناخاو
           ٥,٠٠٠ د.ع  :باج
───────────────────────────────
          ٥٠,٠٠٠ د.ع  :کۆی گشتی
```

---

## ٨. پشتگیری لە دوو زمان

| Parameter | Font Family      | Alignment | Column Order |
|-----------|-----------------|-----------|--------------|
| `lang=ku` | NotoSansArabic  | RTL       | Reversed     |
| `lang=en` | Helvetica       | LTR       | Normal       |

---

## ٩. فایلە گۆڕدراوەکان

1. ✅ `backend/fonts/` - دایرکتۆری نوێ
2. ✅ `backend/requirements.txt` - dependencies زیادکرا
3. ✅ `backend/app/services/pdf_generator.py` - تەواو نووسرایەوە
4. ✅ `backend/app/api/invoices.py` - PDF endpoint زیادکرا
5. ✅ `backend/app/api/quotes.py` - PDF endpoint زیادکرا
6. ✅ `backend/app/api/purchase_orders.py` - PDF endpoint زیادکرا

---

## ١٠. داهاتوو

- [ ] Email attachment بۆ PDF بە کوردی
- [ ] PDF preview لە Frontend
- [ ] Bulk download (چەندین PDF یەکجار)
- [ ] Custom templates بۆ organizations

---

**بەروار:** ٢٠٢٦-٠٤-١٤  
**Status:** ✅ تەواو

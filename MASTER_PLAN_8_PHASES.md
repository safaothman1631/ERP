# نەخشەی تۆکمە — ٨ خاڵ بۆ سیستەمی زێریرباری
## (Zoho Books Clone)

> دروستکرا لەلایەن: شادۆ پلانساز  
> جێبەجێکرا: فەیز بە فەیز، بەبێ وەستان

---

## خلاصەی پرۆژە

- **ناوی پرۆژە:** Zoho Books Clone
- **وەسف:** سیستەمی تەواوی ئەکاونتینگ و بەرێوەبردنی بیزنس بۆ بازاری کوردستان
- **ئامانج:** بیزنسەکانی کوردستان — زێریرباری، فرۆش، کڕین، بانک، مەخزن
- **بازار:** کوردستان / عێراق
- **زمانەکان:** کوردی سۆرانی (سەرەکی) + ئینگلیزی
- **دراو:** IQD (سەرەکی)
- **Stack:** `React 19 + TypeScript + Vite 8 + AntD 6.3 + Zustand + Firebase + FastAPI + Firestore`

---

## دوای پلان vs ئێستا ئاماری

| بابەت | ئێستا | دوای ٨ خاڵ |
|-------|-------|------------|
| لاپەڕە | ٤٤ | ٤٧+ (guide, profile, security) |
| i18n keys (ku.json) | ~٤٥٠ | ~٩٥٠+ |
| Settings tabs | ٩ | ١٤+ |
| CSS/Animations | CSS transition 0.2s | Framer Motion + Glassmorphism |

---

## فەیز ١ — RTL Navbar Fix `✅ 523ms`

**نەخشە:**
- Sider لە `position: fixed` کرا
- لەلایەن زمانی کوردی دەچێتە ئاراستەی راست، لە ئینگلیزی چەپ
- `[isRTL ? 'right' : 'left']: 0` بۆ placement
- Header: `position: sticky, top: 0`
- Collapse icon: پێچەوانە دەبێت لە RTL

**فایلەکان:**
- `frontend/src/components/AppLayout.tsx`

---

## فەیز ٢ — i18n تەواو `✅ 588ms`

**نەخشە:**
- ~٢٣٠ کلیلی نوێ زیادکرا
- ٥١ تا `placeholder_*` keys
- ١٤ تا validation keys
- ١٤ تا modal/confirm
- ٥٠+ settings/security
- ٧٠+ general UI
- ٣٠+ document keys
- `en.json` sync کرا بە هەمان keys

**فایلەکان:**
- `frontend/src/locales/ku.json` (450 → 700+ کلیل)
- `frontend/src/locales/en.json`

---

## فەیز ٣ — Placeholder + Validation هەموو ٤٤ لاپەڕە `✅ 700ms`

**نەخشە:**
- هەموو `Input`, `InputNumber`, `Select`, `DatePicker`, `TextArea` گەیشتنە `placeholder={t('placeholder_xxx')}`
- Form.Item rules: `required: true, message: t('required_xxx')`
- Auth pages: email validation + password min 8
- ٢٠ فایل گۆڕدرا بۆ `|| []` fallback (بەجیاتی `|| res.data`)

**فایلەکان:**
- هەموو `frontend/src/pages/*.tsx` (٤٤ فایل)

---

## فەیز ٤ — PDF RTL Support `✅`

**نەخشە:**
- `NotoSansArabic-Regular.ttf` + `NotoSansArabic-Bold.ttf` دابەزاندرا بۆ `backend/fonts/`
- `arabic-reshaper` + `python-bidi` نصب کرا
- `pdf_generator.py` تەواو دووبارە نووسرا
- RTL columns (reversed), IQD formatting
- `?lang=ku|en` parameter پشتگیری کرد
- ٣ endpoint نوێ زیادکرا: invoices PDF, quotes PDF, purchase-orders PDF

**فایلەکان:**
- `backend/app/services/pdf_generator.py` (تەواو دووبارە نووسرا)
- `backend/app/api/invoices.py`
- `backend/app/api/quotes.py`
- `backend/app/api/purchase_orders.py`
- `backend/fonts/NotoSansArabic-Regular.ttf` (نوێ)
- `backend/fonts/NotoSansArabic-Bold.ttf` (نوێ)

---

## فەیز ٥ — Settings تەواو `✅ 572ms`

**نەخشە:** ٩ tab → ١٣+ tab

| Tab | ناوەڕۆک |
|-----|---------|
| Profile | ناو، تەلەفۆن، گۆڕینی پاسوۆرد |
| Organization | ناوی کۆمپانیا، ناونیشان، ژمارەی باج |
| Security | placeholder بۆ 2FA |
| Notifications | ٤ تۆگل |
| Fiscal Years | هەبوو |
| Budgets | هەبوو |
| Currencies | هەبوو |
| Email | هەبوو |
| Backup | لیستی باکئەپ، دروستکردن، داونلۆد |
| Activity Log | فلتەر بە تایپ + بەروار |
| Invoice Templates | CRUD + set-default |
| System Info | ورسیۆن، پلاتفۆرم، شتەکانی سیستەم |

**فایلەکان:**
- `frontend/src/pages/Settings.tsx`
- `backend/app/api/system.py` (2 → 20+ endpoints)

---

## فەیز ٦ — Performance + Security `✅ 551ms`

**Backend:**
- CSP header (Content-Security-Policy)
- Permissions-Policy header
- CORS strict: `origins=['localhost:5173','localhost:3000']`, `methods=['GET','POST','PUT','PATCH','DELETE']`
- Rate limiting: login 5/min, firebase-login 5/min

**Frontend:**
- `api.ts`: `timeout: 30000`
- `AppLayout.tsx`: `menuItems` wrapped لە `useMemo`

**فایلەکان:**
- `backend/app/main.py`
- `backend/app/api/auth.py`
- `frontend/src/api.ts`
- `frontend/src/components/AppLayout.tsx`

---

## فەیز ٧ — Guide/Tutorial System `✅ 618ms`

**نەخشە:**
- `GuideDrawer.tsx` دروست کرا — Ant Design Drawer + sidebar Menu + Collapse
- ٨ بەش: فرۆشتن، كڕین، بانکینگ، ئەکاونتینگ، ئەنبار، پرۆژە، دارایی، ڕێکخستن
- ٧٠+ guide keys لە `ku.json` + `en.json`
- هەر بەشێک: ئامرازەکان + مەرحەلەکان + نموونەی ڕاستەقینە
- AppLayout: دوگمەی `QuestionCircleOutlined` لە منیوو

**فایلەکان:**
- `frontend/src/components/GuideDrawer.tsx` (نوێ)
- `frontend/src/components/AppLayout.tsx`
- `frontend/src/locales/ku.json`
- `frontend/src/locales/en.json`

---

## فەیز ٨ — Animation + Glassmorphism + Vertex Theme `✅ 633ms`

### Vertex Colors:

| ناو | رەنگ |
|-----|------|
| Background | `#0a0a0f` |
| Primary gradient | `linear-gradient(135deg, #6366f1, #8b5cf6)` |
| Surface | `rgba(255,255,255, 0.03–0.06)` |
| Border | `rgba(255,255,255, 0.08)` |
| Text (primary) | `#f8fafc` |
| Text (secondary) | `#94a3b8` |
| Accent | `#818cf8`, `#a78bfa` |

### Framer Motion:
- `PageTransition.tsx`: opacity 0→1, y 20→0→-10, duration 0.3s easeInOut
- هەموو routes wrap کران لە `PageTransition`

### Glassmorphism CSS:
- `.glass-card`: `backdrop-filter: blur(12px)` + semi-transparent border + hover `translateY(-4px)`
- Sidebar: `backdrop-filter: blur(20px)` + `rgba(10,10,15,0.8)`
- Table headers: `rgba(255,255,255,0.04)` background
- Input/Select/Picker: `rgba(255,255,255,0.03)` + border glow on focus
- Button Primary: gradient + `box-shadow rgba(99,102,241,0.3)` + hover lift
- Modal: `background: #12121a` + `backdrop-filter: blur(24px)`
- Micro-interactions: button `scale(0.97)` on click
- Custom scrollbar: 6px، `rgba(255,255,255,0.1)`
- Menu selected: `rgba(99,102,241,0.15)` + inline-end border `#6366f1`

### Ant Design ConfigProvider (Dark):
```ts
colorBgBase:       #0a0a0f
colorBgContainer:  rgba(255,255,255,0.03)
colorBgElevated:   rgba(255,255,255,0.06)
colorBgLayout:     #0a0a0f
colorBorder:       rgba(255,255,255,0.08)
colorText:         #f8fafc
colorTextSecondary:#94a3b8
colorPrimary:      #6366f1
borderRadius:      12
```

### Component Overrides (Dark):
```ts
Card:   { colorBgContainer: 'rgba(255,255,255,0.03)', borderRadiusLG: 16 }
Table:  { colorBgContainer: 'transparent', headerBg: 'rgba(255,255,255,0.04)' }
Menu:   { darkItemBg: 'transparent', darkItemSelectedBg: 'rgba(99,102,241,0.15)' }
Button: { primaryShadow: '0 4px 12px rgba(99,102,241,0.3)' }
Input:  { colorBgContainer: 'rgba(255,255,255,0.03)' }
Select: { colorBgContainer: 'rgba(255,255,255,0.03)' }
Modal:  { contentBg: '#12121a' }
```

**فایلەکان:**
- `frontend/src/components/PageTransition.tsx` (نوێ)
- `frontend/src/App.tsx`
- `frontend/src/global.css`
- `frontend/src/components/AppLayout.tsx`

---

## خلاصەی کۆتایی — هەموو فەیزەکان

| فەیز | ناو | Build |
|------|-----|-------|
| 1 | RTL Navbar Fix | ✅ 523ms |
| 2 | i18n +230 keys | ✅ 588ms |
| 3 | Placeholders + Validation (44 pages) | ✅ 700ms |
| 4 | PDF RTL (NotoSans + bidi) | ✅ |
| 5 | Settings 13 tabs | ✅ 572ms |
| 6 | Security + Performance | ✅ 551ms |
| 7 | Guide/Tutorial | ✅ 618ms |
| 8 | Animation + Vertex Theme | ✅ 633ms |

هەموو ٨ فەیز بە ئاراستەی پلانسازەوە جێبەجێ کران — بەبێ وەستان.

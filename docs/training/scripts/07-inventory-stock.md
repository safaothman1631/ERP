# Script 07 — Stock In, Stock Counts & Low-Stock Alerts

> Languages: **Kurdish (Sorani)** + **Arabic**. Target 3:00–3:30.
> Module: Inventory. Reinforces EC-10 (negative-stock reconcile), EC-30 (pack→each units), EC-27 (batch/expiry — pharmacy variant).
> Demo: receive a delivery, set units, do a count, see a low-stock alert.

## Shot list

| # | On screen | Action |
|---|-----------|--------|
| 1 | Inventory list | Show items with current stock levels. |
| 2 | Receive stock | Record a goods-receipt: 10 cartons in, define carton→each (e.g. 1 carton = 24). |
| 3 | Resulting units | Show on-hand updates to the each-level quantity. |
| 4 | Reorder point | Set a low-stock threshold on a fast mover. |
| 5 | Low-stock alert | Show the low-stock indicator/report when it dips below threshold. |
| 6 | Stock count | Do a physical count for one item; enter counted qty; system records the adjustment. |
| 7 | Negative stock note | Explain: if two offline terminals oversell, the system flags negative stock to reconcile (doesn't silently break). |
| 8 | (Pharmacy variant) batch/expiry | For medicines, show batch + expiry capture and a near-expiry view. |
| 9 | Tip | Tip: count your top 20 movers weekly, not the whole shop — keeps it quick and accurate. |

## Narration — کوردی (سۆرانی)

1. ئەمە لیستی ئەنبارە، لەگەڵ بڕی ئێستای هەر کاڵایەک.
2. کاتێک بار دێت، وەرگرتنی کاڵا تۆمار بکە — ١٠ کارتۆن، و پێناسە بکە کارتۆن بۆ دانە (نموونە ١ کارتۆن = ٢٤ دانە).
3. سەیر بکە — بڕی بەردەست بۆ ئاستی دانە نوێ دەبێتەوە.
4. خاڵی دووبارە داواکردن دابنێ بۆ کاڵا پڕفرۆشەکان.
5. کاتێک لە سنوور کەمتر بوو، نیشانەی کەمی کاڵا دەردەکەوێت.
6. ژماردنی فیزیکی بکە بۆ کاڵایەک — ژمارەی ژمێردراو بنووسە، سیستەمەکە ڕێکخستنەکە تۆمار دەکات.
7. ئەگەر دوو تەرمیناڵی ئۆفلاین زیاتر لە بڕی بەردەست بفرۆشن، سیستەمەکە بڕی نەرێنی نیشان دەدات بۆ ڕێکخستن — بێدەنگ تێک ناچێت.
8. بۆ دەرمان: ژمارەی بەچ و بەرواری بەسەرچوون تۆمار بکە و لیستی نزیک-بەسەرچوو ببینە.
9. ئامۆژگاری: هەفتانە تەنها ٢٠ کاڵای پڕفرۆش بژمێرە، نەک هەموو دوکان — خێرا و وردتر دەبێت.

## Narration — العربية

1. هذه قائمة المخزون، مع الكمية الحالية لكل سلعة.
2. عند وصول بضاعة، سجّل استلامًا — ١٠ كراتين، وعرّف الكرتون إلى قطعة (مثلًا ١ كرتون = ٢٤ قطعة).
3. انظر — تتحدّث الكمية المتوفرة إلى مستوى القطعة.
4. اضبط نقطة إعادة الطلب للسلع سريعة الحركة.
5. عند النزول تحت الحد، تظهر علامة نقص المخزون.
6. قم بجرد فعلي لسلعة — أدخل الكمية المعدودة، ويسجّل النظام التسوية.
7. إذا باعت نقطتا بيع غير متصلتين أكثر من المتوفر، يُظهر النظام مخزونًا سالبًا للتسوية — لا يتعطّل بصمت.
8. للأدوية: سجّل رقم الدفعة وتاريخ الانتهاء، وشاهد قائمة قرب الانتهاء.
9. نصيحة: اجرد أسبوعيًا أهم ٢٠ سلعة فقط، لا المحل كله — يبقى سريعًا وأدق.

## Pause points
- Hold shot 3 (pack→each conversion) 2s.
- Hold shot 5 (low-stock alert) 1.5s.

## Note for the editor
Batch/expiry (shot 8) and negative-stock reconcile (shot 7) are open/partial edge cases (EC-27, EC-10). Record the pharmacy batch/expiry shot only against a build where it works; otherwise drop shot 8 from the supermarket cut and keep it for the pharmacy-specific edition.

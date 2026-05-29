# Script 06 — Selling in USD and IQD Together

> Languages: **Kurdish (Sorani)** + **Arabic**. Target 3:00.
> Module: Multi-currency (CBI rate + converter). Reinforces EC-02 (dual pricing), EC-03 (cross-currency change), EC-04 (rate fallback/override).
> Demo: an electronics/hardware item priced in USD, paid in mixed USD+IQD.

## Shot list

| # | On screen | Action |
|---|-----------|--------|
| 1 | Today's rate | Show the CBI USD/IQD rate badge ("as of <date>"). |
| 2 | Manual override | Show how the owner can set today's rate each morning if needed. |
| 3 | USD-priced item | Add an item priced in USD ($450). |
| 4 | IQD equivalent | Show the live IQD equivalent on the line / total. |
| 5 | Tender split | Customer pays $400 USD cash + the rest in IQD. |
| 6 | Cross-currency change | If they overpay in USD, show IQD change computed at the rate. |
| 7 | Receipt | Receipt prints both currencies + the rate used. |
| 8 | Books | Note the GL records the functional-currency amount. |
| 9 | Tip | Tip: lock the morning rate so all day's USD sales use one consistent number. |

## Narration — کوردی (سۆرانی)

1. زۆر دوکان بە دۆلار نرخ دادەنێن بەڵام بە دینار پارە وەردەگرن. ئەمە نرخی ئەمڕۆی دۆلارە بەپێی بانکی ناوەندی، لەگەڵ بەرواری "هەتا".
2. ئەگەر بتەوێت، دەتوانیت هەر بەیانییەک نرخی ئەمڕۆ بە دەستی دابنێیت.
3. کاڵایەک زیاد بکە کە بە دۆلار نرخی هەیە — ٤٥٠ دۆلار.
4. سەیر بکە — هاوتای دیناری ڕاستەوخۆ نیشان دەدرێت.
5. کڕیارەکە ٤٠٠ دۆلار کاش دەدات و ماوەکە بە دینار.
6. ئەگەر بە دۆلار زیاتری دا، پارەی گەڕاوە بە دینار حیساب دەکرێت بەپێی نرخەکە.
7. پسووڵەکە هەردوو دراو و نرخی بەکارهاتوو چاپ دەکات.
8. لە دەفتەری حیساباتدا، بڕەکە بە دراوی سەرەکی تۆمار دەبێت.
9. ئامۆژگاری: نرخی بەیانی قفڵ بکە تا هەموو فرۆشتنە دۆلارییەکانی ڕۆژەکە یەک نرخیان بێت.

## Narration — العربية

1. كثير من المحلات تسعّر بالدولار لكنها تستلم بالدينار. هذا سعر الدولار اليوم حسب البنك المركزي، مع تاريخ "حتى".
2. إذا أردت، يمكنك ضبط سعر اليوم يدويًا كل صباح.
3. أضف سلعة مسعّرة بالدولار — ٤٥٠ دولارًا.
4. انظر — يظهر المعادل بالدينار مباشرة.
5. يدفع العميل ٤٠٠ دولار نقدًا والباقي بالدينار.
6. إذا دفع بالدولار أكثر، يُحسب الباقي بالدينار حسب السعر.
7. يطبع الإيصال العملتين والسعر المستخدم.
8. في دفتر الحسابات، يُسجَّل المبلغ بالعملة الأساسية.
9. نصيحة: ثبّت سعر الصباح حتى تستخدم كل مبيعات الدولار في اليوم رقمًا واحدًا.

## Pause points
- Hold shot 4 (IQD equivalent) 2s.
- Hold shot 7 (dual-currency receipt) 2s.

## Note for the editor
Cross-currency change (shot 6) is an open edge case (EC-03) — if the build being recorded doesn't yet support it cleanly, narrate the supported path (USD-priced, IQD-paid) and skip the overpay-in-USD demo. Do not show a broken flow.

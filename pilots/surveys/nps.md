# NPS — Net Promoter Score instrument (ku / ar / en)

> Send at **Day 14** and **Day 30** to the owner and each trained staff member (T-SF.6.12).
> One 0–10 question + one open follow-up. Classify 9–10 = Promoter, 7–8 = Passive, 0–6 = Detractor.
> **NPS = %Promoters − %Detractors.** Program gate: **median ≥ 30**.

---

## کوردی (سۆرانی)

**پرسیار:** لە ٠ تا ١٠، چەند ئەگەرە سیستەمی Kurdish ERP پێشنیار بکەیت بۆ هاوکار یان دۆستێکی خاوەن بزنس؟

`٠ — هەرگیز پێشنیار ناکەم    …    ١٠ — بەدڵنیاییەوە پێشنیار دەکەم`

**پرسیاری دواکەوتوو:** هۆکاری سەرەکیی ئەو نمرەیە چی بوو؟
> _<وەڵام — دەکرێت بە دەنگ بێت و پاشان بنووسرێتەوە>_

> _ئەم ڕاپرسییە دەربارەی نەرمەکاڵاکەیە، نەک دەربارەی تۆ. وەڵامەکانت بۆ باشترکردنی بەرنامەکە بەکاردێن._

---

## العربية

**السؤال:** من ٠ إلى ١٠، ما مدى احتمال أن توصي بنظام Kurdish ERP لزميل أو صديق يملك نشاطًا تجاريًا؟

`٠ — لن أوصي إطلاقًا    …    ١٠ — سأوصي بكل تأكيد`

**سؤال المتابعة:** ما السبب الرئيسي لهذه الدرجة؟
> _<الإجابة — يمكن أن تكون رسالة صوتية تُفرَّغ لاحقًا>_

> _هذا الاستبيان عن البرنامج، وليس عنك. تُستخدم إجاباتك لتحسين النظام._

---

## English

**Question:** On a scale of 0 to 10, how likely are you to recommend Kurdish ERP to a colleague or friend who owns a business?

`0 — Not at all likely    …    10 — Extremely likely`

**Follow-up:** What is the main reason for your score?
> _<answer — may be a voice note, transcribed>_

> _This survey is about the software, not about you. Your answers are used to improve the system._

---

## Recording sheet (per response)

```
Pilot: <code>   Touchpoint: <day-14 / day-30>   Date: YYYY-MM-DD
Respondent: <first name, role>   Language: <ku / ar / en>
NPS score (0–10): __    Class: <Promoter 9-10 / Passive 7-8 / Detractor 0-6>
Reason: ______________________________________________________________
```

## Roll-up formula (paste into results.md)

```
Promoters  = count(score in 9..10)
Detractors = count(score in 0..6)
N          = total responses
NPS = round( 100 * (Promoters - Detractors) / N )
```

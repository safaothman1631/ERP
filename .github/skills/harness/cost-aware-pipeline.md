# Skill: Cost-aware Pipeline

## فەلسەفە
هەر مۆدێل **کۆستی** هەیە. هەمیشە ئەو model بەکار بێنە کە **یەکەم viable** ـە — نا گرانترین.

## Tier System

| Tier | Models | Use case |
|------|--------|----------|
| T1 (cheap) | Haiku، Mini | Q&A، simple edit، list/search |
| T2 (mid)   | Sonnet 4.5 | Most coding، planning |
| T3 (high)  | Opus، GPT-5 | Complex reasoning، architecture |

## Routing Decision Tree

```
Task → Is it pattern matching? → Yes → regex tool (no LLM)
                              → No  ↓
     → Is it < 10 lines simple? → Yes → T1
                              → No  ↓
     → Needs deep reasoning? → No → T2
                            → Yes ↓
     → Long context (>50K)? → Yes → T3 (long-ctx model)
                           → No  → T3
```

## Pipeline Stages

١. **Triage** (T1): ئایا تاسک ساکارە؟ → ئەگەر بەڵێ، T1 بکە کاری
٢. **Plan** (T2): شیکار + پلان
٣. **Execute** (T2): کۆد بنووسە
٤. **Verify** (T1): تێست بکە، ئیرۆر چاودێری
٥. **Reflect** (T1): فێربوون extract بکە

## ❌ Anti-patterns
- ❌ T3 بۆ هەموو شت
- ❌ T1 بۆ architecture (low quality)
- ❌ بێ triage مۆدێل هەڵبژاردن

## Verification
دوای پایان، بپرسە:
- ئایا T2 بەسە بوو لەباتی T3؟
- ئایا regex بەسە بوو لەباتی LLM؟

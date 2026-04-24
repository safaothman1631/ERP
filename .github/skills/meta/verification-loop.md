# Skill: Verification Loop

> Plan → Act → Verify → Reflect

## Loop Steps

### 1. Plan
- بیرۆکە بە جزئیات بنووسە
- چ فایلانە دەسکاری دەکرێن؟
- چ تێستانە بۆ verify ـی هەن؟
- خەتەرەکان (risks): چ بەشانە دەشکێن؟

### 2. Act
- کەمترین گۆڕانکاری پێویست بکە
- یەک focus area لە کاتێکدا
- توڵە‌کانی تۆ هەلبژێرە (read_file، replace_string_in_file، etc.)

### 3. Verify
- هەموو فایلی دەستکاری کراو ـی پشکنە (read_file)
- Backend: `test_all.py`
- Frontend: `npm run build`
- Lint: `get_errors`
- Manual smoke test (ئەگەر pages)

### 4. Reflect
- ئایا objective هاتە دیست؟
- ئایا regression ـی نوێ هەیە؟
- چی فێرم بوو؟ → memory ـی session/repo نوێ بکە
- ئەگەر pattern نوێ، skill ـی نوێ بنووسە (Sprint 7: شادۆ سکیڵ‌میکەر)

## ❌ Anti-pattern: Plan & Pray
- ❌ "ئەمە دەکات" بێ verify
- ❌ assume کۆد کاردەکات بێ تێست
- ❌ commit بێ build

## ❌ Anti-pattern: Endless Loop
- ئەگەر سێ هەوڵ شکستی هێنا → بوەستە، approach گۆڕە یان پرسیار بکە
- نا brute-force

## Memory Integration
- session memory (`/memories/session/`): پلانی ئێستا
- repo memory (`/memories/repo/`): فاکتی verified
- user memory (`/memories/`): pattern ـی گشتی + lesson

# Skill: Token Optimization

## ١٠ ڕێگەی ئاسایی بۆ کەمکردنەوەی token

### 1. Targeted reads
```
❌ read_file file=X startLine=1 endLine=2000
✅ grep_search "pattern" → read_file startLine=N endLine=N+50
```

### 2. Parallel calls
```
✅ multi-tool block: read A + B + C + grep_search D
```

### 3. Cache awareness
ئەگەر فایل لە conversation خوێندراوەتەوە و نەگۆڕاوە، نا re-read.

### 4. Compact summaries
لەباتی پارگراف، bullet کورت.

### 5. Symbol-only mode
بۆ overview، signatures تەنها.

### 6. Subagent delegation
Task گەورە → `runSubagent`، context کم دەگەڕێتەوە.

### 7. Skip irrelevant files
Use `excludePattern` لە search.

### 8. Stop early
ئەگەر یەکەم چەند result بەسە، نا maxResults زیاد بکە.

### 9. Memory-first
پێش read، `/memories/` بپشکنە — لەوانەیە summary لەبەردەست بێت.

### 10. Avoid re-explanation
ئاکسێشن بکە (tool call)، لەباتی توضیحی درێژ.

## Anti-patterns
- ❌ Reading whole files when only one function needed
- ❌ Sequential when parallel possible
- ❌ Re-reading unchanged files
- ❌ Verbose narration before tool call

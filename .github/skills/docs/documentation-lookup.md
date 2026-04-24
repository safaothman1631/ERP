# Skill: Documentation Lookup

## فەلسەفە
کۆد بنووسە لەسەر **fact**، نا assumption.

## Lookup Order

1. **In-context:** ئایا لە conversation پێشتر دیتراوە؟
2. **Memory:** `/memories/repo/`، `/memories/`
3. **Local cache:** `.github/docs-cache/<lib>-<version>.md`
4. **Live fetch:** `fetch_webpage` بۆ official docs
5. **GitHub:** `github_repo` بۆ example کۆد

## Tools

### fetch_webpage
```
✅ بۆ docs page ـی دیار (URL exists)
❌ بۆ گەڕانی گشتی (هەرگیز URL guess مەکە)
```

### github_repo
```
✅ بۆ ڕێکخراوی دیار: "facebook/react"، "ant-design/ant-design"
❌ بۆ private repo (لە دەست تۆدا نییە)
```

## Cache Format

`.github/docs-cache/antd-6.3.md`:
```markdown
# AntD 6.3 — Reference Cache

## Divider
- ❌ `orientation="left"` (لابرا)
- ✅ `titlePlacement="start" | "center" | "end"`

## Tag
- ❌ `size` prop (لابرا)
- ✅ `<Tag color="blue">label</Tag>` تەنها

## Last verified: 2026-04-22
```

## Best Practices

- **Specific query:** "AntD 6 Divider titlePlacement" نا "AntD docs"
- **Save findings:** هەر کات live fetch، cache نوێ بکە
- **Date metadata:** هەمیشە "Last verified: <date>"
- **Cross-reference:** ئەگەر skill-ـی پەیوەست هەیە، link بدە

## When NOT to lookup
- API ـی basic Python/JavaScript (لانیکەم memorize)
- pattern ـی repo-specific (لە کۆدی project)
- conversation context-ـدا دیترا

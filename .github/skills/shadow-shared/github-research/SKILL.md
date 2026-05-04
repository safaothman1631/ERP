# SKILL: GitHub Research

> Use this skill when you need to find best-in-class repos, patterns, and examples on GitHub before planning or implementing.

## Search Strategy

### 1. By stars + recency
```
language:typescript stars:>5000 pushed:>2024-01-01 <topic>
```

### 2. By file path (find specific patterns)
```
path:**/middleware.ts <pattern>
path:**/.github/workflows/ <action>
filename:rls.sql
```

### 3. By topic
```
topic:nextjs topic:supabase stars:>500
```

### 4. Official examples
- vercel/next.js → /examples
- supabase/supabase → /examples
- shadcn-ui/ui → registry
- t3-oss/create-t3-app

## Evaluation Criteria

When you find a repo, score it:
- ⭐ **Stars** > 1000 (signal quality)
- 🔄 **Last commit** < 6 months (maintained)
- 📝 **README** clarity
- 🧪 **Tests** present
- 📜 **License** permissive (MIT، Apache 2.0)
- 👥 **Contributors** > 5

## Patterns to Extract
- folder structure
- naming conventions
- CI/CD pipeline
- testing setup
- error handling
- type patterns
- README structure

## Output Format

```markdown
## Top 3 References
1. **owner/repo** (12k ⭐، active)
   - Pattern: ...
   - Why useful: ...
   - File to check: `path/to/file`
2. ...
```

## Awesome Lists
- awesome-nextjs، awesome-react، awesome-nodejs
- awesome-typescript، awesome-rust
- awesome-selfhosted
- awesome-llm-apps

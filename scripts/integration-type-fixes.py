#!/usr/bin/env python3
"""Apply small, checked TypeScript fixes identified by integration CI.

This script edits only source files, never database data or build config.
Every edit asserts its expected occurrence count to avoid broad silent rewrites.
Run on integration branch; validate with full Vite build and tsc before commit.
"""
from pathlib import Path
import re

changed = []

def exact(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    found = text.count(old)
    if found != count:
        raise RuntimeError(f"{path}: expected {count} matches, found {found} for {old!r}")
    file.write_text(text.replace(old, new))
    if path not in changed: changed.append(path)
    print(f"Updated {path}: {count} exact replacement(s)")

def regex(path: str, pattern: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    edited, found = re.subn(pattern, new, text, flags=re.DOTALL)
    if found != count:
        raise RuntimeError(f"{path}: expected {count} regex matches, found {found} for {pattern!r}")
    file.write_text(edited)
    if path not in changed: changed.append(path)
    print(f"Updated {path}: {count} pattern replacement(s)")

exact("src/components/site.tsx", '<Link to={`/join?plan=${plan.id}`}>', '<a href={`/join?plan=${encodeURIComponent(plan.id)}`}>')
exact("src/components/site.tsx", 'Choose plan <ArrowRight />\n        </Link>', 'Choose plan <ArrowRight />\n        </a>')
exact("src/lib/supabase.ts", 'import.meta.env.VITE_SUPABASE_URL', 'import.meta.env["VITE_SUPABASE_URL"]')
exact("src/lib/supabase.ts", 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY', 'import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]')
regex("src/routes/blog.tsx", r'\.from\("blog_posts"\)\s*\.select\(\s*`\s*id,\s*title,\s*slug,\s*excerpt,\s*content,\s*featured_image,\s*category,\s*author_name,\s*status,\s*featured,\s*published_at,\s*created_at,\s*updated_at\s*`\s*,?\s*\)', '.from("blog_posts")\n      .select("id,title,slug,excerpt,content,featured_image,category,author_name,status,featured,published_at,created_at,updated_at")')
exact("src/routes/join.tsx", ') || membershipPlans[0],', ') || membershipPlans[0]!,')
exact("src/routes/management-communications.tsx", '=> values[key]);', '=> values[key] ?? "");')
for field in ["revenue_excluded", "record_type"]:
    exact("src/routes/management-preview.tsx", f'payment.metadata?.{field}', f'payment.metadata?.["{field}"]')
for field in ["payment_method", "payment_source", "provider"]:
    exact("src/routes/management-revenue.tsx", f'meta.{field}', f'meta["{field}"]')
for field in ["plan_name", "revenue_excluded", "record_type"]:
    exact("src/routes/management-revenue.tsx", f'payment.metadata?.{field}', f'payment.metadata?.["{field}"]')
exact("src/routes/management-staff-monthly.tsx", 'rows[0].checked_in_at', 'rows[0]!.checked_in_at', 2)
exact("src/routes/management-staff-review.tsx", 'rows[0].checked_in_at', 'rows[0]!.checked_in_at', 2)
exact("src/routes/management-staff.tsx", 'clock(first.checked_in_at)', 'clock(first!.checked_in_at)')
exact("src/routes/management-standard-plan.tsx", '|| receptionPlans[2];', '|| receptionPlans[0]!;')
exact("src/routes/management-standard-plan.tsx", 'duplicates[0].full_name', 'duplicates[0]!.full_name')
exact("src/routes/member.tsx", 'const [year, month, day] =', 'const [year = 0, month = 0, day = 0] =', 2)
for index in range(3):
    exact("src/routes/member.tsx", f'todayParts[{index}]', f'(todayParts[{index}] ?? 0)')
for index in range(3):
    exact("src/routes/payment.callback.tsx", f'parts[{index}]', f'parts[{index}]!')
regex("src/routes/reception-dashboard.tsx", r'\.select\(\s*`\s*id,\s*member_id,\s*checked_in_at,\s*checked_out_at,\s*created_at,\s*member:members \(\s*full_name,\s*phone\s*\)\s*`\s*,?\s*\)', '.select("id,member_id,checked_in_at,checked_out_at,created_at,member:members(full_name,phone)")', 2)
exact("src/routes/reception-dashboard.tsx", 'selectedAddMembershipPlan.name', 'selectedAddMembershipPlan!.name')
for field in ["plan_name", "full_name", "payment_method", "payment_source", "provider", "revenue_excluded", "record_type"]:
    exact("src/routes/staff-admin.tsx", f'payment.metadata?.{field}', f'payment.metadata?.["{field}"]')
exact("src/routes/staff-attendance.tsx", '      return () => window.clearTimeout(timer);\n    }\n  }, [authorized]);', '      return () => window.clearTimeout(timer);\n    }\n    return undefined;\n  }, [authorized]);')
print(f"Checked source edits completed in {len(changed)} files: {', '.join(changed)}")

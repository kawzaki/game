---
description: Full DevSecOps loop — from requirements to UAT
---

# 🚀 New Feature DevSecOps Workflow

This workflow manages the full development lifecycle: requirements → planning → implementation → security → testing → UAT.

---

## STEP 1 — Read Project Context
// turbo
1. Read `CONTEXT.md` in the project root to load all project knowledge before doing anything else.

---

## STEP 2 — Requirements Discovery
Ask the user the following questions (as a numbered list in one message):

1. **What do you want to build?** Describe the feature or change.
2. **Who is the user?** (admin, end user, guest, etc.)
3. **Any constraints?** (must use existing DB tables, must be bilingual, specific UI pattern, etc.)
4. **Priority?** (critical bug fix / enhancement / new feature)

Wait for the user's answers before proceeding.

---

## STEP 3 — Planning
Create `implementation_plan.md` in the artifacts directory with:
- A clear description of the feature
- Proposed file changes (grouped by component)
- Database migrations needed (if any)
- Security considerations
- Verification plan

Use `notify_user` to request plan review. **Do NOT write code until the user approves the plan.**

---

## STEP 4 — Implementation
After plan approval:

1. Write database migrations (if needed) and run them
2. Write models / controllers / services
3. Write views / Inertia components / Blade templates
4. Write routes
5. Update language files (`lang/ar.json`, `lang/en.json`) if the project is bilingual
6. Update admin panel resources (if the project uses Filament)

---

## STEP 5 — Security Checks
Run the following before testing:

// turbo
1. Check for SQL injection risks — ensure all queries use Eloquent or parameterized bindings
// turbo
2. Check for missing auth middleware on new routes: `php artisan route:list | grep -v middleware`
// turbo
3. Check for exposed sensitive data in API responses
4. Ensure file uploads (if any) validate MIME type and size
5. Confirm CSRF protection is active on all forms

Flag any issues found and fix them before proceeding.

---

## STEP 6 — Automated Testing
// turbo
1. Run `php artisan test` (or `php artisan test --filter=FeatureName`)
2. Fix any test failures before proceeding
3. If no tests exist for the new feature, create at least one basic feature test

---

## STEP 7 — UAT Gate
Use `notify_user` with `BlockedOnUser: true` to notify the user:

> **✅ Ready for UAT**
>
> The feature is implemented and all automated checks passed. Please test the following:
> - [List specific user scenarios to test, based on the requirements from Step 2]
> - [Include the local or live URL to test at]
>
> Let me know if anything needs fixing, or confirm **"approved"** to proceed to deployment.

Wait for user confirmation before deploying.

---

## STEP 8 — Deployment
After UAT approval:

// turbo
1. Run `git add . && git commit -m "feat: [description]" && git push origin main`
2. Monitor GitHub Actions for deployment success
3. Verify the feature is live at the production URL

---

## STEP 9 — Walkthrough
Create `walkthrough.md` in the artifacts directory summarizing:
- What was built
- Files changed
- Test results
- Live URL where the feature can be verified

Notify the user that the feature is live.

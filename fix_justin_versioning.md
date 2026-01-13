# Fixing just:in mac pro Version Numbering

## The Problem

just:in mac pro changed their version numbering scheme mid-stream:

**Old scheme (2024 and earlier):**
- 3.5.0.GM.828
- 4.0.2.GM.956
- 5.5.0.GM.1092
- 6.5.0.GM.1258

**New scheme (2025):**
- 2025.1.GM.1289
- 2025.3.2.GM.1357
- v.2025.3

### Why It Breaks

The semantic version comparison sees:
- "6.5.0" > "2025.1" (comparing as numbers: 6 > 2)
- So it thinks version 6.5.0.GM.1258 (old) is "current" instead of 2025.3.2.GM.1357 (new)

## The Solution: Use Manual Override

I just added the **manual override button** (star icon) to the release notes dialog!

### How to Fix it:

1. **Open the release notes dialog** for just:in mac pro
2. **Select the correct current version** from the dropdown:
   - Either `2025.3.2.GM.1357` or `v.2025.3` (whichever is actually newest)
3. **Click the star button** ⭐ that appears next to the delete button
4. This sets `is_current_override = true` for that version
5. **The system will now always treat this as current**, regardless of semantic versioning

### What Happens After Override

- The overridden version will be marked as (Current) in the dropdown
- All version calculations will prioritize the manual override
- Future scrapes won't change it unless you remove the override
- The system will show this version in:
  - Software list
  - Digest emails
  - Version audit
  - Everywhere else

### To Remove Override Later

If you want to go back to automatic detection:
1. Open release notes for the software
2. Select the overridden version
3. Delete it and re-add it (without clicking star)
   OR
4. Run this SQL:
   ```sql
   UPDATE software_version_history
   SET is_current_override = FALSE
   WHERE software_id = '0f04c82e-55c2-429d-af48-ad171a8b39ad'
   AND is_current_override = TRUE;
   ```

## Check Current Data

Run this to see all versions and which should be current:

```sql
SELECT
  version,
  release_date,
  detected_at,
  is_current_override,
  newsletter_verified,
  created_at
FROM software_version_history
WHERE software_id = '0f04c82e-55c2-429d-af48-ad171a8b39ad'
ORDER BY created_at DESC;
```

## Alternative: Delete Old Versions

If the old versions (3.x - 6.x) are no longer relevant, you could delete them:

1. Open release notes dialog
2. Select each old version (3.5.0.GM.828, 4.0.2.GM.956, etc.)
3. Click the delete button
4. Once only 2025.x versions remain, semantic versioning will work correctly

This is cleaner than manual override if the old versions are truly obsolete.

# UI Changes Needed for Manual Version Override

## Release Notes Dialog (`src/components/admin/software/release-notes-dialog.tsx`)

The following changes need to be made to add the "Set as Current Version" button:

### 1. Update imports (line ~22-24):
```typescript
import { addVersionHistory, getVersionHistory, deleteVersionHistory, setVersionAsCurrent } from '@/lib/software/api/api';
import { Plus, Upload, Link as LinkIcon, Loader2, Check, X, ChevronDown, ChevronUp, Trash2, Star } from 'lucide-react';
```

### 2. Add interface for version history with override (after line ~38):
```typescript
interface VersionHistoryWithOverride {
  id: string;
  version: string;
  notes: any;
  type: string;
  release_date: string;
  is_current_override?: boolean;
  newsletter_verified?: boolean;
}
```

### 3. Update state types (line ~59):
```typescript
const [versionHistory, setVersionHistory] = useState<VersionHistoryWithOverride[]>([]);
const [settingCurrent, setSettingCurrent] = useState(false);
```

### 4. Add handleSetAsCurrent function (before handleDeleteVersion, around line ~193):
```typescript
const handleSetAsCurrent = async () => {
  let versionToSet = selectedVersion;
  if (selectedVersion === 'current') {
    versionToSet = software.current_version || '';
  }

  const versionEntry = versionHistory.find(v => v.version === versionToSet);
  if (!versionEntry) {
    toast.error('Version not found');
    return;
  }

  if (!confirm(`Set version ${versionToSet} as the current version? This will override automatic version detection.`)) {
    return;
  }

  setSettingCurrent(true);
  try {
    const success = await setVersionAsCurrent(versionEntry.id, software.id);
    if (success) {
      const history = await getVersionHistory(software.id);
      setVersionHistory(history);
      await onSuccess();
    }
  } finally {
    setSettingCurrent(false);
  }
};
```

### 5. Update the button section (around line ~462-478):
Replace the single delete button with both a "Set as Current" button and delete button:

```typescript
{selectedVersion !== 'new' && (
  <>
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleSetAsCurrent}
      disabled={settingCurrent}
      title="Set as current version (manual override)"
    >
      {settingCurrent ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Star className={`h-4 w-4 ${versionHistory.find(v => v.version === (selectedVersion === 'current' ? software.current_version : selectedVersion))?.is_current_override ? 'fill-yellow-400 text-yellow-400' : ''}`} />
      )}
    </Button>
    <Button
      type="button"
      variant="destructive"
      size="icon"
      onClick={handleDeleteVersion}
      disabled={deleting}
      title="Delete this version"
    >
      {deleting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </Button>
  </>
)}
```

### 6. Add override indicator (after the version selection, around line ~482):
```typescript
{/* Show indicator if this version has manual override */}
{selectedVersion !== 'new' && versionHistory.find(v => v.version === (selectedVersion === 'current' ? software.current_version : selectedVersion))?.is_current_override && (
  <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1 mt-1">
    <Star className="h-3 w-3 fill-current" />
    Manually set as current version (overrides automatic detection)
  </p>
)}
```

## How It Works:

1. **Star Button**: Click to manually set a version as "current"
2. **Yellow Star**: Indicates a version has manual override active
3. **Indicator Text**: Shows below version selector when manual override is active
4. **Database Trigger**: Automatically clears other manual overrides for the same software

This allows admins to override automatic version detection for edge cases (like name-based versions or incorrect semantic parsing).

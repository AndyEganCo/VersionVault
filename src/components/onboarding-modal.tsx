import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Package, Bell, CheckCircle2, Loader2, User, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { getSoftwareList } from '@/lib/software/api/api';
import { toggleSoftwareTracking } from '@/lib/software/utils/tracking';
import { updateUserSettings, NotificationFrequency } from '@/lib/settings';
import { Software } from '@/lib/software/types';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

type Step = 1 | 2 | 3 | 4;

// Common US timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];

export function OnboardingModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);

  // Step 1 state
  const [name, setName] = useState('');

  // Step 2 state
  const [software, setSoftware] = useState<Software[]>([]);
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const [versionVaultId, setVersionVaultId] = useState<string | null>(null);

  // Step 3 state
  const [selectedFrequency, setSelectedFrequency] = useState<NotificationFrequency>('weekly');
  const [selectedTimezone, setSelectedTimezone] = useState('America/New_York');

  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user) return;

      // Check if user should see onboarding (stored in database)
      const { data: userData } = await supabase
        .from('users')
        .select('show_onboarding')
        .eq('id', user.id)
        .single();

      // Only show if show_onboarding is true
      if (userData?.show_onboarding === true) {
        setIsOpen(true);
      }
    };

    checkOnboarding();
  }, [user]);

  useEffect(() => {
    // Load software list when modal opens and we're on step 2
    if (isOpen && currentStep === 2 && software.length === 0) {
      loadSoftware();
    }
  }, [isOpen, currentStep]);

  const loadSoftware = async () => {
    setLoading(true);
    try {
      const allSoftware = await getSoftwareList();

      // Load existing tracked software for this user
      let existingTrackedIds = new Set<string>();
      if (user) {
        const { data: tracked } = await supabase
          .from('tracked_software')
          .select('software_id')
          .eq('user_id', user.id);

        if (tracked) {
          existingTrackedIds = new Set(tracked.map(t => t.software_id));
          setTrackedIds(existingTrackedIds);
        }
      }

      // Find VersionVault
      const vv = allSoftware.find(s =>
        s.name.toLowerCase().includes('versionvault') ||
        s.name.toLowerCase().includes('version vault')
      );

      if (vv) {
        setVersionVaultId(vv.id);
        // Auto-track VersionVault if not already tracked
        if (user && !existingTrackedIds.has(vv.id)) {
          await toggleSoftwareTracking(user.id, vv.id, true);
          setTrackedIds(prev => new Set([...prev, vv.id]));
        }
      }

      // Get popular software (filter out VersionVault, take top 10 by name)
      const popular = allSoftware
        .filter(s => s.id !== vv?.id)
        .slice(0, 10);

      setSoftware(popular);
    } catch (error) {
      console.error('Error loading software:', error);
      toast.error('Failed to load software catalog');
    } finally {
      setLoading(false);
    }
  };

  const handleTrackingToggle = async (softwareId: string, tracked: boolean) => {
    if (!user) return;

    const success = await toggleSoftwareTracking(user.id, softwareId, tracked);
    if (success) {
      setTrackedIds(prev => {
        const next = new Set(prev);
        if (tracked) {
          next.add(softwareId);
        } else {
          next.delete(softwareId);
        }
        return next;
      });
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const handleFinish = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Save display name and mark onboarding as complete
      const { error: nameError } = await supabase
        .from('users')
        .update({
          display_name: name,
          show_onboarding: false
        })
        .eq('id', user.id);

      if (nameError) {
        console.error('Error saving display name:', nameError);
        throw nameError;
      }

      // Save digest frequency
      await updateUserSettings(user.id, 'notificationFrequency', selectedFrequency);

      // Save timezone
      await updateUserSettings(user.id, 'timezone', selectedTimezone);

      toast.success('Setup complete! Welcome to VersionVault.');

      // Close modal
      setIsOpen(false);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  // Don't count VersionVault in the manual tracking requirement
  const manualTrackedCount = versionVaultId
    ? Array.from(trackedIds).filter(id => id !== versionVaultId).length
    : trackedIds.size;

  const canContinueFromStep1 = name.trim().length >= 2;
  const canContinueFromStep2 = manualTrackedCount >= 1;

  const handleClose = () => {
    // Mark onboarding as dismissed (won't show again)
    if (user) {
      supabase
        .from('users')
        .update({
          display_name: name.trim() || 'User',
          show_onboarding: false
        })
        .eq('id', user.id)
        .then(() => {
          console.log('Onboarding dismissed');
        });
    }
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        {/* Step 1: Welcome + Name */}
        {currentStep === 1 && (
          <>
            <DialogHeader>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
                <User className="h-8 w-8 text-blue-500" />
              </div>
              <DialogTitle className="text-center text-2xl">
                Welcome to VersionVault!
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-center text-muted-foreground">
                Let's get you set up in just a few quick steps.
              </p>

              <div className="space-y-2">
                <Label htmlFor="name">What should we call you?</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  minLength={2}
                />
                <p className="text-xs text-muted-foreground">
                  We'll use this to personalize your experience.
                </p>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <p className="text-sm">
                  <strong>Here's the quick version:</strong>
                </p>
                <ul className="text-sm space-y-1 ml-4 list-disc text-muted-foreground">
                  <li>Pick software to track</li>
                  <li>Get emails with new versions</li>
                  <li>Choose daily, weekly, or monthly digests</li>
                </ul>
              </div>
            </div>
            <div className="flex justify-center">
              <Button onClick={handleNext} disabled={!canContinueFromStep1}>
                Continue
              </Button>
            </div>
          </>
        )}

        {/* Step 2: Track Software */}
        {currentStep === 2 && (
          <>
            <DialogHeader>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <Package className="h-8 w-8 text-green-500" />
              </div>
              <DialogTitle className="text-center text-2xl">
                Track Your Software
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-center text-muted-foreground">
                We've auto-tracked VersionVault for you. Pick at least 1 more software to track.
              </p>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {versionVaultId && (
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-green-500/5 border-green-500/20">
                      <div className="flex-1">
                        <p className="font-medium text-sm">VersionVault</p>
                        <p className="text-xs text-muted-foreground">Auto-tracked ✓</p>
                      </div>
                      <Switch checked disabled />
                    </div>
                  )}

                  {software.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {item.category}
                          </Badge>
                          {item.current_version && (
                            <span className="text-xs text-muted-foreground">
                              v{item.current_version}
                            </span>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={trackedIds.has(item.id)}
                        onCheckedChange={(checked) => handleTrackingToggle(item.id, checked)}
                      />
                    </div>
                  ))}
                </div>
              )}

              <p className="text-sm text-center text-muted-foreground">
                Tracked: {manualTrackedCount} {manualTrackedCount === 1 ? 'item' : 'items'}
                {manualTrackedCount === 0 && ' (track at least 1 to continue)'}
              </p>
            </div>
            <div className="flex justify-center">
              <Button onClick={handleNext} disabled={!canContinueFromStep2}>
                Continue
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Digest Frequency + Timezone */}
        {currentStep === 3 && (
          <>
            <DialogHeader>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10">
                <Bell className="h-8 w-8 text-purple-500" />
              </div>
              <DialogTitle className="text-center text-2xl">
                Email Preferences
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Frequency Selection */}
              <div className="space-y-3">
                <Label>How often should we email you?</Label>
                <div className="space-y-2">
                  {[
                    { value: 'daily' as NotificationFrequency, label: 'Daily', desc: 'Get updates every day' },
                    { value: 'weekly' as NotificationFrequency, label: 'Weekly', desc: 'Updates once a week (recommended)' },
                    { value: 'monthly' as NotificationFrequency, label: 'Monthly', desc: 'Monthly digest of updates' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedFrequency(option.value)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedFrequency === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{option.label}</p>
                          <p className="text-sm text-muted-foreground">{option.desc}</p>
                        </div>
                        {selectedFrequency === option.value && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Timezone Selection */}
              <div className="space-y-3">
                <Label htmlFor="timezone">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <span>Your Timezone</span>
                  </div>
                </Label>
                <select
                  id="timezone"
                  value={selectedTimezone}
                  onChange={(e) => setSelectedTimezone(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  We'll send emails based on your timezone.
                </p>
              </div>
            </div>
            <div className="flex justify-center">
              <Button onClick={handleNext}>
                Continue
              </Button>
            </div>
          </>
        )}

        {/* Step 4: Success */}
        {currentStep === 4 && (
          <>
            <DialogHeader>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <DialogTitle className="text-center text-2xl">
                You're All Set, {name}!
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-center text-muted-foreground">
                Here's what we've set up for you:
              </p>

              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="font-medium text-sm mb-2">📦 Tracking Software</p>
                  <p className="text-sm text-muted-foreground">
                    {trackedIds.size} software {trackedIds.size === 1 ? 'item' : 'items'} tracked
                  </p>
                </div>

                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="font-medium text-sm mb-2">🔔 Email Digest</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedFrequency.charAt(0).toUpperCase() + selectedFrequency.slice(1)} updates
                  </p>
                </div>

                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="font-medium text-sm mb-2">🌍 Timezone</p>
                  <p className="text-sm text-muted-foreground">
                    {TIMEZONES.find(tz => tz.value === selectedTimezone)?.label}
                  </p>
                </div>
              </div>

              <p className="text-sm text-center text-muted-foreground">
                You can always change these settings from your profile or notifications page.
              </p>
            </div>
            <div className="flex justify-center">
              <Button onClick={handleFinish} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Go to Dashboard'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, Edit, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface VersionCheck {
  id: string;
  software_id: string;
  version: string | null;
  confidence_score: number | null;
  validation_notes: string | null;
  software: {
    name: string;
    manufacturer: string;
  };
}

export function VersionReviewWidget() {
  const [pendingReviews, setPendingReviews] = useState<VersionCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedVersion, setEditedVersion] = useState('');

  useEffect(() => {
    loadPendingReviews();
  }, []);

  async function loadPendingReviews() {
    try {
      const { data, error } = await supabase
        .from('software_version_history')
        .select(`
          id,
          software_id,
          version,
          confidence_score,
          validation_notes,
          software:software_id (
            name,
            manufacturer
          )
        `)
        .eq('requires_manual_review', true)
        .order('checked_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setPendingReviews(data || []);
    } catch (error) {
      console.error('Error loading pending reviews:', error);
    } finally {
      setLoading(false);
    }
  }

  async function approveVersion(checkId: string) {
    try {
      const { error } = await supabase
        .from('software_version_history')
        .update({
          requires_manual_review: false,
          validation_notes: 'Manually approved by admin'
        })
        .eq('id', checkId);

      if (error) throw error;
      setPendingReviews(prev => prev.filter(v => v.id !== checkId));
    } catch (error) {
      console.error('Error approving version:', error);
    }
  }

  async function rejectVersion(checkId: string) {
    try {
      const { error } = await supabase
        .from('software_version_history')
        .delete()
        .eq('id', checkId);

      if (error) throw error;
      setPendingReviews(prev => prev.filter(v => v.id !== checkId));
    } catch (error) {
      console.error('Error rejecting version:', error);
    }
  }

  async function saveEdit(checkId: string) {
    try {
      const { error } = await supabase
        .from('software_version_history')
        .update({
          version: editedVersion || null,
          requires_manual_review: false,
          confidence_score: 100
        })
        .eq('id', checkId);

      if (error) throw error;
      setPendingReviews(prev => prev.filter(v => v.id !== checkId));
      setEditingId(null);
    } catch (error) {
      console.error('Error saving edit:', error);
    }
  }

  if (loading) return null;
  if (pendingReviews.length === 0) return null;

  return (
    <Card className="mb-6 border-yellow-200 bg-yellow-50">
      <div className="p-4">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <span className="font-semibold text-yellow-900">
              {pendingReviews.length} version{pendingReviews.length !== 1 ? 's' : ''} need review
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Review
                </>
              )}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-3">
            {pendingReviews.map((check) => (
              <div key={check.id} className="bg-white p-3 rounded border">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium">{check.software.name}</div>
                    <div className="text-sm text-muted-foreground">
                      by {check.software.manufacturer}
                    </div>
                  </div>
                  {check.confidence_score !== null && (
                    <Badge variant={check.confidence_score < 50 ? 'destructive' : 'secondary'}>
                      {check.confidence_score}%
                    </Badge>
                  )}
                </div>

                {editingId === check.id ? (
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={editedVersion}
                      onChange={(e) => setEditedVersion(e.target.value)}
                      placeholder="Version"
                      className="h-8"
                    />
                    <Button size="sm" onClick={() => saveEdit(check.id)}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="text-sm mb-2">
                      <span className="text-muted-foreground">Version: </span>
                      {check.version || (
                        <span className="italic text-muted-foreground">None</span>
                      )}
                    </div>
                    {check.validation_notes && (
                      <div className="text-xs text-muted-foreground mb-2 p-2 bg-muted rounded">
                        {check.validation_notes}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approveVersion(check.id)}>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(check.id);
                          setEditedVersion(check.version || '');
                        }}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectVersion(check.id)}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

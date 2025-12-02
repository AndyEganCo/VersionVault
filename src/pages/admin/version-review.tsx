import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Edit, ExternalLink, AlertTriangle } from 'lucide-react';

interface VersionCheck {
  id: string;
  software_id: string;
  checked_at: string;
  current_version: string | null;
  release_date: string | null;
  confidence_score: number | null;
  validation_notes: string | null;
  requires_manual_review: boolean;
  extraction_method: string | null;
  software: {
    name: string;
    manufacturer: string;
    version_url: string;
    website: string;
  };
}

export function AdminVersionReview() {
  const [pendingReviews, setPendingReviews] = useState<VersionCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedVersion, setEditedVersion] = useState('');
  const [editedDate, setEditedDate] = useState('');
  const [editNotes, setEditNotes] = useState('');

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
          checked_at,
          current_version,
          release_date,
          confidence_score,
          validation_notes,
          requires_manual_review,
          extraction_method,
          software:software_id (
            name,
            manufacturer,
            version_url,
            website
          )
        `)
        .eq('requires_manual_review', true)
        .order('checked_at', { ascending: false })
        .limit(50);

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

      // Remove from pending list
      setPendingReviews(prev => prev.filter(v => v.id !== checkId));
    } catch (error) {
      console.error('Error approving version:', error);
      alert('Failed to approve version');
    }
  }

  async function rejectVersion(checkId: string) {
    try {
      const { error } = await supabase
        .from('software_version_history')
        .delete()
        .eq('id', checkId);

      if (error) throw error;

      // Remove from pending list
      setPendingReviews(prev => prev.filter(v => v.id !== checkId));
    } catch (error) {
      console.error('Error rejecting version:', error);
      alert('Failed to reject version');
    }
  }

  async function saveEdit(checkId: string) {
    try {
      const { error } = await supabase
        .from('software_version_history')
        .update({
          current_version: editedVersion || null,
          release_date: editedDate || null,
          validation_notes: editNotes || null,
          requires_manual_review: false,
          confidence_score: 100 // Manual edit = 100% confidence
        })
        .eq('id', checkId);

      if (error) throw error;

      // Remove from pending list
      setPendingReviews(prev => prev.filter(v => v.id !== checkId));
      setEditingId(null);
    } catch (error) {
      console.error('Error saving edit:', error);
      alert('Failed to save changes');
    }
  }

  function startEdit(check: VersionCheck) {
    setEditingId(check.id);
    setEditedVersion(check.current_version || '');
    setEditedDate(check.release_date || '');
    setEditNotes(check.validation_notes || '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditedVersion('');
    setEditedDate('');
    setEditNotes('');
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading pending reviews...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Manual Version Review</h1>
        <p className="text-muted-foreground">
          Review and approve low-confidence version extractions
        </p>
      </div>

      {pendingReviews.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h2 className="text-xl font-semibold mb-2">All Clear!</h2>
          <p className="text-muted-foreground">
            No versions currently require manual review.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <span className="font-semibold">{pendingReviews.length} versions pending review</span>
          </div>

          {pendingReviews.map((check) => (
            <Card key={check.id} className="p-6">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">{check.software.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      by {check.software.manufacturer}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {check.confidence_score !== null && (
                      <Badge
                        variant={check.confidence_score < 50 ? 'destructive' : 'secondary'}
                      >
                        {check.confidence_score}% confidence
                      </Badge>
                    )}
                    {check.extraction_method && (
                      <Badge variant="outline">{check.extraction_method}</Badge>
                    )}
                  </div>
                </div>

                {/* Links */}
                <div className="flex gap-4 text-sm">
                  <a
                    href={check.software.version_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Version URL
                  </a>
                  <a
                    href={check.software.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Website
                  </a>
                </div>

                {/* Edit Mode */}
                {editingId === check.id ? (
                  <div className="space-y-4 border-t pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Version</label>
                        <Input
                          value={editedVersion}
                          onChange={(e) => setEditedVersion(e.target.value)}
                          placeholder="e.g., 5.4.2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Release Date
                        </label>
                        <Input
                          type="date"
                          value={editedDate}
                          onChange={(e) => setEditedDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Notes</label>
                      <Textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Add notes about this manual review..."
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => saveEdit(check.id)}>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Save Changes
                      </Button>
                      <Button variant="outline" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Display Mode */}
                    <div className="border-t pt-4">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <span className="text-sm font-medium">Extracted Version:</span>
                          <p className="text-lg">
                            {check.current_version || (
                              <span className="text-muted-foreground italic">None</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium">Release Date:</span>
                          <p className="text-lg">
                            {check.release_date || (
                              <span className="text-muted-foreground italic">Unknown</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {check.validation_notes && (
                        <div className="mb-4 p-3 bg-muted rounded">
                          <span className="text-sm font-medium">Validation Notes:</span>
                          <p className="text-sm mt-1">{check.validation_notes}</p>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        Checked: {new Date(check.checked_at).toLocaleString()}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 border-t pt-4">
                      <Button
                        onClick={() => approveVersion(check.id)}
                        variant="default"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => startEdit(check)}
                        variant="outline"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => rejectVersion(check.id)}
                        variant="destructive"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

export async function storeVersion(softwareId: string, version: string): Promise<void> {
  const { error } = await supabase
    .from('software_versions')
    .upsert({
      software_id: softwareId,
      version: version,
      detected_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error storing version:', error);
    throw error;
  }
}
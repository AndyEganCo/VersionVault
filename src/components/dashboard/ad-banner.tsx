import { useEffect, useRef } from 'react';

interface AdBannerProps {
  /**
   * AdSense data-ad-slot ID
   * Get this from your AdSense dashboard after creating an ad unit
   */
  dataAdSlot?: string;
  /**
   * Whether to show the ad (can be toggled based on user subscription status)
   */
  show?: boolean;
}

export function AdBanner({ dataAdSlot, show = true }: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (show && adRef.current) {
      try {
        // @ts-ignore - adsbygoogle is loaded from external script
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (err) {
        console.error('AdSense error:', err);
      }
    }
  }, [show]);

  if (!show) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="text-xs text-muted-foreground text-center mb-2">
        Advertisement
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client="ca-pub-5667174195737969"
          data-ad-slot={dataAdSlot}
          data-ad-format="horizontal"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}

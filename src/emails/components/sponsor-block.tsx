import {
  Section,
  Text,
  Link,
  Img,
} from '@react-email/components';
import type { SponsorData } from '../../lib/newsletter/types';

interface SponsorBlockProps {
  sponsor: SponsorData;
}

export function SponsorBlock({ sponsor }: SponsorBlockProps) {
  return (
    <Section style={sponsorSection}>
      <Text style={sponsorLabel}>SPONSOR</Text>

      <Link href={sponsor.cta_url} style={sponsorLink}>
        <Section style={sponsorCard}>
          {sponsor.image_url && (
            <Img
              src={sponsor.image_url}
              alt={sponsor.name}
              width="100%"
              height="auto"
              style={sponsorImage}
            />
          )}

          <Text style={sponsorName}>{sponsor.name}</Text>

          {sponsor.tagline && (
            <Text style={sponsorTagline}>{sponsor.tagline}</Text>
          )}

          {sponsor.description && (
            <Text style={sponsorDescription}>{sponsor.description}</Text>
          )}

          <Text style={ctaButton}>{sponsor.cta_text}</Text>
        </Section>
      </Link>
    </Section>
  );
}

const sponsorSection: React.CSSProperties = {
  padding: '0 24px 24px 24px',
};

const sponsorLabel: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: '600',
  color: '#525252',
  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  letterSpacing: '1px',
  margin: '0 0 8px 0',
  textAlign: 'center' as const,
};

const sponsorLink: React.CSSProperties = {
  textDecoration: 'none',
};

const sponsorCard: React.CSSProperties = {
  backgroundColor: '#171717',
  border: '1px solid #262626',
  borderRadius: '8px',
  padding: '16px',
};

const sponsorImage: React.CSSProperties = {
  borderRadius: '4px',
  marginBottom: '12px',
};

const sponsorName: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '0 0 4px 0',
};

const sponsorTagline: React.CSSProperties = {
  fontSize: '13px',
  color: '#3b82f6',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '0 0 8px 0',
};

const sponsorDescription: React.CSSProperties = {
  fontSize: '13px',
  color: '#a3a3a3',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '0 0 12px 0',
  lineHeight: '1.5',
};

const ctaButton: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '12px',
  fontWeight: '600',
  color: '#ffffff',
  backgroundColor: '#2563eb',
  padding: '8px 16px',
  borderRadius: '6px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '0',
  textDecoration: 'none',
};

import {
  Section,
  Text,
  Row,
  Column,
  Link,
  Button,
} from '@react-email/components';
import type { NewSoftwareSummary } from '../../lib/newsletter/types';

interface NewSoftwareCardProps {
  software: NewSoftwareSummary;
  softwarePageUrl: string;
}

export function NewSoftwareCard({ software, softwarePageUrl }: NewSoftwareCardProps) {
  const viewUrl = `${softwarePageUrl}?software_id=${software.software_id}`;
  const trackUrl = `${softwarePageUrl}?software_id=${software.software_id}&action=track`;

  return (
    <Section style={cardContainer}>
      <Row>
        <Column>
          {/* Header row: Name + NEW badge */}
          <table width="100%" cellPadding={0} cellSpacing={0}>
            <tr>
              <td>
                <Text style={softwareName}>{software.name}</Text>
              </td>
              <td align="right">
                <span style={newBadge}>NEW</span>
              </td>
            </tr>
          </table>

          {/* Manufacturer + Category */}
          <Text style={metaText}>
            {software.manufacturer} • {software.category}
          </Text>

          {/* Initial version */}
          <Text style={versionText}>
            <span style={versionLabel}>Version: </span>
            <span style={versionValue}>{software.initial_version}</span>
          </Text>

          {/* Added date */}
          {software.added_date && (
            <Text style={dateText}>
              Added {formatDate(software.added_date)}
            </Text>
          )}

          {/* Action buttons */}
          <Section style={actionsSection}>
            <Row>
              <Column align="center">
                <Link href={viewUrl} style={viewButton}>
                  View Details
                </Link>
                <Link href={trackUrl} style={trackButton}>
                  Start Tracking
                </Link>
              </Column>
            </Row>
          </Section>
        </Column>
      </Row>
    </Section>
  );
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateString;
  }
}

const cardContainer: React.CSSProperties = {
  backgroundColor: '#171717',
  border: '1px solid #262626',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '12px',
};

const softwareName: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '0',
};

const newBadge: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '10px',
  fontWeight: '600',
  color: '#ffffff',
  backgroundColor: '#8b5cf6', // Purple for "NEW"
  padding: '3px 8px',
  borderRadius: '4px',
  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  letterSpacing: '0.5px',
};

const metaText: React.CSSProperties = {
  fontSize: '13px',
  color: '#a3a3a3',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '4px 0 12px 0',
};

const versionText: React.CSSProperties = {
  fontSize: '14px',
  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  margin: '0 0 4px 0',
};

const versionLabel: React.CSSProperties = {
  color: '#737373',
};

const versionValue: React.CSSProperties = {
  color: '#8b5cf6', // Purple to match NEW badge
  fontWeight: '600',
};

const dateText: React.CSSProperties = {
  fontSize: '12px',
  color: '#525252',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '0',
};

const actionsSection: React.CSSProperties = {
  marginTop: '12px',
  paddingTop: '12px',
  borderTop: '1px solid #262626',
};

const viewButton: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '13px',
  fontWeight: '500',
  color: '#3b82f6',
  textDecoration: 'none',
  padding: '8px 16px',
  marginRight: '8px',
  border: '1px solid #3b82f6',
  borderRadius: '6px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const trackButton: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '13px',
  fontWeight: '600',
  color: '#ffffff',
  backgroundColor: '#8b5cf6',
  textDecoration: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

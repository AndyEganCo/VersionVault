import {
  Section,
  Text,
  Row,
  Column,
  Link,
} from '@react-email/components';
import type { SoftwareUpdateSummary } from '../../lib/newsletter/types';

interface UpdateCardProps {
  update: SoftwareUpdateSummary;
  dashboardUrl: string;
}

export function UpdateCard({ update, dashboardUrl }: UpdateCardProps) {
  const typeColor = getTypeColor(update.update_type);
  const typeLabel = getTypeLabel(update.update_type);
  const detailUrl = `${dashboardUrl}?software_id=${update.software_id}`;

  return (
    <Link href={detailUrl} style={cardLink}>
      <Section style={cardContainer}>
      <Row>
        <Column>
          {/* Header row: Name + Type badge */}
          <table width="100%" cellPadding={0} cellSpacing={0}>
            <tr>
              <td>
                <Text style={softwareName}>{update.name}</Text>
              </td>
              <td align="right">
                <span style={{ ...typeBadge, backgroundColor: typeColor }}>
                  {typeLabel}
                </span>
              </td>
            </tr>
          </table>

          {/* Manufacturer + Category */}
          <Text style={metaText}>
            {update.manufacturer} • {update.category}
          </Text>

          {/* Version change */}
          <Text style={versionText}>
            <span style={oldVersion}>{update.old_version}</span>
            <span style={arrow}> → </span>
            <span style={newVersion}>{update.new_version}</span>
          </Text>

          {/* Release date */}
          {update.release_date && (
            <Text style={dateText}>
              Released {formatDate(update.release_date)}
            </Text>
          )}

          {/* Release notes (if available, show first 2) */}
          {update.release_notes && update.release_notes.length > 0 && (
            <Section style={notesSection}>
              {update.release_notes.slice(0, 2).map((note, index) => (
                <Text key={index} style={noteItem}>
                  • {note}
                </Text>
              ))}
              {update.release_notes.length > 2 && (
                <Text style={moreNotes}>
                  +{update.release_notes.length - 2} more changes
                </Text>
              )}
            </Section>
          )}
        </Column>
      </Row>
    </Section>
    </Link>
  );
}

function getTypeColor(type: 'major' | 'minor' | 'patch'): string {
  switch (type) {
    case 'major':
      return '#dc2626'; // Red
    case 'minor':
      return '#2563eb'; // Blue
    case 'patch':
      return '#16a34a'; // Green
    default:
      return '#525252'; // Gray
  }
}

function getTypeLabel(type: 'major' | 'minor' | 'patch'): string {
  switch (type) {
    case 'major':
      return 'MAJOR';
    case 'minor':
      return 'MINOR';
    case 'patch':
      return 'PATCH';
    default:
      return 'UPDATE';
  }
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

const cardLink: React.CSSProperties = {
  textDecoration: 'none',
  display: 'block',
  color: 'inherit',
};

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

const typeBadge: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '10px',
  fontWeight: '600',
  color: '#ffffff',
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

const oldVersion: React.CSSProperties = {
  color: '#737373',
};

const arrow: React.CSSProperties = {
  color: '#525252',
};

const newVersion: React.CSSProperties = {
  color: '#22c55e',
  fontWeight: '600',
};

const dateText: React.CSSProperties = {
  fontSize: '12px',
  color: '#525252',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '0',
};

const notesSection: React.CSSProperties = {
  marginTop: '12px',
  paddingTop: '12px',
  borderTop: '1px solid #262626',
};

const noteItem: React.CSSProperties = {
  fontSize: '12px',
  color: '#a3a3a3',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '0 0 4px 0',
  lineHeight: '1.4',
};

const moreNotes: React.CSSProperties = {
  fontSize: '12px',
  color: '#525252',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '4px 0 0 0',
  fontStyle: 'italic',
};

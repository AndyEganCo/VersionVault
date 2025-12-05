import {
  Section,
  Text,
  Link,
  Hr,
} from '@react-email/components';

interface FooterProps {
  unsubscribeUrl: string;
  preferencesUrl: string;
}

export function Footer({ unsubscribeUrl, preferencesUrl }: FooterProps) {
  return (
    <Section style={footerSection}>
      <Hr style={divider} />

      <Text style={linksText}>
        <Link href={preferencesUrl} style={footerLink}>
          Manage Preferences
        </Link>
        <span style={separator}>•</span>
        <Link href={unsubscribeUrl} style={footerLink}>
          Unsubscribe
        </Link>
        <span style={separator}>•</span>
        <Link href="https://versionvault.dev" style={footerLink}>
          Open Dashboard
        </Link>
      </Text>

      <Text style={addressText}>
        VersionVault • Software Version Tracking
      </Text>

      <Text style={copyrightText}>
        © {new Date().getFullYear()} VersionVault. All rights reserved.
      </Text>
    </Section>
  );
}

const footerSection: React.CSSProperties = {
  padding: '24px',
};

const divider: React.CSSProperties = {
  borderColor: '#262626',
  borderTop: '1px solid #262626',
  margin: '0 0 24px 0',
};

const linksText: React.CSSProperties = {
  fontSize: '13px',
  color: '#a3a3a3',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '0 0 16px 0',
  textAlign: 'center' as const,
};

const footerLink: React.CSSProperties = {
  color: '#a3a3a3',
  textDecoration: 'underline',
};

const separator: React.CSSProperties = {
  margin: '0 12px',
  color: '#525252',
};

const addressText: React.CSSProperties = {
  fontSize: '12px',
  color: '#525252',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '0 0 8px 0',
  textAlign: 'center' as const,
};

const copyrightText: React.CSSProperties = {
  fontSize: '12px',
  color: '#404040',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '0',
  textAlign: 'center' as const,
};

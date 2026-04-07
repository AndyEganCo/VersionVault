import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Preview,
} from '@react-email/components';
import { Header } from './components/header';
import { Footer } from './components/footer';

interface GracePeriodExpiredProps {
  userName: string;
  keptApps: string[];
  removedApps: string[];
  premiumUrl: string;
  dashboardUrl: string;
  preferencesUrl: string;
}

export default function GracePeriodExpired({
  userName,
  keptApps,
  removedApps,
  premiumUrl,
  dashboardUrl,
  preferencesUrl,
}: GracePeriodExpiredProps) {
  return (
    <Html>
      <Head />
      <Preview>Your tracked apps have been updated</Preview>
      <Body style={body}>
        <Container style={container}>
          <Header title="Account Updated" />

          <Section style={contentSection}>
            <Text style={greetingText}>Hey {userName},</Text>
            <Text style={bodyText}>
              Your 30-day grace period has ended. We've kept your 5 most recently tracked
              apps and removed the rest.
            </Text>
          </Section>

          {keptApps.length > 0 && (
            <Section style={appListSection}>
              <Text style={sectionTitle}>Apps we kept</Text>
              {keptApps.map((app, i) => (
                <Text key={i} style={keptItem}>{app}</Text>
              ))}
            </Section>
          )}

          {removedApps.length > 0 && (
            <Section style={appListSection}>
              <Text style={sectionTitle}>Apps removed</Text>
              {removedApps.map((app, i) => (
                <Text key={i} style={removedItem}>{app}</Text>
              ))}
            </Section>
          )}

          <Section style={ctaSection}>
            <Link href={premiumUrl} style={ctaButton}>
              Upgrade to Pro — Track Unlimited Apps
            </Link>
            <Text style={ctaSubtext}>
              Re-add removed apps instantly after upgrading
            </Text>
          </Section>

          <Section style={contentSection}>
            <Text style={bodyText}>
              You can always <Link href={dashboardUrl} style={link}>manage your tracked apps</Link> from
              your dashboard.
            </Text>
          </Section>

          <Footer unsubscribeUrl={preferencesUrl} preferencesUrl={preferencesUrl} />
        </Container>
      </Body>
    </Html>
  );
}

GracePeriodExpired.PreviewProps = {
  userName: 'Andy',
  keptApps: ['Chrome', 'VS Code', 'Node.js', 'Docker', 'PostgreSQL'],
  removedApps: ['Firefox', 'Redis', 'Nginx', 'Slack', 'Zoom', 'Git', 'Python'],
  premiumUrl: 'https://versionvault.dev/premium',
  dashboardUrl: 'https://versionvault.dev/dashboard',
  preferencesUrl: 'https://versionvault.dev/user/notifications',
} satisfies GracePeriodExpiredProps;

const body: React.CSSProperties = {
  backgroundColor: '#0a0a0a',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '0',
  padding: '0',
};

const container: React.CSSProperties = {
  backgroundColor: '#0a0a0a',
  maxWidth: '600px',
  margin: '0 auto',
};

const contentSection: React.CSSProperties = {
  padding: '0 24px 16px 24px',
};

const greetingText: React.CSSProperties = {
  fontSize: '16px',
  color: '#ffffff',
  margin: '0 0 12px 0',
  padding: '24px 0 0 0',
};

const bodyText: React.CSSProperties = {
  fontSize: '14px',
  color: '#a3a3a3',
  margin: '0 0 12px 0',
  lineHeight: '1.6',
};

const appListSection: React.CSSProperties = {
  padding: '0 24px 16px 24px',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '600',
  color: '#525252',
  letterSpacing: '0.5px',
  textTransform: 'uppercase' as const,
  margin: '0 0 8px 0',
};

const keptItem: React.CSSProperties = {
  fontSize: '13px',
  color: '#a3a3a3',
  margin: '0 0 4px 0',
  padding: '4px 12px',
  backgroundColor: '#171717',
  border: '1px solid #262626',
  borderRadius: '4px',
};

const removedItem: React.CSSProperties = {
  fontSize: '13px',
  color: '#525252',
  margin: '0 0 4px 0',
  padding: '4px 12px',
  backgroundColor: '#0f0f0f',
  border: '1px solid #1a1a1a',
  borderRadius: '4px',
  textDecoration: 'line-through',
};

const ctaSection: React.CSSProperties = {
  padding: '8px 24px 24px 24px',
  textAlign: 'center' as const,
};

const ctaButton: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  color: '#ffffff',
  backgroundColor: '#2563eb',
  padding: '12px 32px',
  borderRadius: '8px',
  textDecoration: 'none',
};

const ctaSubtext: React.CSSProperties = {
  fontSize: '12px',
  color: '#525252',
  margin: '12px 0 0 0',
};

const link: React.CSSProperties = {
  color: '#2563eb',
  textDecoration: 'underline',
};

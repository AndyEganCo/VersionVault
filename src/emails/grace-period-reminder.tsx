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

interface GracePeriodReminderProps {
  userName: string;
  trackedCount: number;
  daysLeft: number;
  trackedApps: string[];
  premiumUrl: string;
  dashboardUrl: string;
  preferencesUrl: string;
}

export default function GracePeriodReminder({
  userName,
  trackedCount,
  daysLeft,
  trackedApps,
  premiumUrl,
  dashboardUrl,
  preferencesUrl,
}: GracePeriodReminderProps) {
  const isFinalWarning = daysLeft <= 3;

  return (
    <Html>
      <Head />
      <Preview>
        {isFinalWarning
          ? `Final warning: ${daysLeft} days left to choose your 5 apps`
          : `Reminder: ${daysLeft} days left to choose your 5 apps`}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Header title={isFinalWarning ? 'Final Warning' : 'Reminder'} />

          <Section style={contentSection}>
            <Text style={greetingText}>Hey {userName},</Text>
            <Text style={bodyText}>
              {isFinalWarning ? (
                <>
                  In <strong>{daysLeft} days</strong>, we'll keep your 5 most recently tracked
                  apps and remove the rest. Upgrade now to keep all {trackedCount}.
                </>
              ) : (
                <>
                  You have <strong>{daysLeft} days left</strong> to choose which 5 apps to keep
                  or upgrade to Pro. You're currently tracking <strong>{trackedCount} apps</strong>.
                </>
              )}
            </Text>
          </Section>

          {trackedApps.length > 0 && (
            <Section style={appListSection}>
              <Text style={sectionTitle}>Your tracked apps</Text>
              {trackedApps.map((app, i) => (
                <Text key={i} style={appItem}>{app}</Text>
              ))}
            </Section>
          )}

          <Section style={ctaSection}>
            <Link href={premiumUrl} style={ctaButton}>
              Upgrade to Pro — Keep All Apps
            </Link>
            <Text style={ctaSubtext}>
              Or <Link href={dashboardUrl} style={link}>choose which 5 to keep</Link>
            </Text>
          </Section>

          <Footer unsubscribeUrl={preferencesUrl} preferencesUrl={preferencesUrl} />
        </Container>
      </Body>
    </Html>
  );
}

GracePeriodReminder.PreviewProps = {
  userName: 'Andy',
  trackedCount: 12,
  daysLeft: 15,
  trackedApps: ['Chrome', 'Firefox', 'VS Code', 'Node.js', 'Docker', 'PostgreSQL', 'Redis', 'Nginx'],
  premiumUrl: 'https://versionvault.dev/premium',
  dashboardUrl: 'https://versionvault.dev/dashboard',
  preferencesUrl: 'https://versionvault.dev/user/notifications',
} satisfies GracePeriodReminderProps;

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

const appItem: React.CSSProperties = {
  fontSize: '13px',
  color: '#a3a3a3',
  margin: '0 0 4px 0',
  padding: '4px 12px',
  backgroundColor: '#171717',
  border: '1px solid #262626',
  borderRadius: '4px',
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

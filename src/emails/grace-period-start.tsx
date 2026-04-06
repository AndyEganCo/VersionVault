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

interface GracePeriodStartProps {
  userName: string;
  trackedCount: number;
  daysLeft: number;
  premiumUrl: string;
  dashboardUrl: string;
  preferencesUrl: string;
}

export default function GracePeriodStart({
  userName,
  trackedCount,
  daysLeft,
  premiumUrl,
  dashboardUrl,
  preferencesUrl,
}: GracePeriodStartProps) {
  return (
    <Html>
      <Head />
      <Preview>Important change: Free accounts limited to 5 tracked apps</Preview>
      <Body style={body}>
        <Container style={container}>
          <Header title="Important Update" />

          <Section style={contentSection}>
            <Text style={greetingText}>Hey {userName},</Text>
            <Text style={bodyText}>
              We're making a change to VersionVault. Free accounts will be limited to tracking
              <strong> 5 software apps</strong> and <strong>weekly email digests</strong>.
            </Text>
            <Text style={bodyText}>
              You currently track <strong>{trackedCount} apps</strong>. You have
              <strong> {daysLeft} days</strong> to choose which 5 to keep or upgrade to Pro.
            </Text>
          </Section>

          <Section style={ctaSection}>
            <Link href={premiumUrl} style={ctaButton}>
              Upgrade to Pro — $25/year
            </Link>
            <Text style={ctaSubtext}>
              Unlimited tracking + daily/monthly notifications
            </Text>
          </Section>

          <Section style={contentSection}>
            <Text style={bodyText}>
              Or <Link href={dashboardUrl} style={link}>manage your tracked apps</Link> to
              choose which 5 to keep. After {daysLeft} days, we'll automatically keep your 5
              most recently tracked apps.
            </Text>
          </Section>

          <Footer unsubscribeUrl={preferencesUrl} preferencesUrl={preferencesUrl} />
        </Container>
      </Body>
    </Html>
  );
}

GracePeriodStart.PreviewProps = {
  userName: 'Andy',
  trackedCount: 12,
  daysLeft: 30,
  premiumUrl: 'https://versionvault.dev/premium',
  dashboardUrl: 'https://versionvault.dev/dashboard',
  preferencesUrl: 'https://versionvault.dev/user/notifications',
} satisfies GracePeriodStartProps;

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

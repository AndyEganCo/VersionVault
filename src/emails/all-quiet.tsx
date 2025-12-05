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
import { SponsorBlock } from './components/sponsor-block';
import type { AllQuietProps } from '../lib/newsletter/types';

export default function AllQuiet({
  userName,
  userEmail: _userEmail,
  message,
  trackedCount,
  sponsor,
  unsubscribeUrl,
  preferencesUrl,
  dashboardUrl,
}: AllQuietProps) {
  return (
    <Html>
      <Head />
      <Preview>All quiet on the version front this week</Preview>
      <Body style={body}>
        <Container style={container}>
          <Header title="Weekly Digest" />

          {/* Greeting */}
          <Section style={greetingSection}>
            <Text style={greetingText}>
              Hey {userName},
            </Text>
          </Section>

          {/* Main message */}
          <Section style={messageSection}>
            <Text style={quietIcon}>🌙</Text>
            <Text style={messageText}>
              {message}
            </Text>
            <Text style={statsText}>
              Watching <strong>{trackedCount}</strong> app{trackedCount === 1 ? '' : 's'} for you
            </Text>
          </Section>

          {/* Call to action */}
          <Section style={ctaSection}>
            <Link href={dashboardUrl} style={ctaButton}>
              Open Dashboard
            </Link>
          </Section>

          {/* Tip section */}
          <Section style={tipSection}>
            <Text style={tipLabel}>💡 TIP</Text>
            <Text style={tipText}>
              Track more software to get notified when your favorite tools update.
              We monitor versions so you don't have to.
            </Text>
          </Section>

          {/* Sponsor */}
          {sponsor && <SponsorBlock sponsor={sponsor} />}

          {/* Footer */}
          <Footer
            unsubscribeUrl={unsubscribeUrl}
            preferencesUrl={preferencesUrl}
          />
        </Container>
      </Body>
    </Html>
  );
}

// Preview data for email dev server
AllQuiet.PreviewProps = {
  userName: 'Andy',
  userEmail: 'andy@example.com',
  message: "Your software is suspiciously stable this week. We're keeping an eye on it.",
  trackedCount: 11,
  sponsor: null,
  unsubscribeUrl: 'https://versionvault.dev/unsubscribe?token=abc123',
  preferencesUrl: 'https://versionvault.dev/user/notifications',
  dashboardUrl: 'https://versionvault.dev/dashboard',
} satisfies AllQuietProps;

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

const greetingSection: React.CSSProperties = {
  padding: '24px 24px 0 24px',
};

const greetingText: React.CSSProperties = {
  fontSize: '16px',
  color: '#ffffff',
  margin: '0',
};

const messageSection: React.CSSProperties = {
  padding: '32px 24px',
  textAlign: 'center' as const,
};

const quietIcon: React.CSSProperties = {
  fontSize: '48px',
  margin: '0 0 16px 0',
};

const messageText: React.CSSProperties = {
  fontSize: '18px',
  color: '#ffffff',
  margin: '0 0 12px 0',
  lineHeight: '1.5',
  fontStyle: 'italic',
};

const statsText: React.CSSProperties = {
  fontSize: '14px',
  color: '#737373',
  margin: '0',
};

const ctaSection: React.CSSProperties = {
  padding: '0 24px 32px 24px',
  textAlign: 'center' as const,
};

const ctaButton: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  color: '#ffffff',
  backgroundColor: '#262626',
  border: '1px solid #404040',
  padding: '12px 24px',
  borderRadius: '8px',
  textDecoration: 'none',
};

const tipSection: React.CSSProperties = {
  padding: '0 24px 32px 24px',
};

const tipLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: '600',
  color: '#525252',
  letterSpacing: '0.5px',
  margin: '0 0 8px 0',
};

const tipText: React.CSSProperties = {
  fontSize: '13px',
  color: '#737373',
  margin: '0',
  lineHeight: '1.5',
  backgroundColor: '#171717',
  border: '1px solid #262626',
  borderRadius: '8px',
  padding: '12px 16px',
};

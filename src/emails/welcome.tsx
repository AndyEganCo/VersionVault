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
import type { WelcomeEmailProps } from '../lib/newsletter/types';

export default function Welcome({
  userName,
  userEmail: _userEmail,
  frequency,
  preferencesUrl,
  dashboardUrl,
}: WelcomeEmailProps) {
  const frequencyText = {
    daily: 'daily',
    weekly: 'weekly (every Monday)',
    monthly: 'monthly (1st of each month)',
  }[frequency];

  return (
    <Html>
      <Head />
      <Preview>Welcome to VersionVault notifications!</Preview>
      <Body style={body}>
        <Container style={container}>
          <Header title="Welcome" />

          {/* Greeting */}
          <Section style={greetingSection}>
            <Text style={greetingText}>
              Hey {userName},
            </Text>
            <Text style={introText}>
              You're all set to receive version updates! We'll send you a <strong>{frequencyText}</strong> digest
              with updates for the software you're tracking.
            </Text>
          </Section>

          {/* What to expect */}
          <Section style={featuresSection}>
            <Text style={sectionTitle}>What to expect</Text>

            <Section style={featureItem}>
              <Text style={featureIcon}>📬</Text>
              <Text style={featureText}>
                <strong>Personalized digests</strong><br />
                Only updates for software you're tracking
              </Text>
            </Section>

            <Section style={featureItem}>
              <Text style={featureIcon}>🎯</Text>
              <Text style={featureText}>
                <strong>Version type indicators</strong><br />
                See at a glance if it's a major, minor, or patch release
              </Text>
            </Section>

            <Section style={featureItem}>
              <Text style={featureIcon}>📝</Text>
              <Text style={featureText}>
                <strong>Release notes</strong><br />
                Key changes included so you know what's new
              </Text>
            </Section>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Link href={dashboardUrl} style={ctaButton}>
              Go to Dashboard
            </Link>
            <Text style={ctaSubtext}>
              Track more software to get more updates
            </Text>
          </Section>

          {/* Preferences note */}
          <Section style={noteSection}>
            <Text style={noteText}>
              You can change your notification frequency or unsubscribe anytime
              from your <Link href={preferencesUrl} style={noteLink}>notification preferences</Link>.
            </Text>
          </Section>

          {/* Footer - use dashboardUrl as unsubscribe fallback for welcome email */}
          <Footer
            unsubscribeUrl={preferencesUrl}
            preferencesUrl={preferencesUrl}
          />
        </Container>
      </Body>
    </Html>
  );
}

// Preview data for email dev server
Welcome.PreviewProps = {
  userName: 'Andy',
  userEmail: 'andy@example.com',
  frequency: 'weekly' as const,
  preferencesUrl: 'https://versionvault.dev/user/notifications',
  dashboardUrl: 'https://versionvault.dev/dashboard',
} satisfies WelcomeEmailProps;

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
  padding: '24px',
};

const greetingText: React.CSSProperties = {
  fontSize: '16px',
  color: '#ffffff',
  margin: '0 0 12px 0',
};

const introText: React.CSSProperties = {
  fontSize: '14px',
  color: '#a3a3a3',
  margin: '0',
  lineHeight: '1.6',
};

const featuresSection: React.CSSProperties = {
  padding: '0 24px 24px 24px',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '600',
  color: '#525252',
  letterSpacing: '0.5px',
  textTransform: 'uppercase' as const,
  margin: '0 0 16px 0',
};

const featureItem: React.CSSProperties = {
  backgroundColor: '#171717',
  border: '1px solid #262626',
  borderRadius: '8px',
  padding: '12px 16px',
  marginBottom: '8px',
};

const featureIcon: React.CSSProperties = {
  fontSize: '20px',
  margin: '0 0 8px 0',
};

const featureText: React.CSSProperties = {
  fontSize: '13px',
  color: '#a3a3a3',
  margin: '0',
  lineHeight: '1.5',
};

const ctaSection: React.CSSProperties = {
  padding: '8px 24px 32px 24px',
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

const noteSection: React.CSSProperties = {
  padding: '0 24px 24px 24px',
};

const noteText: React.CSSProperties = {
  fontSize: '12px',
  color: '#525252',
  margin: '0',
  textAlign: 'center' as const,
};

const noteLink: React.CSSProperties = {
  color: '#525252',
  textDecoration: 'underline',
};

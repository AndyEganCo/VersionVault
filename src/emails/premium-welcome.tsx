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

interface PremiumWelcomeEmailProps {
  userName: string;
  dashboardUrl: string;
  manageSubscriptionUrl: string;
}

export default function PremiumWelcome({
  userName,
  dashboardUrl,
  manageSubscriptionUrl,
}: PremiumWelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to VersionVault Premium! 🎉</Preview>
      <Body style={body}>
        <Container style={container}>
          <Header title="Welcome to Premium" />

          {/* Greeting */}
          <Section style={greetingSection}>
            <Text style={greetingText}>
              Hey {userName},
            </Text>
            <Text style={introText}>
              Thank you for upgrading to <strong>VersionVault Premium</strong>! Your support means the world to us and helps keep VersionVault running.
            </Text>
          </Section>

          {/* What's Included */}
          <Section style={featuresSection}>
            <Text style={sectionTitle}>What's Included</Text>

            <Section style={featureItem}>
              <Text style={featureIcon}>✨</Text>
              <Text style={featureText}>
                <strong>Ad-Free Experience</strong><br />
                Enjoy VersionVault without any distractions
              </Text>
            </Section>

            <Section style={featureItem}>
              <Text style={featureIcon}>💙</Text>
              <Text style={featureText}>
                <strong>Support Development</strong><br />
                Help us build new features and keep the service running
              </Text>
            </Section>

            <Section style={featureItem}>
              <Text style={featureIcon}>⚡</Text>
              <Text style={featureText}>
                <strong>Priority Support</strong><br />
                Get faster responses to your questions and feature requests
              </Text>
            </Section>

            <Section style={featureItem}>
              <Text style={featureIcon}>🎯</Text>
              <Text style={featureText}>
                <strong>All Features</strong><br />
                Track unlimited software with custom notifications
              </Text>
            </Section>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Link href={dashboardUrl} style={ctaButton}>
              Go to Dashboard
            </Link>
            <Text style={ctaSubtext}>
              Your ad-free experience starts now!
            </Text>
          </Section>

          {/* Manage Subscription */}
          <Section style={noteSection}>
            <Text style={noteText}>
              Your subscription renews annually. You can manage your subscription, update payment methods, or cancel anytime from your{' '}
              <Link href={manageSubscriptionUrl} style={noteLink}>subscription settings</Link>.
            </Text>
          </Section>

          {/* Footer */}
          <Footer
            unsubscribeUrl={dashboardUrl}
            preferencesUrl={dashboardUrl}
          />
        </Container>
      </Body>
    </Html>
  );
}

// Preview data for email dev server
PremiumWelcome.PreviewProps = {
  userName: 'Andy',
  dashboardUrl: 'https://versionvault.dev/dashboard',
  manageSubscriptionUrl: 'https://versionvault.dev/premium',
} satisfies PremiumWelcomeEmailProps;

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

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

interface DonationThankYouEmailProps {
  userName: string;
  amount: number; // in cents
  dashboardUrl: string;
  premiumUrl: string;
}

export default function DonationThankYou({
  userName,
  amount,
  dashboardUrl,
  premiumUrl,
}: DonationThankYouEmailProps) {
  const amountDollars = (amount / 100).toFixed(2);

  return (
    <Html>
      <Head />
      <Preview>Thank you for your generous donation! 💙</Preview>
      <Body style={body}>
        <Container style={container}>
          <Header title="Thank You!" />

          {/* Greeting */}
          <Section style={greetingSection}>
            <Text style={greetingText}>
              Hey {userName},
            </Text>
            <Text style={introText}>
              Thank you so much for your generous <strong>${amountDollars}</strong> donation! Your support helps keep VersionVault running and enables us to build new features for everyone.
            </Text>
          </Section>

          {/* Impact Section */}
          <Section style={impactSection}>
            <Text style={sectionTitle}>Your Impact</Text>

            <Section style={impactItem}>
              <Text style={impactIcon}>🚀</Text>
              <Text style={impactText}>
                <strong>Keeps the service running</strong><br />
                Covers server costs, database hosting, and email delivery
              </Text>
            </Section>

            <Section style={impactItem}>
              <Text style={impactIcon}>✨</Text>
              <Text style={impactText}>
                <strong>Funds new features</strong><br />
                Helps us build the features you want to see
              </Text>
            </Section>

            <Section style={impactItem}>
              <Text style={impactIcon}>💙</Text>
              <Text style={impactText}>
                <strong>Keeps it free</strong><br />
                Helps us keep VersionVault accessible to everyone
              </Text>
            </Section>
          </Section>

          {/* Heart */}
          <Section style={heartSection}>
            <Text style={heartEmoji}>❤️</Text>
            <Text style={heartText}>
              We're grateful for supporters like you!
            </Text>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Link href={dashboardUrl} style={ctaButton}>
              Go to Dashboard
            </Link>
          </Section>

          {/* Premium Note */}
          <Section style={noteSection}>
            <Text style={noteTitle}>Want more?</Text>
            <Text style={noteText}>
              Consider upgrading to{' '}
              <Link href={premiumUrl} style={noteLink}>VersionVault Premium</Link>{' '}
              for $50/year to enjoy an ad-free experience and support ongoing development.
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
DonationThankYou.PreviewProps = {
  userName: 'Andy',
  amount: 2500, // $25.00
  dashboardUrl: 'https://versionvault.dev/dashboard',
  premiumUrl: 'https://versionvault.dev/premium',
} satisfies DonationThankYouEmailProps;

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

const impactSection: React.CSSProperties = {
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

const impactItem: React.CSSProperties = {
  backgroundColor: '#171717',
  border: '1px solid #262626',
  borderRadius: '8px',
  padding: '12px 16px',
  marginBottom: '8px',
};

const impactIcon: React.CSSProperties = {
  fontSize: '20px',
  margin: '0 0 8px 0',
};

const impactText: React.CSSProperties = {
  fontSize: '13px',
  color: '#a3a3a3',
  margin: '0',
  lineHeight: '1.5',
};

const heartSection: React.CSSProperties = {
  padding: '24px',
  textAlign: 'center' as const,
  backgroundColor: '#171717',
  borderTop: '1px solid #262626',
  borderBottom: '1px solid #262626',
};

const heartEmoji: React.CSSProperties = {
  fontSize: '48px',
  margin: '0 0 12px 0',
};

const heartText: React.CSSProperties = {
  fontSize: '16px',
  color: '#ffffff',
  fontWeight: '500',
  margin: '0',
};

const ctaSection: React.CSSProperties = {
  padding: '24px',
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

const noteSection: React.CSSProperties = {
  padding: '0 24px 24px 24px',
  textAlign: 'center' as const,
};

const noteTitle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#ffffff',
  margin: '0 0 8px 0',
};

const noteText: React.CSSProperties = {
  fontSize: '12px',
  color: '#525252',
  margin: '0',
  lineHeight: '1.5',
};

const noteLink: React.CSSProperties = {
  color: '#2563eb',
  textDecoration: 'underline',
};

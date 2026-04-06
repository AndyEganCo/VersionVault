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

interface FreemiumLaunchProps {
  userName: string;
  premiumUrl: string;
  dashboardUrl: string;
  preferencesUrl: string;
}

export default function FreemiumLaunchAnnouncement({
  userName,
  premiumUrl,
  dashboardUrl,
  preferencesUrl,
}: FreemiumLaunchProps) {
  return (
    <Html>
      <Head />
      <Preview>We tried everything, but a change is coming to VersionVault..</Preview>
      <Body style={body}>
        <Container style={container}>
          <Header title="Quick Update" />

          <Section style={contentSection}>
            <Text style={greetingText}>Hey {userName},</Text>
            <Text style={bodyText}>Quick update for you!</Text>
          </Section>

          <Section style={contentSection}>
            <Text style={sectionTitle}>Why we're making a change</Text>
            <Text style={bodyText}>
              Running VersionVault — the scraping, version checks, and email delivery — costs more
              than the free tier covers. Rather than shut it down or plaster it with ads, we're
              moving to a freemium model.
            </Text>
          </Section>

          <Section style={contentSection}>
            <Text style={sectionTitle}>Here's what's changing</Text>
            <Text style={bodyText}>
              Free accounts will be limited to tracking 5 apps and weekly digest emails. Pro stays
              $25/year and gets you unlimited tracking, and all email frequencies.
            </Text>
          </Section>

          <Section style={contentSection}>
            <Text style={sectionTitle}>Already tracking more than 5 apps?</Text>
            <Text style={bodyText}>
              No sudden changes — you'll get a 30-day grace period to pick your 5 to keep or
              upgrade to Pro. We'll email you before anything happens.
            </Text>
          </Section>

          <Section style={contentSection}>
            <Text style={sectionTitle}>Earn Pro for free</Text>
            <Text style={bodyText}>
              We're adding a referral program! Invite a friend and earn a free month of Pro when
              they sign up. More details coming once it's live.
            </Text>
          </Section>

          <Section style={contentSection}>
            <Text style={bodyText}>
              We built this because we needed it, and we want to keep it running. This is how we
              do that — thanks for understanding.
            </Text>
          </Section>

          <Section style={ctaSection}>
            <Link href={premiumUrl} style={ctaButton}>
              Learn More About Pro
            </Link>
          </Section>

          <Section style={contentSection}>
            <Text style={bodyText}>
              Got questions or feedback? Hit reply or email{' '}
              <Link href="mailto:support@versionvault.dev" style={link}>
                support@versionvault.dev
              </Link>
            </Text>
          </Section>

          <Section style={sponsorSection}>
            <Text style={sponsorText}>
              Want to reach the people who keep software up to date? We're opening up a few
              sponsor spots in the VersionVault newsletter. If your product is built for developers,
              IT teams, or anyone who cares about staying current — let's talk. Email us at{' '}
              <Link href="mailto:support@versionvault.dev" style={link}>
                support@versionvault.dev
              </Link>
            </Text>
          </Section>

          <Section style={contentSection}>
            <Text style={bodyText}>Thanks for using VersionVault!</Text>
          </Section>

          <Footer unsubscribeUrl={preferencesUrl} preferencesUrl={preferencesUrl} />
        </Container>
      </Body>
    </Html>
  );
}

FreemiumLaunchAnnouncement.PreviewProps = {
  userName: 'Andy',
  premiumUrl: 'https://versionvault.dev/premium',
  dashboardUrl: 'https://versionvault.dev/dashboard',
  preferencesUrl: 'https://versionvault.dev/user/notifications',
} satisfies FreemiumLaunchProps;

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

const sectionTitle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#ffffff',
  margin: '0 0 8px 0',
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

const link: React.CSSProperties = {
  color: '#2563eb',
  textDecoration: 'underline',
};

const sponsorSection: React.CSSProperties = {
  padding: '16px 24px',
  margin: '0 24px 16px 24px',
  backgroundColor: '#171717',
  border: '1px solid #262626',
  borderRadius: '8px',
};

const sponsorText: React.CSSProperties = {
  fontSize: '12px',
  color: '#525252',
  margin: '0',
  lineHeight: '1.5',
};

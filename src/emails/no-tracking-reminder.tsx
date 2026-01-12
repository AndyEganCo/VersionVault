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
import type { NoTrackingReminderProps } from '../lib/newsletter/types';

export default function NoTrackingReminder({
  userName,
  userEmail: _userEmail,
  popularSoftware,
  sponsor,
  unsubscribeUrl,
  preferencesUrl,
  dashboardUrl,
  softwarePageUrl,
}: NoTrackingReminderProps) {
  return (
    <Html>
      <Head />
      <Preview>Your software tracker is looking a bit empty...</Preview>
      <Body style={body}>
        <Container style={container}>
          <Header title="Tracking Reminder" />

          {/* Greeting */}
          <Section style={greetingSection}>
            <Text style={greetingText}>
              Hey {userName},
            </Text>
            <Text style={introText}>
              We noticed you haven't tracked any software yet. You're missing out on automatic version updates!
            </Text>
          </Section>

          {/* Main Message */}
          <Section style={messageSection}>
            <Text style={messageIcon}>📭</Text>
            <Text style={messageText}>
              Your watchlist is feeling lonely
            </Text>
            <Text style={messageSubtext}>
              Track software to get notified about updates, security patches, and new releases — all automatically.
            </Text>
          </Section>

          {/* Benefits */}
          <Section style={benefitsSection}>
            <Text style={sectionTitle}>WHY TRACK SOFTWARE?</Text>

            <Section style={benefitItem}>
              <Text style={benefitIcon}>🔔</Text>
              <Text style={benefitText}>
                <strong>Never miss critical updates</strong><br />
                Get notified when your tools release new versions
              </Text>
            </Section>

            <Section style={benefitItem}>
              <Text style={benefitIcon}>🛡️</Text>
              <Text style={benefitText}>
                <strong>Stay ahead of breaking changes</strong><br />
                See major, minor, and patch releases at a glance
              </Text>
            </Section>

            <Section style={benefitItem}>
              <Text style={benefitIcon}>🔐</Text>
              <Text style={benefitText}>
                <strong>Security patch alerts</strong><br />
                Know when security updates are available
              </Text>
            </Section>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Link href={softwarePageUrl} style={ctaButton}>
              Browse Software
            </Link>
            <Text style={ctaSubtext}>
              Start tracking your favorite tools
            </Text>
          </Section>

          {/* Popular Software */}
          {popularSoftware && popularSoftware.length > 0 && (
            <Section style={popularSection}>
              <Text style={popularHeading}>
                🔥 Popular Software
              </Text>
              <Text style={popularSubheading}>
                Most tracked by the community
              </Text>

              {popularSoftware.map((software, index) => (
                <Link
                  key={index}
                  href={`${softwarePageUrl}?software_id=${software.software_id}`}
                  style={softwareLink}
                >
                  <Section style={softwareCard}>
                    <Text style={softwareName}>{software.name}</Text>
                    <Text style={softwareInfo}>
                      {software.manufacturer} • {software.category}
                    </Text>
                    <Text style={softwareVersion}>
                      Latest: <span style={versionText}>{software.current_version}</span>
                    </Text>
                    <Text style={trackButton}>Track This →</Text>
                  </Section>
                </Link>
              ))}

              <Text style={viewAllText}>
                <Link href={softwarePageUrl} style={viewAllLink}>
                  View all software →
                </Link>
              </Text>
            </Section>
          )}

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
NoTrackingReminder.PreviewProps = {
  userName: 'Andy',
  userEmail: 'andy@example.com',
  popularSoftware: [
    {
      software_id: '1',
      name: 'QLab',
      manufacturer: 'Figure 53',
      category: 'Audio/Video',
      current_version: '5.5.8',
      tracker_count: 142,
    },
    {
      software_id: '2',
      name: 'ProPresenter',
      manufacturer: 'Renewed Vision',
      category: 'Presentation',
      current_version: '21.1',
      tracker_count: 128,
    },
    {
      software_id: '3',
      name: 'Resolume Arena',
      manufacturer: 'Resolume',
      category: 'VJ Software',
      current_version: '8.0.0',
      tracker_count: 95,
    },
  ],
  sponsor: {
    name: 'StreamDeck XL',
    tagline: 'Your command center',
    description: 'Control your entire show with customizable buttons.',
    image_url: null,
    cta_url: 'https://example.com/streamdeck',
    cta_text: 'Learn More',
  },
  unsubscribeUrl: 'https://versionvault.dev/unsubscribe?token=abc123',
  preferencesUrl: 'https://versionvault.dev/user/notifications',
  dashboardUrl: 'https://versionvault.dev/dashboard',
  softwarePageUrl: 'https://versionvault.dev/software',
} satisfies NoTrackingReminderProps;

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
  margin: '0 0 12px 0',
};

const introText: React.CSSProperties = {
  fontSize: '14px',
  color: '#a3a3a3',
  margin: '0',
  lineHeight: '1.6',
};

const messageSection: React.CSSProperties = {
  padding: '32px 24px',
  textAlign: 'center' as const,
};

const messageIcon: React.CSSProperties = {
  fontSize: '48px',
  margin: '0 0 16px 0',
};

const messageText: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: '600',
  color: '#ffffff',
  margin: '0 0 12px 0',
};

const messageSubtext: React.CSSProperties = {
  fontSize: '14px',
  color: '#a3a3a3',
  margin: '0',
  lineHeight: '1.5',
};

const benefitsSection: React.CSSProperties = {
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

const benefitItem: React.CSSProperties = {
  backgroundColor: '#171717',
  border: '1px solid #262626',
  borderRadius: '8px',
  padding: '12px 16px',
  marginBottom: '8px',
};

const benefitIcon: React.CSSProperties = {
  fontSize: '20px',
  margin: '0 0 8px 0',
};

const benefitText: React.CSSProperties = {
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

const popularSection: React.CSSProperties = {
  padding: '24px 24px 0 24px',
};

const popularHeading: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#ffffff',
  margin: '0 0 4px 0',
};

const popularSubheading: React.CSSProperties = {
  fontSize: '13px',
  color: '#a3a3a3',
  margin: '0 0 16px 0',
};

const softwareLink: React.CSSProperties = {
  textDecoration: 'none',
  display: 'block',
  color: 'inherit',
};

const softwareCard: React.CSSProperties = {
  backgroundColor: '#171717',
  border: '1px solid #262626',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '12px',
  transition: 'border-color 0.2s',
};

const softwareName: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#ffffff',
  margin: '0 0 4px 0',
};

const softwareInfo: React.CSSProperties = {
  fontSize: '13px',
  color: '#a3a3a3',
  margin: '0 0 12px 0',
};

const softwareVersion: React.CSSProperties = {
  fontSize: '14px',
  color: '#737373',
  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  margin: '0 0 12px 0',
};

const versionText: React.CSSProperties = {
  color: '#22c55e',
  fontWeight: '600',
};

const trackButton: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: '500',
  color: '#3b82f6',
  margin: '0',
};

const viewAllText: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '16px 0 24px 0',
};

const viewAllLink: React.CSSProperties = {
  fontSize: '13px',
  color: '#3b82f6',
  textDecoration: 'none',
};

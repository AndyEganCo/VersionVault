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
import { UpdateCard } from './components/update-card';
import { NewSoftwareCard } from './components/new-software-card';
import { SponsorBlock } from './components/sponsor-block';
import type { WeeklyDigestProps } from '../lib/newsletter/types';

export default function WeeklyDigest({
  userName,
  userEmail: _userEmail,
  updates,
  newSoftware,
  sponsor,
  unsubscribeUrl,
  preferencesUrl,
  dashboardUrl,
  softwarePageUrl,
}: WeeklyDigestProps) {
  const updateCount = updates.length;
  const newSoftwareCount = newSoftware?.length || 0;
  const previewText = updateCount > 0
    ? `${updateCount} update${updateCount === 1 ? '' : 's'} for your tracked software this week`
    : 'Your weekly software update digest';

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Header title="Weekly Digest" />

          {/* Greeting */}
          <Section style={greetingSection}>
            <Text style={greetingText}>
              Hey {userName},
            </Text>
            <Text style={introText}>
              {updateCount > 0 ? (
                <>
                  Here's what changed in the <strong>{updateCount}</strong> app
                  {updateCount === 1 ? '' : 's'} you're tracking this week:
                </>
              ) : (
                <>
                  No updates this week for the software you're tracking.
                  We'll keep watching and let you know when something changes.
                </>
              )}
            </Text>
          </Section>

          {/* Updates */}
          {updateCount > 0 && (
            <Section style={updatesSection}>
              {updates.map((update, index) => (
                <UpdateCard key={index} update={update} dashboardUrl={dashboardUrl} />
              ))}

              {/* View all link */}
              <Text style={viewAllText}>
                <Link href={dashboardUrl} style={viewAllLink}>
                  View all in dashboard →
                </Link>
              </Text>
            </Section>
          )}

          {/* New Software Section */}
          {newSoftwareCount > 0 && (
            <Section style={newSoftwareSection}>
              <Text style={sectionHeading}>
                🆕 New Software Added
              </Text>
              <Text style={sectionSubheading}>
                {newSoftwareCount} new {newSoftwareCount === 1 ? 'app' : 'apps'} added to VersionVault this week
              </Text>

              {newSoftware!.map((software, index) => (
                <NewSoftwareCard key={index} software={software} softwarePageUrl={softwarePageUrl} />
              ))}
            </Section>
          )}

          {/* Empty state */}
          {updateCount === 0 && (
            <Section style={emptySection}>
              <Text style={emptyIcon}>📦</Text>
              <Text style={emptyText}>
                All quiet on the version front
              </Text>
              <Text style={emptySubtext}>
                Your tracked software is stable this week. Enjoy the peace!
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
WeeklyDigest.PreviewProps = {
  userName: 'Andy',
  userEmail: 'andy@example.com',
  updates: [
    {
      software_id: '1',
      name: 'QLab',
      manufacturer: 'Figure 53',
      category: 'Audio/Video',
      old_version: '5.5.7',
      new_version: '5.5.8',
      release_date: '2025-11-24',
      release_notes: ['Fixed audio sync issues', 'Improved timeline performance'],
      update_type: 'patch' as const,
    },
    {
      software_id: '2',
      name: 'ProPresenter',
      manufacturer: 'Renewed Vision',
      category: 'Presentation',
      old_version: '21.0',
      new_version: '21.1',
      release_date: '2025-12-03',
      release_notes: ['New NDI output options', 'Bug fixes for stage display', 'Performance improvements'],
      update_type: 'minor' as const,
    },
    {
      software_id: '3',
      name: 'Resolume Arena',
      manufacturer: 'Resolume',
      category: 'VJ Software',
      old_version: '7.20.0',
      new_version: '8.0.0',
      release_date: '2025-12-01',
      release_notes: ['Complete UI redesign', 'New effects engine', 'Improved MIDI mapping'],
      update_type: 'major' as const,
    },
  ],
  newSoftware: [
    {
      software_id: '4',
      name: 'Companion',
      manufacturer: 'Bitfocus',
      category: 'Control Software',
      initial_version: '3.2.0',
      added_date: '2025-12-08',
    },
    {
      software_id: '5',
      name: 'TouchDesigner',
      manufacturer: 'Derivative',
      category: 'Visual Programming',
      initial_version: '2023.11760',
      added_date: '2025-12-07',
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
} satisfies WeeklyDigestProps;

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

const updatesSection: React.CSSProperties = {
  padding: '0 24px 24px 24px',
};

const viewAllText: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '16px 0 0 0',
};

const viewAllLink: React.CSSProperties = {
  fontSize: '13px',
  color: '#3b82f6',
  textDecoration: 'none',
};

const emptySection: React.CSSProperties = {
  padding: '32px 24px 48px 24px',
  textAlign: 'center' as const,
};

const emptyIcon: React.CSSProperties = {
  fontSize: '48px',
  margin: '0 0 16px 0',
};

const emptyText: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#ffffff',
  margin: '0 0 8px 0',
};

const emptySubtext: React.CSSProperties = {
  fontSize: '14px',
  color: '#737373',
  margin: '0',
};

const newSoftwareSection: React.CSSProperties = {
  padding: '24px 24px 0 24px',
};

const sectionHeading: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#ffffff',
  margin: '0 0 4px 0',
};

const sectionSubheading: React.CSSProperties = {
  fontSize: '13px',
  color: '#a3a3a3',
  margin: '0 0 16px 0',
};

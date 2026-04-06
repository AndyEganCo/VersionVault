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

interface ReferralRewardProps {
  userName: string;
  monthsEarned: number;
  reason: 'signup' | 'paid' | 'milestone';
  friendName?: string;
  milestoneCount?: number;
  totalMonthsEarned: number;
  referralsUrl: string;
  preferencesUrl: string;
}

export default function ReferralReward({
  userName,
  monthsEarned,
  reason,
  friendName,
  milestoneCount,
  totalMonthsEarned,
  referralsUrl,
  preferencesUrl,
}: ReferralRewardProps) {
  const reasonText = {
    signup: `${friendName || 'Your friend'} just signed up using your referral link!`,
    paid: `${friendName || 'Your friend'} just became a Pro subscriber!`,
    milestone: `You hit the ${milestoneCount}-referral milestone!`,
  }[reason];

  return (
    <Html>
      <Head />
      <Preview>You earned {monthsEarned} month{monthsEarned > 1 ? 's' : ''} of Pro!</Preview>
      <Body style={body}>
        <Container style={container}>
          <Header title="Referral Reward" />

          <Section style={contentSection}>
            <Text style={greetingText}>Hey {userName},</Text>
            <Text style={bodyText}>{reasonText}</Text>
          </Section>

          <Section style={rewardSection}>
            <Text style={rewardAmount}>+{monthsEarned} month{monthsEarned > 1 ? 's' : ''}</Text>
            <Text style={rewardLabel}>of Pro added to your account</Text>
          </Section>

          <Section style={contentSection}>
            <Text style={bodyText}>
              You've earned <strong>{totalMonthsEarned} months</strong> total through referrals.
              Keep sharing to earn more!
            </Text>
          </Section>

          <Section style={ctaSection}>
            <Link href={referralsUrl} style={ctaButton}>
              View Your Referrals
            </Link>
          </Section>

          <Footer unsubscribeUrl={preferencesUrl} preferencesUrl={preferencesUrl} />
        </Container>
      </Body>
    </Html>
  );
}

ReferralReward.PreviewProps = {
  userName: 'Andy',
  monthsEarned: 1,
  reason: 'signup' as const,
  friendName: 'Sarah',
  totalMonthsEarned: 3,
  referralsUrl: 'https://versionvault.dev/user/referrals',
  preferencesUrl: 'https://versionvault.dev/user/notifications',
} satisfies ReferralRewardProps;

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

const rewardSection: React.CSSProperties = {
  padding: '16px 24px',
  textAlign: 'center' as const,
};

const rewardAmount: React.CSSProperties = {
  fontSize: '32px',
  fontWeight: '700',
  color: '#2563eb',
  margin: '0',
};

const rewardLabel: React.CSSProperties = {
  fontSize: '14px',
  color: '#a3a3a3',
  margin: '4px 0 0 0',
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

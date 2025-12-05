import {
  Section,
  Text,
  Link,
} from '@react-email/components';

interface HeaderProps {
  title?: string;
}

export function Header({ title = 'Version Digest' }: HeaderProps) {
  return (
    <Section style={headerSection}>
      <table width="100%" cellPadding={0} cellSpacing={0} style={{ margin: 0 }}>
        <tr>
          <td>
            <Link href="https://versionvault.dev" style={logoLink}>
              <Text style={logo}>
                <span style={logoPrompt}>&gt;_</span> VersionVault
              </Text>
            </Link>
          </td>
        </tr>
        <tr>
          <td>
            <Text style={titleText}>{title}</Text>
          </td>
        </tr>
      </table>
    </Section>
  );
}

const headerSection: React.CSSProperties = {
  padding: '32px 24px 24px 24px',
  borderBottom: '1px solid #262626',
};

const logoLink: React.CSSProperties = {
  textDecoration: 'none',
};

const logo: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: '600',
  color: '#ffffff',
  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  margin: '0 0 8px 0',
};

const logoPrompt: React.CSSProperties = {
  color: '#a3a3a3',
};

const titleText: React.CSSProperties = {
  fontSize: '14px',
  color: '#a3a3a3',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: '0',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

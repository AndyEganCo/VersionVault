import { Link } from 'react-router-dom';
import { PageContainer } from './layout/page-container';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t mt-auto">
      <PageContainer>
        <div className="py-6">
          <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center text-sm text-muted-foreground">
            <p>© {currentYear} VersionVault. All rights reserved.</p>

            <nav className="flex flex-wrap gap-6">
              <Link to="/privacy" className="hover:text-primary transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-primary transition-colors">
                Terms & Conditions
              </Link>
            </nav>
          </div>
        </div>
      </PageContainer>
    </footer>
  );
}

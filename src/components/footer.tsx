import { Link } from 'react-router-dom';
import { Terminal } from 'lucide-react';
import { PageContainer } from './layout/page-container';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30 mt-auto">
      <PageContainer>
        <div className="py-8 md:py-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Brand Section */}
            <div className="space-y-4">
              <Link to="/" className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                <span className="font-semibold">VersionVault</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                Never miss a software update again. Track 400+ apps and get notified when new versions release.
              </p>
            </div>

            {/* Product Links */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Product</h3>
              <ul className="space-y-3">
                <li>
                  <Link to="/software" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Browse Software
                  </Link>
                </li>
                <li>
                  <Link to="/premium" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Premium
                  </Link>
                </li>
                <li>
                  <Link to="/donate" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Donate
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal Links */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Legal</h3>
              <ul className="space-y-3">
                <li>
                  <Link to="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Terms & Conditions
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-8 pt-8 border-t">
            <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
              <p className="text-sm text-muted-foreground">
                © {currentYear} VersionVault. All rights reserved.
              </p>
              <p className="text-sm text-muted-foreground">
                Made with ❤️ for developers
              </p>
            </div>
          </div>
        </div>
      </PageContainer>
    </footer>
  );
}

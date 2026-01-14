import { Helmet } from 'react-helmet-async';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';

export function Privacy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy - VersionVault</title>
        <meta name="description" content="VersionVault Privacy Policy - Learn how we collect, use, and protect your personal information." />
      </Helmet>

      <PageContainer>
        <PageHeader
          title="Privacy Policy"
          description="Last Updated: January 14, 2026"
        />

        <div className="prose prose-slate dark:prose-invert max-w-4xl mx-auto">
          <section className="space-y-4 mb-8">
            <p>
              This Privacy Policy describes how VersionVault ("we," "us," or "our") collects, uses, and shares your personal information when you use our software version tracking service available at versionvault.dev (the "Service").
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">1. Information We Collect</h2>

            <h3 className="text-xl font-semibold">1.1 Information You Provide</h3>
            <p>When you create an account or use our Service, we collect:</p>
            <ul>
              <li><strong>Account Information:</strong> Email address, password (encrypted), and profile preferences</li>
              <li><strong>Tracking Preferences:</strong> Software applications you choose to track and notification frequency settings</li>
              <li><strong>Payment Information:</strong> If you subscribe to premium features or make donations, payment information is processed securely through third-party payment processors</li>
              <li><strong>Communications:</strong> When you contact us, we collect the content of your messages</li>
            </ul>

            <h3 className="text-xl font-semibold">1.2 Automatically Collected Information</h3>
            <p>We automatically collect certain information when you use our Service:</p>
            <ul>
              <li><strong>Usage Data:</strong> Information about how you interact with our Service, including pages visited and features used</li>
              <li><strong>Device Information:</strong> Browser type, operating system, IP address, and device identifiers</li>
              <li><strong>Cookies and Similar Technologies:</strong> We use cookies and similar tracking technologies to enhance your experience</li>
            </ul>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve our Service</li>
              <li>Send you email notifications about software version updates based on your tracking preferences</li>
              <li>Process your subscription or donation payments</li>
              <li>Respond to your comments, questions, and customer service requests</li>
              <li>Send you technical notices, updates, security alerts, and administrative messages</li>
              <li>Monitor and analyze trends, usage, and activities in connection with our Service</li>
              <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities</li>
              <li>Personalize and improve your experience</li>
            </ul>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">3. How We Share Your Information</h2>
            <p>We may share your information in the following circumstances:</p>
            <ul>
              <li><strong>Service Providers:</strong> We share information with third-party service providers who perform services on our behalf, such as email delivery, payment processing, analytics, and AI-powered version detection</li>
              <li><strong>Legal Requirements:</strong> We may disclose your information if required by law or in response to valid requests by public authorities</li>
              <li><strong>Business Transfers:</strong> If we are involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction</li>
              <li><strong>With Your Consent:</strong> We may share your information with your consent or at your direction</li>
            </ul>
            <p>We do not sell your personal information to third parties.</p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">4. Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar tracking technologies to collect information about your browsing activities. Cookies are small data files stored on your device that help us improve our Service and your experience.
            </p>
            <p>Types of cookies we use:</p>
            <ul>
              <li><strong>Essential Cookies:</strong> Required for the Service to function properly</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how users interact with our Service</li>
              <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
            </ul>
            <p>
              You can control cookies through your browser settings. However, disabling cookies may affect the functionality of our Service.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">5. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no internet transmission or electronic storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">6. Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to provide you with our Service and as described in this Privacy Policy. We will also retain and use your information to comply with our legal obligations, resolve disputes, and enforce our agreements.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">7. Your Rights and Choices</h2>
            <p>Depending on your location, you may have certain rights regarding your personal information:</p>
            <ul>
              <li><strong>Access:</strong> You can request access to the personal information we hold about you</li>
              <li><strong>Correction:</strong> You can request correction of inaccurate information</li>
              <li><strong>Deletion:</strong> You can request deletion of your personal information</li>
              <li><strong>Opt-Out:</strong> You can opt out of receiving marketing emails by using the unsubscribe link in our emails or by adjusting your account settings</li>
              <li><strong>Data Portability:</strong> You can request a copy of your data in a structured, commonly used format</li>
            </ul>
            <p>
              To exercise these rights, please contact us using the information provided below.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">8. California Privacy Rights</h2>
            <p>
              If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
            </p>
            <ul>
              <li>Right to know what personal information is collected, used, shared, or sold</li>
              <li>Right to delete personal information held by us</li>
              <li>Right to opt-out of the sale of personal information (we do not sell personal information)</li>
              <li>Right to non-discrimination for exercising your CCPA rights</li>
            </ul>
            <p>
              To exercise your California privacy rights, please contact us at the email address below.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">9. Children's Privacy</h2>
            <p>
              Our Service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">10. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that are different from the laws of your country. We take appropriate measures to ensure that your personal information remains protected in accordance with this Privacy Policy.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">11. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">12. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <p>
              <strong>Email:</strong> privacy@versionvault.dev
            </p>
          </section>
        </div>
      </PageContainer>
    </>
  );
}

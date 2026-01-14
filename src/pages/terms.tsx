import { Helmet } from 'react-helmet-async';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';

export function Terms() {
  return (
    <>
      <Helmet>
        <title>Terms and Conditions - VersionVault</title>
        <meta name="description" content="VersionVault Terms and Conditions - Read our terms of service and user agreement." />
      </Helmet>

      <PageContainer>
        <PageHeader
          title="Terms and Conditions"
          description="Last Updated: January 14, 2026"
        />

        <div className="prose prose-slate dark:prose-invert max-w-4xl mx-auto">
          <section className="space-y-4 mb-8">
            <p>
              These Terms and Conditions ("Terms") govern your access to and use of VersionVault ("Service," "we," "us," or "our"), a software version tracking service available at versionvault.dev. By accessing or using our Service, you agree to be bound by these Terms.
            </p>
            <p>
              <strong>PLEASE READ THESE TERMS CAREFULLY BEFORE USING THE SERVICE. IF YOU DO NOT AGREE TO THESE TERMS, DO NOT USE THE SERVICE.</strong>
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">1. Acceptance of Terms</h2>
            <p>
              By creating an account, accessing, or using VersionVault, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you are using the Service on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">2. Description of Service</h2>
            <p>
              VersionVault is a software version tracking service that monitors software applications and provides email notifications when new versions are released. The Service includes:
            </p>
            <ul>
              <li>Access to a catalog of tracked software applications</li>
              <li>Ability to track selected software applications</li>
              <li>Email notifications about version updates</li>
              <li>Version history and release notes</li>
              <li>Customizable notification preferences</li>
              <li>Additional premium features (if subscribed)</li>
            </ul>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">3. User Accounts</h2>

            <h3 className="text-xl font-semibold">3.1 Account Creation</h3>
            <p>
              To use certain features of the Service, you must create an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.
            </p>

            <h3 className="text-xl font-semibold">3.2 Account Security</h3>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
            </p>

            <h3 className="text-xl font-semibold">3.3 Account Termination</h3>
            <p>
              You may terminate your account at any time through your account settings. We reserve the right to suspend or terminate your account if you violate these Terms or for any other reason at our sole discretion.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">4. User Responsibilities</h2>
            <p>You agree to:</p>
            <ul>
              <li>Use the Service only for lawful purposes and in accordance with these Terms</li>
              <li>Not use the Service in any way that could damage, disable, overburden, or impair our servers or networks</li>
              <li>Not attempt to gain unauthorized access to any portion of the Service</li>
              <li>Not use any automated system, including "robots" or "spiders," to access the Service without our prior written permission</li>
              <li>Not transmit any viruses, malware, or other malicious code</li>
              <li>Not impersonate any person or entity or misrepresent your affiliation with any person or entity</li>
              <li>Not interfere with or disrupt the Service or servers or networks connected to the Service</li>
            </ul>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">5. License and Intellectual Property</h2>

            <h3 className="text-xl font-semibold">5.1 License Grant</h3>
            <p>
              Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal or internal business purposes.
            </p>

            <h3 className="text-xl font-semibold">5.2 Ownership</h3>
            <p>
              The Service, including all content, features, and functionality, is owned by VersionVault and is protected by United States and international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>

            <h3 className="text-xl font-semibold">5.3 Restrictions</h3>
            <p>
              You may not copy, modify, distribute, sell, or lease any part of our Service, nor may you reverse engineer or attempt to extract the source code of the Service.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">6. Subscriptions and Payments</h2>

            <h3 className="text-xl font-semibold">6.1 Premium Features</h3>
            <p>
              Certain features of the Service may require payment of subscription fees. By subscribing to premium features, you agree to pay all applicable fees as described at the time of purchase.
            </p>

            <h3 className="text-xl font-semibold">6.2 Billing</h3>
            <p>
              Subscription fees are billed in advance on a recurring basis (monthly, annually, etc.). Your subscription will automatically renew unless you cancel it before the renewal date.
            </p>

            <h3 className="text-xl font-semibold">6.3 Refunds</h3>
            <p>
              Refunds are handled on a case-by-case basis. Please contact us if you believe you are entitled to a refund.
            </p>

            <h3 className="text-xl font-semibold">6.4 Price Changes</h3>
            <p>
              We reserve the right to change our subscription fees at any time. We will provide you with reasonable notice of any fee changes.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">7. Service Availability</h2>
            <p>
              We strive to provide reliable Service, but we do not guarantee that the Service will be uninterrupted, timely, secure, or error-free. We reserve the right to modify, suspend, or discontinue the Service at any time without notice.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">8. Third-Party Content and Links</h2>
            <p>
              The Service may contain links to third-party websites or services that are not owned or controlled by VersionVault. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party websites or services.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">9. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, OR THAT ANY DEFECTS WILL BE CORRECTED.
            </p>
            <p>
              WE MAKE NO WARRANTIES ABOUT THE ACCURACY, RELIABILITY, COMPLETENESS, OR TIMELINESS OF THE VERSION INFORMATION PROVIDED BY THE SERVICE.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">10. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL VERSIONVAULT, ITS AFFILIATES, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
            </p>
            <p>
              OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE LIABILITY, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS GREATER.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">11. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless VersionVault and its affiliates, officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with your access to or use of the Service or your violation of these Terms.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">12. DMCA Compliance</h2>
            <p>
              We respect the intellectual property rights of others and expect our users to do the same. In accordance with the Digital Millennium Copyright Act (DMCA), we will respond to notices of alleged copyright infringement that comply with the DMCA and other applicable laws.
            </p>
            <p>
              If you believe that your work has been copied in a way that constitutes copyright infringement, please contact us at privacy@versionvault.dev with:
            </p>
            <ul>
              <li>A description of the copyrighted work that you claim has been infringed</li>
              <li>A description of where the allegedly infringing material is located on the Service</li>
              <li>Your contact information</li>
              <li>A statement that you have a good faith belief that the use is not authorized</li>
              <li>A statement, under penalty of perjury, that the information in your notice is accurate</li>
              <li>Your physical or electronic signature</li>
            </ul>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">13. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. If we make material changes to these Terms, we will notify you by email or by posting a notice on our Service prior to the effective date of the changes. Your continued use of the Service after the effective date constitutes your acceptance of the revised Terms.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">14. Governing Law and Dispute Resolution</h2>

            <h3 className="text-xl font-semibold">14.1 Governing Law</h3>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the United States and the State of [Your State], without regard to its conflict of law provisions.
            </p>

            <h3 className="text-xl font-semibold">14.2 Dispute Resolution</h3>
            <p>
              Any dispute arising out of or relating to these Terms or the Service shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association, except that either party may seek injunctive or other equitable relief in any court of competent jurisdiction.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">15. Miscellaneous</h2>

            <h3 className="text-xl font-semibold">15.1 Entire Agreement</h3>
            <p>
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and VersionVault regarding the Service and supersede all prior agreements.
            </p>

            <h3 className="text-xl font-semibold">15.2 Severability</h3>
            <p>
              If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions will remain in full force and effect.
            </p>

            <h3 className="text-xl font-semibold">15.3 Waiver</h3>
            <p>
              No waiver of any term of these Terms shall be deemed a further or continuing waiver of such term or any other term.
            </p>

            <h3 className="text-xl font-semibold">15.4 Assignment</h3>
            <p>
              You may not assign or transfer these Terms or your rights under these Terms without our prior written consent. We may assign these Terms without restriction.
            </p>
          </section>

          <section className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold">16. Contact Information</h2>
            <p>
              If you have any questions about these Terms, please contact us at:
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

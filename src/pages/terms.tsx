import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Shield, CreditCard, Users, AlertCircle, Scale } from 'lucide-react';

export function Terms() {
  return (
    <>
      <Helmet>
        <title>Terms and Conditions - VersionVault</title>
        <meta name="description" content="VersionVault Terms and Conditions - Read our terms of service and user agreement." />
      </Helmet>

      <div className="container max-w-4xl mx-auto py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-purple-500/10 flex items-center justify-center">
              <FileText className="h-8 w-8 text-purple-500" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">Terms and Conditions</h1>
          <p className="text-muted-foreground">
            Last Updated: January 14, 2026
          </p>
        </div>

        {/* Introduction */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <p className="text-muted-foreground leading-relaxed mb-4">
              These Terms and Conditions ("Terms") govern your access to and use of VersionVault ("Service," "we," "us," or "our"), a software version tracking service available at versionvault.dev. By accessing or using our Service, you agree to be bound by these Terms.
            </p>
            <p className="font-semibold text-sm">
              PLEASE READ THESE TERMS CAREFULLY BEFORE USING THE SERVICE. IF YOU DO NOT AGREE TO THESE TERMS, DO NOT USE THE SERVICE.
            </p>
          </CardContent>
        </Card>

        {/* Key Points Grid */}
        <div className="grid md:grid-cols-4 gap-4 mb-12">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                <Shield className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-sm font-semibold">User Protection</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <CreditCard className="h-5 w-5 text-green-500" />
              </div>
              <p className="text-sm font-semibold">Fair Billing</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <p className="text-sm font-semibold">Clear Rights</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-3">
                <Scale className="h-5 w-5 text-orange-500" />
              </div>
              <p className="text-sm font-semibold">Legal Clarity</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Acceptance */}
          <Card>
            <CardHeader>
              <CardTitle>1. Acceptance of Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                By creating an account, accessing, or using VersionVault, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you are using the Service on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.
              </p>
            </CardContent>
          </Card>

          {/* Description of Service */}
          <Card>
            <CardHeader>
              <CardTitle>2. Description of Service</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                VersionVault is a software version tracking service that monitors software applications and provides email notifications when new versions are released. The Service includes:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                <li>Access to a catalog of tracked software applications</li>
                <li>Ability to track selected software applications</li>
                <li>Email notifications about version updates</li>
                <li>Version history and release notes</li>
                <li>Customizable notification preferences</li>
                <li>Additional premium features (if subscribed)</li>
              </ul>
            </CardContent>
          </Card>

          {/* User Accounts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                3. User Accounts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2 text-sm">Account Creation</h3>
                <p className="text-sm text-muted-foreground">
                  To use certain features of the Service, you must create an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm">Account Security</h3>
                <p className="text-sm text-muted-foreground">
                  You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm">Account Termination</h3>
                <p className="text-sm text-muted-foreground">
                  You may terminate your account at any time through your account settings. We reserve the right to suspend or terminate your account if you violate these Terms or for any other reason at our sole discretion.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* User Responsibilities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                4. User Responsibilities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">You agree to:</p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                <li>Use the Service only for lawful purposes and in accordance with these Terms</li>
                <li>Not use the Service in any way that could damage, disable, overburden, or impair our servers or networks</li>
                <li>Not attempt to gain unauthorized access to any portion of the Service</li>
                <li>Not use any automated system, including "robots" or "spiders," to access the Service without our prior written permission</li>
                <li>Not transmit any viruses, malware, or other malicious code</li>
                <li>Not impersonate any person or entity or misrepresent your affiliation with any person or entity</li>
                <li>Not interfere with or disrupt the Service or servers or networks connected to the Service</li>
              </ul>
            </CardContent>
          </Card>

          {/* License and IP */}
          <Card>
            <CardHeader>
              <CardTitle>5. License and Intellectual Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2 text-sm">License Grant</h3>
                <p className="text-sm text-muted-foreground">
                  Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal or internal business purposes.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm">Ownership</h3>
                <p className="text-sm text-muted-foreground">
                  The Service, including all content, features, and functionality, is owned by VersionVault and is protected by United States and international copyright, trademark, patent, trade secret, and other intellectual property laws.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm">Restrictions</h3>
                <p className="text-sm text-muted-foreground">
                  You may not copy, modify, distribute, sell, or lease any part of our Service, nor may you reverse engineer or attempt to extract the source code of the Service.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Subscriptions and Payments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                6. Subscriptions and Payments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2 text-sm">Premium Features</h3>
                <p className="text-sm text-muted-foreground">
                  Certain features of the Service may require payment of subscription fees. By subscribing to premium features, you agree to pay all applicable fees as described at the time of purchase.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm">Billing</h3>
                <p className="text-sm text-muted-foreground">
                  Subscription fees are billed in advance on a recurring basis (monthly, annually, etc.). Your subscription will automatically renew unless you cancel it before the renewal date.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm">Refunds</h3>
                <p className="text-sm text-muted-foreground">
                  Refunds are handled on a case-by-case basis. Please contact us if you believe you are entitled to a refund.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm">Price Changes</h3>
                <p className="text-sm text-muted-foreground">
                  We reserve the right to change our subscription fees at any time. We will provide you with reasonable notice of any fee changes.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Service Availability */}
          <Card>
            <CardHeader>
              <CardTitle>7. Service Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We strive to provide reliable Service, but we do not guarantee that the Service will be uninterrupted, timely, secure, or error-free. We reserve the right to modify, suspend, or discontinue the Service at any time without notice.
              </p>
            </CardContent>
          </Card>

          {/* Third-Party Links */}
          <Card>
            <CardHeader>
              <CardTitle>8. Third-Party Content and Links</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The Service may contain links to third-party websites or services that are not owned or controlled by VersionVault. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party websites or services.
              </p>
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <Card className="border-orange-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                9. Disclaimer of Warranties
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
              <p className="text-sm text-muted-foreground">
                WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, OR THAT ANY DEFECTS WILL BE CORRECTED. WE MAKE NO WARRANTIES ABOUT THE ACCURACY, RELIABILITY, COMPLETENESS, OR TIMELINESS OF THE VERSION INFORMATION PROVIDED BY THE SERVICE.
              </p>
            </CardContent>
          </Card>

          {/* Limitation of Liability */}
          <Card className="border-red-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-500" />
                10. Limitation of Liability
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL VERSIONVAULT, ITS AFFILIATES, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
              </p>
              <p className="text-sm text-muted-foreground">
                OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE LIABILITY, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS GREATER.
              </p>
            </CardContent>
          </Card>

          {/* Indemnification */}
          <Card>
            <CardHeader>
              <CardTitle>11. Indemnification</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You agree to indemnify, defend, and hold harmless VersionVault and its affiliates, officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with your access to or use of the Service or your violation of these Terms.
              </p>
            </CardContent>
          </Card>

          {/* DMCA */}
          <Card>
            <CardHeader>
              <CardTitle>12. DMCA Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                We respect the intellectual property rights of others and expect our users to do the same. In accordance with the Digital Millennium Copyright Act (DMCA), we will respond to notices of alleged copyright infringement that comply with the DMCA and other applicable laws.
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                If you believe that your work has been copied in a way that constitutes copyright infringement, please contact us at support@versionvault.dev with:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                <li>A description of the copyrighted work that you claim has been infringed</li>
                <li>A description of where the allegedly infringing material is located on the Service</li>
                <li>Your contact information</li>
                <li>A statement that you have a good faith belief that the use is not authorized</li>
                <li>A statement, under penalty of perjury, that the information in your notice is accurate</li>
                <li>Your physical or electronic signature</li>
              </ul>
            </CardContent>
          </Card>

          {/* Changes to Terms */}
          <Card>
            <CardHeader>
              <CardTitle>13. Changes to Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We reserve the right to modify these Terms at any time. If we make material changes to these Terms, we will notify you by email or by posting a notice on our Service prior to the effective date of the changes. Your continued use of the Service after the effective date constitutes your acceptance of the revised Terms.
              </p>
            </CardContent>
          </Card>

          {/* Governing Law */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                14. Governing Law and Dispute Resolution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2 text-sm">Governing Law</h3>
                <p className="text-sm text-muted-foreground">
                  These Terms shall be governed by and construed in accordance with the laws of the United States and the State of Louisiana, without regard to its conflict of law provisions.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm">Dispute Resolution</h3>
                <p className="text-sm text-muted-foreground">
                  Any dispute arising out of or relating to these Terms or the Service shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association, except that either party may seek injunctive or other equitable relief in any court of competent jurisdiction.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Miscellaneous */}
          <Card>
            <CardHeader>
              <CardTitle>15. Miscellaneous</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2 text-sm">Entire Agreement</h3>
                <p className="text-sm text-muted-foreground">
                  These Terms, together with our Privacy Policy, constitute the entire agreement between you and VersionVault regarding the Service and supersede all prior agreements.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm">Severability</h3>
                <p className="text-sm text-muted-foreground">
                  If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions will remain in full force and effect.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm">Waiver</h3>
                <p className="text-sm text-muted-foreground">
                  No waiver of any term of these Terms shall be deemed a further or continuing waiver of such term or any other term.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm">Assignment</h3>
                <p className="text-sm text-muted-foreground">
                  You may not assign or transfer these Terms or your rights under these Terms without our prior written consent. We may assign these Terms without restriction.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle>16. Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                If you have any questions about these Terms, please contact us at:
              </p>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm">
                  <strong>Email:</strong>{' '}
                  <a href="mailto:support@versionvault.dev" className="text-primary hover:underline">
                    support@versionvault.dev
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

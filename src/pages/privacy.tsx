import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, Eye, FileText, Scale, Globe } from 'lucide-react';

export function Privacy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy - VersionVault</title>
        <meta name="description" content="VersionVault Privacy Policy - Learn how we collect, use, and protect your personal information." />
      </Helmet>

      <div className="container max-w-4xl mx-auto py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Shield className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground">
            Last Updated: January 14, 2026
          </p>
        </div>

        {/* Introduction */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <p className="text-muted-foreground leading-relaxed">
              This Privacy Policy describes how VersionVault ("we," "us," or "our") collects, uses, and shares your personal information when you use our software version tracking service available at versionvault.dev (the "Service").
            </p>
          </CardContent>
        </Card>

        {/* Key Points Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="font-semibold mb-2">Secure</h3>
              <p className="text-sm text-muted-foreground">
                Your data is encrypted and protected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <Eye className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="font-semibold mb-2">Transparent</h3>
              <p className="text-sm text-muted-foreground">
                We're clear about what we collect
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                <Scale className="h-6 w-6 text-purple-500" />
              </div>
              <h3 className="font-semibold mb-2">Your Rights</h3>
              <p className="text-sm text-muted-foreground">
                You control your personal data
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Information We Collect */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                1. Information We Collect
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Information You Provide</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  When you create an account or use our Service, we collect:
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                  <li><strong>Account Information:</strong> Email address, password (encrypted), and profile preferences</li>
                  <li><strong>Tracking Preferences:</strong> Software applications you choose to track and notification frequency settings</li>
                  <li><strong>Payment Information:</strong> If you subscribe to premium features or make donations, payment information is processed securely through third-party payment processors</li>
                  <li><strong>Communications:</strong> When you contact us, we collect the content of your messages</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Automatically Collected Information</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  We automatically collect certain information when you use our Service:
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                  <li><strong>Usage Data:</strong> Information about how you interact with our Service, including pages visited and features used</li>
                  <li><strong>Device Information:</strong> Browser type, operating system, IP address, and device identifiers</li>
                  <li><strong>Cookies and Similar Technologies:</strong> We use cookies and similar tracking technologies to enhance your experience</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* How We Use Your Information */}
          <Card>
            <CardHeader>
              <CardTitle>2. How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                <li>Provide, maintain, and improve our Service</li>
                <li>Send you email notifications about software version updates based on your tracking preferences</li>
                <li>Process your subscription or donation payments</li>
                <li>Respond to your comments, questions, and customer service requests</li>
                <li>Send you technical notices, updates, security alerts, and administrative messages</li>
                <li>Monitor and analyze trends, usage, and activities in connection with our Service</li>
                <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities</li>
                <li>Personalize and improve your experience</li>
              </ul>
            </CardContent>
          </Card>

          {/* How We Share Your Information */}
          <Card>
            <CardHeader>
              <CardTitle>3. How We Share Your Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                We may share your information in the following circumstances:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                <li><strong>Service Providers:</strong> We share information with third-party service providers who perform services on our behalf, such as email delivery, payment processing, analytics, and AI-powered version detection</li>
                <li><strong>Legal Requirements:</strong> We may disclose your information if required by law or in response to valid requests by public authorities</li>
                <li><strong>Business Transfers:</strong> If we are involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction</li>
                <li><strong>With Your Consent:</strong> We may share your information with your consent or at your direction</li>
              </ul>
              <p className="text-sm font-semibold mt-4 text-primary">
                We do not sell your personal information to third parties.
              </p>
            </CardContent>
          </Card>

          {/* Cookies and Tracking */}
          <Card>
            <CardHeader>
              <CardTitle>4. Cookies and Tracking Technologies</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                We use cookies and similar tracking technologies to collect information about your browsing activities. Cookies are small data files stored on your device that help us improve our Service and your experience.
              </p>
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-sm mb-1">Types of cookies we use:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    <li><strong>Essential Cookies:</strong> Required for the Service to function properly</li>
                    <li><strong>Analytics Cookies:</strong> Help us understand how users interact with our Service</li>
                    <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground">
                  You can control cookies through your browser settings. However, disabling cookies may affect the functionality of our Service.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                5. Data Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no internet transmission or electronic storage is 100% secure, and we cannot guarantee absolute security.
              </p>
            </CardContent>
          </Card>

          {/* Data Retention */}
          <Card>
            <CardHeader>
              <CardTitle>6. Data Retention</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We retain your personal information for as long as necessary to provide you with our Service and as described in this Privacy Policy. We will also retain and use your information to comply with our legal obligations, resolve disputes, and enforce our agreements.
              </p>
            </CardContent>
          </Card>

          {/* Your Rights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                7. Your Rights and Choices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Depending on your location, you may have certain rights regarding your personal information:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                <li><strong>Access:</strong> You can request access to the personal information we hold about you</li>
                <li><strong>Correction:</strong> You can request correction of inaccurate information</li>
                <li><strong>Deletion:</strong> You can request deletion of your personal information</li>
                <li><strong>Opt-Out:</strong> You can opt out of receiving marketing emails by using the unsubscribe link in our emails or by adjusting your account settings</li>
                <li><strong>Data Portability:</strong> You can request a copy of your data in a structured, commonly used format</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-3">
                To exercise these rights, please contact us using the information provided below.
              </p>
            </CardContent>
          </Card>

          {/* California Privacy Rights */}
          <Card>
            <CardHeader>
              <CardTitle>8. California Privacy Rights (CCPA)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                <li>Right to know what personal information is collected, used, shared, or sold</li>
                <li>Right to delete personal information held by us</li>
                <li>Right to opt-out of the sale of personal information (we do not sell personal information)</li>
                <li>Right to non-discrimination for exercising your CCPA rights</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-3">
                To exercise your California privacy rights, please contact us at the email address below.
              </p>
            </CardContent>
          </Card>

          {/* Children's Privacy */}
          <Card>
            <CardHeader>
              <CardTitle>9. Children's Privacy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Our Service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
              </p>
            </CardContent>
          </Card>

          {/* International Data Transfers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                10. International Data Transfers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that are different from the laws of your country. We take appropriate measures to ensure that your personal information remains protected in accordance with this Privacy Policy.
              </p>
            </CardContent>
          </Card>

          {/* Changes to Privacy Policy */}
          <Card>
            <CardHeader>
              <CardTitle>11. Changes to This Privacy Policy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </CardContent>
          </Card>

          {/* Contact Us */}
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle>12. Contact Us</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
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

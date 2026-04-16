const Privacy = () => {
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-2 text-foreground">Privacy Policy for The Nest</h1>
          <p className="text-muted-foreground mb-8">Effective Date: 4/16/2026</p>

          <p className="text-foreground mb-6">
            The Nest ("we," "our," or "us") respects your privacy and is committed to protecting it through this Privacy Policy.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3 text-foreground">1. Information We Collect</h2>
          <p className="text-foreground mb-3">We may collect the following types of information:</p>
          <ul className="list-disc pl-6 space-y-2 text-foreground mb-6">
            <li><strong>Personal Information:</strong> name, email address, phone number, and account login details</li>
            <li><strong>Usage Data:</strong> interactions within the app, features used, and activity logs</li>
            <li><strong>Device Information:</strong> device type, operating system, and app version</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-8 mb-3 text-foreground">2. How We Use Information</h2>
          <p className="text-foreground mb-3">We use the information we collect to:</p>
          <ul className="list-disc pl-6 space-y-2 text-foreground mb-6">
            <li>Provide, operate, and maintain the app</li>
            <li>Improve user experience and app functionality</li>
            <li>Communicate with users regarding updates, support, or important notices</li>
            <li>Ensure security and prevent fraud</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-8 mb-3 text-foreground">3. Sharing of Information</h2>
          <p className="text-foreground mb-6">
            We do not sell your personal information. We may share information with trusted third-party services (such as hosting providers, analytics tools, or payment processors) strictly to operate the app.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3 text-foreground">4. Data Security</h2>
          <p className="text-foreground mb-6">
            We implement reasonable safeguards to protect your information. However, no method of transmission over the internet is 100% secure.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3 text-foreground">5. Data Retention</h2>
          <p className="text-foreground mb-6">
            We retain personal data only as long as necessary to provide services and fulfill legal obligations.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3 text-foreground">6. Children's Privacy</h2>
          <p className="text-foreground mb-6">
            The Nest is not intended for children under 13. We do not knowingly collect personal information from children.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3 text-foreground">7. Your Rights</h2>
          <p className="text-foreground mb-6">
            You may request access to, correction of, or deletion of your personal data by contacting us.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3 text-foreground">8. Changes to This Policy</h2>
          <p className="text-foreground mb-6">
            We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated effective date.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3 text-foreground">9. Contact Us</h2>
          <p className="text-foreground mb-2">
            If you have any questions about this Privacy Policy, please contact us at:
          </p>
          <p className="text-foreground">
            Email: <a href="mailto:todd@camptlc.com" className="text-primary hover:underline">todd@camptlc.com</a>
          </p>
        </article>
      </div>
    </div>
  );
};

export default Privacy;

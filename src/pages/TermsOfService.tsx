import { Link } from 'react-router-dom';

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header - light blue */}
      <header className="bg-sky-100 border-b border-sky-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-3">
            <img
              src="/assets/Logo-transparent_bg.png"
              alt="aitamate"
              className="h-14 sm:h-16 w-auto"
            />
          </Link>
          <Link
            to="/login"
            className="text-base text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Back to Login
          </Link>
        </div>
      </header>

      {/* Content - no container, free on page background */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-primary-600 mb-8 text-center">
          Terms of Service
        </h1>

        <div className="prose prose-gray max-w-none space-y-8 text-base sm:text-lg">
            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                1. Acceptance of terms
              </h2>
              <p className="text-gray-600 leading-relaxed">
                By accessing or using ProValuate (“Service”), you agree to be bound by these Terms
                of Service (“Terms”). If you do not agree, do not use the Service. We may update
                these Terms from time to time; the “Last updated” date at the top will reflect the
                latest version. Continued use after changes constitutes acceptance where permitted
                by law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                2. Description of the service
              </h2>
              <p className="text-gray-600 leading-relaxed">
                ProValuate is an AI-powered candidate assessment platform that helps recruiters and
                companies screen resumes, define evaluation criteria, and conduct AI-assisted
                interviews. Use of the Service is subject to your plan, applicable laws, and these
                Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                3. Account and obligations
              </h2>
              <p className="text-gray-600 leading-relaxed">
                You must provide accurate account information and keep it up to date. You are
                responsible for maintaining the confidentiality of your credentials and for all
                activity under your account. You must use the Service in compliance with applicable
                laws and must not use it for any unlawful or abusive purpose, including but not
                limited to harassment, discrimination, or misuse of candidate data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                4. Acceptable use
              </h2>
              <p className="text-gray-600 leading-relaxed">
                You agree not to: (a) reverse engineer, decompile, or attempt to derive source code
                from the Service; (b) use the Service to transmit malware or violate any third-party
                rights; (c) circumvent or disable any security or access controls; or (d) use the
                Service in a way that could harm, overload, or impair our systems or other users.
                We may suspend or terminate access for breach of these Terms or for any other
                reason we deem necessary.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                5. Data and privacy
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Your use of the Service is also governed by our{' '}
                <Link to="/privacy" className="text-indigo-600 hover:text-indigo-800 underline">
                  Privacy Policy
                </Link>
                . You are responsible for ensuring that you have appropriate legal basis (e.g.
                consent, legitimate interest) to process candidate and other personal data through
                the Service, including where required under laws such as the GDPR. You must not
                upload or process data in a way that violates applicable data protection or
                employment laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                6. Intellectual property
              </h2>
              <p className="text-gray-600 leading-relaxed">
                We and our licensors retain all rights in the Service, including software, design,
                and content. We grant you a limited, non-exclusive, non-transferable licence to
                use the Service in accordance with these Terms. You retain rights in the content
                you upload; you grant us the rights necessary to operate and improve the Service
                (e.g. to store, process, and display your data as described in our Privacy Policy).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                7. Limitation of liability
              </h2>
              <p className="text-gray-600 leading-relaxed">
                To the maximum extent permitted by applicable law, the Service is provided “as is”
                and we disclaim all warranties, express or implied. We are not liable for any
                indirect, incidental, special, consequential, or punitive damages, or for loss of
                data or profits, arising from your use of or inability to use the Service. Our
                total liability for any claims arising from these Terms or the Service shall not
                exceed the amount you paid us in the twelve (12) months preceding the claim (or
                such other limit as required by law).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                8. Termination
              </h2>
              <p className="text-gray-600 leading-relaxed">
                You may stop using the Service at any time. We may suspend or terminate your access
                for breach of these Terms, non-payment, or for operational or legal reasons. Upon
                termination, your right to use the Service ceases. Provisions that by their nature
                should survive (e.g. liability, data, intellectual property) will survive
                termination.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                9. Governing law and disputes
              </h2>
              <p className="text-gray-600 leading-relaxed">
                These Terms are governed by the laws of India, unless otherwise required by
                mandatory law in your jurisdiction. Any dispute arising from these Terms or the
                Service shall be subject to the exclusive jurisdiction of the courts of India,
                except where prohibited. If you are in the European Economic Area, you may also
                have rights under mandatory consumer or data protection laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                10. Contact
              </h2>
              <p className="text-gray-600 leading-relaxed">
                For questions about these Terms, contact us at{' '}
                <a
                  href="mailto:sales@aitamate.com?subject=Terms%20of%20Service"
                  className="text-indigo-600 hover:text-indigo-800 underline"
                >
                  sales@aitamate.com
                </a>
                .
              </p>
            </section>
          </div>
      </main>

      {/* Footer - same light blue as header */}
      <footer className="bg-sky-100 border-t border-sky-200 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-6 sm:gap-6">
            <div className="flex items-center gap-4">
              <a
                href="https://aitamate.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xl text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                Home
              </a>
              <a
                href="mailto:sales@aitamate.com"
                className="text-xl text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                Contact
              </a>
            </div>
            {/* Compliance badges */}
            <div className="flex flex-wrap items-center gap-6 sm:gap-8">
              <img src="/assets/CCPA.png" alt="CCPA Compliant" className="h-24 sm:h-28 w-auto object-contain" />
              <img src="/assets/ISO.png" alt="ISO Certified" className="h-20 sm:h-24 w-auto object-contain" />
              <img src="/assets/GDPR.png" alt="GDPR" className="h-20 sm:h-24 w-auto object-contain" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TermsOfService;

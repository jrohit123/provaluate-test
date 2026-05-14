import { Link } from 'react-router-dom';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header - light blue */}
      <header className="bg-sky-100 border-b border-sky-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}assets/Logo-transparent_bg.png`}
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
          Privacy Policy
        </h1>

        <div className="prose prose-gray max-w-none space-y-8 text-base sm:text-lg">
            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                1. Who we are and how to contact us
              </h2>
              <p className="text-gray-600 leading-relaxed">
                ProValuate (“we”, “our”) is an AI-powered candidate assessment platform. For privacy
                and data protection enquiries, including requests to exercise your rights, contact us
                at{' '}
                <a
                  href="mailto:sales@aitamate.com?subject=Privacy%20Enquiry"
                  className="text-indigo-600 hover:text-indigo-800 underline"
                >
                  sales@aitamate.com
                </a>
                . If you are in the European Economic Area (EEA), you may also have the right to
                lodge a complaint with your local data protection supervisory authority.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                2. What data we collect and why
              </h2>
              <p className="text-gray-600 leading-relaxed mb-3">
                We process personal data necessary to provide and improve our services:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-600">
                <li>
                  <strong>Account and company data:</strong> name, email, company name, role (for
                  recruiters and administrators).
                </li>
                <li>
                  <strong>Candidate data:</strong> resumes/CVs, names, contact details, interview
                  responses (video/audio/text), and related assessment data when you use our
                  screening and AI interview features.
                </li>
                <li>
                  <strong>Usage and technical data:</strong> login sessions, browser/device
                  information, and cookies as described in our Cookie Policy (if applicable).
                </li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-3">
                We use this data to deliver the platform, run AI analysis (e.g. resume ranking and
                interview evaluation), improve our services, and comply with legal obligations.
                Where required by law (e.g. in the EEA), we rely on consent, contract performance,
                or legitimate interests as the legal basis for processing.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                3. Data retention
              </h2>
              <p className="text-gray-600 leading-relaxed">
                We retain your data only as long as needed to provide our services, fulfil legal
                obligations, or resolve disputes. Retention periods may vary by data type and
                jurisdiction. You may request deletion or restriction of your data in line with
                your rights below.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                4. Who we share data with
              </h2>
              <p className="text-gray-600 leading-relaxed">
                We may share data with service providers (e.g. hosting, analytics) who act on our
                instructions and are bound by confidentiality and data protection obligations. If
                we transfer data outside the EEA, we ensure appropriate safeguards (e.g. standard
                contractual clauses) where required by law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                5. Your rights (including GDPR)
              </h2>
              <p className="text-gray-600 leading-relaxed mb-3">
                Depending on your location, you may have the right to:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-600">
                <li>Access and receive a copy of your personal data</li>
                <li>Rectify inaccurate or incomplete data</li>
                <li>Request erasure (“right to be forgotten”) in certain cases</li>
                <li>Restrict processing in certain cases</li>
                <li>Data portability (receive your data in a structured, machine-readable format)</li>
                <li>Object to processing based on legitimate interests</li>
                <li>Withdraw consent where processing is based on consent</li>
                <li>Lodge a complaint with a supervisory authority (e.g. in the EEA)</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-3">
                To exercise these rights, contact us at{' '}
                <a
                  href="mailto:sales@aitamate.com?subject=Privacy%20Rights%20Request"
                  className="text-indigo-600 hover:text-indigo-800 underline"
                >
                  sales@aitamate.com
                </a>
                . We will respond within the timeframes required by applicable law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                6. Security
              </h2>
              <p className="text-gray-600 leading-relaxed">
                We implement appropriate technical and organisational measures to protect your
                personal data against unauthorised access, loss, or misuse. Access to data is
                limited to those who need it to provide and support our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-primary-600 mb-2">
                7. Changes to this policy
              </h2>
              <p className="text-gray-600 leading-relaxed">
                We may update this Privacy Policy from time to time. The “Last updated” date at the
                top will reflect the latest version. We encourage you to review this page
                periodically. Continued use of our services after changes constitutes acceptance
                of the updated policy where permitted by law.
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
              <img src={`${import.meta.env.BASE_URL}assets/CCPA.png`} alt="CCPA Compliant" className="h-24 sm:h-28 w-auto object-contain" />
              <img src={`${import.meta.env.BASE_URL}assets/ISO.png`} alt="ISO Certified" className="h-20 sm:h-24 w-auto object-contain" />
              <img src={`${import.meta.env.BASE_URL}assets/GDPR.png`} alt="GDPR" className="h-20 sm:h-24 w-auto object-contain" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;

import { useState } from 'react';
import { Link } from 'react-router-dom';

type Testimonial = {
  id: string;
  videoSrc: string;
  quote: string;
  name: string;
  title: string;
  company: string;
  initials: string;
};

const testimonials: Testimonial[] = [
  {
    id: 'neetu-singh',
    videoSrc: '/videos/Testimonial_SRGlobal.mp4',
    quote:
      'ProValuate has definitely streamlined our hiring process. It has saved a lot of manual effort and helps a lot in aligning the right candidate with the JD. I would definitely recommend it to the people who are looking out to streamline their hiring process.',
    name: 'Neetu Singh',
    title: 'HR Professional',
    company: 'SR Global HR Solutions',
    initials: 'NS',
  },
];

export default function CustomersPage() {
  const [playing, setPlaying] = useState<string | null>(null);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[linear-gradient(145deg,#F6FAFF_0%,#EEF6FF_55%,#FFFFFF_100%)]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-slate-200 bg-white/95 px-2 py-4 backdrop-blur sm:px-4 sm:py-5 lg:px-4 lg:py-6">
          <div className="flex w-full min-w-0 items-center justify-between gap-3 pl-2 pr-4 sm:px-0 lg:px-8">
            <img
              src="/Logo_Transparent_BG.png"
              alt="ProValuate"
              className="h-12 w-auto shrink-0 sm:h-14 lg:h-16"
            />
            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
              <Link
                to="/"
                className="shrink-0 text-right text-sm font-semibold text-[#0d6ea3] no-underline transition-colors hover:text-[#042C53] sm:text-base lg:text-lg"
              >
                <span className="sm:hidden">Home</span>
                <span className="hidden sm:inline">Back to Home</span>
              </Link>
            </div>
          </div>
        </header>

      <main className="mx-auto max-w-7xl xl:max-w-screen-xl px-2 pb-12 pt-28 sm:px-3 sm:pb-16 sm:pt-32 lg:pt-36">
        {/* Page heading */}
        <div className="mb-8 sm:mb-12 text-center">
          <p className="mb-3 text-sm font-semibold tracking-widest text-[#1a9fd6] uppercase">
            Customer Stories
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0a3a5a] lg:text-4xl">
            Trusted by hiring teams
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm sm:text-base text-slate-500">
            Real stories from HR professionals and placement teams using ProValuate to hire smarter.
          </p>
        </div>

        {/* Testimonial cards grid */}
        <div
          className={`grid gap-8 ${
            testimonials.length === 1
              ? 'grid-cols-1 max-w-2xl mx-auto'
              : testimonials.length === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-xl sm:rounded-2xl"
            >
              {/* Video area */}
              <div className="relative aspect-video bg-[#0a1e30]">
                {playing === t.id ? (
                  <video
                    src={t.videoSrc}
                    controls
                    autoPlay
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <>
                    {/* Video thumbnail */}
                    <video
                      src={t.videoSrc}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      onLoadedMetadata={(e) => {
                        const video = e.target as HTMLVideoElement;
                        video.currentTime = 1; // Set to 1 second for thumbnail
                      }}
                    />
                    {/* Play button overlay */}
                    <button
                      type="button"
                      onClick={() => setPlaying(t.id)}
                      className="absolute inset-0 flex items-center justify-center group"
                      aria-label={`Play ${t.name}'s story`}
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform duration-200 group-hover:scale-110">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-7 w-7 text-[#1a9fd6] ml-1"
                          fill="currentColor"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </button>
                  </>
                )}
              </div>

              {/* Card body */}
              <div className="flex flex-1 flex-col p-4 sm:p-6">

                {/* Quote */}
                <svg
                  className="mb-2 h-5 w-5 text-[#1a9fd6] opacity-50 sm:h-6 sm:w-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path d="M7.17 17c.51 0 .98-.29 1.2-.74l1.42-2.84c.14-.28.21-.58.21-.89V8c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v5c0 .55.45 1 1 1h2l-1.03 2.06c-.45.89.2 1.94 1.2 1.94zm10 0c.51 0 .98-.29 1.2-.74l1.42-2.84c.14-.28.21-.58.21-.89V8c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v5c0 .55.45 1 1 1h2l-1.03 2.06c-.45.89.2 1.94 1.2 1.94z" />
                </svg>
                <p className="flex-1 text-sm sm:text-base italic leading-relaxed text-slate-600">
                  "{t.quote}"
                </p>

                {/* Person */}
                <div className="mt-4 sm:mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#E6F1FB] text-sm font-semibold text-[#185FA5]">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm sm:text-base font-semibold text-[#0a3a5a]">{t.name}</p>
                    <p className="text-xs sm:text-sm text-slate-500">
                      {t.title} · {t.company}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA at bottom */}
        <div className="mt-12 sm:mt-16 rounded-2xl border border-[#1a9fd6]/20 bg-white/70 px-6 py-8 text-center shadow-sm">
          <h2 className="text-lg sm:text-xl font-bold text-[#0a3a5a]">
            Ready to streamline your hiring?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-slate-500">
            Join teams using ProValuate to make faster, smarter hiring decisions.
          </p>
          <div className="mt-4 sm:mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <a
              href="https://aitamate.com/contact.html"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#0a3a5a] hover:border-[#1a9fd6] transition-colors sm:px-6 sm:py-2.5"
            >
              Request a Demo
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 sm:py-8 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs sm:text-sm">
          <Link to="/privacy" className="font-medium text-[#0a3a5a] hover:text-[#042C53]">
            Privacy Policy
          </Link>
          <span className="text-slate-300">•</span>
          <Link to="/terms" className="font-medium text-[#0a3a5a] hover:text-[#042C53]">
            Terms
          </Link>
          <span className="text-slate-300">•</span>
          <a
            href="mailto:sales@aitamate.com?subject=ProValuate%20Contact"
            className="font-medium text-[#0a3a5a] hover:text-[#042C53]"
          >
            Contact
          </a>
        </div>
      </footer>
    </div>
  );
}

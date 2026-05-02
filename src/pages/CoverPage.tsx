import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { gsap } from 'gsap/dist/gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

type RoleId = 'candidate' | 'recruiter' | 'tpo';

const roles: Array<{
  id: RoleId;
  route: string;
  label: string;
  subtitle: string;
  description: string;
  icon: ReactNode;
  borderColor: string;
  hoverBorder: string;
  iconBg: string;
  btnColor: string;
  featureIconClass: string;
  features: string[];
}> = [
  {
    id: 'candidate',
    route: '/candidate-login',
    label: 'Candidate',
    subtitle: 'Job seekers & interview takers',
    description:
      'Build your profile, track interviews, and get detailed feedback on your performance.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10" aria-hidden>
        <circle cx="20" cy="14" r="7" fill="currentColor" opacity="0.18" />
        <circle cx="20" cy="14" r="5" fill="currentColor" opacity="0.55" />
        <path
          d="M6 34c0-7.732 6.268-14 14-14s14 6.268 14 14"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.55"
        />
      </svg>
    ),
    borderColor: 'border-[#1a9fd6]/35',
    hoverBorder: 'hover:border-[#1a9fd6]/70',
    iconBg: 'bg-[#1a9fd6]/12 text-[#1a9fd6]',
    btnColor:
      'text-white shadow-[0_4px_18px_rgba(37,99,235,0.28)] transition-all duration-200 hover:shadow-[0_6px_22px_rgba(37,99,235,0.34)] [background:linear-gradient(135deg,#1a9fd6,#2563eb)] hover:[background:linear-gradient(135deg,#1490c0,#1d4ed8)]',
    featureIconClass: 'text-[#1a9fd6]',
    features: ['Build your profile', 'Track interviews', 'View feedback reports'],
  },
  {
    id: 'recruiter',
    route: '/login',
    label: 'Recruiter',
    subtitle: 'Hiring managers & HR teams',
    description:
      'Screen candidates, run structured interviews, and make data-driven hiring decisions.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10" aria-hidden>
        <rect x="7" y="10" width="26" height="20" rx="3" fill="currentColor" opacity="0.14" />
        <rect
          x="7"
          y="10"
          width="26"
          height="20"
          rx="3"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          opacity="0.55"
        />
        <path
          d="M13 19h14M13 24h8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        />
        <circle cx="29" cy="11" r="5" fill="currentColor" opacity="0.7" />
        <path
          d="M27.5 11l1 1 2-2"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    borderColor: 'border-[#0d6ea3]/35',
    hoverBorder: 'hover:border-[#0d6ea3]/70',
    iconBg: 'bg-[#0d6ea3]/12 text-[#042C53]',
    btnColor:
      'text-white shadow-[0_4px_18px_rgba(13,110,163,0.28)] transition-all duration-200 hover:shadow-[0_6px_22px_rgba(13,110,163,0.34)] [background:linear-gradient(135deg,#042C53,#0d6ea3)] hover:[background:linear-gradient(135deg,#053565,#0c7eb8)]',
    featureIconClass: 'text-[#0d6ea3]',
    features: ['Manage job openings', 'Screen & score candidates', 'Decision-ready reports'],
  },
  {
    id: 'tpo',
    route: '/tpo-login',
    label: 'TPO',
    subtitle: 'Training & Placement Officers',
    description:
      'Manage campus placements, configure college-scoped interviews, and track student outcomes.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10" aria-hidden>
        <path
          d="M20 6L34 13v4c0 9-6 16-14 18C12 33 6 26 6 17v-4L20 6z"
          fill="currentColor"
          opacity="0.14"
        />
        <path
          d="M20 6L34 13v4c0 9-6 16-14 18C12 33 6 26 6 17v-4L20 6z"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          opacity="0.55"
        />
        <path
          d="M14 21l4 4 8-8"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
      </svg>
    ),
    borderColor: 'border-[#042C53]/35',
    hoverBorder: 'hover:border-[#042C53]/70',
    iconBg: 'bg-[#042C53]/12 text-[#042C53]',
    btnColor:
      'text-white shadow-[0_4px_18px_rgba(4,44,83,0.30)] transition-all duration-200 hover:shadow-[0_6px_22px_rgba(4,44,83,0.35)] [background:linear-gradient(135deg,#020f1a,#042C53)] hover:[background:linear-gradient(135deg,#031525,#053565)]',
    featureIconClass: 'text-[#042C53]',
    features: ['College-scoped access', 'Campus interview setup', 'Student analytics'],
  },
];

const roleOrder: RoleId[] = ['candidate', 'recruiter', 'tpo'];

export default function CoverPage() {
  const navigate = useNavigate();
  const cardRefs = useRef<Record<RoleId, HTMLDivElement | null>>({
    candidate: null,
    recruiter: null,
    tpo: null,
  });
  const [activeTab, setActiveTab] = useState<'cv-screening' | 'resume-ingestion' | 'dynamic-interview'>('cv-screening');

  const go = (route: string) => {
    navigate(route);
  };

  const handleCardKeyDown = (e: KeyboardEvent, route: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      go(route);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) return;

    const triggers: ScrollTrigger[] = [];
    const animations: gsap.core.Tween[] = [];

    roleOrder.forEach((id, i) => {
      const el = cardRefs.current[id];
      if (!el) return;

      gsap.set(el, {
        opacity: 0,
        y: 64,
        rotationX: 20,
        scale: 0.88,
        transformPerspective: 900,
        transformOrigin: '50% 100%',
      });

      const anim = gsap.to(el, {
        opacity: 1,
        y: 0,
        rotationX: 0,
        scale: 1,
        duration: 0.7,
        delay: i * 0.03,
        ease: 'power3.out',
        paused: true,
      });

      const trigger = ScrollTrigger.create({
        trigger: el,
        start: 'top 74%',
        end: 'top 15%',
        onEnter: () => anim.play(),
        onLeaveBack: () => anim.timeScale(1.15).reverse(0),
        onEnterBack: () => anim.play(),
      });

      animations.push(anim);
      triggers.push(trigger);
    });

    return () => {
      triggers.forEach((trigger) => trigger.kill());
      animations.forEach((anim) => anim.kill());
      roleOrder.forEach((id) => {
        const el = cardRefs.current[id];
        if (el) gsap.set(el, { clearProps: 'all' });
      });
    };
  }, []);

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <style>{`
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(12px) scale(0.995); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(10px) rotate(var(--r, 0deg)) scale(0.95); }
          to { opacity: 1; transform: translateY(0) rotate(var(--r, 0deg)) scale(1); }
        }
        @keyframes heroIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cover-panel { animation: panelIn 0.45s cubic-bezier(0.25,0.46,0.45,0.94) both; }
        .role-card-1 { opacity: 0; animation: cardIn 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.15s forwards; }
        .role-card-2 { opacity: 0; animation: cardIn 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.28s forwards; }
        .role-card-3 { opacity: 0; animation: cardIn 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.41s forwards; }
        .hero-line-1 { opacity: 0; animation: heroIn 0.55s cubic-bezier(0.25,0.46,0.45,0.94) 0.12s forwards; }
        .hero-line-2 { opacity: 0; animation: heroIn 0.55s cubic-bezier(0.25,0.46,0.45,0.94) 0.24s forwards; }
        
        /* --- NEW: Desktop Hover Expansion Logic --- */
        @media (min-width: 768px) {
          .cards-container { 
            display: flex; 
            align-items: stretch; 
            height: 480px; /* Fixed height prevents vertical bouncing during width expansion */
          }
          .expandable-card { 
            flex: 1; 
            transition: flex 0.5s cubic-bezier(0.25, 1, 0.5, 1), filter 0.5s ease, transform 0.4s ease, box-shadow 0.4s ease; 
          }
          .cards-container:hover .expandable-card { 
            filter: grayscale(60%) opacity(0.6); 
          }
          .cards-container .expandable-card:hover { 
            flex: 1.35; 
            filter: grayscale(0%) opacity(1); 
            transform: translateY(-8px); 
          }
        }
        
        @media (max-width: 767px) {
          .role-card-1, .role-card-2, .role-card-3 { opacity: 1; animation: none; }
        }

        /* Feature Tabs */
        .feature-tab {
          transition: all 0.3s ease;
          cursor: pointer;
        }
        .feature-tab:hover {
          transform: translateY(-2px);
        }
        .feature-tab.active {
          background: #1a9fd6;
          color: white;
          transform: translateY(-4px);
          box-shadow: 0 8px 40px rgba(10,74,140,0.14);
        }

        /* Demo Content Container */
        .demo-content {
          min-height: 600px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 2px 20px rgba(10,74,140,0.09);
          overflow: auto;
        }

        /* Tab Content Animation */
        .tab-content {
          animation: fadeIn 0.6s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Mobile responsive adjustments for feature tabs */
        @media (max-width: 767px) {
          .demo-content {
            width: 100vw;          /* ← full viewport width */
            margin-left: -20px;    /* ← break out of px-5 (20px) parent padding */
            border-radius: 0;      /* ← no rounded corners at full bleed */
            overflow: hidden;
            min-height: 100vh;   /* ← change from fixed to 100vh */
            max-height: none;    /* ← remove max-height cap */
          }
          .feature-tab {
            font-size: 14px;
            padding: 12px 16px;
          }
          .tab-content {
            min-height: 100vh;
            max-height: none;
          }
          .tab-content iframe {
            width: 100vw !important;   /* ← iframe fills full width */
            height: 100vh !important;      /* ← full viewport */
            min-height: 100vh !important;
          }
        }
        
        /* Desktop adjustments for full-screen iframes */
        @media (min-width: 768px) {
          .demo-content {
            min-height: 90vh;
            max-height: 90vh;
          }
          .tab-content {
            min-height: 90vh;
            max-height: 90vh;
          }
          .tab-content iframe {
            height: 90vh !important;
            min-height: 600px !important;
          }
        }
      `}</style>

      {/* <video
        autoPlay
        muted
        loop
        playsInline
        className="pointer-events-none fixed inset-0 z-0 h-full w-full object-cover"
        src="/videos/video.mp4"
      />
      <div className="pointer-events-none fixed inset-0 z-0 bg-white/70" /> */}
      
      {/* Light blue background matching Login page */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(145deg,#F6FAFF_0%,#EEF6FF_55%,#FFFFFF_100%)]" />

      <div className="cover-panel relative z-10 flex min-h-screen flex-col">
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 px-2 py-4 backdrop-blur sm:px-4 sm:py-5 lg:px-4 lg:py-6">
          <div className="flex w-full min-w-0 items-center justify-between gap-3 pl-2 pr-4 sm:px-0 lg:px-8">
            <img
              src="/Logo_Transparent_BG.png"
              alt="ProValuate"
              className="h-12 w-auto shrink-0 sm:h-14 lg:h-16"
            />
            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
              <a
                href="https://aitamate.com/contact.html"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-right text-sm font-semibold text-[#0d6ea3] no-underline transition-colors hover:text-[#042C53] sm:text-base lg:text-lg"
              >
                <span className="sm:hidden">Demo</span>
                <span className="hidden sm:inline">Request for Demo</span>
              </a>
              <button
                onClick={() => {
                  const featuresSection = document.getElementById('features-section');
                  if (featuresSection) {
                    featuresSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="shrink-0 text-right text-sm font-semibold text-[#0d6ea3] no-underline transition-colors hover:text-[#042C53] sm:text-base lg:text-lg"
              >
                <span className="sm:hidden">Features</span>
                <span className="hidden sm:inline">Features</span>
              </button>
            </div>
          </div>
        </header>

        <section className="relative flex min-h-[180px] flex-col items-center justify-center px-5 pb-8 pt-10 text-center sm:min-h-[200px] sm:px-4 sm:pb-10 sm:pt-14 md:px-5 md:pt-16 lg:px-6">
          <div className="relative z-10 mx-auto w-full min-w-0 max-w-none">
            <h1 className="hero-line-1 mb-4 px-1 text-center text-lg font-bold leading-tight tracking-[-0.02em] text-[#0a3a5a] min-[360px]:text-xl sm:whitespace-nowrap sm:text-2xl md:text-3xl lg:text-5xl">
              Evidence-based assessment starts here. <span className="text-[#1a9fd6]">ProValuate</span>
            </h1>

            <p className="hero-line-2 mx-auto max-w-2xl text-pretty px-1 text-center text-sm font-bold leading-relaxed text-[#5a6f82] sm:text-base md:text-lg">
              One platform connecting candidates, recruiters, and placement officers —<br />
              powered by structured AI evaluation.
            </p>
          </div>
        </section>

        <section className="flex flex-1 flex-col items-center px-5 pb-14 pt-8 sm:px-4 sm:pb-20 sm:pt-10 md:px-5 lg:px-6">
          <p className="mb-8 text-base font-semibold tracking-wide text-[#1a9fd6] sm:text-lg">
            CONTINUE AS
          </p>

          <div className="flex flex-col md:flex-row w-full max-w-7xl gap-4 md:gap-5 cards-container">
            {roles.map((role, i) => (
              <div
                key={role.id}
                ref={(element) => {
                  cardRefs.current[role.id] = element;
                }}
                data-role-id={role.id}
                className={`role-card-${i + 1} expandable-card flex-1 group relative flex cursor-pointer select-none flex-col rounded-2xl border bg-white/75 p-6 backdrop-blur-md hover:bg-white/90 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 focus-visible:ring-offset-2 active:scale-[0.99] sm:p-7 ${role.borderColor} ${role.hoverBorder}`}
                style={{ transitionProperty: 'box-shadow, transform, border-color' }}
                onClick={() => go(role.route)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => handleCardKeyDown(e, role.route)}
                aria-label={`Sign in as ${role.label}`}
              >
                <div
                  className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105 ${role.iconBg}`}
                >
                  {role.icon}
                </div>

                <div className="mb-2 flex items-center gap-2.5">
                  <h2 className="text-2xl font-bold text-[#0a3a5a] sm:text-[1.7rem]">{role.label}</h2>
                </div>

                <p className="mb-5 flex-1 text-base leading-relaxed text-slate-600 sm:text-[1.02rem]">{role.description}</p>

                <ul className="mb-6 flex-1 space-y-1.5">
                  {role.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-500">
                      <svg
                        viewBox="0 0 12 12"
                        className={`h-3 w-3 flex-shrink-0 ${role.featureIconClass}`}
                        fill="none"
                        aria-hidden
                      >
                        <circle cx="6" cy="6" r="5" fill="currentColor" opacity="0.15" />
                        <path
                          d="M3.5 6l2 2 3-4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-base font-semibold ${role.btnColor}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    go(role.route);
                  }}
                >
                  Sign in as {role.label}
                  <svg
                    viewBox="0 0 16 16"
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M3 8h10M9 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Feature Tabs Section */}
          <div id="features-section" className="mt-16 w-full max-w-7xl -mx-5 sm:-mx-4 md:-mx-5 lg:-mx-6 px-0 sm:px-0">
            <h2 className="text-center text-2xl font-bold text-[#0a3a5a] mb-8">Explore Our Features</h2>
            
            {/* Tab Navigation */}
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <div 
                className={`feature-tab px-6 py-3 rounded-xl bg-white border-2 font-semibold transition-all ${
                  activeTab === 'cv-screening' 
                    ? 'border-[#1a9fd6] text-white active' 
                    : 'border-gray-200 text-gray-600'
                }`}
                onClick={() => setActiveTab('cv-screening')}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  CV SCREENING
                </div>
              </div>
              <div 
                className={`feature-tab px-6 py-3 rounded-xl bg-white border-2 font-semibold transition-all ${
                  activeTab === 'resume-ingestion' 
                    ? 'border-[#1a9fd6] text-white active' 
                    : 'border-gray-200 text-gray-600'
                }`}
                onClick={() => setActiveTab('resume-ingestion')}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                  </svg>
                  RESUME INGESTION
                </div>
              </div>
              <div 
                className={`feature-tab px-6 py-3 rounded-xl bg-white border-2 font-semibold transition-all ${
                  activeTab === 'dynamic-interview' 
                    ? 'border-[#1a9fd6] text-white active' 
                    : 'border-gray-200 text-gray-600'
                }`}
                onClick={() => setActiveTab('dynamic-interview')}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                  </svg>
                  DYNAMIC INTERVIEW
                </div>
              </div>
            </div>

            {/* Demo Content Container */}
            <div className="demo-content">
              <div className="tab-content w-full h-full overflow-visible">
                {activeTab === 'cv-screening' && (
                  <iframe 
                    src="/CV Screening.html" 
                    className="w-full h-full border-0 rounded-lg"
                    style={{ height: '90vh', minHeight: '600px' }}
                    title="CV Screening Demo"
                  />
                )}
                {activeTab === 'resume-ingestion' && (
                  <iframe 
                    src="/provaluate-ingestion-hub.html" 
                    className="w-full h-full border-0 rounded-lg"
                    style={{ height: '90vh', minHeight: '600px' }}
                    title="Resume Ingestion Demo"
                  />
                )}
                {activeTab === 'dynamic-interview' && (
                  <iframe 
                    src="/Interview Session.html" 
                    className="w-full h-full border-0 rounded-lg"
                    style={{ height: '90vh', minHeight: '600px' }}
                    title="Dynamic Interview Demo"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-2">
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground sm:text-base">
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
          </div>
        </section>
      </div>
    </div>
  );
}

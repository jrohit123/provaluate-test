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
        @media (max-width: 767px) {
          .role-card-1, .role-card-2, .role-card-3 { opacity: 1; animation: none; }
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
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-8 sm:py-5 lg:px-12 lg:py-6">
          <div className="flex w-full min-w-0 items-center justify-between gap-3">
            <img
              src="/Logo_Transparent_BG.png"
              alt="ProValuate"
              className="h-12 w-auto shrink-0 sm:h-14 lg:h-16"
            />
            <a
              href="https://aitamate.com/contact.html"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-right text-sm font-semibold text-[#0d6ea3] no-underline transition-colors hover:text-[#042C53] sm:text-base lg:text-lg"
            >
              <span className="sm:hidden">Demo</span>
              <span className="hidden sm:inline">Request for Demo</span>
            </a>
          </div>
        </header>

        <section className="relative flex min-h-[180px] flex-col items-center justify-center px-5 pb-8 pt-10 text-center sm:min-h-[200px] sm:pb-10 sm:pt-14 md:pt-16">
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

        <section className="flex flex-1 flex-col items-center px-5 pb-14 pt-8 sm:pb-20 sm:pt-10">
          <p className="mb-8 text-base font-semibold tracking-wide text-[#1a9fd6] sm:text-lg">
            CONTINUE AS
          </p>

          <div className="grid w-full max-w-5xl grid-cols-1 gap-5 md:grid-cols-3">
            {roles.map((role, i) => (
              <div
                key={role.id}
                ref={(element) => {
                  cardRefs.current[role.id] = element;
                }}
                data-role-id={role.id}
                className={`role-card-${i + 1} group relative flex cursor-pointer select-none flex-col rounded-2xl border bg-white/75 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/90 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 focus-visible:ring-offset-2 active:scale-[0.99] sm:p-7 ${role.borderColor} ${role.hoverBorder}`}
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

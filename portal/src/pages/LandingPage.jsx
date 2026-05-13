import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'
import hero from '../assets/hero.jpg'
import { useAuthStore } from '../store/authStore'

// Icon helpers

function IconBase({ children, className = 'h-6 w-6' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function ProcessIconBase({ children, className = 'h-9 w-9' }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="#20232A"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

// Process step icons

function ApplicationFormIcon() {
  return (
    <ProcessIconBase>
      <rect x="5" y="9" width="10" height="10" rx="2" />
      <path d="m8 14 2 2 4-5" stroke="#059669" />
      <rect x="5" y="22" width="10" height="10" rx="2" />
      <path d="m8 27 2 2 4-5" stroke="#059669" />
      <circle cx="31" cy="14" r="5.5" />
      <path d="M22 35c1.8-5 5-8 9-8s7.2 3 9 8" />
      <path d="M31 20v7" />
      <ellipse cx="31" cy="41" rx="10" ry="2.5" stroke="#059669" />
    </ProcessIconBase>
  )
}

function DocumentCheckIcon() {
  return (
    <ProcessIconBase>
      <path d="M12 8h18a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H18" />
      <path d="M12 8a5 5 0 0 0 0 10h5" />
      <path d="M18 18h10" />
      <circle cx="29.5" cy="25.5" r="7.5" stroke="#059669" />
      <path d="m26 25.5 2.2 2.2 5-5.2" stroke="#059669" />
    </ProcessIconBase>
  )
}

function EligibilityIcon() {
  return (
    <ProcessIconBase>
      <path d="m12 14 12-5 12 5-12 5-12-5Z" />
      <path d="m12 21 12-5 12 5" />
      <path d="m12 28 12-5 12 5" />
      <rect x="29" y="24" width="10" height="12" rx="2" stroke="#059669" />
      <path d="M32 29h4" stroke="#059669" />
      <path d="M32 33h4" stroke="#059669" />
    </ProcessIconBase>
  )
}

function CaseStudyIcon() {
  return (
    <ProcessIconBase>
      <rect x="12" y="9" width="24" height="30" rx="3" />
      <path d="M19 9.5h10" />
      <path d="M18 18h12" />
      <path d="M18 24h12" />
      <path d="M18 30h8" />
      <path d="m31 32 7-7 3 3-7 7-4 1Z" stroke="#059669" />
    </ProcessIconBase>
  )
}

function ApprovalIcon() {
  return (
    <ProcessIconBase>
      <path d="M14 8h16l6 6v24H14Z" />
      <path d="M30 8v7h6" />
      <path d="M19 22h12" />
      <path d="M19 28h10" />
      <circle cx="30.5" cy="33.5" r="4.5" stroke="#059669" />
      <path d="m28.5 33.5 1.3 1.4 2.7-2.9" stroke="#059669" />
      <path d="m28.8 37.3-1.1 4 2.8-1.7 2.8 1.7-1.1-4" stroke="#059669" />
    </ProcessIconBase>
  )
}

function ReleaseIcon() {
  return (
    <ProcessIconBase>
      <circle cx="24" cy="14" r="5.5" />
      <path d="M15 35c1.6-5.8 5.1-9 9-9s7.4 3.2 9 9" />
      <path d="M12 22h7" />
      <path d="M29 22h7" />
      <path d="M18 35h12" stroke="#059669" />
      <path d="M20 40h8" stroke="#059669" />
    </ProcessIconBase>
  )
}

// Nav icons

function ArrowRightIcon({ className = 'h-4 w-4' }) {
  return (
    <IconBase className={className}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </IconBase>
  )
}

// Benefit icons

function PillIcon() {
  return (
    <IconBase>
      <path d="M10.5 4.5a5 5 0 0 1 7 7l-7.5 7.5a5 5 0 0 1-7-7l7.5-7.5Z" />
      <path d="m7 10.5 6 6" />
    </IconBase>
  )
}

function HospitalIcon() {
  return (
    <IconBase>
      <rect x="3.5" y="6.5" width="17" height="15" rx="1.5" />
      <path d="M12 10v6M9 13h6" />
      <path d="M7.5 21.5v.5" />
      <path d="M16.5 21.5v.5" />
    </IconBase>
  )
}

function StethoscopeIcon() {
  return (
    <IconBase>
      <path d="M6 3.5v5a6 6 0 0 0 12 0v-5" />
      <path d="M12 14.5v3" />
      <circle cx="12" cy="19" r="2" />
    </IconBase>
  )
}

function EyeglassIcon() {
  return (
    <IconBase>
      <circle cx="7" cy="14" r="3.5" />
      <circle cx="17" cy="14" r="3.5" />
      <path d="M10.5 14h3" />
      <path d="M3.5 14H2M20.5 14H22" />
    </IconBase>
  )
}

function FlowerIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="2" />
      <path d="M12 7V5M12 19v-2M7 12H5M19 12h-2" />
      <path d="M8.4 8.4 7 7M17 17l-1.4-1.4M8.4 15.6 7 17M17 7l-1.4 1.4" />
    </IconBase>
  )
}

function HandHeartIcon() {
  return (
    <IconBase>
      <path d="M11 14.5a2 2 0 0 0 2 0l5.5-3.5A2 2 0 0 0 17 8l-5 3-5-3a2 2 0 0 0-1.5 2.5L11 14.5Z" />
      <path d="M4.5 14.5v4a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4" />
    </IconBase>
  )
}

// Data

const processSteps = [
  {
    n: '01',
    title: 'Application',
    desc: 'Create an account and complete the online application form with your personal information and crisis situation details.',
    Icon: ApplicationFormIcon,
  },
  {
    n: '02',
    title: 'Requirements',
    desc: 'Submit the required documents and certifications for verification by the social welfare office.',
    Icon: DocumentCheckIcon,
  },
  {
    n: '03',
    title: 'Eligibility Review',
    desc: 'Applications are reviewed against program guidelines and the nature of the applicant\'s crisis situation.',
    Icon: EligibilityIcon,
  },
  {
    n: '04',
    title: 'Case Study',
    desc: 'A social worker conducts an assessment and encodes the case study for proper endorsement and evaluation.',
    Icon: CaseStudyIcon,
  },
  {
    n: '05',
    title: 'Approval',
    desc: 'Endorsed cases are forwarded through the appropriate authorization channels for final approval.',
    Icon: ApprovalIcon,
  },
  {
    n: '06',
    title: 'Release',
    desc: 'Approved assistance is released to the qualified beneficiary or authorized representative.',
    Icon: ReleaseIcon,
  },
]

const benefits = [
  {
    title: 'Medicine Assistance',
    desc: 'Financial assistance for prescription medications and pharmacy bills of individuals unable to meet medical expenses.',
    Icon: PillIcon,
  },
  {
    title: 'Hospital Bill Assistance',
    desc: 'Support for inpatient and outpatient hospitalization expenses through guarantee letters or direct financial aid.',
    Icon: HospitalIcon,
  },
  {
    title: 'Medical Assistance',
    desc: 'Coverage for medical procedures, consultations, diagnostic examinations, and laboratory fees.',
    Icon: StethoscopeIcon,
  },
  {
    title: 'Optical Assistance',
    desc: 'Assistance for optical needs including prescription eyeglasses for individuals who cannot afford them.',
    Icon: EyeglassIcon,
  },
  {
    title: 'Burial Assistance',
    desc: 'Financial support for funeral and burial expenses extended to bereaved families in crisis situations.',
    Icon: FlowerIcon,
  },
  {
    title: 'Plain AICS',
    desc: 'General social welfare financial assistance for individuals and families experiencing acute crisis situations.',
    Icon: HandHeartIcon,
  },
]

const faqs = [
  {
    q: 'Who is eligible to apply?',
    a: 'Bonafide residents of Vigan City who are experiencing crisis situations due to illness, accident, loss of a family member, calamity, or similar circumstances may apply. Priority is given to indigent individuals and families who are unable to meet their immediate needs.',
  },
  {
    q: 'What documents are required?',
    items: [
      'Valid government-issued identification card.',
      'Barangay Certificate of Indigency or Certificate of Residency.',
      'Medical certificate or hospital bill (for medicine or hospital assistance).',
      'Prescription from a licensed physician (for medicine assistance).',
      'Death certificate and funeral contract (for burial assistance).',
      'Other supporting documents depending on the type of assistance applied for.',
    ],
  },
  {
    q: 'When can I file an application?',
    a: 'Applications are accepted throughout the year subject to fund availability. Online applications may be submitted at any time through this portal. Walk-in applications are accommodated at the DSWD-AICS office during regular government business hours.',
  },
  {
    q: 'How long does the process take?',
    a: 'Applications with complete documentary requirements are typically processed within 24 to 72 hours. Processing time may vary depending on application volume and the completeness of submitted documents.',
  },
  {
    q: 'Can I apply online without visiting the office?',
    a: 'You may initiate your application online through this portal. However, a social worker may contact you for a brief assessment interview, and some documents may need to be submitted or verified in person at the DSWD-AICS office.',
  },
  {
    q: 'How will I know the status of my application?',
    a: 'You will receive SMS and email notifications as your application progresses through each stage. You may also log in to this portal at any time to view the current status of your application.',
  },
]

// Component

export default function LandingPage() {
  const [activeFaq, setActiveFaq] = useState(null)
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)

  const handleLoginClick = (event) => {
    event.preventDefault()
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-white text-[#0c2340]">

      {/* TOP UTILITY BAR */}
      <div className="bg-gradient-to-r from-[#064e3b] via-[#065f46] to-[#047857] border-b border-[#10b981]/30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 text-xs md:px-8">
          <p className="uppercase tracking-[0.2em] text-emerald-50/95">Republic of the Philippines</p>
          <div className="flex items-center gap-4 text-emerald-50/95">
            <a href="#faq" className="hidden transition-colors hover:text-[#10b981] md:block">AICS Guidelines</a>
            <Link to="/login" onClick={handleLoginClick} className="transition-colors hover:text-[#10b981]">Applicant Login</Link>
          </div>
        </div>
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-50 shadow-lg">
        {/* Brand area */}
        <div className="bg-gradient-to-r from-[#064e3b] via-[#065f46] to-[#047857] text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:gap-6 md:px-8 md:py-5">
            <div className="flex items-center gap-3 md:gap-5">
              <img
                src={logo}
                alt="Vigan City Seal"
                className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 shrink-0 object-contain"
              />
              <div>
                <p className="text-[9px] uppercase tracking-[0.22em] text-emerald-100 sm:text-xs sm:tracking-[0.28em]">
                  AICS Online Application Portal
                </p>
                <h1 className="font-display text-base font-bold leading-tight sm:text-2xl md:text-3xl lg:text-[2.25rem]">
                  City Government of Vigan
                </h1>
                <p className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-slate-100/90 sm:text-xs md:text-sm">
                  Province of Ilocos Sur
                </p>
              </div>
            </div>

            <div className="hidden border-l border-white/15 pl-8 text-right lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100/95">Social Welfare Services</p>
              <p className="mt-1 max-w-xs text-sm leading-relaxed text-slate-100/90">
                Online application, case filing, and status tracking for individuals in crisis.
              </p>
            </div>
          </div>
        </div>

        {/* Nav bar */}
        <nav className="border-b-2 border-[#10b981] bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 md:px-8 md:py-2.5">
            <div className="hidden flex-wrap items-center text-sm font-medium text-slate-600 md:flex">
              <a href="#overview" className="rounded px-3 py-2 transition-colors hover:bg-emerald-50 hover:text-[#065f46]">Overview</a>
              <a href="#how-it-works" className="rounded px-3 py-2 transition-colors hover:bg-emerald-50 hover:text-[#065f46]">Application Process</a>
              <a href="#benefits" className="rounded px-3 py-2 transition-colors hover:bg-emerald-50 hover:text-[#065f46]">Types of Assistance</a>
              <a href="#faq" className="rounded px-3 py-2 transition-colors hover:bg-emerald-50 hover:text-[#065f46]">Frequently Asked Questions</a>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link
                to="/login"
                onClick={handleLoginClick}
                className="inline-flex items-center justify-center rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-all hover:border-[#065f46] hover:bg-[#065f46] hover:text-white sm:px-4 sm:py-2 sm:text-sm"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-1.5 rounded bg-[#10b981] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#059669] sm:px-4 sm:py-2 sm:text-sm"
              >
                Apply for Assistance <ArrowRightIcon />
              </Link>
            </div>
          </div>
        </nav>
      </header>

      <main>
        {/* HERO */}
        <section id="overview">
          <div
            className="relative min-h-[500px] sm:min-h-[520px] md:min-h-[580px]"
            style={{
              backgroundImage: `linear-gradient(106deg, rgba(12,35,64,0.62) 0%, rgba(12,35,64,0.52) 38%, rgba(12,35,64,0.34) 66%, rgba(6,95,70,0.22) 84%, rgba(6,95,70,0.16) 100%), url('${hero}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[#0c2340]/38 via-[#0c2340]/14 to-transparent" />
            <div className="relative z-10 flex h-full flex-col justify-end px-4 py-8 text-white sm:px-10 sm:py-14 md:px-14 md:py-16 lg:px-20 lg:py-20">
              <div className="max-w-full sm:max-w-3xl">
                <span className="inline-block rounded-full border border-emerald-300/60 bg-emerald-500/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100 sm:text-xs">
                  Fiscal Year 2025-2026
                </span>
                <h2 className="mt-3 font-display text-[clamp(1.6rem,8.4vw,3.25rem)] font-bold leading-[1.08] sm:mt-4 sm:text-4xl md:text-5xl lg:text-6xl">
                  Assistance to Individuals in Crisis Situation
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-100/95 sm:mt-4 sm:text-base sm:leading-8 md:text-lg">
                  A formal and accessible digital application system for individuals and families seeking emergency financial assistance from the City Government of Vigan.
                </p>
                <div className="mt-5 flex flex-wrap gap-2.5 sm:mt-8 sm:gap-3">
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#10b981] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition-all hover:bg-[#059669] hover:-translate-y-0.5 sm:px-6 sm:py-3"
                  >
                    Apply for Assistance <ArrowRightIcon />
                  </Link>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center justify-center rounded-lg border border-white/55 bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/25 sm:px-6 sm:py-3"
                  >
                    View Application Process
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STATS BAND */}
        <section className="bg-gradient-to-r from-[#064e3b] via-[#065f46] to-[#047857]">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-2 divide-x divide-y divide-white/10 lg:grid-cols-4">
              {[
                { value: 'PHP 2.5M+', label: 'Total Disbursed',    sub: 'Released to beneficiaries' },
                { value: '6',      label: 'Types of Assistance', sub: 'Available under the program' },
                { value: '72 hrs', label: 'Processing Time',     sub: 'From submission to release' },
                { value: '100%',   label: 'Government-Backed',   sub: 'DSWD-supervised program' },
              ].map(({ value, label, sub }) => (
                <div key={label} className="px-6 py-10 md:px-10 md:py-12">
                  <p className="font-display text-4xl font-bold text-[#6ee7b7] md:text-5xl">{value}</p>
                  <p className="mt-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-white">{label}</p>
                  <p className="mt-1 text-xs text-emerald-100/85">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PROCESS STEPS */}
        <section id="how-it-works" className="bg-slate-50 py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#059669]">Application Process</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-[#0c2340] md:text-4xl xl:text-5xl">
                Six clear steps from application to release
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                The assistance process is presented in a straightforward sequence so applicants understand each requirement and review stage.
              </p>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {processSteps.map(({ n, title, desc, Icon }) => (
                <article
                  key={n}
                  className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-[#10b981]/40 hover:shadow-xl"
                >
                  <span className="pointer-events-none absolute -right-1 -top-1 select-none font-mono text-8xl font-black text-slate-100 transition-colors duration-300 group-hover:text-[#10b981]/12">
                    {n}
                  </span>
                  <div className="relative">
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-[#10b981]/20 bg-emerald-50 transition-all duration-300 group-hover:border-[#10b981]/50 group-hover:bg-emerald-100">
                      <Icon />
                    </div>
                    <div className="mt-3 h-0.5 w-8 rounded-full bg-[#10b981]" />
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-[#0c2340]">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* BENEFITS */}
        <section id="benefits" className="bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#047857] py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#6ee7b7]">Types of Assistance</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl xl:text-5xl">
                Support designed for individuals in crisis
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-100/90">
                The program extends financial assistance across six categories to address the immediate needs of eligible individuals and families.
              </p>
            </div>

            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {benefits.map(({ title, desc, Icon }) => (
                <article
                  key={title}
                  className="group rounded-xl border border-white/10 bg-white/5 p-8 transition-all duration-300 hover:border-[#10b981]/40 hover:bg-white/10"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#10b981]/25 bg-[#10b981]/15 text-[#6ee7b7] transition-all duration-300 group-hover:border-[#10b981]/50 group-hover:bg-[#10b981]/25">
                    <Icon />
                  </div>
                  <h3 className="mt-6 font-display text-2xl font-bold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-100/90">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-[#f0fdf4] py-20 md:py-28">
          <div className="mx-auto max-w-4xl px-4 md:px-8">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#059669]">Frequently Asked Questions</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-[#0c2340] md:text-4xl xl:text-5xl">
                Guidance for applicants and their families
              </h2>
            </div>

            <div className="mt-12 flex flex-col gap-3">
              {faqs.map((faq, index) => (
                <div
                  key={faq.q}
                  className="overflow-hidden rounded-xl border border-emerald-200 bg-white transition-all hover:border-[#10b981]/60"
                >
                  <button
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-base font-semibold text-[#0c2340]"
                    onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                    aria-expanded={activeFaq === index}
                    aria-controls={`faq-panel-${index}`}
                  >
                    <span>{faq.q}</span>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all duration-200 ${activeFaq === index ? 'border-[#10b981] bg-[#10b981] text-white' : 'border-slate-300 text-slate-500'}`}>
                      {activeFaq === index ? '-' : '+'}
                    </span>
                  </button>
                  {activeFaq === index && (
                    <div
                      id={`faq-panel-${index}`}
                      className="border-t border-emerald-100 bg-emerald-50/60 px-6 py-5 text-sm leading-7 text-slate-600"
                    >
                      {faq.items ? (
                        <ul className="list-disc space-y-3 pl-5">
                          {faq.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        faq.a
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden py-20 md:py-28">
          <div className="absolute inset-0 bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#047857]" />
          <div className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-[#10b981]/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-40 -bottom-40 h-[500px] w-[500px] rounded-full bg-[#0c2340]/22 blur-3xl" />

          <div className="relative mx-auto max-w-5xl px-4 text-center md:px-8 md:text-right">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#6ee7b7]">Online Services</p>
            <h2 className="mt-4 font-display text-4xl font-bold text-white md:text-5xl xl:text-6xl">
              Begin your assistance application
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-100/90">
              Create your account to submit requirements, monitor application progress, and receive assistance notices online.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row md:justify-end">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#10b981] px-8 py-4 text-base font-bold text-white shadow-lg shadow-emerald-900/30 transition-all hover:-translate-y-0.5 hover:bg-[#059669]"
              >
                Create Applicant Account <ArrowRightIcon className="h-5 w-5" />
              </Link>
              <Link
                to="/login"
                onClick={handleLoginClick}
                className="inline-flex items-center justify-center rounded-lg border border-white/45 bg-white/15 px-8 py-4 text-base font-medium text-white transition-all hover:bg-white/25"
              >
                Sign In to Existing Account
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-gradient-to-r from-[#064e3b] via-[#065f46] to-[#047857] py-14 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 md:px-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <img
              src={logo}
              alt="Vigan City Seal"
              className="h-10 w-10 sm:h-14 sm:w-14 shrink-0 object-contain"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
                Heritage City of Vigan
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-white">
                AICS Online Application Portal
              </p>
              <p className="mt-2 max-w-md text-sm leading-7 text-slate-100/90">
                Digital services for assistance application, case filing, document submission, and status monitoring for eligible residents of Vigan City.
              </p>
            </div>
          </div>

          <div className="grid gap-8 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Portal Links</p>
              <div className="mt-4 flex flex-col gap-2.5 text-slate-100/90">
                <Link to="/login" onClick={handleLoginClick} className="transition-colors hover:text-white">Login</Link>
                <Link to="/register" className="transition-colors hover:text-white">Apply for Assistance</Link>
                <a href="https://vigancity.gov.ph/" target="_blank" rel="noreferrer" className="transition-colors hover:text-white">Vigan City Official Website</a>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Information</p>
              <div className="mt-4 flex flex-col gap-2.5 text-slate-100/90">
                <a href="#how-it-works" className="transition-colors hover:text-white">Application Process</a>
                <a href="#faq" className="transition-colors hover:text-white">Frequently Asked Questions</a>
                <a href="#benefits" className="transition-colors hover:text-white">Types of Assistance</a>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-white/20 px-4 pt-6 text-xs text-slate-200/95 md:px-8">
          (c) {new Date().getFullYear()} City Government of Vigan | Management Information System - AICS | All rights reserved.
        </div>
      </footer>

    </div>
  )
}

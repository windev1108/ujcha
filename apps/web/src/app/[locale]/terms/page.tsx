import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("terms_of_service"),
    description: t("terms_intro"),
  };
}

export default async function TermsPage() {
  const t = await getTranslations();

  const SECTIONS = [
    {
      id: "chap-nhan",
      title: t("ts1_title"),
      content: [{ subtitle: "", body: t("ts1_body") }],
    },
    {
      id: "tai-khoan",
      title: t("ts2_title"),
      content: [
        { subtitle: t("ts2_p1_sub"), body: t("ts2_p1_body") },
        { subtitle: t("ts2_p2_sub"), body: t("ts2_p2_body") },
        { subtitle: t("ts2_p3_sub"), body: t("ts2_p3_body") },
      ],
    },
    {
      id: "dat-hang",
      title: t("ts3_title"),
      content: [
        { subtitle: t("ts3_p1_sub"), body: t("ts3_p1_body") },
        { subtitle: t("ts3_p2_sub"), body: t("ts3_p2_body") },
        { subtitle: t("ts3_p3_sub"), body: t("ts3_p3_body") },
      ],
    },
    {
      id: "huy-hoan",
      title: t("ts4_title"),
      content: [
        { subtitle: t("ts4_p1_sub"), body: t("ts4_p1_body") },
        { subtitle: t("ts4_p2_sub"), body: t("ts4_p2_body") },
        { subtitle: t("ts4_p3_sub"), body: t("ts4_p3_body") },
      ],
    },
    {
      id: "diem-thuong",
      title: t("ts5_title"),
      content: [
        { subtitle: t("ts5_p1_sub"), body: t("ts5_p1_body") },
        { subtitle: t("ts5_p2_sub"), body: t("ts5_p2_body") },
        { subtitle: t("ts5_p3_sub"), body: t("ts5_p3_body") },
      ],
    },
    {
      id: "cam-ket",
      title: t("ts6_title"),
      content: [{ subtitle: "", body: t("ts6_body") }],
    },
    {
      id: "gioi-han",
      title: t("ts7_title"),
      content: [{ subtitle: "", body: t("ts7_body") }],
    },
    {
      id: "thay-doi",
      title: t("ts8_title"),
      content: [{ subtitle: "", body: t("ts8_body") }],
    },
    {
      id: "phap-luat",
      title: t("ts9_title"),
      content: [{ subtitle: "", body: t("ts9_body") }],
    },
    {
      id: "lien-he-dk",
      title: t("ts10_title"),
      content: [{ subtitle: "", body: t("ts10_body") }],
    },
  ];

  return (
    <div className="min-h-screen bg-surface-soft">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a3c34] via-[#1e4438] to-[#112a21] pb-20 pt-14 sm:pb-24 sm:pt-18">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 size-64 rounded-full bg-white/[0.03] blur-3xl" />
          <div className="absolute -bottom-16 left-1/4 size-80 rounded-full bg-[#99d6b3]/[0.05] blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }}
          />
        </div>
        <div className="relative container mx-auto max-w-[72rem] px-4 lg:px-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
            <ScrollText className="size-7 text-white" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">{t("legal_eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{t("terms_of_service")}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/55">
            {t("terms_updated")}
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" className="w-full">
            <path d="M0 40 C360 0 1080 0 1440 40 L1440 40 L0 40Z" fill="rgb(247,247,247)" />
          </svg>
        </div>
      </section>

      {/* Content */}
      <div className="container mx-auto max-w-[72rem] px-4 pb-24 pt-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

          {/* TOC sidebar */}
          <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-56">
            <div className="rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.07)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{t("table_of_contents")}</p>
              <nav className="mt-3 flex flex-col gap-1">
                {SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground/60 transition-colors hover:bg-surface-soft hover:text-foreground"
                  >
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <article className="min-w-0 flex-1 rounded-3xl border border-black/6 bg-white p-6 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.07)] sm:p-8 lg:p-10">
            <p className="mb-8 text-sm leading-relaxed text-foreground/65 border-l-2 border-kun-primary/40 pl-4">
              {t("terms_intro")}
            </p>

            <div className="space-y-10">
              {SECTIONS.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="mb-4 text-base font-bold tracking-tight text-foreground">{section.title}</h2>
                  <div className="space-y-4">
                    {section.content.map((block, i) => (
                      <div key={i}>
                        {block.subtitle && (
                          <h3 className="mb-1 text-sm font-semibold text-foreground">{block.subtitle}</h3>
                        )}
                        <p className="text-sm leading-relaxed text-foreground/65">{block.body}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

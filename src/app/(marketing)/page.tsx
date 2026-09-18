import Image from "next/image";

const brandLink =
  "inline-flex items-center gap-2.5 text-ink text-[17px] font-[750] tracking-[-0.03em] no-underline";
const brandMark =
  "grid size-[34px] place-items-center rounded-full bg-accent text-on-accent text-[14px]";

const pillBase =
  "inline-flex items-center justify-center rounded-full font-[720] whitespace-nowrap no-underline transition-[transform,background-color,border-color] duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none active:translate-y-px active:scale-[0.98]";
const navCta = `${pillBase} min-h-10 px-[15px] text-xs bg-accent text-on-accent hover:bg-accent-strong hover:-translate-y-0.5 md:min-h-[42px] md:px-[19px] md:text-sm`;
const primaryButton = `${pillBase} min-h-12 px-[23px] bg-accent text-on-accent hover:bg-accent-strong hover:-translate-y-0.5`;
const secondaryButton = `${pillBase} min-h-12 px-[23px] border border-line text-ink hover:border-ink hover:-translate-y-0.5`;

const eyebrow = "text-accent text-[12px] font-[800] tracking-[0.15em] uppercase";

const cardBase = "rounded-3xl p-[clamp(28px,4vw,58px)]";
const sectionHeading =
  "m-0 text-[clamp(38px,4.5vw,66px)] font-bold tracking-[-0.055em] leading-[1.06]";
const sectionLeadP = "max-w-[45ch] mt-6 text-muted text-lg leading-[1.6]";
const cardH3 = "mt-[38px] mb-3 text-[26px] tracking-[-0.035em]";
const cardP = "m-0 text-base leading-[1.55]";

const imgCardBase = "absolute overflow-hidden rounded-3xl bg-surface-soft";

const processArticleBase =
  "min-h-0 border-t border-line border-l-0 px-0 py-[26px] md:min-h-[170px] md:border-t-0 md:px-10";
const processArticleFirst = `${processArticleBase} md:border-l-0`;
const processArticleRest = `${processArticleBase} md:border-l md:border-line`;

export default function MarketingPage() {
  return (
    <main className="bg-surface text-ink min-h-dvh overflow-hidden font-sans">
      <header className="relative z-[2] mx-auto flex h-16 w-[min(100%-32px,1280px)] items-center justify-between md:h-18 md:w-[min(100%-48px,1280px)]">
        <a className={brandLink} href="#top" aria-label="Nagelzeit Startseite">
          <span className={brandMark} aria-hidden="true">
            N
          </span>
          <span>Nagelzeit</span>
        </a>
        <nav className="text-muted flex items-center gap-7 text-sm" aria-label="Hauptnavigation">
          <a className="hidden no-underline md:inline" href="#vorteile">
            Vorteile
          </a>
          <a className="hidden no-underline md:inline" href="#styles">
            Nail-Styles
          </a>
          <a className={navCta} href="/admin/login">
            Studio-Login
          </a>
        </nav>
      </header>

      <section
        className="mx-auto grid min-h-auto w-[min(100%-32px,1280px)] grid-cols-1 items-center gap-[42px] px-0 pt-[62px] pb-[88px] md:min-h-[calc(100dvh-72px)] md:w-[min(100%-48px,1280px)] md:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)] md:gap-[72px] md:pt-10 md:pb-16"
        id="top"
      >
        <div className="max-w-[590px]">
          <p className={`${eyebrow} animate-enter mb-[22px] motion-reduce:animate-none`}>
            Dein Termin. Dein Style.
          </p>
          <h1 className="animate-enter m-0 max-w-[11ch] text-[clamp(47px,14vw,68px)] leading-[0.98] font-[760] tracking-[-0.065em] [animation-delay:80ms] motion-reduce:animate-none md:max-w-[12ch] md:text-[clamp(48px,5.9vw,82px)]">
            Die WhatsApp-Plattform für moderne Nail-Studios.
          </h1>
          <p className="text-muted animate-enter mt-7 max-w-[48ch] text-[clamp(17px,1.4vw,20px)] leading-[1.55] [animation-delay:150ms] motion-reduce:animate-none">
            Studios automatisieren Buchungen, Kundenservice und persönliche Nail-Style-Vorschauen in
            ihrem eigenen WhatsApp-Chat.
          </p>
          <div className="animate-enter mt-[34px] flex flex-wrap gap-3 [animation-delay:220ms] motion-reduce:animate-none">
            <a className={primaryButton} href="#vorteile">
              Plattform entdecken
            </a>
            <a className={secondaryButton} href="#vorteile">
              So funktioniert es
            </a>
          </div>
        </div>
        <div className="bg-surface-soft shadow-marketing animate-visual-enter relative min-h-[62dvh] overflow-hidden rounded-[28px] motion-reduce:animate-none md:min-h-[min(74dvh,760px)]">
          <Image
            className="object-cover"
            src="https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1400&q=88"
            alt="Professionell gepflegte Nägel in einem modernen Nail-Studio"
            fill
            priority
            sizes="(max-width: 767px) 100vw, 50vw"
          />
        </div>
      </section>

      <section
        className="mx-auto w-[min(100%-32px,1280px)] px-0 pt-[100px] pb-[120px] text-center md:w-[min(100%-48px,1280px)] md:px-[8vw] md:pt-[130px] md:pb-[150px]"
        aria-label="Buchung per Chat"
      >
        <p className="text-accent mb-5 font-[750]">Kein Formular. Kein App-Download.</p>
        <h2 className="mx-auto max-w-[22ch] text-[clamp(38px,5vw,68px)] leading-[1.05] font-[680] tracking-[-0.055em]">
          Jedes Studio betreut seine Kundschaft im eigenen, sicheren Bereich.
        </h2>
      </section>

      <section
        className="benefits-areas md:benefits-areas-desktop mx-auto grid w-[min(100%-32px,1280px)] grid-cols-1 gap-[14px] pb-[110px] md:w-[min(100%-48px,1280px)] md:grid-cols-[1.25fr_0.75fr] md:gap-[18px] md:pb-[150px]"
        id="vorteile"
      >
        <div
          className={`${cardBase} bg-surface-raised flex min-h-[430px] flex-col justify-end bg-[linear-gradient(145deg,rgb(166_47_92/8%),transparent_54%)] [grid-area:lead] md:min-h-[520px]`}
        >
          <h2 className={sectionHeading}>So leicht wie eine Nachricht.</h2>
          <p className={sectionLeadP}>
            Unser WhatsApp-Assistent versteht natürliche Sprache und führt dich freundlich zum
            passenden Termin.
          </p>
        </div>
        <article
          className={`${cardBase} bg-accent text-on-accent [grid-area:chat] dark:text-[#fff6fa]`}
        >
          <span className="text-[13px] font-[800]">01</span>
          <h3 className={cardH3}>Natürlich schreiben</h3>
          <p className={`${cardP} text-on-accent-soft`}>
            „Samstag gegen 15 Uhr, Gel-Nägel und Pediküre“ reicht völlig aus.
          </p>
        </article>
        <article className={`${cardBase} bg-surface-soft [grid-area:choice]`}>
          <span className="text-[13px] font-[800]">02</span>
          <h3 className={cardH3}>Einfach auswählen</h3>
          <p className={`${cardP} text-muted`}>
            Nutze praktische Listen oder antworte jederzeit mit deinen eigenen Worten.
          </p>
        </article>
      </section>

      <section
        className="mx-auto grid w-[min(100%-32px,1280px)] grid-cols-1 items-center gap-[58px] pb-[120px] md:w-[min(100%-48px,1280px)] md:grid-cols-[1.08fr_0.92fr] md:gap-[clamp(44px,8vw,120px)] md:pb-[160px]"
        id="styles"
      >
        <div className="relative min-h-[560px] md:min-h-[680px]">
          <div className={`${imgCardBase} top-0 right-[18%] bottom-[12%] left-0`}>
            <Image
              className="object-cover"
              src="https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=1000&q=86"
              alt="Detailaufnahme eines modernen Nail-Designs"
              fill
              sizes="(max-width: 767px) 86vw, 35vw"
            />
          </div>
          <div
            className={`${imgCardBase} border-surface right-0 bottom-0 h-[48%] w-[44%] border-8`}
          >
            <Image
              className="object-cover"
              src="https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=800&q=86"
              alt="Farbige Nail-Art als Inspiration"
              fill
              sizes="(max-width: 767px) 45vw, 20vw"
            />
          </div>
        </div>
        <div className="p-0 md:pr-[4vw]">
          <p className={eyebrow}>Inspiration im Chat</p>
          <h2 className={sectionHeading}>Sieh deinen neuen Look vor dem Termin.</h2>
          <p className={sectionLeadP}>
            Sende ein Foto deiner Hand. Du erhältst bis zu drei persönliche Style-Vorschauen direkt
            in WhatsApp.
          </p>
        </div>
      </section>

      <section
        className="border-line mx-auto w-[min(100%-32px,1280px)] border-t pt-[90px] pb-[110px] md:w-[min(100%-48px,1280px)] md:pt-[110px] md:pb-[150px]"
        aria-labelledby="process-title"
      >
        <h2 id="process-title" className={`${sectionHeading} max-w-[14ch]`}>
          Heute noch zum Wunschtermin.
        </h2>
        <div className="mt-[58px] grid grid-cols-1 md:mt-[80px] md:grid-cols-3">
          <article className={processArticleFirst}>
            <strong className="text-[24px] tracking-[-0.03em]">Schreiben</strong>
            <p className="text-muted mt-[22px] max-w-[26ch] leading-[1.55]">
              Starte den Chat und sag uns, wonach du suchst.
            </p>
          </article>
          <article className={processArticleRest}>
            <strong className="text-[24px] tracking-[-0.03em]">Auswählen</strong>
            <p className="text-muted mt-[22px] max-w-[26ch] leading-[1.55]">
              Finde Studio, Leistungen, Wunschperson und Zeit.
            </p>
          </article>
          <article className={processArticleRest}>
            <strong className="text-[24px] tracking-[-0.03em]">Bestätigt</strong>
            <p className="text-muted mt-[22px] max-w-[26ch] leading-[1.55]">
              Dein Termin wird direkt im WhatsApp-Chat bestätigt.
            </p>
          </article>
        </div>
      </section>

      <section className="bg-surface-raised mx-auto mb-6 flex min-h-[450px] w-[min(100%-32px,1280px)] flex-col items-center justify-center rounded-[28px] px-6 py-[70px] text-center md:min-h-[520px] md:w-[min(100%-48px,1280px)]">
        <h2 className={sectionHeading}>Du betreibst ein Nail-Studio?</h2>
        <p className="text-muted mt-[22px] mb-[30px] text-lg">
          Verwalte Standorte, Termine und WhatsApp-Konfiguration an einem Ort.
        </p>
        <a className={primaryButton} href="/admin/login">
          Zum Studio-Login
        </a>
      </section>

      <footer className="text-muted mx-auto grid min-h-[150px] w-[min(100%-32px,1280px)] grid-cols-1 items-center gap-4 px-0 py-12 text-[13px] md:w-[min(100%-48px,1280px)] md:grid-cols-[1fr_auto_1fr] md:gap-0 md:py-0">
        <a className={brandLink} href="#top">
          <span className={brandMark} aria-hidden="true">
            N
          </span>
          <span>Nagelzeit</span>
        </a>
        <p>Termine und Nail-Inspiration per WhatsApp.</p>
        <p className="justify-self-start md:justify-self-end">
          © {new Date().getFullYear()} Nagelzeit
        </p>
      </footer>
    </main>
  );
}

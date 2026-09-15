import Image from "next/image";

import styles from "./page.module.css";

const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "";
const whatsappUrl = whatsappNumber ? `https://wa.me/${whatsappNumber}` : "https://wa.me/";

export default function MarketingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="#top" aria-label="Nagelzeit Startseite">
          <span className={styles.brandMark} aria-hidden="true">
            N
          </span>
          <span>Nagelzeit</span>
        </a>
        <nav className={styles.nav} aria-label="Hauptnavigation">
          <a href="#vorteile">Vorteile</a>
          <a href="#styles">Nail-Styles</a>
          <a className={styles.navCta} href={whatsappUrl}>
            Auf WhatsApp buchen
          </a>
        </nav>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Dein Termin. Dein Style.</p>
          <h1>Dein nächster Nail-Termin beginnt hier.</h1>
          <p className={styles.heroText}>
            Finde dein Studio, buche per WhatsApp und probiere neue Looks direkt auf deinem Foto.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href={whatsappUrl}>
              Auf WhatsApp buchen
            </a>
            <a className={styles.secondaryButton} href="#vorteile">
              So funktioniert es
            </a>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <Image
            src="https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1400&q=88"
            alt="Professionell gepflegte Nägel in einem modernen Nail-Studio"
            fill
            priority
            sizes="(max-width: 767px) 100vw, 50vw"
          />
        </div>
      </section>

      <section className={styles.statement} aria-label="Buchung per Chat">
        <p>Kein Formular. Kein App-Download.</p>
        <h2>Schreib einfach, wann du Zeit hast und was du dir wünschst.</h2>
      </section>

      <section className={styles.benefits} id="vorteile">
        <div className={styles.benefitLead}>
          <h2>So leicht wie eine Nachricht.</h2>
          <p>
            Unser WhatsApp-Assistent versteht natürliche Sprache und führt dich freundlich zum
            passenden Termin.
          </p>
        </div>
        <article className={styles.benefitChat}>
          <span className={styles.benefitNumber}>01</span>
          <h3>Natürlich schreiben</h3>
          <p>„Samstag gegen 15 Uhr, Gel-Nägel und Pediküre“ reicht völlig aus.</p>
        </article>
        <article className={styles.benefitChoice}>
          <span className={styles.benefitNumber}>02</span>
          <h3>Einfach auswählen</h3>
          <p>Nutze praktische Listen oder antworte jederzeit mit deinen eigenen Worten.</p>
        </article>
      </section>

      <section className={styles.styleSection} id="styles">
        <div className={styles.styleImages}>
          <div className={styles.styleImageMain}>
            <Image
              src="https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=1000&q=86"
              alt="Detailaufnahme eines modernen Nail-Designs"
              fill
              sizes="(max-width: 767px) 86vw, 35vw"
            />
          </div>
          <div className={styles.styleImageDetail}>
            <Image
              src="https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=800&q=86"
              alt="Farbige Nail-Art als Inspiration"
              fill
              sizes="(max-width: 767px) 45vw, 20vw"
            />
          </div>
        </div>
        <div className={styles.styleCopy}>
          <p className={styles.eyebrow}>Inspiration im Chat</p>
          <h2>Sieh deinen neuen Look vor dem Termin.</h2>
          <p>
            Sende ein Foto deiner Hand. Du erhältst bis zu drei persönliche Style-Vorschauen direkt
            in WhatsApp.
          </p>
        </div>
      </section>

      <section className={styles.process} aria-labelledby="process-title">
        <h2 id="process-title">Heute noch zum Wunschtermin.</h2>
        <div className={styles.processGrid}>
          <article>
            <strong>Schreiben</strong>
            <p>Starte den Chat und sag uns, wonach du suchst.</p>
          </article>
          <article>
            <strong>Auswählen</strong>
            <p>Finde Studio, Leistungen, Wunschperson und Zeit.</p>
          </article>
          <article>
            <strong>Bestätigt</strong>
            <p>Dein Termin wird direkt im WhatsApp-Chat bestätigt.</p>
          </article>
        </div>
      </section>

      <section className={styles.finalCta}>
        <h2>Bereit für frische Nägel?</h2>
        <p>Dein passendes Studio ist nur eine Nachricht entfernt.</p>
        <a className={styles.primaryButton} href={whatsappUrl}>
          Auf WhatsApp buchen
        </a>
      </section>

      <footer className={styles.footer}>
        <a className={styles.brand} href="#top">
          <span className={styles.brandMark} aria-hidden="true">
            N
          </span>
          <span>Nagelzeit</span>
        </a>
        <p>Termine und Nail-Inspiration per WhatsApp.</p>
        <p>© {new Date().getFullYear()} Nagelzeit</p>
      </footer>
    </main>
  );
}

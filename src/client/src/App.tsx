import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Copy, ExternalLink, Link2, LoaderCircle, Plus, Rows3 } from "lucide-react";

interface StoredLink {
  slug: string;
  shortUrl: string;
  originalUrl: string;
  createdAt: string;
}

interface CreateLinkResponse {
  slug: string;
  shortUrl: string;
  error?: string;
}

function loadLinks(): StoredLink[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("tinyurl-links") ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is StoredLink =>
        typeof item?.slug === "string" &&
        typeof item?.shortUrl === "string" &&
        typeof item?.originalUrl === "string" &&
        typeof item?.createdAt === "string",
    );
  } catch {
    return [];
  }
}

function destinationHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function App() {
  const [links, setLinks] = useState<StoredLink[]>(loadLinks);
  const [clickTotals, setClickTotals] = useState<Record<string, number>>({});
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedSlug, setCopiedSlug] = useState("");

  useEffect(() => {
    localStorage.setItem("tinyurl-links", JSON.stringify(links));
  }, [links]);

  useEffect(() => {
    let isActive = true;

    const refreshTotals = async () => {
      const results = await Promise.all(
        links.map(async (link) => {
          try {
            const response = await fetch(`/api/links/${link.slug}/analytics`);
            if (!response.ok) return null;
            const payload = (await response.json()) as { total: number };
            return [link.slug, payload.total] as const;
          } catch {
            return null;
          }
        }),
      );

      if (!isActive) return;
      setClickTotals((current) => {
        const updated = { ...current };
        for (const result of results) {
          if (result) updated[result[0]] = result[1];
        }
        return updated;
      });
    };

    void refreshTotals();
    const intervalId = window.setInterval(() => void refreshTotals(), 5000);
    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [links]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as CreateLinkResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível encurtar este link.");
      }

      const link: StoredLink = {
        slug: payload.slug,
        shortUrl: payload.shortUrl,
        originalUrl: url.trim(),
        createdAt: new Date().toISOString(),
      };
      setLinks((current) => [link, ...current.filter((item) => item.slug !== link.slug)]);
      setClickTotals((current) => ({ ...current, [link.slug]: 0 }));
      setUrl("");
      setNotice("Link criado.");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível conectar ao serviço.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyLink(link: StoredLink) {
    try {
      await navigator.clipboard.writeText(link.shortUrl);
      setCopiedSlug(link.slug);
      setNotice("Link copiado.");
      window.setTimeout(() => setCopiedSlug(""), 1800);
    } catch {
      setError("Não foi possível copiar. Verifique a permissão da área de transferência.");
    }
  }

  const totalClicks = Object.values(clickTotals).reduce((total, value) => total + value, 0);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="TinyURL, início">
          <span className="brand-mark"><Link2 size={18} strokeWidth={2.5} /></span>
          <span className="brand-name">tiny<span>url</span></span>
        </a>
        <div className="topbar-note"><span className="live-dot" /> LINK ENGINE <span className="topbar-divider">/</span> ANALYTICS</div>
      </header>

      <main className="workspace">
        <section className="intro-row" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">SEU ESPAÇO DE LINKS</p>
            <h1 id="page-title">Encurte. Acompanhe.</h1>
          </div>
          <div className="summary-chip" aria-label={`${links.length} links, ${totalClicks} acessos`}>
            <span className="summary-value">{links.length.toString().padStart(2, "0")}</span>
            <span className="summary-label">LINKS ATIVOS</span>
            <span className="summary-divider" />
            <span className="summary-value">{totalClicks.toLocaleString("pt-BR")}</span>
            <span className="summary-label">ACESSOS</span>
          </div>
        </section>

        <section className="composer" aria-labelledby="composer-title">
          <div className="composer-heading">
            <span className="composer-index">01</span>
            <h2 id="composer-title">Novo link</h2>
            <span className="composer-rule" />
            <span className="protocol-note">HTTP / HTTPS</span>
          </div>
          <form className="url-form" onSubmit={handleSubmit}>
            <label className="visually-hidden" htmlFor="long-url">URL longa</label>
            <div className="url-input-wrap">
              <Link2 className="url-input-icon" size={19} aria-hidden="true" />
              <input
                id="long-url"
                type="url"
                inputMode="url"
                placeholder="Cole sua URL longa aqui"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <button className="submit-button" type="submit" disabled={isSubmitting || !url.trim()}>
              {isSubmitting ? <LoaderCircle className="spin" size={17} /> : <Plus size={18} />}
              <span>{isSubmitting ? "Criando" : "Encurtar"}</span>
              {!isSubmitting && <ArrowUpRight size={16} className="submit-arrow" />}
            </button>
          </form>
          <div className="form-feedback" aria-live="polite">
            {error ? <span className="error-message">{error}</span> : notice ? <span>{notice}</span> : <span>&nbsp;</span>}
            <span className="slug-note">SLUG ÚNICO · 6 CARACTERES</span>
          </div>
        </section>

        <section className="links-section" aria-labelledby="links-title">
          <div className="section-heading">
            <div className="section-title-group">
              <span className="section-icon"><Rows3 size={17} /></span>
              <h2 id="links-title">Seus links</h2>
              <span className="count-badge">{links.length}</span>
            </div>
            <div className="refresh-indicator"><span className="refresh-dot" /> ATUALIZA A CADA 5S</div>
          </div>

          <div className="table-scroll">
            <table className="links-table">
              <thead>
                <tr>
                  <th scope="col">LINK CURTO</th>
                  <th scope="col">DESTINO</th>
                  <th scope="col">CRIADO</th>
                  <th scope="col" className="clicks-column">ACESSOS</th>
                  <th scope="col" className="actions-column"><span className="visually-hidden">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.slug}>
                    <td>
                      <a className="short-link" href={link.shortUrl} target="_blank" rel="noreferrer">
                        {link.shortUrl.replace(/^https?:\/\//, "")}
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    </td>
                    <td className="destination-cell" title={link.originalUrl}>{destinationHost(link.originalUrl)}</td>
                    <td className="date-cell">{formatDate(link.createdAt)}</td>
                    <td className="clicks-cell">{(clickTotals[link.slug] ?? 0).toLocaleString("pt-BR")}</td>
                    <td className="actions-cell">
                      <button
                        className={`icon-button${copiedSlug === link.slug ? " is-copied" : ""}`}
                        type="button"
                        onClick={() => void copyLink(link)}
                        aria-label={copiedSlug === link.slug ? "Link copiado" : "Copiar link"}
                        title={copiedSlug === link.slug ? "Copiado" : "Copiar link"}
                      >
                        {copiedSlug === link.slug ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {links.length === 0 && (
              <div className="empty-state">
                <span className="empty-mark"><Link2 size={22} /></span>
                <p>Nenhum link por aqui ainda.</p>
              </div>
            )}
          </div>
          <footer className="table-footer">
            <span>{links.length === 1 ? "1 LINK" : `${links.length} LINKS`}</span>
            <span>REDIRECIONAMENTO HTTP 302</span>
          </footer>
        </section>
        <footer className="page-footer"><span>TINYURL ENGINE</span><span>LINKS CURTOS, DADOS CLAROS.</span></footer>
      </main>
    </div>
  );
}
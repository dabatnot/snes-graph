import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { version } from "../../package.json";
import logo from "../../app-icon.svg";
import { MIT_LICENSE } from "../core/license";
import { releases } from "../help/releases";
import { openRepository } from "../platform";
import { tr } from "../i18n";
export type HelpPage = "news" | "about" | "licenses";
type Component = {
  name: string;
  version: string;
  ecosystem: string;
  license: string;
  source: string;
  platforms: string[];
  notices: string[];
};
type Inventory = { components: Component[]; texts: Record<string, string> };
export function HelpContent({
  page,
  onPage,
  report,
}: {
  page: HelpPage;
  onPage: (page: HelpPage) => void;
  report: (message: string) => void;
}) {
  const { i18n } = useTranslation();
  const language = i18n.language === "en" ? "en" : "fr";
  const [inventory, setInventory] = useState<Inventory>();
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (page !== "licenses" || inventory) return;
    const controller = new AbortController();
    fetch(new URL("licenses/third-party.json", document.baseURI), {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(setInventory)
      .catch((e) => {
        if (e.name !== "AbortError") setError(String(e));
      });
    return () => controller.abort();
  }, [page, inventory]);
  if (page === "about")
    return (
      <div className="help-content">
        <img className="about-logo" src={logo} alt="" />
        <h2>{tr("À propos de SNES Graph", "About SNES Graph")}</h2>
        <p>SNES Graph {version}</p>
        <p>
          {tr(
            "David Brugneaux et les contributeurs",
            "David Brugneaux and contributors",
          )}
        </p>
        <p>
          {tr(
            "Éditeur graphique pour la Super Nintendo.",
            "Graphics editor for the Super Nintendo.",
          )}
        </p>
        <button
          onClick={() =>
            void navigator.clipboard
              .writeText(`SNES Graph ${version}`)
              .then(() => setCopied(true))
              .catch((e) => report(String(e)))
          }
        >
          {copied
            ? tr("Version copiée", "Version copied")
            : tr("Copier la version", "Copy version")}
        </button>
        <p>
          <button
            className="text-link"
            onClick={() =>
              void openRepository().catch((e) => report(String(e)))
            }
          >
            github.com/dabatnot/snes-graph
          </button>
        </p>
        <button onClick={() => onPage("licenses")}>
          {tr(
            "Licence et composants tiers",
            "License and third-party components",
          )}
        </button>
      </div>
    );
  if (page === "news")
    return (
      <div className="help-content">
        <h2>{tr("Nouveautés", "What’s new")}</h2>
        {releases.map((r) => (
          <details
            key={r.date + r.version + r.fr.title}
            open={r.version === version}
          >
            <summary>
              {r.version ? `${r.version} — ` : ""}
              {r[language].title} · {r.date}
            </summary>
            <p>{r[language].summary}</p>
            {(["added", "improved", "fixed"] as const).map((key, i) =>
              r[language][key]?.length ? (
                <section key={key}>
                  <h3>
                    {
                      [
                        tr("Ajouts", "Added"),
                        tr("Améliorations", "Improved"),
                        tr("Corrections", "Fixed"),
                      ][i]
                    }
                  </h3>
                  <ul>
                    {r[language][key]!.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                </section>
              ) : null,
            )}
          </details>
        ))}
      </div>
    );
  return (
    <div className="help-content">
      <h2>
        {tr(
          "Licence et composants tiers",
          "License and third-party components",
        )}
      </h2>
      <p>
        {tr(
          "SNES Graph et le programme assembleur fourni par ses générateurs sont sous licence MIT. Vos créations conservent leur propriété et leur propre licence.",
          "SNES Graph and the assembly program supplied by its generators are MIT licensed. Your creations retain their ownership and their own license.",
        )}
      </p>
      <details>
        <summary>
          {tr("Licence MIT de SNES Graph", "SNES Graph MIT license")}
        </summary>
        <pre>{MIT_LICENSE}</pre>
      </details>
      <h3>{tr("Composants tiers", "Third-party components")}</h3>
      <p>
        {tr(
          "Chaque composant conserve sa licence. Les textes ci-dessous sont les notices originales. Les liens source identifient les versions redistribuées ; les bibliothèques système restent fournies par leur plateforme.",
          "Each component retains its license. The texts below are the original notices. Source links identify the redistributed versions; system libraries are supplied by their platform.",
        )}
      </p>
      <label>
        {tr("Rechercher un composant", "Find a component")}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert">
          {tr("Notices indisponibles : ", "Notices unavailable: ")}
          {error}
        </p>
      )}
      {!inventory && !error && (
        <p>{tr("Chargement des notices…", "Loading notices…")}</p>
      )}
      {inventory?.components
        .filter((c) =>
          `${c.name} ${c.license} ${c.ecosystem}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .map((c) => (
          <details key={`${c.ecosystem}/${c.name}/${c.version}`}>
            <summary>
              {c.name} {c.version} — {c.license}
            </summary>
            <p>
              {c.ecosystem} · {c.platforms.join(", ")}
            </p>
            <p className="source-url">{c.source}</p>
            {c.notices.map((id) => (
              <pre key={id}>{inventory.texts[id]}</pre>
            ))}
          </details>
        ))}
    </div>
  );
}

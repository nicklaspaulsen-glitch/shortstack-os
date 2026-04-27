import { useCallback, useEffect, useState } from "react";
import type {
  AuthState,
  ProspectData,
  ResearchResult,
  SaveLeadPayload,
} from "../shared/types";
import {
  checkAuth,
  getProspect,
  openLogin,
  researchProspect,
  saveLead,
} from "./messaging";
import { ResearchPanel } from "./ResearchPanel";

type SaveStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; leadId: string }
  | { state: "error"; message: string };

export function Popup(): JSX.Element {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [prospect, setProspect] = useState<ProspectData | null>(null);
  const [loadingProspect, setLoadingProspect] = useState<boolean>(true);
  const [save, setSave] = useState<SaveStatus>({ state: "idle" });
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [researchLoading, setResearchLoading] = useState<boolean>(false);
  const [researchError, setResearchError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadingProspect(true);
    try {
      const [authState, prospectData] = await Promise.all([
        checkAuth(),
        getProspect().catch(() => null),
      ]);
      setAuth(authState);
      setProspect(prospectData);
    } finally {
      setLoadingProspect(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = useCallback(async () => {
    if (!prospect) return;
    setSave({ state: "saving" });
    try {
      const payload: SaveLeadPayload = {
        business_name: prospect.company || prospect.fullName,
        name: prospect.fullName,
        email: null,
        phone: null,
        website: null,
        industry: null,
        source_url: prospect.linkedinUrl,
        detected_from: "linkedin_profile",
        headline: prospect.headline,
        role: prospect.role,
        location: prospect.location,
        profile_image_url: prospect.profileImageUrl,
      };
      const result = await saveLead(payload);
      setSave({ state: "saved", leadId: result.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setSave({ state: "error", message: msg });
    }
  }, [prospect]);

  const handleResearch = useCallback(async () => {
    if (!prospect) return;
    setResearchLoading(true);
    setResearchError(null);
    try {
      const result = await researchProspect({
        linkedin_url: prospect.linkedinUrl,
        name: prospect.fullName,
        company: prospect.company,
      });
      setResearch(result);
    } catch (e) {
      setResearchError(e instanceof Error ? e.message : "Research failed");
    } finally {
      setResearchLoading(false);
    }
  }, [prospect]);

  // ─── Not signed in ─────────────────────────────────────────────
  if (auth && !auth.connected) {
    return (
      <main className="popup">
        <Header subtitle="Sign in to save prospects" />
        <div className="card center">
          <p className="muted">
            You're not signed in to ShortStack. Open the app, sign in, then
            return here.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              void openLogin();
            }}
          >
            Sign in to ShortStack
          </button>
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              void refresh();
            }}
          >
            I've signed in — refresh
          </button>
        </div>
      </main>
    );
  }

  // ─── Loading ───────────────────────────────────────────────────
  if (loadingProspect || !auth) {
    return (
      <main className="popup">
        <Header subtitle="Detecting prospect…" />
        <div className="card center">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      </main>
    );
  }

  // ─── No prospect detected ─────────────────────────────────────
  if (!prospect) {
    return (
      <main className="popup">
        <Header
          subtitle={
            auth.userEmail
              ? `Signed in as ${auth.userEmail}`
              : "Signed in"
          }
        />
        <div className="card center">
          <p className="muted">
            Open a LinkedIn profile (linkedin.com/in/...) to detect a
            prospect.
          </p>
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              void refresh();
            }}
          >
            Refresh detection
          </button>
        </div>
      </main>
    );
  }

  // ─── Detected ──────────────────────────────────────────────────
  return (
    <main className="popup">
      <Header
        subtitle={
          auth.userEmail
            ? `Signed in as ${auth.userEmail}`
            : "Signed in"
        }
      />

      <ProspectCard prospect={prospect} />

      <div className="actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            void handleSave();
          }}
          disabled={save.state === "saving" || save.state === "saved"}
        >
          {save.state === "saving"
            ? "Saving…"
            : save.state === "saved"
              ? "Saved"
              : "Save to ShortStack"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            void handleResearch();
          }}
          disabled={researchLoading}
        >
          {researchLoading ? "Researching…" : "Run AI research"}
        </button>
      </div>

      {save.state === "error" ? (
        <div className="alert error">{save.message}</div>
      ) : null}
      {save.state === "saved" ? (
        <div className="alert success">
          Saved to your CRM. Lead id: {save.leadId.slice(0, 8)}…
        </div>
      ) : null}

      {researchError ? (
        <div className="alert error">{researchError}</div>
      ) : null}
      {research ? <ResearchPanel data={research} /> : null}

      <footer className="footer">
        <button
          type="button"
          className="btn-link"
          onClick={() => {
            void chrome.runtime.openOptionsPage();
          }}
        >
          Settings
        </button>
      </footer>
    </main>
  );
}

interface HeaderProps {
  subtitle: string;
}

function Header({ subtitle }: HeaderProps): JSX.Element {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          S
        </div>
        <div>
          <h1 className="brand-title">ShortStack Prospector</h1>
          <p className="brand-subtitle">{subtitle}</p>
        </div>
      </div>
    </header>
  );
}

interface ProspectCardProps {
  prospect: ProspectData;
}

function ProspectCard({ prospect }: ProspectCardProps): JSX.Element {
  return (
    <section className="card prospect">
      <div className="prospect-row">
        {prospect.profileImageUrl ? (
          <img
            src={prospect.profileImageUrl}
            alt=""
            className="avatar"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="avatar avatar-fallback" aria-hidden="true">
            {prospect.fullName.charAt(0)}
          </div>
        )}
        <div className="prospect-text">
          <h2 className="prospect-name">{prospect.fullName}</h2>
          {prospect.headline ? (
            <p className="prospect-headline">{prospect.headline}</p>
          ) : null}
        </div>
      </div>

      <dl className="prospect-meta">
        {prospect.company ? (
          <div>
            <dt>Company</dt>
            <dd>{prospect.company}</dd>
          </div>
        ) : null}
        {prospect.role ? (
          <div>
            <dt>Role</dt>
            <dd>{prospect.role}</dd>
          </div>
        ) : null}
        {prospect.location ? (
          <div>
            <dt>Location</dt>
            <dd>{prospect.location}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

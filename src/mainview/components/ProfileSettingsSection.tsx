import { Loader, MessageCircleQuestion, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../rpc";
import type { ProfileAmendment, ProfileSection, ProjectProfile, UserProfile } from "../types/tasks";
import {
  isProfileContentEmpty,
  projectProfileToSections,
  sectionsToProjectProfile,
  sectionsToUserProfile,
  userProfileToSections,
} from "../types/tasks";
import { useUIFeedback } from "./UIFeedback";

interface ProfileSettingsSectionProps {
  scope: "app" | "project";
  /** Required when scope === "project". */
  projectPath?: string;
  projectName?: string;
}

/**
 * The Profile section (tickets 100 §3 / 101 §3), shared by app Settings and
 * the project settings page: view/edit the raw profile, re-interview, refresh
 * from activity (reviewed amendments), delete. Interview entry points stay
 * hidden until an AI service exists.
 */
export default function ProfileSettingsSection({ scope, projectPath, projectName }: ProfileSettingsSectionProps) {
  const { openProfileInterview, profileRevision } = useApp();
  const { confirm, toast } = useUIFeedback();

  const [hasService, setHasService] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<UserProfile | ProjectProfile | null>(null);
  const [sections, setSections] = useState<ProfileSection[]>([]);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<ProfileSection[]>([]);
  const [saving, setSaving] = useState(false);
  const [reflecting, setReflecting] = useState(false);
  const [amendments, setAmendments] = useState<ProfileAmendment[]>([]);
  const [appAmendments, setAppAmendments] = useState<ProfileAmendment[]>([]);
  const [reflectRan, setReflectRan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [services, p] =
      scope === "app"
        ? await Promise.all([api.listAIServices(), api.getUserProfile()])
        : await Promise.all([api.listAIServices(), api.getProjectProfile(projectPath!)]);
    setHasService(services.length > 0);
    setProfile(p);
    setSections(scope === "app" ? userProfileToSections(p as UserProfile | null) : projectProfileToSections(p as ProjectProfile | null));
    setEditing(false);
    setLoaded(true);
  }, [scope, projectPath]);

  // profileRevision bumps when an interview saves — reload the fresh profile.
  useEffect(() => {
    void load();
  }, [load, profileRevision]);

  const persistSections = async (next: ProfileSection[], opts?: { selfNotes?: string }) => {
    const res =
      scope === "app"
        ? await api.saveUserProfile(sectionsToUserProfile(next, profile as UserProfile | null, opts))
        : await api.saveProjectProfile(
            projectPath!,
            sectionsToProjectProfile(next, profile as ProjectProfile | null, opts),
          );
    if (!res.ok) {
      setError(res.error ?? "Couldn't save the profile.");
      return false;
    }
    setError(null);
    await load();
    return true;
  };

  const saveEdits = async () => {
    setSaving(true);
    const ok = await persistSections(edited);
    setSaving(false);
    if (ok) toast("Profile saved");
  };

  const remove = async () => {
    const res = await confirm({
      title: scope === "app" ? "Delete your profile?" : `Delete the profile for "${projectName}"?`,
      message: "AI features go back to working without this context. Interviews can rebuild it anytime.",
      confirmLabel: "Delete",
    });
    if (!res.ok) return;
    if (scope === "app") await api.deleteUserProfile();
    else await api.deleteProjectProfile(projectPath!);
    setAmendments([]);
    setAppAmendments([]);
    setReflectRan(false);
    await load();
    toast("Profile deleted");
  };

  const reflect = async () => {
    setReflecting(true);
    setError(null);
    setReflectRan(false);
    const res = await api.profileReflect(scope, projectPath);
    setReflecting(false);
    if (!res.ok) {
      setError(res.error ?? "Reflection failed.");
      return;
    }
    setAmendments(res.amendments ?? []);
    setAppAmendments(res.appAmendments ?? []);
    setReflectRan(true);
  };

  /** Apply one amendment to this scope's profile — always an explicit user action. */
  const applyAmendment = async (a: ProfileAmendment) => {
    const next = sections.map((s) => (s.id === a.sectionId ? { ...s, value: a.proposed } : s));
    const ok = await persistSections(next);
    if (ok) {
      setAmendments((prev) => prev.filter((x) => x !== a));
      toast(`${a.label} updated`);
    }
  };

  const rejectAmendment = async (a: ProfileAmendment) => {
    await api.recordProfileRejection(
      scope,
      projectPath,
      `Rejected suggestion for ${a.label}: ${Array.isArray(a.proposed) ? a.proposed.join("; ") : a.proposed}`,
    );
    setAmendments((prev) => prev.filter((x) => x !== a));
  };

  /** Cross-scope suggestion (ticket 101 §4): a project reflection amending the APP profile. */
  const applyAppAmendment = async (a: ProfileAmendment) => {
    const appProfile = await api.getUserProfile();
    const appSections = userProfileToSections(appProfile).map((s) =>
      s.id === a.sectionId ? { ...s, value: a.proposed } : s,
    );
    const res = await api.saveUserProfile(sectionsToUserProfile(appSections, appProfile));
    if (!res.ok) {
      setError(res.error ?? "Couldn't update the app profile.");
      return;
    }
    setAppAmendments((prev) => prev.filter((x) => x !== a));
    toast(`App profile ${a.label.toLowerCase()} updated`);
  };

  const rejectAppAmendment = async (a: ProfileAmendment) => {
    await api.recordProfileRejection(
      "app",
      undefined,
      `Rejected suggestion for ${a.label}: ${Array.isArray(a.proposed) ? a.proposed.join("; ") : a.proposed}`,
    );
    setAppAmendments((prev) => prev.filter((x) => x !== a));
  };

  const startInterview = () => {
    if (scope === "app") openProfileInterview({ scope: "app" });
    else openProfileInterview({ scope: "project", projectPath: projectPath!, projectName: projectName ?? "" });
  };

  const hasProfile = profile !== null && !isProfileContentEmpty(sections);
  const actionBtn =
    "flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-40";

  if (!loaded) {
    return (
      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-bold uppercase tracking-wider text-white/40">Profile</span>
        <div className="text-[13px] italic text-white/30">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wider text-white/40">Profile</span>
        {hasService && hasProfile && !editing && (
          <div className="flex items-center gap-1">
            <button onClick={startInterview} className={actionBtn} title="Run another interview session">
              <MessageCircleQuestion size={13} /> Re-interview me
            </button>
            <button
              onClick={() => void reflect()}
              disabled={reflecting}
              className={actionBtn}
              title="Let the AI propose profile updates from your recent activity"
            >
              {reflecting ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh from my
              activity
            </button>
            <button
              onClick={() => {
                setEdited(sections.map((s) => ({ ...s })));
                setEditing(true);
              }}
              className={actionBtn}
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              onClick={() => void remove()}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-red-400/70 hover:bg-white/5 hover:text-red-400"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>

      {!hasService ? (
        <div className="rounded-md border border-dashed border-clide-border px-3 py-4 text-[13px] text-white/40">
          Profile interviews are AI-led — add an AI service {scope === "app" ? "above" : "in Settings"} to enable
          them.
        </div>
      ) : !hasProfile ? (
        <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-clide-border px-3 py-4">
          <span className="text-[13px] text-white/40">
            {scope === "app"
              ? "No profile yet. A short interview teaches CLIDE who it's working for — every AI feature gets more personal."
              : "No profile for this project yet. A short interview teaches CLIDE what it's for and what success looks like."}
          </span>
          <button
            onClick={startInterview}
            className="rounded-md bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/20"
          >
            {scope === "app" ? "Interview me" : "Interview me about this project"}
          </button>
          <span className="text-[11px] text-white/25">
            The profile is local-only and sent solely within your own AI service calls.
          </span>
        </div>
      ) : editing ? (
        <div className="flex flex-col gap-3 rounded-md border border-white/10 bg-white/[0.02] p-3">
          {edited.map((s) => (
            <div key={s.id} className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-white/60">
                {s.label}
                {s.kind === "list" && <span className="ml-1.5 text-white/30">one per line</span>}
              </label>
              <textarea
                rows={s.kind === "list" ? 3 : 2}
                value={Array.isArray(s.value) ? s.value.join("\n") : s.value}
                onChange={(e) =>
                  setEdited((prev) =>
                    prev.map((x) =>
                      x.id === s.id
                        ? { ...x, value: x.kind === "list" ? e.target.value.split("\n") : e.target.value }
                        : x,
                    ),
                  )
                }
                className="clide-scroll w-full resize-y rounded-md border border-clide-border bg-clide-bg px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-white/30"
              />
            </div>
          ))}
          <div className="flex gap-1.5">
            <button
              disabled={saving}
              onClick={() => void saveEdits()}
              className="rounded-md bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-md px-3 py-1.5 text-[12px] text-white/50 hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-md border border-clide-border px-3 py-3">
          {sections.map((s) => {
            const rendered = Array.isArray(s.value) ? s.value.filter((v) => v.trim()) : s.value.trim();
            if (Array.isArray(rendered) ? rendered.length === 0 : !rendered) return null;
            return (
              <div key={s.id} className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-white/30">{s.label}</span>
                {Array.isArray(rendered) ? (
                  <ul className="list-disc pl-4 text-[13px] text-white/70">
                    {rendered.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-[13px] text-white/70">{rendered}</span>
                )}
              </div>
            );
          })}
          <span className="pt-1 text-[11px] text-white/25">
            Interviewed {profile?.interviewCount ?? 0}×
            {profile?.updatedAt ? ` · updated ${profile.updatedAt.slice(0, 10)}` : ""} · local-only, sent solely
            within your own AI service calls
          </span>
        </div>
      )}

      {reflectRan && amendments.length === 0 && appAmendments.length === 0 && (
        <span className="text-[12px] italic text-white/40">
          Nothing new — your recent activity matches the profile.
        </span>
      )}

      {amendments.length > 0 && (
        <AmendmentList
          heading="Suggested updates from your activity"
          amendments={amendments}
          onApply={(a) => void applyAmendment(a)}
          onReject={(a) => void rejectAmendment(a)}
        />
      )}

      {appAmendments.length > 0 && (
        <AmendmentList
          heading="Suggestions for your app profile"
          amendments={appAmendments}
          onApply={(a) => void applyAppAmendment(a)}
          onReject={(a) => void rejectAppAmendment(a)}
        />
      )}

      {error && <span className="text-[12px] text-red-400">{error}</span>}
    </div>
  );
}

interface AmendmentListProps {
  heading: string;
  amendments: ProfileAmendment[];
  onApply: (a: ProfileAmendment) => void;
  onReject: (a: ProfileAmendment) => void;
}

function renderValue(v: string | string[]): string {
  return Array.isArray(v) ? v.filter((x) => x.trim()).join("; ") : v;
}

/** Reviewed-diff list (ticket 100 §4): the profile never silently rewrites itself. */
function AmendmentList({ heading, amendments, onApply, onReject }: AmendmentListProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-amber-300/20 bg-amber-300/5 p-3">
      <span className="text-[12px] font-semibold text-amber-200/80">{heading}</span>
      {amendments.map((a, i) => (
        <div key={`${a.sectionId}-${i}`} className="flex flex-col gap-1 border-t border-white/5 pt-2 first:border-t-0 first:pt-0">
          <span className="text-[12px] font-medium text-white/70">{a.label}</span>
          {a.reason && <span className="text-[11px] italic text-white/40">{a.reason}</span>}
          {renderValue(a.current) && (
            <span className="text-[12px] text-white/40 line-through">{renderValue(a.current)}</span>
          )}
          <span className="text-[12px] text-white/80">{renderValue(a.proposed)}</span>
          <div className="flex gap-1.5 pt-0.5">
            <button
              onClick={() => onApply(a)}
              className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20"
            >
              Accept
            </button>
            <button
              onClick={() => onReject(a)}
              className="rounded-md px-2.5 py-1 text-[11px] text-white/50 hover:bg-white/5 hover:text-white"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

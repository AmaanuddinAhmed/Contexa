"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { prepareAvatar } from "@/lib/avatarImage";
import Avatar from "@/components/Avatar";
import Segmented from "@/components/Segmented";
import OnboardingSteps from "@/components/OnboardingSteps";
import BlockedPeople from "@/components/BlockedPeople";
import DeleteAccount from "@/components/DeleteAccount";
import {
  FormSection,
  FormSkeleton,
  PillChoice,
  TermsField,
  splitTerms,
  useOnboarding,
} from "@/components/FormBits";

interface Profile {
  name: string;
  bio?: string;
  education?: string;
  role?: string;
  experienceLevel?: string;
  skills: string[];
  interests: string[];
  collaborationPreferences: string[];
  visibility: "public" | "private";
}

interface ProfileResponse {
  success: boolean;
  data: {
    profile: Profile | null;
    avatarUrl?: string | null;
  };
}

interface AvatarResponse {
  success: boolean;
  data: { avatarUrl: string | null };
}

const emptyProfile: Profile = {
  name: "",
  bio: "",
  education: "",
  role: "",
  experienceLevel: "",
  skills: [],
  interests: [],
  collaborationPreferences: [],
  visibility: "public",
};

const EXPERIENCE_LEVELS = [
  { value: "Beginner", label: "Beginner" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Advanced", label: "Advanced" },
] as const;

const VISIBILITY_OPTIONS = [
  { value: "public" as const, label: "Public" },
  { value: "private" as const, label: "Private" },
];

export default function ProfilePage() {
  const router = useRouter();
  const onboarding = useOnboarding();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [skills, setSkills] = useState("");
  const [interests, setInterests] = useState("");
  const [preferences, setPreferences] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      const token = getToken();

      if (!token) {
        setMessage("Please log in first.");
        setLoading(false);
        return;
      }

      try {
        const response = await api<ProfileResponse>("/profile", {
          token,
        });

        setAvatarUrl(response.data.avatarUrl ?? null);

        if (response.data.profile) {
          const savedProfile = response.data.profile;

          setProfile(savedProfile);
          setSkills(savedProfile.skills.join(", "));
          setInterests(savedProfile.interests.join(", "));
          setPreferences(savedProfile.collaborationPreferences.join(", "));
        }
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Unable to load profile.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    setMessage("");

    const token = getToken();

    if (!token) {
      setMessage("Please log in first.");
      return;
    }

    setSaving(true);

    try {
      const response = await api<ProfileResponse>("/profile", {
        method: "PUT",
        token,
        body: JSON.stringify({
          ...profile,
          skills: splitTerms(skills),
          interests: splitTerms(interests),
          collaborationPreferences: splitTerms(preferences),
        }),
      });

      if (onboarding) {
        router.push("/context?onboarding=1");
        return;
      }

      setProfile(response.data.profile ?? emptyProfile);
      setSaved(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setAvatarBusy(true);
    setAvatarError("");

    try {
      const image = await prepareAvatar(file);
      const response = await api<AvatarResponse>("/profile/avatar", {
        method: "PUT",
        token: getToken() ?? undefined,
        headers: { "Content-Type": image.type },
        body: image,
      });
      setAvatarUrl(response.data.avatarUrl);
    } catch (error) {
      setAvatarError(
        error instanceof Error ? error.message : "Unable to upload the photo.",
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    setAvatarError("");

    try {
      await api<AvatarResponse>("/profile/avatar", {
        method: "DELETE",
        token: getToken() ?? undefined,
      });
      setAvatarUrl(null);
    } catch (error) {
      setAvatarError(
        error instanceof Error ? error.message : "Unable to remove the photo.",
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const update = (changes: Partial<Profile>) => {
    setSaved(false);
    setProfile((current) => ({ ...current, ...changes }));
  };

  const previewSkills = splitTerms(skills);
  const previewInterests = splitTerms(interests);
  const subtitle = [profile.role, profile.education].filter(Boolean).join(", ");

  return (
    <main className="page">
      {onboarding && <OnboardingSteps current={1} />}

      <header>
        <h1 className="page-title">Your profile</h1>
        <p className="page-lede">
          Who you are and what you bring. Both matching modes use this; keep it
          specific so the reasons on your matches are specific too.
        </p>
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_340px] lg:gap-8">
        {loading ? (
          <FormSkeleton />
        ) : (
          <form
            onSubmit={handleSubmit}
            className="panel grid animate-rise gap-7 sm:p-9"
          >
            <FormSection title="About you">
              <div className="flex items-center gap-4">
                <Avatar
                  name={profile.name || "You"}
                  src={avatarUrl}
                  size="lg"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <label
                      className={`btn btn-quiet cursor-pointer px-4 py-2 ${
                        avatarBusy ? "pointer-events-none opacity-50" : ""
                      }`}
                    >
                      {avatarBusy
                        ? "Saving photo"
                        : avatarUrl
                          ? "Change photo"
                          : "Add a photo"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={uploadAvatar}
                        disabled={avatarBusy}
                        className="sr-only"
                      />
                    </label>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={removeAvatar}
                        disabled={avatarBusy}
                        className="btn px-3 py-2 text-muted hover:text-danger"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    Optional. Cropped to a square; saved straight away.
                  </p>
                </div>
              </div>
              {avatarError && (
                <p role="alert" className="alert-error">
                  {avatarError}
                </p>
              )}

              <div>
                <label htmlFor="name" className="label">
                  Name
                </label>
                <input
                  id="name"
                  value={profile.name}
                  onChange={(event) => update({ name: event.target.value })}
                  className="field"
                  autoComplete="name"
                  required
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="role" className="label">
                    Role
                  </label>
                  <input
                    id="role"
                    value={profile.role}
                    onChange={(event) => update({ role: event.target.value })}
                    className="field"
                    placeholder="Frontend developer"
                  />
                </div>
                <div>
                  <label htmlFor="education" className="label">
                    Education
                  </label>
                  <input
                    id="education"
                    value={profile.education}
                    onChange={(event) =>
                      update({ education: event.target.value })
                    }
                    className="field"
                    placeholder="MCA, PES University"
                  />
                </div>
              </div>

              <PillChoice
                name="experience"
                label="Experience level"
                options={EXPERIENCE_LEVELS}
                value={profile.experienceLevel ?? ""}
                onChange={(experienceLevel) => update({ experienceLevel })}
              />

              <div>
                <label htmlFor="bio" className="label">
                  Bio
                </label>
                <textarea
                  id="bio"
                  value={profile.bio}
                  onChange={(event) => update({ bio: event.target.value })}
                  className="field min-h-28 resize-y"
                  rows={4}
                  placeholder="What you’re building, what you enjoy working on."
                />
              </div>
            </FormSection>

            <FormSection
              title="What you bring"
              description="Skills are what others can come to you for. Matching compares these terms with other people’s skills and needs."
            >
              <TermsField
                id="skills"
                label="Skills"
                value={skills}
                onChange={(value) => {
                  setSaved(false);
                  setSkills(value);
                }}
                placeholder="Python, Java, MongoDB"
              />
              <TermsField
                id="interests"
                label="Interests"
                value={interests}
                onChange={(value) => {
                  setSaved(false);
                  setInterests(value);
                }}
                placeholder="AI, Web development, Cloud"
                tone="plain"
              />
              <TermsField
                id="preferences"
                label="Collaboration preferences"
                value={preferences}
                onChange={(value) => {
                  setSaved(false);
                  setPreferences(value);
                }}
                placeholder="Online, Project-based"
                tone="plain"
              />
            </FormSection>

            <FormSection
              title="Visibility"
              description={
                profile.visibility === "public"
                  ? "Public: you can appear in other people’s matches."
                  : "Private: you won’t appear in anyone’s matches, but you can still see yours."
              }
            >
              <div>
                <Segmented
                  label="Profile visibility"
                  options={VISIBILITY_OPTIONS}
                  value={profile.visibility}
                  onChange={(visibility) => update({ visibility })}
                />
              </div>
            </FormSection>

            <div className="grid gap-3 border-t border-line pt-7">
              {message && (
                <p role="alert" className="alert-error">
                  {message}
                </p>
              )}
              {saved && (
                <p role="status" className="alert-ok animate-fade">
                  Profile saved.{" "}
                  <Link href="/context" className="font-semibold underline">
                    Update your context
                  </Link>
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary w-full py-3 sm:w-fit sm:px-7"
              >
                {saving
                  ? "Saving"
                  : onboarding
                    ? "Save and continue"
                    : "Save profile"}
              </button>
            </div>
          </form>
        )}

        <aside
          className="hidden lg:sticky lg:top-24 lg:block"
          aria-label="Preview of your card"
        >
          <p className="mb-3 text-sm font-medium text-muted">
            How others see you
          </p>
          <div className="rounded-[1.75rem] bg-surface p-6 shadow-[var(--shadow-float)] ring-1 ring-line/70">
            <div className="flex items-start gap-4">
              <Avatar name={profile.name || "You"} src={avatarUrl} />
              <div className="min-w-0">
                <p className="font-display text-xl leading-tight font-semibold break-words">
                  {profile.name || "Your name"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {subtitle || "Role and education"}
                </p>
              </div>
            </div>
            {profile.bio && (
              <p className="mt-4 line-clamp-4 text-sm leading-6 text-muted">
                {profile.bio}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {previewSkills.length > 0 ? (
                previewSkills.map((skill, index) => (
                  <span key={`${skill}-${index}`} className="chip">
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-sm text-faint">
                  Your skills appear here
                </span>
              )}
            </div>
            {previewInterests.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {previewInterests.map((interest, index) => (
                  <span key={`${interest}-${index}`} className="chip-outline">
                    {interest}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-5 flex items-center gap-2 border-t border-line pt-4 text-xs text-muted">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  profile.visibility === "public" ? "bg-ok" : "bg-faint"
                }`}
              />
              {profile.visibility === "public"
                ? "Visible in matches"
                : "Hidden from matches"}
            </p>
          </div>
        </aside>
      </div>

      {!onboarding && <BlockedPeople />}
      {!onboarding && <DeleteAccount />}
    </main>
  );
}

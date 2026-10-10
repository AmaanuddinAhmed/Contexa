"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  };
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

// Must match the levels the matching engine recognises exactly.
const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced"];

// Set by the register page (?onboarding=1) so new users move through
// profile -> context -> recommendations without hunting for the next page.
const isOnboarding = (): boolean =>
  new URLSearchParams(window.location.search).get("onboarding") === "1";

export default function ProfilePage() {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [skills, setSkills] = useState("");
  const [interests, setInterests] = useState("");
  const [preferences, setPreferences] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      const token = localStorage.getItem("contexa_token");

      if (!token) {
        setMessage("Please log in first.");
        setLoading(false);
        return;
      }

      try {
        const response = await api<ProfileResponse>("/profile", {
          token,
        });

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

    const token = localStorage.getItem("contexa_token");

    if (!token) {
      setMessage("Please log in first.");
      return;
    }

    try {
      const response = await api<ProfileResponse>("/profile", {
        method: "PUT",
        token,
        body: JSON.stringify({
          ...profile,
          skills: skills
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          interests: interests
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          collaborationPreferences: preferences
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });

      if (isOnboarding()) {
        router.push("/context?onboarding=1");
        return;
      }

      setProfile(response.data.profile ?? emptyProfile);
      setMessage("Profile saved.");
      setSaved(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save profile.",
      );
    }
  };

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-2xl p-8">Loading profile...</main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <h1 className="mb-6 text-3xl font-bold">My Profile</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block font-medium">Name</label>
          <input
            value={profile.name}
            onChange={(event) =>
              setProfile({
                ...profile,
                name: event.target.value,
              })
            }
            className="w-full rounded border p-3"
            required
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">Bio</label>
          <textarea
            value={profile.bio}
            onChange={(event) =>
              setProfile({
                ...profile,
                bio: event.target.value,
              })
            }
            className="w-full rounded border p-3"
            rows={4}
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">Education</label>
          <input
            value={profile.education}
            onChange={(event) =>
              setProfile({
                ...profile,
                education: event.target.value,
              })
            }
            className="w-full rounded border p-3"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">Role</label>
          <input
            value={profile.role}
            onChange={(event) =>
              setProfile({
                ...profile,
                role: event.target.value,
              })
            }
            className="w-full rounded border p-3"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">Experience Level</label>
          <select
            value={profile.experienceLevel ?? ""}
            onChange={(event) =>
              setProfile({
                ...profile,
                experienceLevel: event.target.value,
              })
            }
            className="w-full rounded border p-3"
          >
            <option value="">Select one</option>
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block font-medium">Skills</label>
          <input
            value={skills}
            onChange={(event) => setSkills(event.target.value)}
            className="w-full rounded border p-3"
            placeholder="Python, Java, MongoDB"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">Interests</label>
          <input
            value={interests}
            onChange={(event) => setInterests(event.target.value)}
            className="w-full rounded border p-3"
            placeholder="AI, Web Development, Cloud"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">
            Collaboration Preferences
          </label>
          <input
            value={preferences}
            onChange={(event) => setPreferences(event.target.value)}
            className="w-full rounded border p-3"
            placeholder="Online, Project-based"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">Visibility</label>

          <select
            value={profile.visibility}
            onChange={(event) =>
              setProfile({
                ...profile,
                visibility: event.target.value as "public" | "private",
              })
            }
            className="w-full rounded border p-3"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>

        <button type="submit" className="rounded bg-black px-6 py-3 text-white">
          Save Profile
        </button>

        {message && (
          <p className="text-sm">
            {message}{" "}
            {saved && (
              <Link href="/context" className="font-medium underline">
                Update your context
              </Link>
            )}
          </p>
        )}
      </form>
    </main>
  );
}

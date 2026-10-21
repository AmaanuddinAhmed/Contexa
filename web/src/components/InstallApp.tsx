"use client";

import { useState, useSyncExternalStore } from "react";
import {
  getInstallState,
  getServerInstallState,
  promptInstall,
  subscribeInstall,
} from "@/lib/installPrompt";

export default function InstallApp() {
  const state = useSyncExternalStore(
    subscribeInstall,
    getInstallState,
    getServerInstallState,
  );
  const [showHint, setShowHint] = useState(false);

  if (state === "prompt") {
    return (
      <button
        type="button"
        onClick={() => void promptInstall()}
        className="btn btn-primary"
      >
        Install app
      </button>
    );
  }

  if (state === "ios") {
    return (
      <div className="flex flex-col items-start">
        <button
          type="button"
          onClick={() => setShowHint((open) => !open)}
          aria-expanded={showHint}
          aria-controls="install-hint"
          className="btn btn-primary"
        >
          Install app
        </button>
        {showHint && (
          <p
            id="install-hint"
            className="mt-2 max-w-xs text-sm text-muted animate-fade"
          >
            Tap the Share button, then <strong>Add to Home Screen</strong>.
          </p>
        )}
      </div>
    );
  }

  return null;
}

type InstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState = "installed" | "prompt" | "ios" | "unavailable";

let deferredPrompt: InstallPromptEvent | null = null;
let justInstalled = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredPrompt = event as InstallPromptEvent;
        notify();
    });

    window.addEventListener("appinstalled", () => {
        deferredPrompt = null;
        justInstalled = true;
        notify();
    });
}

function isStandalone(): boolean {
    const iosStandalone = (navigator as Navigator & { standalone?: boolean })
        .standalone;
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        iosStandalone === true
    );
}

function isIos(): boolean {
    return (
        /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
}

export function getInstallState(): InstallState {
    if (justInstalled || isStandalone()) return "installed";
    if (deferredPrompt) return "prompt";
    if (isIos()) return "ios";
    return "unavailable";
}

export function getServerInstallState(): InstallState {
    return "unavailable";
}

export function subscribeInstall(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export async function promptInstall(): Promise<void> {
    const prompt = deferredPrompt;

    if (!prompt) return;

    deferredPrompt = null;
    notify();
    await prompt.prompt();
    await prompt.userChoice;
}
import { useEffect, useState } from "react";

export default function usePWAInstall() {
  const [promptEvent, setPromptEvent] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPromptEvent(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const installApp = async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    const result = await promptEvent.userChoice;
    console.log("Install result:", result);
  };

  return {
    canInstall: !!promptEvent,
    installApp
  };
}

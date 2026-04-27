import { DEFAULT_BASE_URL, getSettings, setSettings } from "../shared/config";

async function init(): Promise<void> {
  const baseUrlInput = document.getElementById("baseUrl") as HTMLInputElement | null;
  const saveBtn = document.getElementById("save") as HTMLButtonElement | null;
  const status = document.getElementById("status") as HTMLSpanElement | null;
  if (!baseUrlInput || !saveBtn || !status) return;

  const settings = await getSettings();
  baseUrlInput.value =
    settings.baseUrl === DEFAULT_BASE_URL ? "" : settings.baseUrl;

  saveBtn.addEventListener("click", () => {
    void (async () => {
      const next = baseUrlInput.value.trim();
      try {
        await setSettings({
          baseUrl: next === "" ? DEFAULT_BASE_URL : next,
        });
        status.textContent = "Saved.";
        status.style.color = "var(--color-success)";
        window.setTimeout(() => {
          status.textContent = "";
        }, 2200);
      } catch (e) {
        status.textContent = e instanceof Error ? e.message : "Save failed";
        status.style.color = "var(--color-error)";
      }
    })();
  });
}

void init();

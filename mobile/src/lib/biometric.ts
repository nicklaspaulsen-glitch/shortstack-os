import * as LocalAuthentication from "expo-local-authentication";

interface BiometricGate {
  ok: boolean;
  reason?: string;
}

export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function biometricGate(prompt: string): Promise<BiometricGate> {
  if (!(await isBiometricAvailable())) {
    return { ok: true, reason: "no-biometric-hardware" };
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    fallbackLabel: "Use passcode",
    disableDeviceFallback: false,
  });
  if (result.success) return { ok: true };
  return {
    ok: false,
    reason: "error" in result && typeof result.error === "string" ? result.error : "Cancelled",
  };
}

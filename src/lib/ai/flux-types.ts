// FLUX-related shared types. Split from flux-client to keep the
// client tree-shakable from client-side React components that only
// need the option shape.
export type SupportedFluxVariant = "dev" | "schnell";

export interface FluxLicenseInfo {
  variant: SupportedFluxVariant;
  license: "non-commercial" | "apache-2.0";
  commercialSafe: boolean;
  description: string;
}

export const FLUX_LICENSE_INFO: Record<SupportedFluxVariant, FluxLicenseInfo> = {
  dev: {
    variant: "dev",
    license: "non-commercial",
    commercialSafe: false,
    description:
      "FLUX.1-dev — top image quality (~12B params). NON-COMMERCIAL license, personal/internal use only.",
  },
  schnell: {
    variant: "schnell",
    license: "apache-2.0",
    commercialSafe: true,
    description:
      "FLUX.1-schnell — distilled, 4-step fast model. Apache-2.0, safe for commercial use.",
  },
};

export type ThumbnailModelChoice = "flux" | "current" | "auto";

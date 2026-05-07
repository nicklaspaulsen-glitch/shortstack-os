import { Metadata } from "next";
import IntakeFormClient from "./intake-form-client";

interface Props {
  params: { formId: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.shortstack.work"}/api/intake/${params.formId}`,
      { cache: "no-store" }
    );
    if (!res.ok) return { title: "Intake Form" };
    const form = await res.json() as { name?: string };
    return { title: form.name ?? "Intake Form" };
  } catch {
    return { title: "Intake Form" };
  }
}

export default function IntakePage({ params }: Props) {
  return <IntakeFormClient formId={params.formId} />;
}

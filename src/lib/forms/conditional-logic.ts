/**
 * Conditional logic helpers for the form builder.
 *
 * Extracted from src/app/dashboard/forms/page.tsx so that Next.js App Router
 * page files only export the allowed exports (default component, metadata,
 * generateMetadata, etc.). Any named export that isn't on the allow-list
 * causes a Vercel build error.
 */

export type ConditionOperator = "equals" | "not_equals" | "contains" | "is_empty" | "is_not_empty";
export type ConditionAction = "show" | "hide" | "require" | "skip_section";

export interface FieldCondition {
  if_field: string; // referenced field id
  if_operator: ConditionOperator;
  if_value?: string; // ignored when operator is is_empty / is_not_empty
  action: ConditionAction;
}

export interface FormField {
  id: string;
  type: "text" | "email" | "phone" | "textarea" | "select" | "number" | "checkbox" | "file" | "rating";
  label: string;
  placeholder: string;
  required: boolean;
  options?: string[];
  /** @deprecated kept for backward compat — use `conditions` instead. */
  condition?: { fieldId: string; value: string } | null;
  conditions?: FieldCondition[];
}

/**
 * Returns true when the rule matches the given field-value. Used by the
 * renderer to decide visibility/requirement at submit time.
 */
export function evaluateCondition(rule: FieldCondition, value: string | undefined): boolean {
  const v = (value ?? "").trim();
  switch (rule.if_operator) {
    case "equals":
      return v === (rule.if_value ?? "");
    case "not_equals":
      return v !== (rule.if_value ?? "");
    case "contains":
      return rule.if_value ? v.toLowerCase().includes(rule.if_value.toLowerCase()) : false;
    case "is_empty":
      return v === "";
    case "is_not_empty":
      return v !== "";
    default:
      return false;
  }
}

/**
 * Compute show/required state for one field given the current form values.
 * Mirrors the runtime semantics described in the FieldCondition docstring.
 */
export function computeFieldVisibility(
  field: FormField,
  values: Record<string, string>,
  fieldsById: Record<string, FormField>,
): { visible: boolean; required: boolean } {
  let visible = true;
  let required = field.required;
  for (const rule of field.conditions || []) {
    if (!fieldsById[rule.if_field]) continue;
    const matches = evaluateCondition(rule, values[rule.if_field]);
    if (!matches) continue;
    if (rule.action === "show") visible = true;
    else if (rule.action === "hide") visible = false;
    else if (rule.action === "require") required = true;
    else if (rule.action === "skip_section") visible = false;
  }
  return { visible, required };
}

import { z } from "zod";

// Field types for the form builder
export const FIELD_TYPES = [
  "text",
  "email",
  "phone",
  "number",
  "dropdown",
  "radio",
  "checkbox",
  "textarea",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

// Individual form field schema
export const formFieldSchema = z.object({
  id: z.string(),
  type: z.enum(FIELD_TYPES),
  label: z.string().min(1, "Label is required").max(200),
  placeholder: z.string().max(200).optional(),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(), // for dropdown, radio
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional(),
  isBase: z.boolean().default(false), // true for immutable base fields
});

// Form schema (stored as JSON in events.form_schema)
export const formSchemaValidator = z.object({
  fields: z.array(formFieldSchema).min(1, "At least one field required"),
  version: z.number().int().default(1),
});

// Registration API input
export const registrationSchema = z.object({
  teamName: z.string().min(2, "Team name too short").max(100).trim(),
  leaderEmail: z.string().email("Invalid email"),
  teamSize: z.number().int().min(1).max(20),
  members: z
    .array(
      z.object({
        name: z.string().min(1).max(200).trim(),
        email: z.string().email().optional(),
        phone: z.string().max(20).optional(),
      })
    )
    .optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type FormField = z.infer<typeof formFieldSchema>;
export type FormSchema = z.infer<typeof formSchemaValidator>;
export type RegistrationInput = z.infer<typeof registrationSchema>;

// Default base fields (always present)
export function getBaseFields(): FormField[] {
  return [
    {
      id: "team_name",
      type: "text",
      label: "Team Name",
      placeholder: "Enter your team name",
      required: true,
      isBase: true,
    },
    {
      id: "leader_email",
      type: "email",
      label: "Leader Email",
      placeholder: "leader@example.com",
      required: true,
      isBase: true,
    },
  ];
}

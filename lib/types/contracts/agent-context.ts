/**
 * Client-provided page context for POST /api/ask (grounding + routing hints).
 * Server enriches from DB; do not trust client-supplied labels as authoritative.
 */
export type AskClientContextPack = {
  surface:
    | "global"
    | "cm_hub"
    | "dashboard"
    | "county"
    | "person"
    | "workflows"
    | "command_center";
  pathname: string;
  /** Person 360 UUID when on /people/[personId] */
  personId?: string;
  /** URL segment when on /counties/[countyKey] or nested place routes */
  countyKey?: string;
  /** /counties/.../places/[cityKey] */
  cityKey?: string;
};

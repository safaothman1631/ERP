/**
 * SectionDoc — data model for per-nav-section in-app documentation.
 * Each section doc is a static module in src/docs/sections/<key>.ts
 */
export interface SubArea {
  name: string;
  purpose: string;
  /** e.g. "Quote → Sales Order → Invoice → Payment → Journal Entry" */
  dataFlow?: string;
  route?: string;
}

export interface SectionDoc {
  /** Matches NavSection.key in navigation.tsx */
  key: string;
  title: string;
  /** One-paragraph plain description */
  purpose: string;
  /** Roles that primarily use this section */
  whoUses: string[];
  /** Sub-modules within the section */
  subAreas: SubArea[];
  /** Firestore collections written/read by this section */
  dataDestination: string;
  /** Other section keys that closely interact */
  related: string[];
  /** Key metrics shown or affected by this section */
  kpis?: string[];
  /** Pro tips */
  tips?: string[];
  /** Optional mermaid diagram source */
  mermaidDiagram?: string;
}

export type SectionDocMap = Record<string, SectionDoc>;

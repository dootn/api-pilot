export type BodyType =
  | 'json'
  | 'html'
  | 'text'
  | 'image'
  | 'binary'
  | 'xml'
  | 'markdown'
  | 'pdf'
  | 'video'
  | 'audio';

export type ViewMode = 'pretty' | 'raw' | 'preview';

export interface ParsedBody {
  type: BodyType;
  /** Parsed JSON object for 'json'; base64 string for 'image'/'video'/'audio'/'pdf'; raw string for all others. */
  data: unknown;
  /** Original response body text. */
  raw: string;
}

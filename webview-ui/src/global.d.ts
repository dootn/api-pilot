declare module '*.css' {
  const styles: Record<string, string>;
  export default styles;
}

declare const APP_VERSION: string;
declare const REPO_URL: string;

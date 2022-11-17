
export interface ImportMetaArray {
  path: any;
  url?: string;
  type: string;
  value?: string;
}

export interface PathToRegexpOptions {
  rootPath: string;
  resourcePath: string;
  alias: object;
  isVite2: boolean;
}

export interface EnvOptions {
  MODE: string;
  BASE_URL: string;
}

export interface LoaderOptions {
  isVite2: boolean;
  env: EnvOptions;
}

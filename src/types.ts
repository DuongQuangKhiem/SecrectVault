export type PasswordType = 'text' | 'pin' | 'pattern';
export type LanguageType = 'vi' | 'en';

export interface VaultItem {
  id: string;
  originalName: string;
  type: string;
  savedPath: string;
  cachePath?: string;
}
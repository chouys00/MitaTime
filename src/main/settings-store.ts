import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AppSettings } from '../shared/types';
import { DEFAULT_FOCUS_SECONDS, DEFAULT_REST_SECONDS } from '../shared/constants';

const DEFAULTS: AppSettings = {
  focusSeconds: DEFAULT_FOCUS_SECONDS,
  restSeconds: DEFAULT_REST_SECONDS,
};

class SettingsStore {
  private cache: AppSettings = { ...DEFAULTS };
  private filePath: string | null = null;
  private loaded = false;

  private getPath(): string {
    if (!this.filePath) {
      this.filePath = path.join(app.getPath('userData'), 'settings.json');
    }
    return this.filePath;
  }

  async load(): Promise<AppSettings> {
    try {
      const raw = await fs.readFile(this.getPath(), 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      this.cache = {
        focusSeconds: this.sanitize(parsed.focusSeconds, DEFAULTS.focusSeconds),
        restSeconds: this.sanitize(parsed.restSeconds, DEFAULTS.restSeconds),
      };
    } catch {
      this.cache = { ...DEFAULTS };
    }
    this.loaded = true;
    return this.cache;
  }

  get(): AppSettings {
    return { ...this.cache };
  }

  async save(next: Partial<AppSettings>): Promise<AppSettings> {
    if (!this.loaded) await this.load();
    this.cache = {
      focusSeconds: this.sanitize(next.focusSeconds, this.cache.focusSeconds),
      restSeconds: this.sanitize(next.restSeconds, this.cache.restSeconds),
    };
    await fs.writeFile(this.getPath(), JSON.stringify(this.cache, null, 2), 'utf-8');
    return { ...this.cache };
  }

  private sanitize(value: unknown, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    const intValue = Math.floor(value);
    if (intValue < 1) return 1;
    if (intValue > 24 * 60 * 60) return 24 * 60 * 60;
    return intValue;
  }
}

export const settingsStore = new SettingsStore();

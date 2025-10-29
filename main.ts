import { App, MarkdownView, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile } from 'obsidian';

interface TlpLevelSetting {
    level: string;
    name: string;
    color: string;
}

interface TlpPluginSettings {
    levels: TlpLevelSetting[];
}

const DEFAULT_SETTINGS: TlpPluginSettings = {
    levels: [
        { level: 'red', name: 'TLP:RED', color: '#ff2a2a' },
        { level: 'amber', name: 'TLP:AMBER', color: '#ffbf00' },
        { level: 'amber+strict', name: 'TLP:AMBER+STRICT', color: '#ffbf00' },
        { level: 'yellow', name: 'TLP:YELLOW', color: '#ffbf00' },
        { level: 'green', name: 'TLP:GREEN', color: '#2aff2a' },
        { level: 'white', name: 'TLP:WHITE', color: '#ffffff' },
        { level: 'clear', name: 'TLP:CLEAR', color: '#ffffff' }
    ]
};

const cloneDefaultSettings = (): TlpPluginSettings => ({
    levels: DEFAULT_SETTINGS.levels.map(level => ({ ...level }))
});

export default class TlpPlugin extends Plugin {
    public settings: TlpPluginSettings = cloneDefaultSettings();

    async onload(): Promise<void> {
        await this.loadSettings();

        this.initializeTlpIndicators();
        this.initializeTlpBanner();

        this.addSettingTab(new TlpSettingTab(this.app, this));
    }

    async loadSettings(): Promise<void> {
        const loaded = (await this.loadData()) as Partial<TlpPluginSettings> | null;
        if (!loaded) {
            this.settings = cloneDefaultSettings();
            return;
        }

        this.settings = {
            levels: ((loaded.levels as Partial<TlpLevelSetting>[] | undefined) ?? DEFAULT_SETTINGS.levels).map(
                (level): TlpLevelSetting => ({
                    level: level?.level ?? '',
                    name: level?.name ?? '',
                    color: level?.color ?? '#ffffff'
                })
            )
        };
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    updateAllFileIndicators(): void {
        this.app.vault.getMarkdownFiles().forEach(file => this.updateFileIndicator(file));
    }

    updateBanner(file: TFile | null): void {
        const view = this.getActiveMarkdownView();
        if (!view) {
            return;
        }

        let banner = view.contentEl.querySelector<HTMLElement>('.tlp-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.classList.add('tlp-banner');
            view.contentEl.prepend(banner);
        }

        if (!file) {
            banner.style.display = 'none';
            banner.classList.remove('show');
            return;
        }

        const color = this.getTlpColor(file);
        const levelName = this.getTlpLevelName(file);
        const rawLevel = this.getRawTlp(file);

        if (color && levelName && rawLevel) {
            banner.textContent = levelName;
            banner.setAttribute('data-tlp', rawLevel);
            banner.style.backgroundColor = color;
            banner.style.display = 'block';
            banner.classList.remove('show');
            // Trigger reflow to restart animation when value changes.
            void banner.offsetWidth;
            banner.classList.add('show');
        } else {
            banner.style.display = 'none';
            banner.classList.remove('show');
        }
    }

    private initializeTlpIndicators(): void {
        this.app.workspace.onLayoutReady(() => this.updateAllFileIndicators());

        this.registerEvent(
            this.app.metadataCache.on('changed', file => {
                if (file instanceof TFile) {
                    this.updateFileIndicator(file);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
                if (file instanceof TFile) {
                    this.removeFileIndicator(oldPath);
                    this.updateFileIndicator(file);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('delete', file => {
                if (file instanceof TFile) {
                    this.removeFileIndicator(file.path);
                }
            })
        );
    }

    private initializeTlpBanner(): void {
        this.app.workspace.onLayoutReady(() => {
            this.updateBanner(this.app.workspace.getActiveFile());
        });

        this.registerEvent(
            this.app.workspace.on('file-open', file => {
                this.updateBanner(file);
            })
        );

        this.registerEvent(
            this.app.metadataCache.on('changed', file => {
                const active = this.app.workspace.getActiveFile();
                if (active && file.path === active.path) {
                    this.updateBanner(file);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('rename', (file: TAbstractFile) => {
                const active = this.app.workspace.getActiveFile();
                if (active && file instanceof TFile && file.path === active.path) {
                    this.updateBanner(file);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('delete', file => {
                const active = this.app.workspace.getActiveFile();
                if (active && file instanceof TFile && file.path === active.path) {
                    this.updateBanner(null);
                }
            })
        );
    }

    private getActiveMarkdownView(): MarkdownView | null {
        return this.app.workspace.getActiveViewOfType(MarkdownView);
    }

    private normalizeLevel(value: string): string {
        return value.trim().replace(/^TLP:/i, '').toLowerCase();
    }

    private getLevelConfig(level: string): TlpLevelSetting | undefined {
        const normalized = this.normalizeLevel(level);
        return this.settings.levels.find(item => this.normalizeLevel(item.level) === normalized);
    }

    private getFrontmatter(file: TFile): Record<string, unknown> | undefined {
        return this.app.metadataCache.getFileCache(file)?.frontmatter ?? undefined;
    }

    private getRawTlp(file: TFile): string | null {
        const frontmatter = this.getFrontmatter(file);
        const value = frontmatter?.tlp ?? frontmatter?.TLP;
        return typeof value === 'string' ? value : null;
    }

    private getTlpColor(file: TFile): string | null {
        const raw = this.getRawTlp(file);
        if (!raw) {
            return null;
        }

        const config = this.getLevelConfig(raw);
        return config ? config.color : null;
    }

    private getTlpLevelName(file: TFile): string | null {
        const raw = this.getRawTlp(file);
        if (!raw) {
            return null;
        }

        const config = this.getLevelConfig(raw);
        return config ? config.name : raw.toUpperCase();
    }

    private updateFileIndicator(file: TFile): void {
        const color = this.getTlpColor(file);
        const levelName = this.getTlpLevelName(file);
        const raw = this.getRawTlp(file);

        this.forEachNavElement(file.path, el => {
            let indicator = el.querySelector<HTMLElement>('.tlp-indicator');
            if (!indicator) {
                indicator = document.createElement('span');
                indicator.classList.add('tlp-indicator');
                el.prepend(indicator);
            }

            if (color && raw) {
                indicator.style.backgroundColor = color;
                indicator.style.display = 'inline-block';
                indicator.setAttribute('aria-label', `TLP level ${levelName ?? raw}`);
                indicator.setAttribute('data-tlp', raw);
            } else {
                indicator.style.display = 'none';
                indicator.removeAttribute('aria-label');
                indicator.removeAttribute('data-tlp');
            }
        });
    }

    private removeFileIndicator(path: string): void {
        this.forEachNavElement(path, el => {
            el.querySelector('.tlp-indicator')?.remove();
        });
    }

    private forEachNavElement(path: string, callback: (el: HTMLElement) => void): void {
        document
            .querySelectorAll<HTMLElement>('.nav-file-title-content')
            .forEach(el => {
                if (el.dataset.path === path) {
                    callback(el);
                }
            });
    }
}

class TlpSettingTab extends PluginSettingTab {
    private plugin: TlpPlugin;

    constructor(app: App, plugin: TlpPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'TLP Levels' });

        const refreshUi = () => {
            this.plugin.updateAllFileIndicators();
            this.plugin.updateBanner(this.app.workspace.getActiveFile());
        };

        this.plugin.settings.levels.forEach((level, index) => {
            const setting = new Setting(containerEl);

            setting.addText(text =>
                text
                    .setPlaceholder('Level')
                    .setValue(level.level)
                    .onChange(async value => {
                        level.level = value;
                        await this.plugin.saveSettings();
                        refreshUi();
                    })
            );

            setting.addText(text =>
                text
                    .setPlaceholder('Display Name')
                    .setValue(level.name)
                    .onChange(async value => {
                        level.name = value;
                        await this.plugin.saveSettings();
                        refreshUi();
                    })
            );

            setting.addColorPicker(color =>
                color
                    .setValue(level.color)
                    .onChange(async value => {
                        level.color = value;
                        await this.plugin.saveSettings();
                        refreshUi();
                    })
            );

            setting.addExtraButton(btn =>
                btn
                    .setIcon('cross')
                    .setTooltip('Delete')
                    .onClick(async () => {
                        this.plugin.settings.levels.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                        refreshUi();
                    })
            );
        });

        new Setting(containerEl)
            .addButton(btn =>
                btn
                    .setButtonText('Add Level')
                    .setCta()
                    .onClick(async () => {
                        this.plugin.settings.levels.push({ level: '', name: '', color: '#ffffff' });
                        await this.plugin.saveSettings();
                        this.display();
                        refreshUi();
                    })
            );

        new Setting(containerEl)
            .addButton(btn =>
                btn
                    .setButtonText('Reset to Defaults')
                    .setWarning()
                    .onClick(async () => {
                        this.plugin.settings = cloneDefaultSettings();
                        await this.plugin.saveSettings();
                        this.display();
                        refreshUi();
                    })
            );
    }
}

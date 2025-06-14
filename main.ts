import { App, Editor, MarkdownView, Modal, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

// Remember to rename these classes and interfaces!

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

export default class TlpPlugin extends Plugin {
	settings: TlpPluginSettings;

async onload() {
await this.loadSettings();

    this.initializeTlpIndicators();
    this.initializeTlpBanner();


		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

                // This adds a settings tab so the user can configure various aspects of the plugin
                this.addSettingTab(new TlpSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

async saveSettings() {
    await this.saveData(this.settings);
}

private normalizeLevel(value: string): string {
    return value.trim().replace(/^TLP:/i, '');
}

private getLevelConfig(level: string): TlpLevelSetting | undefined {
    const normalized = this.normalizeLevel(level);
    return this.settings.levels.find(l => l.level.toLowerCase() === normalized.toLowerCase());
}

private getRawTlp(file: TFile): string | null {
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    const tlp = (fm?.tlp ?? fm?.TLP) as string | undefined;
    return tlp ?? null;
}

private getTlpColor(file: TFile): string | null {
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    const tlp = (fm?.tlp ?? fm?.TLP) as string | undefined;
    if (tlp) {
        const config = this.getLevelConfig(tlp);
        if (config) return config.color;
    }
    return null;
}

private updateFileIndicator(file: TFile) {
let navEls = document.querySelectorAll<HTMLElement>('.nav-file-title-content');
if (!navEls.length) {
    navEls = document.querySelectorAll<HTMLElement>('.nav-file-title');
}
navEls.forEach(el => {
if (el.getAttribute('data-path') === file.path) {
                let indicator = el.querySelector<HTMLElement>('.tlp-indicator');
                if (!indicator) {
                indicator = document.createElement('span');
                indicator.classList.add('tlp-indicator');
                el.prepend(indicator);
                }
const color = this.getTlpColor(file);
if (color) {
indicator.style.backgroundColor = color;
indicator.style.display = 'inline-block';
} else {
indicator.style.display = 'none';
}
}
});
}

updateAllFileIndicators() {
this.app.vault.getMarkdownFiles().forEach(f => this.updateFileIndicator(f));
}

private initializeTlpIndicators() {
this.app.workspace.onLayoutReady(() => this.updateAllFileIndicators());
this.registerEvent(this.app.metadataCache.on('changed', file => {
if (file instanceof TFile) this.updateFileIndicator(file);
}));
this.registerEvent(this.app.vault.on('rename', file => {
if (file instanceof TFile) this.updateFileIndicator(file);
}));
}

private getTlpLevelName(file: TFile): string | null {
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    const tlp = (fm?.tlp ?? fm?.TLP) as string | undefined;
    if (!tlp) return null;
    const config = this.getLevelConfig(tlp);
    return config ? config.name : tlp.toUpperCase();
}

updateBanner(file: TFile | null) {
const view = this.app.workspace.getActiveViewOfType(MarkdownView);
if (!view) return;
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
            void banner.offsetWidth;
            banner.classList.add('show');
        } else {
            banner.style.display = 'none';
            banner.classList.remove('show');
        }
}

private initializeTlpBanner() {
this.app.workspace.onLayoutReady(() => {
this.updateBanner(this.app.workspace.getActiveFile());
});
this.registerEvent(this.app.workspace.on('file-open', file => this.updateBanner(file)));
this.registerEvent(this.app.metadataCache.on('changed', file => {
const active = this.app.workspace.getActiveFile();
if (active && file.path === active.path) this.updateBanner(file);
}));
}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class TlpSettingTab extends PluginSettingTab {
    plugin: TlpPlugin;

    constructor(app: App, plugin: TlpPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'TLP Levels' });

        this.plugin.settings.levels.forEach((level, index) => {
            const setting = new Setting(containerEl);
            setting.addText(text => text
                .setPlaceholder('Level')
                .setValue(level.level)
                .onChange(async value => {
                    level.level = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateAllFileIndicators();
                    this.plugin.updateBanner(this.app.workspace.getActiveFile());
                }));
            setting.addText(text => text
                .setPlaceholder('Display Name')
                .setValue(level.name)
                .onChange(async value => {
                    level.name = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateBanner(this.app.workspace.getActiveFile());
                }));
            setting.addColorPicker(color => color
                .setValue(level.color)
                .onChange(async value => {
                    level.color = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateAllFileIndicators();
                    this.plugin.updateBanner(this.app.workspace.getActiveFile());
                }));
            setting.addExtraButton(btn => btn
                .setIcon('cross')
                .setTooltip('Delete')
                .onClick(async () => {
                    this.plugin.settings.levels.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.display();
                    this.plugin.updateAllFileIndicators();
                    this.plugin.updateBanner(this.app.workspace.getActiveFile());
                }));
        });

        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('Add Level')
                .onClick(() => {
                    this.plugin.settings.levels.push({ level: '', name: '', color: '#ffffff' });
                    this.display();
                }));

        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('Reset to Defaults')
                .setWarning()
                .onClick(async () => {
                    this.plugin.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
                    await this.plugin.saveSettings();
                    this.display();
                    this.plugin.updateAllFileIndicators();
                    this.plugin.updateBanner(this.app.workspace.getActiveFile());
                }));
    }
}

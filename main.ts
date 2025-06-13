import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

// Remember to rename these classes and interfaces!

interface TlpPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: TlpPluginSettings = {
        mySetting: 'default'
}

const TLP_COLORS: Record<string, string> = {
red: '#ff2a2a',
amber: '#ffbf00',
"amber+strict": '#ffbf00',
yellow: '#ffbf00',
green: '#2aff2a',
white: '#ffffff',
clear: '#ffffff'
};

export default class TlpPlugin extends Plugin {
	settings: TlpPluginSettings;

async onload() {
await this.loadSettings();

this.initializeTlpIndicators();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

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
		this.addSettingTab(new SampleSettingTab(this.app, this));

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

private getTlpColor(file: TFile): string | null {
const cache = this.app.metadataCache.getFileCache(file);
const fm = cache?.frontmatter;
const tlp = (fm?.tlp ?? fm?.TLP) as string | undefined;
if (tlp) {
const color = TLP_COLORS[tlp.toLowerCase()];
if (color) return color;
}
return null;
}

private updateFileIndicator(file: TFile) {
const navEls = document.querySelectorAll<HTMLElement>('.nav-file-title');
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

private updateAllFileIndicators() {
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

class SampleSettingTab extends PluginSettingTab {
	plugin: TlpPlugin;

	constructor(app: App, plugin: TlpPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}

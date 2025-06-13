const { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } = require('obsidian');

const DEFAULT_SETTINGS = {
    mySetting: 'default'
};

const TLP_COLORS = {
    red: '#ff2a2a',
    amber: '#ffbf00',
    yellow: '#ffbf00',
    green: '#2aff2a',
    white: '#ffffff',
    clear: '#ffffff'
};

class TlpPlugin extends Plugin {
    async onload() {
        await this.loadSettings();
        this.initializeTlpIndicators();

        const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', () => {
            new Notice('This is a notice!');
        });
        ribbonIconEl.addClass('my-plugin-ribbon-class');

        const statusBarItemEl = this.addStatusBarItem();
        statusBarItemEl.setText('Status Bar Text');

        this.addCommand({
            id: 'open-sample-modal-simple',
            name: 'Open sample modal (simple)',
            callback: () => {
                new SampleModal(this.app).open();
            }
        });

        this.addCommand({
            id: 'sample-editor-command',
            name: 'Sample editor command',
            editorCallback: (editor, view) => {
                console.log(editor.getSelection());
                editor.replaceSelection('Sample Editor Command');
            }
        });

        this.addCommand({
            id: 'open-sample-modal-complex',
            name: 'Open sample modal (complex)',
            checkCallback: (checking) => {
                const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (markdownView) {
                    if (!checking) {
                        new SampleModal(this.app).open();
                    }
                    return true;
                }
            }
        });

        this.addSettingTab(new SampleSettingTab(this.app, this));

        this.registerDomEvent(document, 'click', (evt) => {
            console.log('click', evt);
        });

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

    getTlpColor(file) {
        const cache = this.app.metadataCache.getFileCache(file);
        const fm = cache?.frontmatter;
        const tlp = fm?.tlp ?? fm?.TLP;
        if (tlp) {
            const color = TLP_COLORS[tlp.toLowerCase()];
            if (color)
                return color;
        }
        return null;
    }

    updateFileIndicator(file) {
        const navEls = document.querySelectorAll('.nav-file-title');
        navEls.forEach((el) => {
            if (el.getAttribute('data-path') === file.path) {
                let indicator = el.querySelector('.tlp-indicator');
                if (!indicator) {
                    indicator = document.createElement('span');
                    indicator.classList.add('tlp-indicator');
                    el.prepend(indicator);
                }
                const color = this.getTlpColor(file);
                if (color) {
                    indicator.style.backgroundColor = color;
                    indicator.style.display = 'inline-block';
                }
                else {
                    indicator.style.display = 'none';
                }
            }
        });
    }

    updateAllFileIndicators() {
        this.app.vault.getMarkdownFiles().forEach((f) => this.updateFileIndicator(f));
    }

    initializeTlpIndicators() {
        this.app.workspace.onLayoutReady(() => this.updateAllFileIndicators());
        this.registerEvent(this.app.metadataCache.on('changed', (file) => {
            if (file instanceof TFile)
                this.updateFileIndicator(file);
        }));
        this.registerEvent(this.app.vault.on('rename', (file) => {
            if (file instanceof TFile)
                this.updateFileIndicator(file);
        }));
    }
}

class SampleModal extends Modal {
    onOpen() {
        const { contentEl } = this;
        contentEl.setText('Woah!');
    }
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class SampleSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        new Setting(containerEl)
            .setName('Setting #1')
            .setDesc("It's a secret")
            .addText((text) => text
            .setPlaceholder('Enter your secret')
            .setValue(this.plugin.settings.mySetting)
            .onChange(async (value) => {
            this.plugin.settings.mySetting = value;
            await this.plugin.saveSettings();
        }));
    }
}

module.exports = TlpPlugin;

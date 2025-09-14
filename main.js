const { Plugin, Notice } = require("obsidian");

module.exports = class DoubleClickRename extends Plugin {
  onload() {
    // Handler per doppio click
    this._dblHandler = (evt) => {
      try {
        // Escludi doppio click su freccetta
        if (evt.target.closest(".collapse-icon, .tree-item-icon.collapse-icon"))
          return;

        const target = evt.target.closest(".nav-file-title, .nav-folder-title");
        if (!target) return;

        evt.preventDefault();
        evt.stopPropagation();

        const dataPath =
          target.getAttribute("data-path") || target.dataset.path;
        if (!dataPath) return;

        const file = this.app.vault.getAbstractFileByPath(dataPath);
        if (!file) return;

        this.startInlineRename(target, file, dataPath);
      } catch (e) {
        console.error("[double-click-rename] dblHandler error", e);
      }
    };

    this.registerDomEvent(document, "dblclick", this._dblHandler);
  }

  onunload() {
    if (this._currentInput && this._currentInput.parentElement) {
      this._currentInput.remove();
    }
  }

  startInlineRename(target, file, path) {
    if (this._currentInput) {
      this._currentInput.remove();
      this._currentInput = null;
    }

    // Trova il contenitore del titolo (singola dichiarazione)
    const titleContent =
      target.querySelector(
        ".nav-file-title-content, .nav-folder-title-content"
      ) || target;

    // Analizza path
    const lastSlash = path.lastIndexOf("/");
    const parentPath = lastSlash === -1 ? "" : path.slice(0, lastSlash);
    const fullName = path.slice(lastSlash + 1);

    let displayName, extension;

    if (file.children !== undefined) {
      // cartella
      displayName = fullName;
      extension = "";
    } else {
      // file
      const lastDot = fullName.lastIndexOf(".");
      if (lastDot > 0 && lastDot < fullName.length - 1) {
        displayName = fullName.slice(0, lastDot);
        extension = fullName.slice(lastDot);
      } else {
        displayName = fullName;
        extension = "";
      }
    }

    // Determina se è un file o una cartella
    const isFolder = file.children !== undefined;

    // Ottieni il contenitore e il suo stile
    const rect = target.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(target);
    const titleStyle = titleContent
      ? window.getComputedStyle(titleContent)
      : null;

    // Crea e configura l'input
    const input = document.createElement("input");
    input.type = "text";
    input.value = displayName;
    input.className = "double-click-rename-input";

    // Stili di base comuni
    input.style.position = "absolute";
    input.style.left = `${rect.left}px`;
    input.style.top = `${rect.top}px`;
    input.style.width = `${rect.width}px`;
    input.style.height = `${rect.height}px`;
    input.style.fontSize = computedStyle.fontSize;
    input.style.lineHeight = computedStyle.lineHeight;
    input.style.boxSizing = "border-box";
    input.style.background = "var(--background-modifier-form-field)";
    input.style.color = "var(--text-normal)";
    input.style.border = "1px solid var(--background-modifier-border)";
    input.style.borderRadius = "var(--radius-s)";
    input.style.outline = "none";
    input.style.margin = "0";
    input.style.zIndex = "9999";

    // Gestisci diversamente padding e allineamento per file e cartelle
    if (isFolder) {
      input.style.paddingLeft = computedStyle.paddingLeft;
      input.style.paddingRight = computedStyle.paddingRight;
    } else {
      // Per i file, allinea il testo con il contenuto originale
      if (titleContent) {
        const titleRect = titleContent.getBoundingClientRect();
        const offsetLeft = titleRect.left - rect.left;
        input.style.paddingLeft = `${offsetLeft}px`;
        input.style.paddingRight = "8px";
      }
    }

    // Nascondi il titolo originale
    target.style.visibility = "hidden";
    document.body.appendChild(input); // aggiungi direttamente al body

    this._currentInput = input;
    input.focus();
    input.select();

    // Dopo appendChild(input)
    const inputComputedStyle = window.getComputedStyle(input);
    //console.log("Tutte le proprietà CSS calcolate dell'input:");
    for (let prop of inputComputedStyle) {
      //console.log(`${prop}: ${inputComputedStyle.getPropertyValue(prop)}`);
    }

    let isCleanedUp = false;

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;

      if (input && input.parentElement) input.parentElement.removeChild(input);
      target.style.visibility = "";
      this._currentInput = null;
    };

    const doRename = async (trigger) => {
      const newDisplayName = input.value.trim();
      if (!newDisplayName || newDisplayName === displayName) {
        cleanup();
        return;
      }

      try {
        const newFullName = newDisplayName + extension;
        const newPath = parentPath
          ? `${parentPath}/${newFullName}`
          : newFullName;

        input.removeEventListener("blur", blurHandler);

        const existingFile = this.app.vault.getAbstractFileByPath(newPath);
        if (existingFile && existingFile !== file) {
          throw new Error(
            `A ${
              file.children !== undefined ? "folder" : "file"
            } with that name already exists`
          );
        }

        await this.app.fileManager.renameFile(file, newPath);

        setTimeout(() => cleanup(), 100);
      } catch (error) {
        new Notice(`Rename failed: ${error.message}`);
        input.addEventListener("blur", blurHandler);
        input.focus();
        input.select();
      }
    };

    // Eventi
    const blurHandler = () => doRename("blur");
    input.addEventListener("blur", blurHandler);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doRename("enter");
      } else if (e.key === "Escape") {
        e.preventDefault();
        cleanup();
      }
    });

    //console.log("Bounding rect titolo:", target.getBoundingClientRect());
    //console.log("Bounding rect input:", input.getBoundingClientRect());
  }
};

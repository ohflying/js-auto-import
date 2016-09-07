import * as vscode from 'vscode'
import * as path from 'path';

import { ImportObject } from './import-db';

export class ImportFixer {

    private spacesBetweenBraces;
    private doubleQuotes;

    constructor() {
        let config = vscode.workspace.getConfiguration('autoimport');

        this.spacesBetweenBraces = config.get<boolean>('spaceBetweenBraces');
        this.doubleQuotes = config.get<boolean>('doubleQuotes');
    }

    public fix(document: vscode.TextDocument, range: vscode.Range,
        context: vscode.CodeActionContext, token: vscode.CancellationToken, imports: Array<ImportObject>): void {

        let edit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
        let importObj: vscode.Uri | any = imports[0].file;
        let importName: string = imports[0].name;

        let relativePath = this.normaliseRelativePath(importObj, this.getRelativePath(document, importObj));

        if (this.shouldMergeImport(document, relativePath)) {
            edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0),
                this.mergeImports(document, edit, importName, importObj, relativePath, imports[0]));
        } else {
            let imp = imports[0].isDefault ? null : imports[0].name;
            let defDefind = imports[0].isDefault ? imports[0].name : null;
            let line = this.findPosition(document);
            edit.insert(document.uri, new vscode.Position(line, 0),
                this.createImportStatement(imp, relativePath, true, defDefind));
        }

        vscode.workspace.applyEdit(edit);
    }

    private findPosition(document) {
        for(let i = 0; i < document.lineCount; i++) {
            let text = document.lineAt(i).text.trim();
            console.log("text=" + text);
            if (text === '' || text.includes("use strict") || text.startsWith('import ')) {
                continue;
            } else {
                return i;
            }
        }

        return 0;
    }

    private shouldMergeImport(document: vscode.TextDocument, relativePath): boolean {
        return document.getText().indexOf(relativePath) !== -1;
    }

    private mergeImports(document: vscode.TextDocument, edit: vscode.WorkspaceEdit, name, file, relativePath: string, importObj: ImportObject) {

        let exp = new RegExp('(?:import\ )(?:.*)( from\ \')(?:' + relativePath + ')(?:\'\;)')

        let currentDoc = document.getText();

        let foundImport = currentDoc.match(exp)

        if (foundImport) {
            let workingString = foundImport[0];
            let isDefault = workingString.includes('{');
            workingString = workingString
                .replace(/{|}|from|import|'|"| |;/gi, '').replace(relativePath, '');

            let importArray = workingString.split(',');
            if (!isDefault) {
                importArray.push(name)
            }

            let imp = isDefault ? null : importArray.join(', ');
            let defDefind = importObj.isDefault ? name : (isDefault ? workingString : null);
            let newImport = this.createImportStatement(imp, relativePath, false, defDefind);

            currentDoc = currentDoc.replace(exp, newImport);
        }

        return currentDoc;
    }

    private createImportStatement(imp: string, path: string, endline: boolean = false, defaultDefind: string = null): string {
        let baseString = null;
        if (imp && defaultDefind) {
            baseString = `import ${defaultDefind}, { ${imp} } from '${path}';${endline ? '\r\n' : ''}`;
        } else if (imp) {
            baseString = `import { ${imp} } from '${path}';${endline ? '\r\n' : ''}`;
        } else if (defaultDefind) {
            baseString = `import ${defaultDefind} from '${path}';${endline ? '\r\n' : ''}`;
        }

        if (this.doubleQuotes) {
            baseString = baseString.replace(/'/gi, "\"");
        }

        if (!this.spacesBetweenBraces) {
            baseString = baseString.replace('{ ', '{').replace(' }', '}');
        }

        return baseString;
    }

    private getRelativePath(document, importObj: vscode.Uri | any): string {
        return importObj.discovered ? importObj.fsPath :
            path.relative(path.dirname(document.fileName), importObj.fsPath);
    }

    private normaliseRelativePath(importObj, relativePath: string): string {

        let removeFileExtenion = (rp) => {
            if (rp) {
                rp = rp.substring(0, rp.lastIndexOf('.'))
            }
            return rp;
        }

        let makeRelativePath = (rp) => {

            let preAppend = './';

            if (!rp.startsWith(preAppend)) {
                rp = preAppend + rp;
            }

            if(/^win/.test(process.platform)){
                rp = rp.replace(/\\/g, '/');
            }

            return rp;
        }

        if (importObj.discovered === undefined) {
            relativePath = makeRelativePath(relativePath);
            relativePath = removeFileExtenion(relativePath);
        }

        return relativePath;
    }
}
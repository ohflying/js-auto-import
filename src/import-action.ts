import { PathHelper } from './helpers/path-helper';
import * as vscode from 'vscode';

import { ImportDb, ImportObject } from './import-db';

export interface Context {
    document: vscode.TextDocument;
    range: vscode.Range;
    context: vscode.CodeActionContext;
    token: vscode.CancellationToken;
    imports?: Array<ImportObject>
}

export class ImportAction {

    private db: ImportDb;

    constructor() {
        this.db = new ImportDb();
    }

    public provideCodeActions(document: vscode.TextDocument, range: vscode.Range,
        context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.Command[] {

        let actionContext = this.createContext(document, range, context, token);

        if (this.canHandleAction(actionContext)) {
            return this.actionHandler(actionContext);
        }
    }

    private canHandleAction(context: Context): boolean {
        let diagnostic: vscode.Diagnostic = context.context.diagnostics[0];
        console.log("diagnostic=" + diagnostic.message);
        if (diagnostic && diagnostic.message.endsWith('is not defined. (no-undef)')) {
            let imp = diagnostic.message.replace('is not defined. (no-undef)', '')
                .replace(/{|}|from|import|'|"| |\.|;/gi, '')

            try {

                let found = this.db.getImport(imp);

                if (found) {
                    context.imports = found;
                    return true
                }

            } catch (exception) {
                return false;
            }
        }

        return false;
    }

    private actionHandler(context: Context): vscode.Command[] {
        let path = (imp: ImportObject) => {
            if ((<any>imp.file).discovered) {
                return imp.file.fsPath;
            } else {
                let rp = PathHelper.normalisePath(
                    PathHelper.getRelativePath(context.document.uri.fsPath, imp.file.fsPath));
                return rp;
            }
        };

        let handlers = [];
        context.imports.forEach(i => {
            handlers.push({
                title: `Import ${i.name} from ${path(i)}`,
                command: 'extension.fixImport',
                arguments: [context.document, context.range, context.context, context.token, context.imports]
            });
        });

        return handlers;
    }

    private createContext(document: vscode.TextDocument, range: vscode.Range,
        context: vscode.CodeActionContext, token: vscode.CancellationToken): Context {
        return {
            document, range, context, token
        }
    }
}
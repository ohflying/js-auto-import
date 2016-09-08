import { NodeUpload } from './node-upload';
import * as path from 'path';
import * as FS from 'fs';
import * as vscode from 'vscode';
import * as _ from 'lodash';

import { ImportDb } from './import-db';
import { AutoImport } from './auto-import';

export class ImportScanner {

    private db: ImportDb;

    private scanStarted: Date;

    private scanEnded: Date;

    private showOutput: boolean;

    private filesToScan: string;

    private showNotifications: boolean;

    constructor(private config: vscode.WorkspaceConfiguration) {
        this.db = new ImportDb();
        this.filesToScan = this.config.get<string>('filesToScan');
        this.showNotifications = this.config.get<boolean>('showNotifications');
    }

    public scan(request: any): void {

        this.showOutput = request.showOutput ? request.showOutput : false;

        if (this.showOutput) {
            this.scanStarted = new Date();
        }

        vscode.workspace
            .findFiles(this.filesToScan, '**/node_modules/**', 99999)
            .then((files) => this.processWorkspaceFiles(files));

        vscode.commands
            .executeCommand('extension.scanNodeModules');
    }

    public edit(request: any): void {
        this.db.delete(request);
        this.loadFile(request.file, true);
        new NodeUpload(vscode.workspace.getConfiguration('autoimport')).scanNodeModules();
    }

    public delete(request: any): void {
        this.db.delete(request);
        AutoImport.setStatusBar();
    }


    private processWorkspaceFiles(files: vscode.Uri[]): void {
        let pruned = files.filter((f) => {
            return f.fsPath.indexOf('typings') === -1 &&
                f.fsPath.indexOf('node_modules') === -1 &&
                f.fsPath.indexOf('jspm_packages') === -1;
        });
        pruned.reverse().forEach((f, i) => {
            this.loadFile(f, i === (pruned.length - 1));
        });
    }

    private loadFile(file: vscode.Uri, last: boolean): void {
        console.log("file=" + file.fsPath);
        FS.readFile(file.fsPath, 'utf8', (err, data) => {
            if (err) {
                return console.log(err);
            }

            this.processFile(data, file);

            if (last) {
                AutoImport.setStatusBar();
            }

            if (last && this.showOutput && this.showNotifications) {
                this.scanEnded = new Date();

                let str = `[AutoImport] cache creation complete - (${Math.abs(<any>this.scanStarted - <any>this.scanEnded)}ms)`;

                vscode.window
                    .showInformationMessage(str);
            }
        });
    }

    private processFile(data: any, file: vscode.Uri): void {
        var defaultClassMatches = data.match(/(export[\s]+?default[\s]+?class)[\s]+?([\w])\w+/g);
        var defaultFunctionMatches = data.match(/(export[\s]+?default[\s]+?function)[\s]+?([\w])\w+/g);
        var defaultNewMatches = data.match(/(export[\s]+?default[\s]+?new)[\s]+?([\w])\w+/g);
        var functionMatches = data.match(/(export[\s]+?function)[\s]+?([\w])\w+/g);
        var mulitDefindMatches = data.match(/(export[\s]+?\{)[\s]*?([\s\S])+?\}/g);
        var propertyMatches = data.match(/(export[\s]+?let)[\s]+?([\w])\w+/g);
        var constMatches = data.match(/(export[\s]+?const)[\s]+?([\w])\w+/g);
        var varMatches = data.match(/(export[\s]+?var)[\s]+?([\w])\w+/g);
        
        if (defaultClassMatches) {
            defaultClassMatches.forEach(m => {
                //let workingFile: string =
                //    m.replace('export', '').replace('default', '').replace('class', '').replace(' ', '');
                let moduleName = this.getModuleName(file.fsPath);
                this.db.saveImport(moduleName, data, file, true);
            });
        }

        if (defaultFunctionMatches) {
            defaultFunctionMatches.forEach(m => {
                //let workingFile: string =
                //    m.replace('export', '').replace('default', '').replace('function', '').replace(' ', '');
                let moduleName = this.getModuleName(file.fsPath);
                this.db.saveImport(moduleName, data, file, true);
            });
        }

        if (defaultNewMatches) {
            defaultNewMatches.forEach(m => {
                //let workingFile: string =
                //    m.replace('export', '').replace('default', '').replace('new', '').replace(' ', '');
                let moduleName = this.getModuleName(file.fsPath);
                this.db.saveImport(moduleName, data, file, true);
            });
        }

        if (functionMatches) {
            functionMatches.forEach(m => {
                let workingFile: string =
                    m.replace('export', '').replace('function', '').replace(' ', '');

                this.db.saveImport(workingFile, data, file);
            })
        }

        if (mulitDefindMatches) {
            mulitDefindMatches.forEach(m => {
                let workingFile: string =
                    m.replace('export', '').replace('{', '').replace('}', '').replace(' ', '');
                var arr = workingFile.split(',');
                if (arr) {
                    arr.forEach(item => {
                        let index = item.indexOf(':');
                        if (index <= 0) {
                            index = item.indexOf(' as ');
                        }

                        
                        let key = null;
                        if (index > 0) {
                            key = item.substring(0, index)
                            this.db.saveImport(key, data, file);
                        } else {
                            key = item;    
                        }

                        key = key.replace('\n', '').replace(' ', '');
                        this.db.saveImport(key, data, file);
                    });
                }
            })
        }

        if (propertyMatches || varMatches || constMatches) {
            [].concat(propertyMatches, varMatches, constMatches).filter(m => m).forEach(m => {
                let workingFile: string =
                    m.replace('export', '').replace('let', '').replace('var', '').replace('const', '').replace(' ', '');

                this.db.saveImport(workingFile, data, file);
            });
        }
    }

    private getModuleName(file: string) {
        let dirs = file.split(path.sep);
        if (dirs && dirs.length > 1) {
            var fileName = dirs[dirs.length - 1];
            if (fileName.toLocaleLowerCase() === 'index.js') {
                return dirs[dirs.length - 2];
            } else {
                return fileName.replace('.js', '');
            }
        }
        return null;
    }
}
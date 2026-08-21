import * as vscode from 'vscode';
import { exec } from 'child_process';

const diagnosticCollection = vscode.languages.createDiagnosticCollection('neniy');

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(diagnosticCollection);

    vscode.workspace.findFiles('**/*.neniy').then((uris) => {
        if (uris.length > 0) {
            runCompilerCheck(uris);
        }
    });

    vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId === 'neniy') {
            runCompilerCheck([document.uri]);
        }
    });
}

function runCompilerCheck(uris: vscode.Uri[]) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const config = vscode.workspace.getConfiguration('neniy');
    const version = config.get<string>('mcVersion') || '1.21.11';

    const files = uris.map(uri => `${uri.fsPath}`).join(' ');

    exec(`neniy --check -v ${version} ${files}`, { cwd: workspaceFolder }, (error, stdout, stderr) => {
        uris.forEach(uri => diagnosticCollection.delete(uri));

        if (!stdout.trim()) return;

        try {
            const errors = JSON.parse(stdout);            
            const diagnosticsMap = new Map<string, vscode.Diagnostic[]>();

            for (let err of errors) {
                if (typeof err === 'string') {
                    err = JSON.parse(err);
                }

                const range = new vscode.Range(
                    new vscode.Position(err.range.start_row, err.range.start_col),
                    new vscode.Position(err.range.end_row, err.range.end_col + 1)
                );

                const severity = err.severity === 'error' 
                    ? vscode.DiagnosticSeverity.Error 
                    : vscode.DiagnosticSeverity.Warning;

                const diagnostic = new vscode.Diagnostic(range, err.msg, severity);
                
                if (!diagnosticsMap.has(err.file)) {
                    diagnosticsMap.set(err.file, []);
                }
                diagnosticsMap.get(err.file)!.push(diagnostic);
            }

            for (const [filePath, diagnostics] of diagnosticsMap.entries()) {
                diagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
            }

        } catch (e) {
            console.error("Failed to parse compiler JSON output:", e);
        }
    });
}

export function deactivate() {}

import * as vscode from 'vscode';

const FUNCTION_PATH = /[A-Za-z0-9_#/]+/;

interface FunctionRef {
    path: string;
    range: vscode.Range;
}

let lastInvariantErrorAt = 0;

export function registerFunctionDefinitions(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider({ language: 'neniy' }, { provideDefinition })
    );
}

function provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
): vscode.ProviderResult<vscode.LocationLink[]> {
    const ref = functionRefAt(document, position);
    if (!ref) {
        return;
    }

    return resolveFunctionLocations(document.uri, ref);
}

function functionRefAt(document: vscode.TextDocument, position: vscode.Position): FunctionRef | undefined {
    const line = document.lineAt(position.line).text;
    const re = new RegExp(`\\bfn\\s+(${FUNCTION_PATH.source})`, 'g');
    let match: RegExpExecArray | null;

    while ((match = re.exec(line)) !== null) {
        const path = match[1];
        const start = match.index + match[0].length - path.length;
        const end = start + path.length;
        if (position.character < start || position.character > end) {
            continue;
        }
        if (isInStringOrComment(line, start)) {
            return;
        }
        return {
            path,
            range: new vscode.Range(position.line, start, position.line, end),
        };
    }

    return undefined;
}

function isInStringOrComment(line: string, index: number): boolean {
    let inString = false;

    for (let i = 0; i < index; i++) {
        if (!inString && line[i] === '/' && line[i + 1] === '/') {
            return true;
        }
        if (line[i] === '\\' && inString) {
            i++;
            continue;
        }
        if (line[i] === "'") {
            inString = !inString;
        }
    }

    return inString;
}

async function resolveFunctionLocations(
    documentUri: vscode.Uri,
    ref: FunctionRef
): Promise<vscode.LocationLink[]> {
    const parts = parseFunctionPath(ref.path);
    if (!parts) {
        return [];
    }

    const root = functionRootOf(documentUri);
    if (!root) {
        reportMissingFunctionRoot(documentUri);
        return [];
    }

    const target = directFunctionUri(root, parts);
    if (!await exists(target)) {
        return [];
    }

    return [toLink(ref, target)];
}

function reportMissingFunctionRoot(uri: vscode.Uri): void {
    const now = Date.now();
    if (now - lastInvariantErrorAt < 2000) {
        return;
    }
    lastInvariantErrorAt = now;
    void vscode.window.showErrorMessage(
        `В пути ${uri.fsPath} нет data/<namespace>/function.`
    );
}

function parseFunctionPath(path: string): string[] | undefined {
    const parts = path.split('/').filter(part => part.length > 0);
    if (parts.length === 0 || parts.some(part => part === '.' || part === '..')) {
        return undefined;
    }

    return parts;
}

function directFunctionUri(root: vscode.Uri, parts: string[]): vscode.Uri {
    return withNeniyExtension(vscode.Uri.joinPath(root, ...parts));
}

function functionRootOf(uri: vscode.Uri): vscode.Uri | undefined {
    const parts = uri.path.split('/');
    let functionIndex = -1;

    for (let i = 2; i < parts.length; i++) {
        if (parts[i] === 'function' && parts[i - 2] === 'data' && parts[i - 1]) {
            functionIndex = i;
        }
    }

    if (functionIndex === -1) {
        return undefined;
    }

    return uri.with({ path: parts.slice(0, functionIndex + 1).join('/') });
}

function withNeniyExtension(uri: vscode.Uri): vscode.Uri {
    if (uri.path.endsWith('.neniy')) {
        return uri;
    }
    return uri.with({ path: `${uri.path}.neniy` });
}

function toLink(ref: FunctionRef, uri: vscode.Uri): vscode.LocationLink {
    const start = new vscode.Position(0, 0);
    const target = new vscode.Range(start, start);
    return {
        originSelectionRange: ref.range,
        targetUri: uri,
        targetRange: target,
        targetSelectionRange: target,
    };
}

async function exists(uri: vscode.Uri): Promise<boolean> {
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        return (stat.type & vscode.FileType.File) !== 0;
    } catch {
        return false;
    }
}

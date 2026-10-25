import * as vscode from 'vscode';

const tokenTypes = ['enumMember'];
const legend = new vscode.SemanticTokensLegend(tokenTypes);

export function letNames(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: 'neniy' },
            {
                provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
                    const builder = new vscode.SemanticTokensBuilder(legend);
                    const definedLets = new Set<string>();

                    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
                        const line = document.lineAt(lineIndex).text;

                        for (const match of line.matchAll(/\blet\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/g)) {
                            const name = match[1];
                            const startChar = match.index! + match[0].lastIndexOf(name);
                            definedLets.add(name);
                            builder.push(lineIndex, startChar, name.length, 0);
                        }

                        for (const bracketMatch of line.matchAll(/\[([^\]]*)\]/g)) {
                            const content = bracketMatch[1];
                            const bracketStart = bracketMatch.index! + 1;

                            for (const idMatch of content.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g)) {
                                const name = idMatch[1];
                                if (definedLets.has(name)) {
                                    builder.push(lineIndex, bracketStart + idMatch.index!, name.length, 0);
                                }
                            }
                        }
                    }
                    return builder.build();
                }
            },
            legend
        )
    );
}
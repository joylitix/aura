import * as vscode from 'vscode';
import { AuraChatViewProvider } from './auraChatViewProvider';

export function activate(context: vscode.ExtensionContext) {
  const protocolChannel = vscode.window.createOutputChannel('Aura (Protocol)');
  const daemonLogChannel = vscode.window.createOutputChannel('Aura');

  const chatProvider = new AuraChatViewProvider(context, protocolChannel, daemonLogChannel);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AuraChatViewProvider.viewType, chatProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aura.startSession', () => chatProvider.startSessionFlow())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('aura.toggleProtocolLog', async () => {
      const cfg = vscode.workspace.getConfiguration('aura');
      const next = !cfg.get<boolean>('developer.showProtocolLog');
      await cfg.update('developer.showProtocolLog', next, vscode.ConfigurationTarget.Global);
      void vscode.window.showInformationMessage(
        next ? 'Aura: protocol log enabled (NDJSON → Aura (Protocol)).' : 'Aura: protocol log disabled.'
      );
      protocolChannel.show(true);
    })
  );

  context.subscriptions.push(protocolChannel);
  context.subscriptions.push(daemonLogChannel);
  context.subscriptions.push(new vscode.Disposable(() => chatProvider.dispose()));
}

export function deactivate() {
  /* disposables above tear down the chat provider */
}

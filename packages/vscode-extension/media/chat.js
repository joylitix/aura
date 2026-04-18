(function () {
  const vscode = acquireVsCodeApi();

  const threadSelect = document.getElementById('threadSelect');
  const statusEl = document.getElementById('status');
  const messagesEl = document.getElementById('messages');
  const inputEl = document.getElementById('input');
  const sendBtn = document.getElementById('sendBtn');
  const stopBtn = document.getElementById('stopBtn');
  const newChatBtn = document.getElementById('newChatBtn');

  function setStatus(t) {
    statusEl.textContent = t || '';
  }

  function renderMessages(msgs) {
    messagesEl.innerHTML = '';
    for (const m of msgs) {
      const div = document.createElement('div');
      div.className = 'bubble ' + (m.role === 'user' ? 'user' : m.role === 'tool' ? 'tool' : 'assistant');
      div.textContent = m.text || '';
      messagesEl.appendChild(div);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderThreads(threads, activeId) {
    threadSelect.innerHTML = '';
    for (const t of threads) {
      const opt = document.createElement('option');
      opt.value = t.threadId;
      opt.textContent = t.title || t.threadId;
      if (t.threadId === activeId) opt.selected = true;
      threadSelect.appendChild(opt);
    }
  }

  function applySnapshot(s) {
    renderThreads(s.threads || [], s.activeThreadId);
    renderMessages(s.messages || []);
    setStatus(s.statusText || '');
    const busy = Boolean(s.busy);
    sendBtn.disabled = busy;
    inputEl.disabled = busy;
    stopBtn.disabled = !busy;
  }

  sendBtn.addEventListener('click', () => {
    const text = inputEl.value.trim();
    if (!text) return;
    vscode.postMessage({ type: 'send', text });
  });

  stopBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'stop' });
  });

  newChatBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'newChat' });
  });

  threadSelect.addEventListener('change', () => {
    vscode.postMessage({ type: 'selectThread', threadId: threadSelect.value });
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg && msg.type === 'snapshot') {
      applySnapshot(msg.snapshot);
    }
  });
})();

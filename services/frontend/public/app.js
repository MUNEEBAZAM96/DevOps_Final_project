const list = document.getElementById('task-list');
const form = document.getElementById('task-form');
const input = document.getElementById('task-title');
const message = document.getElementById('message');

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function render(tasks) {
  list.replaceChildren();
  for (const task of tasks) {
    const item = document.createElement('li');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = task.done;
    box.addEventListener('change', () => {
      update(task.id, box.checked).catch((err) => {
        message.textContent = err.message;
      });
    });
    const label = document.createElement('span');
    label.textContent = task.title;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => {
      removeTask(task.id).catch((err) => {
        message.textContent = err.message;
      });
    });
    item.append(box, label, remove);
    list.append(item);
  }
}

async function load() {
  try {
    render(await api('/tasks'));
    message.textContent = '';
  } catch (err) {
    message.textContent = err.message;
  }
}

async function update(id, done) {
  await api(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ done }) });
  await load();
}

async function removeTask(id) {
  await api(`/tasks/${id}`, { method: 'DELETE' });
  await load();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  api('/tasks', { method: 'POST', body: JSON.stringify({ title: input.value }) })
    .then(() => {
      input.value = '';
      return load();
    })
    .catch((err) => {
      message.textContent = err.message;
    });
});

load();

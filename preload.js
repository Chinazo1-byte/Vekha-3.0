const { contextBridge, ipcRenderer } = require('electron');
const api = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('db', {
  students: {
    getAll:     ()     => api('students:getAll'),
    get:        (id)   => api('students:get', id),
    create:     (d)    => api('students:create', d),
    update:     (d)    => api('students:update', d),
    delete:     (id)   => api('students:delete', id),
    getHistory: (id)   => api('students:getHistory', id),
  },
  categories: {
    getAll:  ()    => api('categories:getAll'),
    create:  (d)   => api('categories:create', d),
    delete:  (id)  => api('categories:delete', id),
  },
  exercises: {
    getAll:      ()    => api('exercises:getAll'),
    get:         (id)  => api('exercises:get', id),
    create:      (d)   => api('exercises:create', d),
    update:      (d)   => api('exercises:update', d),
    delete:      (id)  => api('exercises:delete', id),
    saveResult:  (d)   => api('exercises:saveResult', d),
  },
  sessions: {
    getAll:  ()    => api('sessions:getAll'),
    get:     (id)  => api('sessions:get', id),
    create:  (d)   => api('sessions:create', d),
    update:  (d)   => api('sessions:update', d),
    delete:  (id)  => api('sessions:delete', id),
  },
  diagnostics: {
    getAll:      ()    => api('diagnostics:getAll'),
    get:         (id)  => api('diagnostics:get', id),
    update:      (d)   => api('diagnostics:update', d),
    create:      (d)   => api('diagnostics:create', d),
    delete:      (id)  => api('diagnostics:delete', id),
    saveResult:  (d)   => api('diagnostics:saveResult', d),
    getHistory:  (d)   => api('diagnostics:getHistory', d),
    updateNotes: (d)   => api('diagnostics:updateNotes', d),
  },
  report: {
    generate: (studentId) => api('report:generate', studentId),
    open:     (path)      => api('report:open', path),
    saveAs:   (path)      => api('report:saveAs', path),
  },
  files: {
    pickImage:    ()       => api('files:pickImage'),
    getImageData: (path)   => api('files:getImageData', path),
    pickJson:     ()       => api('files:pickJson'),
  },
  library: {
    export: (data) => api('library:export', data),
    import: ()     => api('library:import'),
  },
  app: {
    quit: () => api('app:quit'),
  },
  settings: {
    get: (key)        => api('settings:get', key),
    set: (key, value) => api('settings:set', key, value),
  },
});

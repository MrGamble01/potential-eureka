/* ============================================
   PRODUCTIVITY — Thin wrapper that delegates
   to Pomodoro, TodoList, GoogleTasks, Notes, Bookmarks
   ============================================ */

const Productivity = {
  init() { Pomodoro.init(); TodoList.init(); GoogleTasks.init(); Notes.init(); Bookmarks.init(); },
  pomoToggle: () => Pomodoro.toggle(), pomoSkip: () => Pomodoro.skip(), pomoReset: () => Pomodoro.reset(),
  addTodo: () => TodoList.addTodo(), setTodoFilter: f => TodoList.setTodoFilter(f), clearCompleted: () => TodoList.clearCompleted(),
  addBookmark: () => Bookmarks.add(), deleteBookmark: id => Bookmarks.delete(id),
  openGTSettings: () => GoogleTasks.openSettings(), closeGTSettings: () => GoogleTasks.closeSettings(),
  gtConnect: () => GoogleTasks.connect(), gtSync: () => GoogleTasks.sync(), gtDisconnect: () => GoogleTasks.disconnect(),
};

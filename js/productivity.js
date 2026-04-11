/* ============================================
   PRODUCTIVITY — Thin wrapper that delegates
   to Pomodoro, TodoList, Notes, Bookmarks
   ============================================ */

const Productivity = {
  init() { Pomodoro.init(); TodoList.init(); Notes.init(); Bookmarks.init(); },
  pomoToggle: () => Pomodoro.toggle(), pomoSkip: () => Pomodoro.skip(), pomoReset: () => Pomodoro.reset(),
  addTodo: () => TodoList.addTodo(), setTodoFilter: f => TodoList.setTodoFilter(f), clearCompleted: () => TodoList.clearCompleted(),
  addBookmark: () => Bookmarks.add(), deleteBookmark: id => Bookmarks.delete(id),
  openGTSettings: () => TodoList.openGTSettings(), closeGTSettings: () => TodoList.closeGTSettings(),
  gtConnect: () => TodoList.gtConnect(), gtSync: () => TodoList.gtSync(), gtDisconnect: () => TodoList.gtDisconnect(),
};

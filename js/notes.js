/* ============================================
   QUICK NOTES MODULE
   ============================================ */

const Notes = (() => {
  let notesSaveTimeout = null;

  function initNotes() {
    const area = document.getElementById('notes-area');
    if (!area) return;
    area.value = Utils.store.getRaw('eureka-notes');
    updateNotesCount();
    area.addEventListener('input', () => {
      updateNotesCount();
      clearTimeout(notesSaveTimeout);
      notesSaveTimeout = setTimeout(() => {
        Utils.store.setRaw('eureka-notes', area.value);
      }, 500);
    });
  }

  function updateNotesCount() {
    const area = document.getElementById('notes-area');
    const el = document.getElementById('notes-chars');
    if (area && el) el.textContent = area.value.length;
  }

  function init() {
    initNotes();
  }

  return { init };
})();

const Personal = {
  init: () => PersonalAuth.init(),
  submitPin: () => PersonalAuth.submitPin(),
  lock: () => PersonalAuth.lock(),
  logMood: l => PersonalContent.logMood(l),
  toggleMoodHistory: () => PersonalContent.toggleMoodHistory(),
  toggleHabit: id => PersonalContent.toggleHabit(id),
  addHabit: () => PersonalContent.addHabit(),
  removeHabit: id => PersonalContent.removeHabit(id),
  prevDay: () => PersonalContent.prevDay(),
  nextDay: () => PersonalContent.nextDay(),
};

import { BOOKS } from "../shared/companions";
import type { BookId, CampaignSummary, CampaignView, DiceRoll, HealthInfo, SaveSlot, TranscriptMessage } from "../shared/types";
import type { GameEngine } from "../server/game/engine";
import { escapeHtml, portrait } from "./portraits";

type TableState = {
  bookId: BookId;
  name: string;
  motive: string;
  active: CampaignView | null;
  resumed: boolean;
  busy: boolean;
  error: string | null;
  diceTurn: number | null;
  saveNote: string | null;
  campaigns: CampaignSummary[];
  slot: SaveSlot | null;
};

export function mountTable(root: HTMLElement, engine: GameEngine, health: HealthInfo): void {
  const state: TableState = {
    bookId: "ashmarch",
    name: "",
    motive: "",
    active: null,
    resumed: false,
    busy: false,
    error: null,
    diceTurn: null,
    saveNote: null,
    campaigns: engine.list(),
    slot: engine.slot(),
  };

  const refresh = () => {
    state.campaigns = engine.list();
    state.slot = engine.slot();
  };

  const paint = () => {
    root.innerHTML = shell(health, state.error) + (state.active ? play(state) : home(state));
    bind(root, state, engine, refresh, paint);
  };

  paint();
}

function shell(health: HealthInfo, error: string | null): string {
  return `
    <header class="topbar">
      <div>
        <p class="brand">The Chronicle</p>
        <p class="brand-kicker">Ashmarch and Lumenferry</p>
      </div>
      <div class="topbar-side">
        <p class="chips">
          <span>Chronicle ${escapeHtml(health.llmProvider)}</span>
          <span>Images ${escapeHtml(health.imageProvider)}</span>
          <span>This browser</span>
        </p>
        <a class="ash-back" href="/">Arcade</a>
      </div>
    </header>
    ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
  `;
}

function home(state: TableState): string {
  const book = BOOKS.find((entry) => entry.id === state.bookId) ?? BOOKS[0];
  const slot = state.slot;
  return `
    <div class="home theme-${book.id}">
      <section class="manifesto">
        <p class="eyebrow">${escapeHtml(book.kicker)}</p>
        <h1>${escapeHtml(book.title)}</h1>
        <p class="deck">${escapeHtml(book.deck)}</p>
        <ul class="party-intro">
          ${book.companions
            .map(
              (companion) => `
            <li>
              ${portrait(companion.id, companion.name)}
              <div>
                <h2>${escapeHtml(companion.name)}</h2>
                <p class="role">${escapeHtml(companion.title)}</p>
                <p>${escapeHtml(companion.blurb)}</p>
                <blockquote>“${escapeHtml(companion.quote)}”</blockquote>
              </div>
            </li>`,
            )
            .join("")}
        </ul>
      </section>
      <section class="ledger">
        <section class="continue-slot" aria-label="Continue slot">
          <p class="eyebrow">Continue</p>
          ${
            slot
              ? `<h2>${escapeHtml(slot.bookTitle)}</h2>
                 <p><strong>${escapeHtml(slot.playerName)}</strong><span class="role"> · ${escapeHtml(slot.placeTitle)}${slot.ended ? " · closed" : ""}</span></p>
                 <p>${escapeHtml(slot.motive)}</p>
                 <button type="button" class="primary continue" data-resume="${escapeHtml(slot.campaignId)}" ${state.busy ? "disabled" : ""}>Continue</button>`
              : `<p class="empty">The continue slot is empty. A new road fills it, and Save keeps the one you mean to return to.</p>`
          }
        </section>
        <form id="ash-begin">
          <h2>New expedition</h2>
          <p class="role" id="book-picker-label">Which road?</p>
          <div class="book-picker" role="radiogroup" aria-labelledby="book-picker-label">
            ${BOOKS.map(
              (entry) => `
              <button type="button" role="radio" aria-checked="${entry.id === book.id}" class="${entry.id === book.id ? "selected" : ""}" data-book="${entry.id}">
                <strong>${escapeHtml(entry.title)}</strong>
                <span>${escapeHtml(entry.kicker)}</span>
              </button>`,
            ).join("")}
          </div>
          <label for="player-name">What should the road call you?</label>
          <input id="player-name" name="playerName" maxlength="40" autocomplete="nickname" placeholder="Nim" required value="${escapeHtml(state.name)}">
          <label for="motive">${escapeHtml(book.motiveLabel)}</label>
          <input id="motive" name="motive" maxlength="200" placeholder="${escapeHtml(book.motivePlaceholder)}" required value="${escapeHtml(state.motive)}">
          <button type="submit" class="primary" ${state.busy ? "disabled" : ""}>${state.busy ? "The road is waking…" : escapeHtml(book.beginLabel)}</button>
          <p class="fine">Saved on this machine. Chronicle: stub. Pictures: a procedural plate. No key, no network. No one else is on this road.</p>
        </form>
        <div class="expeditions">
          <h2>Expeditions already walked</h2>
          ${
            state.campaigns.length === 0
              ? `<p class="empty">The table is clear. No one has signed the book.</p>`
              : `<ul>${state.campaigns
                  .map(
                    (campaign) => `
                  <li>
                    <div>
                      <strong>${escapeHtml(campaign.playerName)}</strong>
                      <span class="role">${escapeHtml(campaign.bookTitle)} · ${escapeHtml(campaign.placeTitle)}${campaign.ended ? " · closed" : ""}</span>
                      <p>${escapeHtml(campaign.motive)}</p>
                      <p class="fine">${campaign.memoryCount} remembered · ${escapeHtml(stamp(campaign.updatedAt))}</p>
                    </div>
                    <div class="row-actions">
                      <button type="button" data-resume="${escapeHtml(campaign.id)}" ${state.busy ? "disabled" : ""}>Resume</button>
                      <button type="button" class="ghost" data-abandon="${escapeHtml(campaign.id)}" ${state.busy ? "disabled" : ""}>Abandon</button>
                    </div>
                  </li>`,
                  )
                  .join("")}</ul>`
          }
        </div>
      </section>
    </div>
  `;
}

function play(state: TableState): string {
  const campaign = state.active;
  if (!campaign) return "";
  const turns = groupTurns(campaign.messages);
  const latest = campaign.memories[campaign.memories.length - 1];
  const roll = campaign.state.lastRoll;
  const showDice = Boolean(roll && state.diceTurn !== null && state.diceTurn === campaign.state.turn);
  return `
    <div class="play theme-${campaign.bookId}">
      <section class="stage" aria-label="Chronicle">
        <figure class="scene">
          <img id="ash-plate" src="${escapeHtml(campaign.scene.dataUrl)}" alt="${escapeHtml(campaign.scene.alt)}">
          ${showDice && roll ? diceOverlay(roll) : ""}
          <figcaption>
            <span>${escapeHtml(campaign.bookTitle)}</span>
            <strong>${escapeHtml(campaign.placeTitle)}</strong>
          </figcaption>
        </figure>
        <ul class="party-strip" aria-label="Party">
          ${campaign.party
            .map(
              (member) => `
            <li>
              ${portrait(member.id, member.name)}
              <div>
                <strong>${escapeHtml(member.name)}</strong>
                <span>${escapeHtml(member.mood)} · ${escapeHtml(member.regard)}</span>
              </div>
            </li>`,
            )
            .join("")}
        </ul>
        ${latest ? `<p class="ticker">Remembered — ${escapeHtml(latest.text)}</p>` : ""}
        ${
          state.resumed
            ? `<p class="resume-banner">The Chronicle kept this road. ${campaign.memories.length} ${campaign.memories.length === 1 ? "memory is" : "memories are"} still warm.</p>`
            : ""
        }
        ${state.saveNote ? `<p class="resume-banner" role="status">${escapeHtml(state.saveNote)}</p>` : ""}
        <div class="transcript" id="ash-transcript" aria-live="polite">
          ${turns.map((turn) => turnHtml(turn)).join("")}
          ${state.busy ? `<p class="waiting">The Chronicle is writing, and the party is already interrupting.</p>` : ""}
        </div>
        <form class="composer" id="ash-act">
          <div class="suggestions" id="ash-choices" role="group" aria-label="Choices">
            ${campaign.suggestions
              .map(
                (suggestion) =>
                  `<button type="button" class="choice" data-choice="${escapeHtml(suggestion.label)}" ${state.busy || showDice ? "disabled" : ""}>${escapeHtml(suggestion.label)}</button>`,
              )
              .join("")}
          </div>
          <label class="sr-only" for="action">What do you do?</label>
          <textarea id="action" maxlength="500" rows="2" placeholder="Or say it in your own words. You can look, check your pockets, or speak a companion's name." ${state.busy ? "disabled" : ""}></textarea>
          <div class="composer-row">
            <button type="submit" class="primary choice" ${state.busy || showDice ? "disabled" : ""}>Speak</button>
            <button type="button" class="choice" id="ash-save" ${state.busy || showDice ? "disabled" : ""}>Save</button>
            <button type="button" class="ghost choice" id="ash-leave">Leave the table</button>
            <p class="fine">Enter sends. Shift+Enter breaks a line. The road keeps what you choose.</p>
          </div>
        </form>
      </section>
      <aside class="rail" aria-label="Party and memory">
        <section>
          <h2>Party</h2>
          <ul class="party-cards">
            ${campaign.party
              .map(
                (member) => `
              <li>
                ${portrait(member.id, member.name)}
                <div>
                  <h3>${escapeHtml(member.name)}</h3>
                  <p class="role">${escapeHtml(member.title)}</p>
                  <p class="mood">${escapeHtml(member.mood)} · ${escapeHtml(member.regard)}</p>
                  <div class="meter meter-${member.id}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${member.trust}" aria-label="${escapeHtml(member.name)} trust"><span style="width:${member.trust}%"></span></div>
                  <p class="fine">Carrying ${member.kit.length ? escapeHtml(member.kit.join(", ")) : "nothing owed to the road"}</p>
                </div>
              </li>`,
              )
              .join("")}
          </ul>
        </section>
        <section>
          <h2>Your case</h2>
          <ul class="kit">${campaign.state.inventory.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </section>
        <section>
          <h2>What the Chronicle kept</h2>
          <ol class="memories" id="ash-journal">
            ${campaign.memories
              .map(
                (memory) =>
                  `<li class="${memory.turn === campaign.state.turn ? "fresh" : ""}"><span>${escapeHtml(memory.kind)}</span>${escapeHtml(memory.text)}</li>`,
              )
              .join("")}
          </ol>
        </section>
      </aside>
    </div>
  `;
}

function turnHtml(turn: TranscriptMessage[]): string {
  const player = turn.find((message) => message.role === "player");
  const gm = turn.find((message) => message.role === "gm");
  const lines = turn.filter((message) => message.role === "companion");
  const stances = lines.map((message) => message.stance);
  const argue = stances.includes("for") && stances.includes("against");
  return `
    <article class="turn">
      ${player ? `<p class="you"><span>${escapeHtml(player.speaker)}</span>${escapeHtml(player.text)}</p>` : ""}
      ${
        gm
          ? `<div class="narration">${paragraphs(gm.text)
              .map((part) => `<p>${escapeHtml(part)}</p>`)
              .join("")}</div>`
          : ""
      }
      ${argue ? `<p class="argument">The party does not agree.</p>` : ""}
      <ul class="lines">
        ${lines
          .map(
            (line) => `
          <li class="line line-${line.companionId ?? "sable"}">
            <span class="who">${escapeHtml(line.speaker)}${line.mood ? `<em>${escapeHtml(line.mood)}</em>` : ""}</span>
            ${escapeHtml(line.text)}
          </li>`,
          )
          .join("")}
      </ul>
    </article>
  `;
}

function diceOverlay(roll: DiceRoll): string {
  const sign = roll.modifier >= 0 ? "+" : "";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const face = reduce ? roll.natural : (roll.faces[0] ?? roll.natural);
  return `
    <div class="dice-overlay" role="status" aria-live="assertive" data-dice="1">
      <p class="dice-kind">${roll.kind === "combat" ? "Combat" : "Skill check"}</p>
      <div class="die ${reduce ? "settled" : "spinning"}" aria-hidden="true"><span>${face}</span></div>
      <p class="dice-label">${escapeHtml(roll.actor)} · ${escapeHtml(roll.label)}</p>
      <p class="dice-total">${escapeHtml(`${roll.natural} ${sign}${roll.modifier} = ${roll.total} vs DC ${roll.dc}. ${roll.success ? "Success." : "Failure."}`)}</p>
    </div>
  `;
}

function bind(
  root: HTMLElement,
  state: TableState,
  engine: GameEngine,
  refresh: () => void,
  paint: () => void,
): void {
  root.querySelectorAll<HTMLButtonElement>("[data-book]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.book;
      if (id === "ashmarch" || id === "lumenferry") {
        state.bookId = id;
        captureDraft(root, state);
        paint();
      }
    });
  });

  root.querySelector("#ash-begin")?.addEventListener("submit", (event) => {
    event.preventDefault();
    captureDraft(root, state);
    void run(state, paint, async () => {
      state.active = await engine.start({ playerName: state.name, motive: state.motive, bookId: state.bookId });
      state.resumed = false;
      state.diceTurn = null;
      state.saveNote = null;
      refresh();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-resume]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.resume;
      if (!id) return;
      void run(state, paint, async () => {
        state.active = engine.get(id);
        state.resumed = true;
        state.diceTurn = null;
        state.saveNote = null;
      });
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-abandon]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.abandon;
      if (!id) return;
      if (!window.confirm("Abandon this expedition? The Chronicle will forget it.")) return;
      void run(state, paint, async () => {
        engine.delete(id);
        if (state.active?.id === id) state.active = null;
        refresh();
      });
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const text = button.dataset.choice;
      if (text) void act(state, engine, refresh, paint, text);
    });
  });

  const form = root.querySelector("#ash-act");
  const draft = root.querySelector<HTMLTextAreaElement>("#action");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (draft?.value.trim()) void act(state, engine, refresh, paint, draft.value);
  });
  draft?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (draft.value.trim()) void act(state, engine, refresh, paint, draft.value);
    }
  });

  root.querySelector("#ash-save")?.addEventListener("click", () => {
    if (!state.active) return;
    void run(state, paint, async () => {
      const next = engine.save(state.active!.id);
      state.saveNote = `Saved. Continue will bring back ${next.playerName} at ${next.placeTitle}.`;
      refresh();
    });
  });

  root.querySelector("#ash-leave")?.addEventListener("click", () => {
    state.active = null;
    state.diceTurn = null;
    state.saveNote = null;
    refresh();
    paint();
  });

  const transcript = root.querySelector("#ash-transcript");
  if (transcript) transcript.scrollTop = transcript.scrollHeight;
  if (state.active) window.scrollTo(0, 0);

  const dice = root.querySelector("[data-dice]");
  if (dice && state.diceTurn !== null) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      if (state.diceTurn !== null) {
        state.diceTurn = null;
        paint();
      }
    }, reduce ? 700 : 1100);
  }
}

async function act(
  state: TableState,
  engine: GameEngine,
  refresh: () => void,
  paint: () => void,
  text: string,
): Promise<void> {
  if (!state.active || state.busy || state.diceTurn !== null) return;
  const id = state.active.id;
  await run(state, paint, async () => {
    state.active = await engine.act(id, text);
    state.resumed = false;
    state.saveNote = null;
    state.diceTurn = state.active.state.lastRoll ? state.active.state.turn : null;
    refresh();
  });
}

async function run(state: TableState, paint: () => void, fn: () => Promise<void>): Promise<void> {
  state.busy = true;
  state.error = null;
  paint();
  try {
    await fn();
  } catch (error) {
    state.error = error instanceof Error ? error.message : "The Chronicle lost the sentence.";
  } finally {
    state.busy = false;
    paint();
  }
}

function captureDraft(root: HTMLElement, state: TableState): void {
  const name = root.querySelector<HTMLInputElement>("#player-name");
  const motive = root.querySelector<HTMLInputElement>("#motive");
  if (name) state.name = name.value;
  if (motive) state.motive = motive.value;
}

function paragraphs(text: string): string[] {
  return text.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
}

function groupTurns(messages: TranscriptMessage[]): TranscriptMessage[][] {
  const turns: TranscriptMessage[][] = [];
  for (const message of messages) {
    const last = turns[turns.length - 1];
    if (!last || last[0]?.turn !== message.turn) turns.push([message]);
    else last.push(message);
  }
  return turns;
}

function stamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

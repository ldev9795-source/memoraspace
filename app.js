const STORAGE_KEY = "memora.entries.v1";
const TAGS_KEY = "memora.tags.v1";
const ONBOARDING_KEY = "memora.onboarding.complete.v1";
const SUPABASE_URL_KEY = "memora.supabase.url";
const SUPABASE_ANON_KEY = "memora.supabase.anon";
const DEFAULT_SUPABASE_URL = "https://ywrqsvzqwbbiiiisaxuy.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_xIwvmCPrTS8LmCpYKs4NRA_pvmVmRML";
const CLOUD_TABLE = "memora_entries";
const PROFILE_TABLE = "memora_profiles";

const colorsByType = {
  Thought: "#854F0B",
  Idea: "#1D9E75",
  Note: "#185FA5",
  Meeting: "#534AB7",
  Journal: "#993556",
  Learning: "#3B6D11"
};

const seedEntries = [
  {
    id: "seed-1",
    title: "Why simplicity is the hardest design choice",
    type: "Idea",
    content:
      "Every time I work on an interface I notice the pull toward adding more - more options, more features, more controls. The real craft is knowing what to leave out. Dieter Rams said it best: good design is as little design as possible. This is not laziness. It is the hardest discipline in the field.",
    createdAt: new Date().toISOString(),
    tags: ["idea", "design"],
    project: "memora"
  },
  {
    id: "seed-2",
    title: "Book notes: The Design of Everyday Things",
    type: "Learning",
    content:
      "Norman's concept of affordances keeps showing up in every product I look at. A door handle affords pulling. A flat plate affords pushing. When there is a mismatch, people feel stupid. They should not. The design failed them.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    tags: ["learn", "books"],
    project: "Reading"
  },
  {
    id: "seed-3",
    title: "Second brain app product direction pivot",
    type: "Note",
    content:
      "Removing AI from the app stack is the right call. It forces the product to earn its value through pure design and UX rather than algorithmic assistance. The five pillars remain: Capture, Organise, Browse, Write, Reflect.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    tags: ["work", "product"],
    project: "memora"
  },
  {
    id: "seed-4",
    title: "Conversation with Appa about the old house",
    type: "Journal",
    content:
      "He spoke for a long time about the mango tree in the back garden - how he planted it the year I was born, how it never once gave fruit but gave shade for thirty years. I wrote nothing down then. I am writing it now so I do not lose it.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    tags: ["life", "family"],
    project: ""
  },
  {
    id: "seed-5",
    title: "On building things that last",
    type: "Thought",
    content:
      "Software rots. Relationships do not have to. The things that last are the ones tended to daily - not with grand gestures but with small, consistent attention. I want to build a product with that philosophy baked in.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 70).toISOString(),
    tags: ["idea", "life"],
    project: ""
  },
  {
    id: "seed-6",
    title: "Weekly project review - Memora",
    type: "Meeting",
    content:
      "Discussed scope with team: offline-first, no AI, web-only. Typography decisions landed on Lora and DM Sans. First prototype target is the home dashboard. Next step: wireframe the capture flow and entry editor screens before coding begins.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    tags: ["work", "project"],
    project: "memora"
  }
];

const state = {
  entries: loadEntries(),
  customTags: loadCustomTags(),
  view: "all",
  layout: localStorage.getItem("memora.layout") || "list",
  activeTag: "",
  activeReaderId: "",
  supabase: null,
  cloudUser: null,
  profile: null,
  cloudReady: false,
  cloudSyncing: false,
  authSubscription: null,
  authProviders: {
    google: false,
    apple: false,
    email: true,
    phone: false
  }
};

const elements = {
  content: document.querySelector("#content"),
  title: document.querySelector("#view-title"),
  subtitle: document.querySelector("#view-subtitle"),
  tagCloud: document.querySelector("#tag-cloud"),
  entryModal: document.querySelector("#entry-modal"),
  readerModal: document.querySelector("#reader-modal"),
  searchModal: document.querySelector("#search-modal"),
  managerModal: document.querySelector("#manager-modal"),
  cloudModal: document.querySelector("#cloud-modal"),
  cloudStatus: document.querySelector("#cloud-status"),
  syncDot: document.querySelector("#sync-dot"),
  syncLabel: document.querySelector("#sync-label"),
  onboardingModal: document.querySelector("#onboarding-modal"),
  onboardingCloudStatus: document.querySelector("#onboarding-cloud-status"),
  managerTitle: document.querySelector("#manager-title"),
  managerBody: document.querySelector("#manager-body"),
  form: document.querySelector("#entry-form"),
  toast: document.querySelector("#toast")
};

function loadEntries() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return seedEntries;

  try {
    const entries = JSON.parse(saved);
    return Array.isArray(entries) ? entries : seedEntries;
  } catch {
    return seedEntries;
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
  localStorage.setItem(TAGS_KEY, JSON.stringify(state.customTags));
  queueCloudSync();
}

function loadCustomTags() {
  const saved = localStorage.getItem(TAGS_KEY);
  if (!saved) return [];

  try {
    const tags = JSON.parse(saved);
    return Array.isArray(tags) ? tags : [];
  } catch {
    return [];
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .filter((tag, index, list) => list.indexOf(tag) === index);
}

function normalizeSingleTag(value) {
  return value.trim().toLowerCase();
}

function getAllTags() {
  return [...new Set([...state.customTags, ...activeEntries().flatMap((entry) => entry.tags)])].sort((a, b) =>
    a.localeCompare(b)
  );
}

function getProjects() {
  return [...new Set(activeEntries().map((entry) => entry.project).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function formatDate(value, style = "short") {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);

  if (date.toDateString() === today.toDateString()) {
    return style === "long"
      ? `Today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : "Today";
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return style === "long"
      ? `Yesterday, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : "Yesterday";
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric"
  });
}

function getTagClass(tag) {
  const map = {
    idea: "tag-idea",
    design: "tag-idea",
    work: "tag-work",
    product: "tag-work",
    life: "tag-life",
    family: "tag-life",
    learn: "tag-learn",
    books: "tag-learn",
    project: "tag-project"
  };

  return map[tag] || "tag-neutral";
}

function sortedEntries(entries = state.entries) {
  return [...entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function activeEntries() {
  return state.entries.filter((entry) => !entry.archivedAt);
}

function archivedEntries() {
  return state.entries.filter((entry) => entry.archivedAt);
}

function entriesForCurrentView() {
  const today = new Date().toDateString();
  const source = state.view === "archive" ? archivedEntries() : activeEntries();

  if (state.activeTag) {
    return sortedEntries(source.filter((entry) => entry.tags.includes(state.activeTag)));
  }

  if (state.view === "today") {
    return sortedEntries(source.filter((entry) => new Date(entry.createdAt).toDateString() === today));
  }

  return sortedEntries(source);
}

function getStats() {
  const today = new Date().toDateString();
  const source = activeEntries();
  const projects = new Set(source.map((entry) => entry.project).filter(Boolean));
  const tags = new Set(source.flatMap((entry) => entry.tags));

  return {
    total: source.length,
    today: source.filter((entry) => new Date(entry.createdAt).toDateString() === today).length,
    streak: calculateStreak(),
    projects: projects.size,
    tags: tags.size
  };
}

function calculateStreak() {
  const days = new Set(activeEntries().map((entry) => new Date(entry.createdAt).toDateString()));
  let streak = 0;
  const date = new Date();

  while (days.has(date.toDateString())) {
    streak += 1;
    date.setDate(date.getDate() - 1);
  }

  return streak;
}

function render() {
  updateChrome();
  renderTags();

  if (state.view === "projects" && !state.activeTag) {
    renderProjects();
    return;
  }

  if (state.view === "today" && !state.activeTag) {
    renderToday();
    return;
  }

  if (state.view === "timeline" && !state.activeTag) {
    renderTimeline();
    return;
  }

  if (state.view === "reflect" && !state.activeTag) {
    renderReflect();
    return;
  }

  renderEntryList(entriesForCurrentView());
}

function updateChrome() {
  const titles = {
    all: "All entries",
    today: "Today's entries",
    projects: "Projects",
    timeline: "Timeline",
    reflect: "Reflect",
    archive: "Archive"
  };

  elements.title.textContent = state.activeTag ? `#${state.activeTag}` : titles[state.view];
  elements.subtitle.textContent = new Date().toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view && !state.activeTag);
  });

  document.querySelectorAll("[data-layout]").forEach((button) => {
    button.classList.toggle("active", button.dataset.layout === state.layout);
  });
}

function renderTags() {
  const counts = new Map();
  activeEntries().forEach((entry) => {
    entry.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
  });

  const tags = getAllTags()
    .map((tag) => [tag, counts.get(tag) || 0])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  elements.tagCloud.innerHTML = tags.length
    ? tags
        .slice(0, 12)
        .map(
          ([tag]) =>
            `<button class="tag-pill ${getTagClass(tag)}" type="button" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`
        )
        .join("")
    : `<span class="muted">No tags yet</span>`;
}

function renderStats() {
  const stats = getStats();
  return `
    <div class="stats-row">
      <div class="stat"><span>total entries</span><strong>${stats.total}</strong></div>
      <div class="stat"><span>added today</span><strong>${stats.today}</strong></div>
      <div class="stat"><span>day streak</span><strong>${stats.streak}</strong></div>
      <div class="stat"><span>active projects</span><strong>${stats.projects}</strong></div>
    </div>
  `;
}

function renderEntryList(entries) {
  const label = state.activeTag
    ? `${entries.length} tagged entries`
    : state.view === "archive"
      ? "Archived entries"
      : state.view === "today"
        ? "Captured today"
        : "Recent entries";
  const boardTitle = state.activeTag ? `#${state.activeTag}` : state.view === "archive" ? "Archive" : state.view === "today" ? "Today" : "Memory library";
  const boardKicker = state.activeTag ? "Tag" : state.view === "archive" ? "Stored away" : "Library";

  elements.content.innerHTML = `
    <div class="memory-board">
      <div class="board-head">
        <div>
          <span class="section-kicker">${boardKicker}</span>
          <h2>${boardTitle}</h2>
        </div>
        <span class="muted">${entries.length} ${entries.length === 1 ? "memory" : "memories"}</span>
      </div>
      ${renderStats()}
      <div class="section-head">
        <h2>${label}</h2>
      </div>
      ${
        entries.length
          ? `<div class="entries ${state.layout === "grid" ? "grid" : ""}">${entries.map(renderEntryButton).join("")}</div>`
          : renderEmptyState()
      }
    </div>
  `;
}

function renderEntryButton(entry) {
  const tags = [entry.type, ...entry.tags].map((tag) => renderTag(tag)).join("");
  const isArchived = Boolean(entry.archivedAt);

  return `
    <article class="entry ${isArchived ? "archived" : ""}">
      <span class="entry-dot" style="background:${colorsByType[entry.type] || "#888780"}"></span>
      <span class="entry-body">
        <button class="entry-open" type="button" data-entry-id="${entry.id}">
          <span class="entry-top">
            <span class="entry-title">${escapeHtml(entry.title)}${isArchived ? `<span class="archive-badge">Archived</span>` : ""}</span>
            <span class="entry-date">${formatDate(entry.createdAt, "long")}</span>
          </span>
          <span class="entry-preview">${escapeHtml(entry.content)}</span>
        </button>
        <span class="entry-tags">${tags}</span>
        <span class="entry-actions">
          <button class="micro-button" type="button" data-edit-entry="${entry.id}">Edit</button>
          <button class="micro-button" type="button" data-export-entry="${entry.id}">PDF</button>
          <button class="micro-button" type="button" data-toggle-archive-entry="${entry.id}">${isArchived ? "Unarchive" : "Archive"}</button>
          <select class="micro-select" data-move-entry="${entry.id}" aria-label="Move ${escapeHtml(entry.title)} to project">
            ${renderProjectOptions(entry.project)}
          </select>
          <button class="micro-button danger" type="button" data-delete-entry="${entry.id}">Delete</button>
        </span>
      </span>
    </article>
  `;
}

function renderProjectOptions(currentProject = "") {
  const projects = getProjects();
  const options = [
    `<option value="" ${currentProject ? "" : "selected"}>No project</option>`,
    ...projects.map(
      (project) =>
        `<option value="${escapeHtml(project)}" ${project === currentProject ? "selected" : ""}>${escapeHtml(project)}</option>`
    ),
    `<option value="__new__">Move to new project...</option>`
  ];

  return options.join("");
}

function renderTag(tag) {
  const normalized = tag.toLowerCase();
  return `<span class="entry-tag ${getTagClass(normalized)}">${escapeHtml(tag)}</span>`;
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <h2>Nothing here yet</h2>
      <p>Capture a thought, note, meeting, or journal entry and memora will keep it ready for search and reflection.</p>
      <button class="primary-button compact" type="button" data-new-entry>New entry</button>
    </div>
  `;
}

function renderToday() {
  const entries = entriesForCurrentView();
  const latest = entries[0];
  const tagCounts = new Map();
  entries.forEach((entry) => entry.tags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)));
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  elements.content.innerHTML = `
    <div class="memory-board today-board">
      <div class="board-head">
        <div>
          <span class="section-kicker">Today</span>
          <h2>Daily capture</h2>
        </div>
        <button class="primary-button compact" type="button" data-new-entry>New entry</button>
      </div>
      <div class="today-layout">
        <section class="today-focus">
          <span class="section-kicker">Now</span>
          <h3>${latest ? escapeHtml(latest.title) : "Start today's memory"}</h3>
          <p>${
            latest
              ? escapeHtml(latest.content)
              : "A small note is enough. Capture the thought while it is still warm, then let the system keep it findable."
          }</p>
          ${latest ? `<div class="entry-tags">${[latest.type, ...latest.tags].map((tag) => renderTag(tag)).join("")}</div>` : ""}
        </section>
        <aside class="today-side">
          <div class="today-meter"><strong>${entries.length}</strong><span>captured today</span></div>
          <div class="today-tags">
            <span class="section-kicker">Signals</span>
            ${
              topTags.length
                ? topTags.map(([tag]) => `<button class="tag-pill ${getTagClass(tag)}" type="button" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")
                : `<span class="muted">No tags yet</span>`
            }
          </div>
        </aside>
      </div>
      <div class="section-head"><h2>Today's entries</h2><span class="muted">${entries.length} ${entries.length === 1 ? "memory" : "memories"}</span></div>
      ${
        entries.length
          ? `<div class="entries today-entries ${state.layout === "grid" ? "grid" : ""}">${entries.map(renderEntryButton).join("")}</div>`
          : renderEmptyState()
      }
    </div>
  `;
}

function renderProjects() {
  const projects = new Map();
  activeEntries().forEach((entry) => {
    if (!entry.project) return;
    if (!projects.has(entry.project)) projects.set(entry.project, []);
    projects.get(entry.project).push(entry);
  });

  const cards = [...projects.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([project, entries]) => {
      const ordered = sortedEntries(entries);
      const newest = ordered[0];
      const tags = [...new Set(entries.flatMap((entry) => entry.tags))].slice(0, 5);
      return renderProjectCard(project, entries, ordered, newest, tags);
    })
    .join("");

  elements.content.innerHTML = `
    <div class="memory-board">
      <div class="board-head">
        <div>
          <span class="section-kicker">Projects</span>
          <h2>Active projects</h2>
        </div>
        <div class="board-actions">
          <span class="muted">${projects.size} projects</span>
          <button class="ghost-button compact" type="button" data-manage-projects>Manage projects</button>
        </div>
      </div>
      ${renderStats()}
      ${projects.size ? `<div class="project-list ${state.layout === "list" ? "list" : ""}">${cards}</div>` : renderEmptyState()}
    </div>
  `;
}

function renderProjectCard(project, entries, ordered, newest, tags) {
  return `
    <article class="project-card">
      <div class="project-main">
        <div class="project-card-head">
          <div>
            <span class="section-kicker">Project</span>
            <h3>${escapeHtml(project)}</h3>
          </div>
          <div class="project-actions">
            <span class="project-count">${entries.length}</span>
            <button class="micro-button" type="button" data-rename-project="${escapeHtml(project)}">Rename</button>
            <button class="micro-button danger" type="button" data-delete-project="${escapeHtml(project)}">Remove</button>
          </div>
        </div>
        <p>${entries.length} ${entries.length === 1 ? "entry" : "entries"} · latest ${formatDate(newest.createdAt)}</p>
        <div class="entry-tags">${tags.map((tag) => renderTag(tag)).join("")}</div>
      </div>
      <div class="project-recent">
        ${ordered.slice(0, state.layout === "list" ? 2 : 3).map((entry) => renderProjectEntry(entry)).join("")}
      </div>
    </article>
  `;
}

function renderProjectEntry(entry) {
  return `
    <button class="project-entry" type="button" data-entry-id="${entry.id}">
      <span class="entry-dot" style="background:${colorsByType[entry.type] || "#888780"}"></span>
      <span>
        <strong>${escapeHtml(entry.title)}</strong>
        <small>${formatDate(entry.createdAt, "long")}</small>
      </span>
    </button>
  `;
}

function renderTimeline() {
  const entries = sortedEntries(activeEntries());

  if (state.layout === "grid") {
    elements.content.innerHTML = `
      <div class="memory-board">
        <div class="board-head">
          <div>
            <span class="section-kicker">Timeline</span>
            <h2>Chronology</h2>
          </div>
          <span class="muted">${entries.length} memories</span>
        </div>
        <div class="section-head"><h2>Timeline grid</h2></div>
        <div class="entries grid">${entries.map(renderEntryButton).join("")}</div>
      </div>
    `;
    return;
  }

  const groups = groupEntriesByDay(entries);
  const rows = groups
    .map(([date, entries]) => {
      return `
        <section class="timeline-day">
          <div class="timeline-date">
            <strong>${escapeHtml(date)}</strong>
            <span>${entries.length} ${entries.length === 1 ? "memory" : "memories"}</span>
          </div>
          <div class="timeline-stack">
            ${entries.map(renderTimelineEntry).join("")}
          </div>
        </section>
      `;
    })
    .join("");

  elements.content.innerHTML = `
    <div class="memory-board">
      <div class="board-head">
        <div>
          <span class="section-kicker">Timeline</span>
          <h2>Chronology</h2>
        </div>
        <span class="muted">${entries.length} memories</span>
      </div>
      <div class="timeline">${rows}</div>
    </div>
  `;
}

function groupEntriesByDay(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = formatDate(entry.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return [...groups.entries()];
}

function renderTimelineEntry(entry) {
  return `
    <button class="timeline-entry" type="button" data-entry-id="${entry.id}">
      <span class="timeline-dot" style="background:${colorsByType[entry.type] || "#888780"}"></span>
      <span class="timeline-entry-body">
        <span class="entry-top">
          <span class="entry-title">${escapeHtml(entry.title)}</span>
          <span class="entry-date">${new Date(entry.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
        </span>
        <span class="entry-preview">${escapeHtml(entry.content)}</span>
        <span class="entry-tags">${[entry.type, ...entry.tags].map((tag) => renderTag(tag)).join("")}</span>
      </span>
    </button>
  `;
}

function renderReflect() {
  const stats = getStats();
  const entries = sortedEntries(activeEntries());
  const random = entries[Math.floor(Math.random() * Math.max(entries.length, 1))];
  const surfacedEntries = entries.slice(0, 4);

  elements.content.innerHTML = `
    <div class="memory-board">
      <div class="board-head">
        <div>
          <span class="section-kicker">Reflect</span>
          <h2>Activity</h2>
        </div>
        <span class="muted">${stats.tags} tags used</span>
      </div>
      <div class="section-head"><h2>Last 6 months</h2></div>
      <div class="heatmap">${renderHeatmap()}</div>
      <div class="stats-row">
        <div class="stat"><span>total entries</span><strong>${stats.total}</strong></div>
        <div class="stat"><span>day streak</span><strong>${stats.streak}</strong></div>
        <div class="stat"><span>tags used</span><strong>${stats.tags}</strong></div>
        <div class="stat"><span>most active month</span><strong>${mostActiveMonth()}</strong></div>
      </div>
      <div class="section-head"><h2>Random resurface</h2><span class="muted">from your archive</span></div>
      ${
        random
          ? `<div class="entries reflect-entries ${state.layout === "grid" ? "grid" : ""}">${
              state.layout === "grid" ? surfacedEntries.map(renderEntryButton).join("") : renderEntryButton(random)
            }</div>`
          : renderEmptyState()
      }
    </div>
  `;
}

function renderHeatmap() {
  const counts = new Map();
  state.entries.forEach((entry) => {
    const key = new Date(entry.createdAt).toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const cells = [];
  for (let index = 181; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    const count = counts.get(date.toISOString().slice(0, 10)) || 0;
    const level = count >= 4 ? "l4" : count >= 3 ? "l3" : count >= 2 ? "l2" : count >= 1 ? "l1" : "";
    cells.push(`<span class="hm-cell ${level}" title="${count} entries"></span>`);
  }

  return cells.join("");
}

function mostActiveMonth() {
  const months = new Map();
  state.entries.forEach((entry) => {
    const date = new Date(entry.createdAt);
    const key = date.toLocaleDateString([], { month: "short" });
    months.set(key, (months.get(key) || 0) + 1);
  });

  return [...months.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
}

function openEditor(entry = null) {
  const isEditing = Boolean(entry);
  document.querySelector("#entry-modal-title").textContent = isEditing ? "Edit entry" : "New entry";
  document.querySelector("#entry-id").value = entry?.id || "";
  document.querySelector("#entry-title").value = entry?.title || "";
  document.querySelector("#entry-content").value = entry?.content || "";
  document.querySelector("#entry-type").value = entry?.type || "Thought";
  document.querySelector("#entry-project").value = entry?.project || "";
  document.querySelector("#entry-tags").value = entry?.tags.join(", ") || "";
  document.querySelector("#delete-entry").hidden = !isEditing;
  document.querySelector("#export-entry").hidden = !isEditing;
  document.querySelector("#export-entry").dataset.exportEntry = entry?.id || "";
  openModal(elements.entryModal);
  setTimeout(() => document.querySelector(isEditing ? "#entry-title" : "#entry-content").focus(), 20);
}

function saveEntry(event) {
  event.preventDefault();

  const id = document.querySelector("#entry-id").value;
  const title = document.querySelector("#entry-title").value.trim();
  const content = document.querySelector("#entry-content").value.trim();
  const type = document.querySelector("#entry-type").value;
  const project = document.querySelector("#entry-project").value.trim();
  const tags = normalizeTags(document.querySelector("#entry-tags").value);

  if (!title || !content) return;

  if (id) {
    state.entries = state.entries.map((entry) =>
      entry.id === id ? { ...entry, title, content, type, project, tags, updatedAt: new Date().toISOString() } : entry
    );
    toast("Entry updated");
    haptic([10]);
  } else {
    state.entries.unshift({
      id: crypto.randomUUID(),
      title,
      content,
      type,
      project,
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    toast("Entry saved");
    haptic([10]);
  }

  persist();
  closeModal(elements.entryModal);
  render();
}

function deleteCurrentEntry() {
  const id = document.querySelector("#entry-id").value;
  if (!id) return;
  if (!confirm("Delete this entry? This removes it from your local memora library.")) return;

  deleteEntryById(id);
}

function deleteEntryById(id) {
  state.entries = state.entries.filter((entry) => entry.id !== id);
  if (state.activeReaderId === id) state.activeReaderId = "";
  persist();
  deleteCloudEntry(id);
  closeModal(elements.entryModal);
  closeModal(elements.readerModal);
  render();
  toast("Entry deleted");
  haptic([15, 10, 15]);
}

function moveEntryToProject(id, project) {
  state.entries = state.entries.map((entry) =>
    entry.id === id ? { ...entry, project, updatedAt: new Date().toISOString() } : entry
  );
  persist();
  render();
  toast(project ? `Moved to ${project}` : "Removed from project");
}

function toggleArchiveEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return false;
  const archivedAt = entry.archivedAt ? "" : new Date().toISOString();

  state.entries = state.entries.map((item) =>
    item.id === id ? { ...item, archivedAt, updatedAt: new Date().toISOString() } : item
  );

  if (state.activeReaderId === id && document.querySelector("[data-archive-current]")) {
    document.querySelector("[data-archive-current]").textContent = archivedAt ? "Unarchive" : "Archive";
    document.querySelectorAll("[data-archive-label]").forEach((el) => {
      el.textContent = archivedAt ? "Unarchive" : "Archive";
    });
  }

  persist();
  render();
  toast(archivedAt ? "Entry archived" : "Entry restored");
  haptic([8]);
  return true;
}

function renameProject(oldName, nextName) {
  const name = nextName.trim();
  if (!name || name === oldName) return;

  state.entries = state.entries.map((entry) =>
    entry.project === oldName ? { ...entry, project: name, updatedAt: new Date().toISOString() } : entry
  );
  persist();
  render();
  if (elements.managerModal.classList.contains("open")) openProjectManager();
  toast("Project renamed");
}

function deleteProjectName(project) {
  if (!confirm(`Remove the project name "${project}" from its entries? Entries will stay in your library.`)) return;

  state.entries = state.entries.map((entry) =>
    entry.project === project ? { ...entry, project: "", updatedAt: new Date().toISOString() } : entry
  );
  persist();
  render();
  if (elements.managerModal.classList.contains("open")) openProjectManager();
  toast("Project name removed");
}

function createTag(tag) {
  const next = normalizeSingleTag(tag);
  if (!next) return;

  state.customTags = [...new Set([...state.customTags, next])];
  persist();
  render();
  openTagManager();
  toast("Tag created");
}

function renameTag(oldTag, nextTag) {
  const next = normalizeSingleTag(nextTag);
  if (!next || next === oldTag) return;

  state.customTags = [...new Set(state.customTags.map((tag) => (tag === oldTag ? next : tag)))];
  state.entries = state.entries.map((entry) => ({
    ...entry,
    tags: [...new Set(entry.tags.map((tag) => (tag === oldTag ? next : tag)))],
    updatedAt: entry.tags.includes(oldTag) ? new Date().toISOString() : entry.updatedAt
  }));

  if (state.activeTag === oldTag) state.activeTag = next;
  persist();
  render();
  openTagManager();
  toast("Tag renamed");
}

function deleteTag(tag) {
  if (!confirm(`Delete the tag "${tag}"? It will be removed from every entry that uses it.`)) return;

  state.customTags = state.customTags.filter((item) => item !== tag);
  state.entries = state.entries.map((entry) => ({
    ...entry,
    tags: entry.tags.filter((item) => item !== tag),
    updatedAt: entry.tags.includes(tag) ? new Date().toISOString() : entry.updatedAt
  }));

  if (state.activeTag === tag) state.activeTag = "";
  persist();
  render();
  openTagManager();
  toast("Tag deleted");
}

function openReader(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  state.activeReaderId = id;
  elements.readerModal.dataset.entryId = id;
  document.querySelector("#reader-kind").textContent = entry.type;
  document.querySelector("#reader-title").textContent = entry.title;
  document.querySelector("#reader-meta").textContent = [
    formatDate(entry.createdAt, "long"),
    entry.project ? entry.project : ""
  ]
    .filter(Boolean)
    .join(" · ");
  document.querySelector("#reader-content").textContent = entry.content;
  document.querySelector("#reader-tags").innerHTML = entry.tags.map(renderTag).join("");
  document.querySelector("[data-archive-current]").textContent = entry.archivedAt ? "Unarchive" : "Archive";
  document.querySelectorAll("[data-archive-label]").forEach((el) => {
    el.textContent = entry.archivedAt ? "Unarchive" : "Archive";
  });
  openModal(elements.readerModal);
}

function openSearch() {
  openModal(elements.searchModal);
  const input = document.querySelector("#search-input");
  input.value = "";
  renderSearch("");
  setTimeout(() => input.focus(), 20);
}

function openTagManager() {
  const counts = new Map();
  state.entries.forEach((entry) => entry.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
  const rows = getAllTags()
    .map(
      (tag) => `
        <div class="manager-row">
          <div>
            <strong>${escapeHtml(tag)}</strong>
            <span>${counts.get(tag) || 0} ${counts.get(tag) === 1 ? "entry" : "entries"}</span>
          </div>
          <div class="manager-actions">
            <button class="micro-button" type="button" data-rename-tag="${escapeHtml(tag)}">Rename</button>
            <button class="micro-button danger" type="button" data-delete-tag="${escapeHtml(tag)}">Delete</button>
          </div>
        </div>
      `
    )
    .join("");

  elements.managerTitle.textContent = "Manage tags";
  elements.managerBody.innerHTML = `
    <form class="manager-create" data-create-tag-form>
      <input id="new-tag-input" placeholder="New tag name" autocomplete="off" />
      <button class="primary-button compact" type="submit">Create tag</button>
    </form>
    <div class="manager-list">${rows || `<p class="muted">No tags yet.</p>`}</div>
  `;
  openModal(elements.managerModal);
}

function openProjectManager() {
  const projects = getProjects();
  const rows = projects
    .map((project) => {
      const count = state.entries.filter((entry) => entry.project === project).length;
      return `
        <div class="manager-row">
          <div>
            <strong>${escapeHtml(project)}</strong>
            <span>${count} ${count === 1 ? "entry" : "entries"}</span>
          </div>
          <div class="manager-actions">
            <button class="micro-button" type="button" data-rename-project="${escapeHtml(project)}">Rename</button>
            <button class="micro-button danger" type="button" data-delete-project="${escapeHtml(project)}">Remove name</button>
          </div>
        </div>
      `;
    })
    .join("");

  elements.managerTitle.textContent = "Manage projects";
  elements.managerBody.innerHTML = `
    <p class="manager-note">Project names live on entries. Removing a project name keeps the entries and clears their project field.</p>
    <div class="manager-list">${rows || `<p class="muted">No projects yet.</p>`}</div>
  `;
  openModal(elements.managerModal);
}

function renderOnboardingStatus() {
  if (!elements.onboardingCloudStatus) return;

  if (state.cloudUser) {
    const label = state.profile?.display_name || state.cloudUser.email || state.cloudUser.phone || "your profile";
    elements.onboardingCloudStatus.innerHTML = `<strong>Profile ready</strong><span>Signed in as ${escapeHtml(label)}. Your library will sync automatically.</span>`;
    return;
  }

  if (state.cloudReady) {
    const methods = getAvailableAuthMethodsLabel();
    elements.onboardingCloudStatus.innerHTML = `<strong>Cloud ready</strong><span>${methods} ${state.authProviders.google || state.authProviders.apple || state.authProviders.phone ? "Choose how you want to sign in." : "Email sign-in is ready now, and you can enable more providers later in Supabase."}</span>`;
    return;
  }

  elements.onboardingCloudStatus.innerHTML = `<strong>Cloud unavailable</strong><span>We could not connect to the memora cloud right now. Review your settings and try again.</span>`;
}

function openOnboarding() {
  renderOnboardingStatus();
  elements.onboardingModal.classList.add("open");
  elements.onboardingModal.setAttribute("aria-hidden", "false");
}

function completeOnboarding() {
  localStorage.setItem(ONBOARDING_KEY, "true");
  elements.onboardingModal.classList.remove("open");
  elements.onboardingModal.setAttribute("aria-hidden", "true");
}

function maybeOpenOnboarding() {
  if (localStorage.getItem(ONBOARDING_KEY) === "true") return;
  window.setTimeout(() => openOnboarding(), 150);
}

function renderSearch(query) {
  const target = document.querySelector("#search-results");
  const value = query.trim().toLowerCase();

  if (!value) {
    target.innerHTML = `<div class="empty-state"><p>Start typing to search all entries.</p></div>`;
    return;
  }

  const hits = sortedEntries(
    state.entries.filter((entry) => {
      const haystack = [entry.title, entry.content, entry.type, entry.project, ...entry.tags].join(" ").toLowerCase();
      return haystack.includes(value);
    })
  );

  target.innerHTML = hits.length
    ? hits
        .map(
          (entry) => `
          <button class="search-result" type="button" data-search-entry="${entry.id}">
            <span class="entry-dot" style="background:${colorsByType[entry.type] || "#888780"}"></span>
            <span><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(entry.content.slice(0, 120))}</span></span>
          </button>
        `
        )
        .join("")
    : `<div class="empty-state"><p>No entries found for "${escapeHtml(query)}".</p></div>`;
}

function openModal(modal) {
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => elements.toast.classList.remove("show"), 1800);
}

function getCloudConfig() {
  return {
    url: localStorage.getItem(SUPABASE_URL_KEY) || window.MEMORA_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    anonKey: localStorage.getItem(SUPABASE_ANON_KEY) || window.MEMORA_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
  };
}

function getAvailableAuthMethodsLabel() {
  const labels = [];
  if (state.authProviders.email) labels.push("Email");
  if (state.authProviders.google) labels.push("Google");
  if (state.authProviders.apple) labels.push("Apple");
  if (state.authProviders.phone) labels.push("Phone");
  if (!labels.length) return "Cloud is connected.";
  if (labels.length === 1) return `${labels[0]} sign-in is available.`;
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)} sign-in are available.`;
}

async function fetchAuthProviderSettings(url, anonKey) {
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`
    }
  });
  if (!response.ok) throw new Error("Could not load auth provider settings");

  const settings = await response.json();
  state.authProviders = {
    google: Boolean(settings.external?.google),
    apple: Boolean(settings.external?.apple),
    email: settings.external?.email !== false,
    phone: Boolean(settings.external?.phone)
  };
  applyAuthAvailability();
}

function applyAuthAvailability() {
  const oauthButtons = document.querySelectorAll("[data-oauth-provider]");
  oauthButtons.forEach((button) => {
    const provider = button.dataset.oauthProvider;
    const enabled = provider ? state.authProviders[provider] : false;
    button.disabled = !enabled;
    button.title = enabled ? "" : `${provider[0].toUpperCase()}${provider.slice(1)} sign-in is not enabled in Supabase yet`;
  });

  const phoneForms = document.querySelectorAll("[data-phone-auth-form], [data-verify-phone-form]");
  phoneForms.forEach((form) => {
    const enabled = state.authProviders.phone;
    const input = form.querySelector("input");
    const submit = form.querySelector("button");
    if (input) input.disabled = !enabled;
    if (submit) {
      submit.disabled = !enabled;
      submit.title = enabled ? "" : "Phone sign-in is not enabled in Supabase yet";
    }
  });
}

async function initCloud() {
  const { url, anonKey } = getCloudConfig();
  document.querySelector("#supabase-url").value = url;
  document.querySelector("#supabase-anon-key").value = anonKey;

  if (!url || !anonKey) {
    state.cloudReady = false;
    updateCloudStatus("local");
    return;
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    state.authSubscription?.unsubscribe?.();
    state.supabase = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    await fetchAuthProviderSettings(url, anonKey);

    const { data } = await state.supabase.auth.getSession();
    state.cloudUser = data.session?.user || null;
    state.cloudReady = true;
    const { data: authListener } = state.supabase.auth.onAuthStateChange(async (_event, session) => {
      state.cloudUser = session?.user || null;
      if (state.cloudUser) await ensureProfile();
      updateCloudStatus();
      if (state.cloudUser) {
        completeOnboarding();
        syncNow();
      }
    });
    state.authSubscription = authListener?.subscription || null;
    if (state.cloudUser) await ensureProfile();
    updateCloudStatus();
    if (state.cloudUser) {
      completeOnboarding();
      syncNow();
    }
  } catch (error) {
    state.cloudReady = false;
    updateCloudStatus("error", error.message);
    applyAuthAvailability();
  }
}

function updateCloudStatus(forcedState = "", message = "") {
  const mode = forcedState || (state.cloudUser ? "synced" : state.cloudReady ? "ready" : "local");
  const labels = {
    local: "Local",
    ready: "Sign in",
    synced: "Synced",
    syncing: "Syncing",
    error: "Cloud error"
  };

  elements.syncLabel.textContent = labels[mode] || "Local";
  elements.syncDot.className = `sync-dot ${mode}`;

  if (!elements.cloudStatus) return;

  const email = state.cloudUser?.email || state.cloudUser?.phone || "";
  const body = {
    local: "Cloud sync is not configured yet. Add your Supabase URL and anon key to enable sign-in.",
    ready: `${getAvailableAuthMethodsLabel()} Your library will sync after you sign in.`,
    synced: `Signed in${email ? ` as ${email}` : ""}. New changes sync automatically.`,
    syncing: "Syncing your local library with Supabase...",
    error: message || "Cloud sync could not connect."
  };

  elements.cloudStatus.innerHTML = `<strong>${labels[mode]}</strong><span>${body[mode]}</span>`;
  renderOnboardingStatus();
}

function openCloudModal() {
  const { url, anonKey } = getCloudConfig();
  document.querySelector("#supabase-url").value = url;
  document.querySelector("#supabase-anon-key").value = anonKey;
  updateCloudStatus();
  openModal(elements.cloudModal);
}

async function signInWithOAuth(provider) {
  if (!state.supabase) {
    toast("Save Supabase settings first");
    openCloudModal();
    return;
  }

  if (!state.authProviders[provider]) {
    toast(`${provider[0].toUpperCase()}${provider.slice(1)} sign-in is not enabled in Supabase yet`);
    return;
  }

  const { error } = await state.supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
  if (error) toast(error.message);
}

async function signInWithEmail(email) {
  if (!state.supabase || !email) return;
  const { error } = await state.supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });
  toast(error ? error.message : "Check your email for the sign-in link");
}

async function signInWithPhone(phone) {
  if (!state.authProviders.phone) {
    toast("Phone sign-in is not enabled in Supabase yet");
    return;
  }
  if (!state.supabase || !phone) return;
  const { error } = await state.supabase.auth.signInWithOtp({ phone });
  toast(error ? error.message : "Check your phone for the OTP code");
}

async function verifyPhoneOtp(phone, token) {
  if (!state.authProviders.phone) {
    toast("Phone sign-in is not enabled in Supabase yet");
    return;
  }
  if (!state.supabase || !phone || !token) return;
  const { error } = await state.supabase.auth.verifyOtp({ phone, token, type: "sms" });
  toast(error ? error.message : "Phone verified");
}

async function signOutCloud() {
  if (!state.supabase) return;
  await state.supabase.auth.signOut();
  state.cloudUser = null;
  state.profile = null;
  updateCloudStatus();
  toast("Signed out");
}

async function deleteCloudEntry(id) {
  if (!state.supabase || !state.cloudUser) return;
  await state.supabase.from(CLOUD_TABLE).delete().eq("user_id", state.cloudUser.id).eq("entry_id", id);
}

async function ensureProfile() {
  if (!state.supabase || !state.cloudUser) return null;

  const displayName =
    state.cloudUser.user_metadata?.full_name ||
    state.cloudUser.user_metadata?.name ||
    state.cloudUser.email?.split("@")[0] ||
    state.cloudUser.phone ||
    "memora user";

  const profile = {
    id: state.cloudUser.id,
    display_name: displayName,
    email: state.cloudUser.email || null,
    phone: state.cloudUser.phone || null,
    avatar_url: state.cloudUser.user_metadata?.avatar_url || null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await state.supabase.from(PROFILE_TABLE).upsert(profile).select().single();
  if (!error) state.profile = data || profile;
  return state.profile;
}

function queueCloudSync() {
  if (!state.cloudReady || !state.cloudUser) return;
  clearTimeout(queueCloudSync.timeout);
  queueCloudSync.timeout = setTimeout(syncNow, 500);
}

async function syncNow() {
  if (!state.supabase || !state.cloudUser || state.cloudSyncing) return;
  state.cloudSyncing = true;
  updateCloudStatus("syncing");

  try {
    const { data, error } = await state.supabase
      .from(CLOUD_TABLE)
      .select("entry_id,payload,updated_at")
      .eq("user_id", state.cloudUser.id);
    if (error) throw error;

    const cloudEntries = (data || []).map((row) => row.payload).filter(Boolean);
    const merged = mergeEntries(state.entries, cloudEntries);
    state.entries = merged;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));

    const rows = state.entries.map((entry) => ({
      user_id: state.cloudUser.id,
      entry_id: entry.id,
      payload: entry,
      updated_at: entry.updatedAt || entry.createdAt
    }));

    if (rows.length) {
      const { error: upsertError } = await state.supabase.from(CLOUD_TABLE).upsert(rows, {
        onConflict: "user_id,entry_id"
      });
      if (upsertError) throw upsertError;
    }

    updateCloudStatus("synced");
    render();
  } catch (error) {
    updateCloudStatus("error", error.message);
  } finally {
    state.cloudSyncing = false;
  }
}

function mergeEntries(localEntries, cloudEntries) {
  const byId = new Map();
  [...localEntries, ...cloudEntries].forEach((entry) => {
    const current = byId.get(entry.id);
    const entryTime = new Date(entry.updatedAt || entry.createdAt || 0).getTime();
    const currentTime = current ? new Date(current.updatedAt || current.createdAt || 0).getTime() : -1;
    if (!current || entryTime >= currentTime) byId.set(entry.id, entry);
  });

  return sortedEntries([...byId.values()]);
}

async function exportEntryAsPdf(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  try {
    toast("Preparing PDF...");
    const [jsPDF, logoData] = await Promise.all([loadJsPdf(), imageToDataUrl("./assets/memora-mark.png")]);

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const page = { width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight() };
    const margin = 54;
    const words = entry.content.split(/\s+/).filter(Boolean);
    const chunks = chunkWords(words, 380);
    const created = new Date(entry.createdAt);
    const userName = getUserDisplayName();

    chunks.forEach((chunk, index) => {
      if (index > 0) doc.addPage();
      drawPdfPage(doc, page, margin, logoData, entry, chunk.join(" "), index + 1, chunks.length, created, userName, words.length);
    });

    drawPdfSignature(doc, page, margin, userName);
    doc.save(`${sanitizeFilename(entry.title)}-memora.pdf`);
    toast("PDF exported");
  } catch (error) {
    console.error("PDF export failed", error);
    openPrintablePdfFallback(entry);
    toast("PDF generator unavailable. Opened printable export.");
  }
}

async function loadJsPdf() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;

  try {
    const module = await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm");
    const jsPDF = module.jsPDF || module.default?.jsPDF || module.default;
    if (jsPDF) return jsPDF;
  } catch {
    // Fall through to the UMD loader below.
  }

  await loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  throw new Error("Could not load jsPDF");
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function imageToDataUrl(src) {
  const response = await fetch(src);
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function chunkWords(words, size) {
  if (!words.length) return [[]];
  const chunks = [];
  for (let index = 0; index < words.length; index += size) {
    chunks.push(words.slice(index, index + size));
  }
  return chunks;
}

function drawPdfPage(doc, page, margin, logoData, entry, text, pageNumber, pageTotal, created, userName, wordCount) {
  doc.setFillColor(248, 247, 245);
  doc.rect(0, 0, page.width, page.height, "F");
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(34, 34, page.width - 68, page.height - 68, 12, 12, "F");

  const bodyTop = pageNumber === 1
    ? drawPdfCoverHeader(doc, page, margin, logoData, entry, created, userName, wordCount, pageTotal)
    : drawPdfContinuationHeader(doc, page, margin, logoData, entry, pageNumber, pageTotal);

  doc.setFont("times", "normal");
  doc.setFontSize(13);
  doc.setTextColor(70, 67, 63);
  doc.text(doc.splitTextToSize(text, page.width - margin * 2), margin, bodyTop, { lineHeightFactor: 1.55 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(159, 153, 145);
  doc.text(`Page ${pageNumber} of ${pageTotal}`, page.width - margin, page.height - 54, { align: "right" });
}

function drawPdfCoverHeader(doc, page, margin, logoData, entry, created, userName, wordCount, pageTotal) {
  const headerTop = 52;
  const headerHeight = 210;
  const rightX = page.width - margin - 172;

  doc.setFillColor(248, 247, 245);
  doc.roundedRect(margin - 10, headerTop - 8, page.width - margin * 2 + 20, headerHeight, 10, 10, "F");

  doc.addImage(logoData, "PNG", margin, headerTop, 44, 44);
  doc.setFont("times", "normal");
  doc.setFontSize(28);
  doc.setTextColor(26, 25, 23);
  doc.text("mem·ora", margin + 56, headerTop + 30);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(44, 95, 74);
  doc.text(entry.type.toUpperCase(), margin, headerTop + 78);

  doc.setFont("times", "normal");
  doc.setFontSize(28);
  doc.setTextColor(26, 25, 23);
  doc.text(doc.splitTextToSize(entry.title, 315), margin, headerTop + 112);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(rightX, headerTop, 172, 172, 8, 8, "F");
  doc.setDrawColor(232, 228, 223);
  doc.roundedRect(rightX, headerTop, 172, 172, 8, 8, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(159, 153, 145);
  doc.text("CREATED", rightX + 16, headerTop + 24);
  doc.text("PROJECT", rightX + 16, headerTop + 62);
  doc.text("TAGS", rightX + 16, headerTop + 100);
  doc.text("LENGTH", rightX + 16, headerTop + 138);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70, 67, 63);
  doc.text(`${created.toLocaleDateString()} · ${created.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`, rightX + 16, headerTop + 39);
  doc.text(doc.splitTextToSize(entry.project || "None", 136), rightX + 16, headerTop + 77);
  doc.text(doc.splitTextToSize(entry.tags.join(", ") || "None", 136), rightX + 16, headerTop + 115);
  doc.text(`${wordCount} words · ${pageTotal} pages`, rightX + 16, headerTop + 153);

  doc.setFont("times", "italic");
  doc.setFontSize(17);
  doc.setTextColor(26, 25, 23);
  doc.text(userName, rightX, headerTop + 204, { align: "left" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(159, 153, 145);
  doc.text("Personal signature", rightX, headerTop + 218);

  doc.setDrawColor(232, 228, 223);
  doc.line(margin, headerTop + headerHeight + 16, page.width - margin, headerTop + headerHeight + 16);
  return headerTop + headerHeight + 54;
}

function drawPdfContinuationHeader(doc, page, margin, logoData, entry, pageNumber, pageTotal) {
  doc.addImage(logoData, "PNG", margin, 52, 30, 30);
  doc.setFont("times", "normal");
  doc.setFontSize(18);
  doc.setTextColor(26, 25, 23);
  doc.text("mem·ora", margin + 40, 74);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(159, 153, 145);
  doc.text(`${entry.title} · Page ${pageNumber} of ${pageTotal}`, page.width - margin, 72, { align: "right" });
  doc.setDrawColor(232, 228, 223);
  doc.line(margin, 96, page.width - margin, 96);
  return 128;
}

function drawPdfSignature(doc, page, margin, userName) {
  doc.setDrawColor(232, 228, 223);
  doc.line(margin, page.height - 136, page.width - margin, page.height - 136);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(44, 95, 74);
  doc.text("PERSONAL MEMORY SIGNATURE", margin, page.height - 106);
  doc.setFont("times", "italic");
  doc.setFontSize(28);
  doc.setTextColor(26, 25, 23);
  doc.text(userName, margin, page.height - 72);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(159, 153, 145);
  doc.text("Created with memora", margin, page.height - 52);
}

function getUserDisplayName() {
  return (
    state.profile?.display_name ||
    state.cloudUser?.user_metadata?.full_name ||
    state.cloudUser?.user_metadata?.name ||
    state.cloudUser?.email?.split("@")[0] ||
    state.cloudUser?.phone ||
    "memora user"
  );
}

function sanitizeFilename(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "entry";
}

function openPrintablePdfFallback(entry) {
  const chunks = chunkWords(entry.content.split(/\s+/).filter(Boolean), 380);
  const created = new Date(entry.createdAt);
  const userName = getUserDisplayName();
  const popup = window.open("", "_blank");
  if (!popup) return;

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(entry.title)} - memora PDF</title>
        <style>
          @page { size: A4; margin: 0; }
          body { margin: 0; background: #f8f7f5; color: #1a1917; font-family: Georgia, serif; }
          .page { box-sizing: border-box; width: 210mm; min-height: 297mm; padding: 20mm; page-break-after: always; background: white; }
          .brand { display: flex; align-items: center; gap: 12px; font-size: 30px; margin-bottom: 24px; }
          .brand img { width: 46px; height: 46px; border-radius: 50%; }
          .kicker { color: #2c5f4a; font: 700 10px Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
          h1 { font-size: 34px; line-height: 1.15; font-weight: 400; margin: 10px 0 16px; }
          .meta { color: #65615c; font: 12px Arial, sans-serif; line-height: 1.7; border-bottom: 1px solid #e8e4df; padding-bottom: 18px; margin-bottom: 28px; }
          .content { color: #46433f; font-size: 16px; line-height: 1.8; }
          .footer { position: fixed; bottom: 15mm; right: 20mm; color: #9f9991; font: 11px Arial, sans-serif; }
          .signature { margin-top: 72px; border-top: 1px solid #e8e4df; padding-top: 24px; }
          .signature strong { color: #2c5f4a; font: 700 10px Arial, sans-serif; letter-spacing: .08em; }
          .signature div { margin-top: 14px; font: italic 34px Georgia, serif; }
        </style>
      </head>
      <body>
        ${chunks
          .map(
            (chunk, index) => `
              <section class="page">
                <div class="brand"><img src="./assets/memora-mark.png" alt="">mem·ora</div>
                <div class="kicker">${escapeHtml(entry.type)}</div>
                <h1>${escapeHtml(entry.title)}</h1>
                <div class="meta">
                  Created ${created.toLocaleDateString()} at ${created.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}<br>
                  Project: ${escapeHtml(entry.project || "None")}<br>
                  Tags: ${escapeHtml(entry.tags.join(", ") || "None")}
                </div>
                <div class="content">${escapeHtml(chunk.join(" "))}</div>
                ${
                  index === chunks.length - 1
                    ? `<div class="signature"><strong>PERSONAL MEMORY SIGNATURE</strong><div>${escapeHtml(userName)}</div><p>Created with memora</p></div>`
                    : ""
                }
                <div class="footer">Page ${index + 1} of ${chunks.length}</div>
              </section>
            `
          )
          .join("")}
        <script>window.onload = () => setTimeout(() => window.print(), 250);<\/script>
      </body>
    </html>
  `);
  popup.document.close();
}

document.addEventListener("click", async (event) => {
  const readerArchiveButton = event.target.closest("[data-archive-current]");
  if (readerArchiveButton) {
    event.preventDefault();
    event.stopPropagation();
    const id = state.activeReaderId || elements.readerModal.dataset.entryId;
    if (toggleArchiveEntry(id)) {
      closeModal(elements.readerModal);
      state.activeReaderId = "";
      delete elements.readerModal.dataset.entryId;
    }
    return;
  }

  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    event.preventDefault();
    state.view = viewButton.dataset.view;
    state.activeTag = "";
    document.body.classList.remove("sidebar-open");
    render();
    return;
  }

  const tagButton = event.target.closest("[data-tag]");
  if (tagButton) {
    state.activeTag = tagButton.dataset.tag;
    document.body.classList.remove("sidebar-open");
    render();
  }

  const layoutButton = event.target.closest("[data-layout]");
  if (layoutButton) {
    state.layout = layoutButton.dataset.layout;
    localStorage.setItem("memora.layout", state.layout);
    render();
  }

  if (event.target.closest("[data-new-entry]")) openEditor();
  if (event.target.closest("[data-open-search]")) openSearch();
  if (event.target.closest("[data-open-onboarding]")) openOnboarding();
  if (event.target.closest("[data-open-cloud]")) openCloudModal();
  if (event.target.closest("[data-manage-tags]")) openTagManager();
  if (event.target.closest("[data-manage-projects]")) openProjectManager();
  if (event.target.closest("[data-toggle-sidebar]")) document.body.classList.toggle("sidebar-open");
  if (event.target.closest("[data-close-modal]")) closeModal(elements.entryModal);
  if (event.target.closest("[data-close-reader]")) closeModal(elements.readerModal);
  if (event.target.closest("[data-close-manager]")) closeModal(elements.managerModal);
  if (event.target.closest("[data-close-cloud]")) closeModal(elements.cloudModal);

  const oauthButton = event.target.closest("[data-oauth-provider]");
  if (oauthButton) signInWithOAuth(oauthButton.dataset.oauthProvider);

  if (event.target.closest("[data-sync-now]")) syncNow();
  if (event.target.closest("[data-sign-out]")) signOutCloud();

  if (event.target.closest("[data-skip-onboarding]")) {
    completeOnboarding();
  }

  const editEntryButton = event.target.closest("[data-edit-entry]");
  if (editEntryButton) {
    const entry = state.entries.find((item) => item.id === editEntryButton.dataset.editEntry);
    openEditor(entry);
    return;
  }

  const deleteEntryButton = event.target.closest("[data-delete-entry]");
  if (deleteEntryButton) {
    const entry = state.entries.find((item) => item.id === deleteEntryButton.dataset.deleteEntry);
    if (entry && confirm(`Delete "${entry.title}"? This removes it from your local memora library.`)) {
      deleteEntryById(entry.id);
    }
    return;
  }

  const archiveEntryButton = event.target.closest("[data-toggle-archive-entry]");
  if (archiveEntryButton) {
    toggleArchiveEntry(archiveEntryButton.dataset.toggleArchiveEntry);
    return;
  }

  const exportEntryButton = event.target.closest("[data-export-entry]");
  if (exportEntryButton) {
    await exportEntryAsPdf(exportEntryButton.dataset.exportEntry);
    return;
  }

  const entryButton = event.target.closest("[data-entry-id]");
  if (entryButton) openReader(entryButton.dataset.entryId);

  const searchButton = event.target.closest("[data-search-entry]");
  if (searchButton) {
    closeModal(elements.searchModal);
    openReader(searchButton.dataset.searchEntry);
  }

  if (event.target.closest("[data-edit-current]")) {
    const entry = state.entries.find((item) => item.id === state.activeReaderId);
    closeModal(elements.readerModal);
    openEditor(entry);
  }

  if (event.target.closest("[data-export-current]")) {
    await shareOrExport(state.activeReaderId);
  }

  if (event.target.closest("[data-delete-current]")) {
    const entry = state.entries.find((item) => item.id === state.activeReaderId);
    if (entry && confirm(`Delete "${entry.title}"? This removes it from your local memora library.`)) {
      deleteEntryById(entry.id);
    }
  }

  const renameProjectButton = event.target.closest("[data-rename-project]");
  if (renameProjectButton) {
    const oldName = renameProjectButton.dataset.renameProject;
    const nextName = prompt("Rename project", oldName);
    if (nextName !== null) renameProject(oldName, nextName);
  }

  const deleteProjectButton = event.target.closest("[data-delete-project]");
  if (deleteProjectButton) deleteProjectName(deleteProjectButton.dataset.deleteProject);

  const renameTagButton = event.target.closest("[data-rename-tag]");
  if (renameTagButton) {
    const oldTag = renameTagButton.dataset.renameTag;
    const nextTag = prompt("Rename tag", oldTag);
    if (nextTag !== null) renameTag(oldTag, nextTag);
  }

  const deleteTagButton = event.target.closest("[data-delete-tag]");
  if (deleteTagButton) deleteTag(deleteTagButton.dataset.deleteTag);
});

elements.form.addEventListener("submit", saveEntry);
document.querySelector("#delete-entry").addEventListener("click", deleteCurrentEntry);
document.querySelector("#search-input").addEventListener("input", (event) => renderSearch(event.target.value));

document.addEventListener("submit", (event) => {
  const tagForm = event.target.closest("[data-create-tag-form]");
  if (tagForm) {
    event.preventDefault();
    createTag(tagForm.querySelector("input").value);
    return;
  }

  const emailForm = event.target.closest("[data-email-auth-form]");
  if (emailForm) {
    event.preventDefault();
    signInWithEmail(emailForm.querySelector("input[type='email']").value.trim());
    return;
  }

  const phoneForm = event.target.closest("[data-phone-auth-form]");
  if (phoneForm) {
    event.preventDefault();
    signInWithPhone(phoneForm.querySelector("input[type='tel']").value.trim());
    return;
  }

  const verifyForm = event.target.closest("[data-verify-phone-form]");
  if (verifyForm) {
    event.preventDefault();
    verifyPhoneOtp(document.querySelector("#auth-phone").value.trim(), verifyForm.querySelector("input").value.trim());
  }
});

document.querySelector("#cloud-config-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  localStorage.setItem(SUPABASE_URL_KEY, document.querySelector("#supabase-url").value.trim());
  localStorage.setItem(SUPABASE_ANON_KEY, document.querySelector("#supabase-anon-key").value.trim());
  await initCloud();
  openCloudModal();
  toast("Cloud settings saved");
});

document.addEventListener("change", (event) => {
  const moveSelect = event.target.closest("[data-move-entry]");
  if (!moveSelect) return;

  let project = moveSelect.value;
  if (project === "__new__") {
    const nextProject = prompt("Move to new project");
    if (nextProject === null) {
      render();
      return;
    }
    project = nextProject.trim();
  }

  moveEntryToProject(moveSelect.dataset.moveEntry, project);
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  }

  if (event.key === "Escape") {
    closeModal(elements.entryModal);
    closeModal(elements.readerModal);
    closeModal(elements.searchModal);
    closeModal(elements.managerModal);
    closeModal(elements.cloudModal);
    if (localStorage.getItem(ONBOARDING_KEY) === "true") closeModal(elements.onboardingModal);
    document.body.classList.remove("sidebar-open");
  }
});

document.querySelector("#view-nav").addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (!viewButton) return;

  event.preventDefault();
  event.stopPropagation();
  state.view = viewButton.dataset.view;
  state.activeTag = "";
  document.body.classList.remove("sidebar-open");
  render();
});

render();
initCloud();
maybeOpenOnboarding();

// ============================================================
// PWA + Native Mobile Enhancements
// ============================================================

function haptic(pattern = [10]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

async function shareOrExport(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  if (navigator.share && window.matchMedia("(max-width: 820px)").matches) {
    try {
      await navigator.share({
        title: entry.title,
        text: entry.content.slice(0, 300) + (entry.content.length > 300 ? "…" : ""),
        url: window.location.href
      });
      return;
    } catch {
      // user cancelled — fall through to PDF
    }
  }
  await exportEntryAsPdf(id);
}

// View order for swipe navigation
const SWIPE_VIEWS = ["all", "today", "projects", "timeline", "reflect", "archive"];

// Touch state
const touch = { startX: 0, startY: 0, active: false };

document.addEventListener("touchstart", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  touch.startX = event.touches[0].clientX;
  touch.startY = event.touches[0].clientY;
  touch.active = true;
}, { passive: true });

document.addEventListener("touchend", (event) => {
  if (!touch.active) return;
  touch.active = false;

  const dx = event.changedTouches[0].clientX - touch.startX;
  const dy = event.changedTouches[0].clientY - touch.startY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  const anyModalOpen = document.querySelector(".modal.open");

  if (anyModalOpen) {
    // Swipe down to dismiss modal sheet on small screens
    if (dy > 90 && absDx < 60 && window.matchMedia("(max-width: 560px)").matches) {
      closeModal(anyModalOpen);
      haptic([8]);
    }
    return;
  }

  // Swipe from left edge → open sidebar
  if (touch.startX < 28 && dx > 60 && absDy < 80) {
    document.body.classList.add("sidebar-open");
    haptic([8]);
    return;
  }

  // Swipe left on open sidebar → close it
  if (document.body.classList.contains("sidebar-open") && dx < -50 && absDy < 80) {
    document.body.classList.remove("sidebar-open");
    haptic([8]);
    return;
  }

  // Horizontal swipe on main content → navigate between views
  if (absDx > 72 && absDx > absDy * 1.6 && !document.body.classList.contains("sidebar-open")) {
    const currentIndex = SWIPE_VIEWS.indexOf(state.view);
    if (dx < 0 && currentIndex < SWIPE_VIEWS.length - 1) {
      state.view = SWIPE_VIEWS[currentIndex + 1];
      state.activeTag = "";
      render();
      haptic([6]);
    } else if (dx > 0 && currentIndex > 0) {
      state.view = SWIPE_VIEWS[currentIndex - 1];
      state.activeTag = "";
      render();
      haptic([6]);
    }
  }
}, { passive: true });

// Pull-to-refresh
const ptrEl = document.createElement("div");
ptrEl.className = "ptr-indicator";
ptrEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21.5 2v6h-6"/><path d="M2.5 12A10 10 0 0 1 18.46 5.46L21.5 8M2.5 22v-6h6"/><path d="M21.5 12A10 10 0 0 1 5.54 18.54L2.5 16"/></svg>`;
document.body.appendChild(ptrEl);

let ptrStartY = 0;
let ptrActive = false;

elements.content.addEventListener("touchstart", (event) => {
  if (elements.content.scrollTop === 0) {
    ptrStartY = event.touches[0].clientY;
    ptrActive = true;
  }
}, { passive: true });

elements.content.addEventListener("touchmove", (event) => {
  if (!ptrActive) return;
  const dy = event.touches[0].clientY - ptrStartY;
  if (dy > 12) {
    ptrEl.classList.add("ptr-visible");
    ptrEl.classList.toggle("ptr-ready", dy > 64);
  }
}, { passive: true });

elements.content.addEventListener("touchend", (event) => {
  if (!ptrActive) return;
  ptrActive = false;
  const dy = event.changedTouches[0].clientY - ptrStartY;
  if (dy > 64) {
    haptic([10, 20, 10]);
    if (state.cloudUser) {
      syncNow();
    } else {
      render();
      toast("Refreshed");
    }
  }
  ptrEl.classList.remove("ptr-visible", "ptr-ready");
}, { passive: true });

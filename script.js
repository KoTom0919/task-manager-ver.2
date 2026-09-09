"use strict";

const STEP = 15;
const KEY = "solo-scheduler-v3";

const COLORS = [
  "#fff1a8",
  "#f8c9b8",
  "#d9c2f3",
  "#bfe3b2",
  "#b9d9f2",
  "#f2bddd"
];

const $ = (id) =>
  document.getElementById(id);

let data = load();
let editId = null;
let selectedId = null;
let selectedColor = COLORS[0];

init();

/* ==============================
   保存・読み込み
============================== */

function initialData() {
  return {
    tasks: [],
    base: {
      start: "08:00",
      end: "20:00",
      hasBreak: true,
      breakStart: "12:00",
      breakEnd: "13:00"
    },
    special: {}
  };
}

function load() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(KEY) || "{}"
    );

    return {
      ...initialData(),
      ...saved,
      tasks: Array.isArray(saved.tasks)
        ? saved.tasks
        : [],
      special:
        saved.special || {}
    };
  } catch {
    return initialData();
  }
}

function save() {
  localStorage.setItem(
    KEY,
    JSON.stringify(data)
  );
}

function makeId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7)
  );
}

/* ==============================
   日付と時刻
============================== */

function pad(number) {
  return String(number).padStart(2, "0");
}

function dayKey(date = new Date()) {
  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}`
  );
}

function dateTimeInput(date) {
  return (
    `${dayKey(date)}T` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

function toMilliseconds(value) {
  const number =
    new Date(value).getTime();

  return Number.isFinite(number)
    ? number
    : null;
}

function timeToMinutes(value) {
  const [hour, minute] =
    value.split(":").map(Number);

  return hour * 60 + minute;
}

function dateAtTime(date, time) {
  const [hour, minute] =
    time.split(":").map(Number);

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour,
    minute
  ).getTime();
}

function startOfDay(value) {
  const date =
    new Date(value);

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
}

function addOneDay(value) {
  const date =
    new Date(value);

  date.setDate(
    date.getDate() + 1
  );

  return date.getTime();
}

function roundUp(value) {
  const unit =
    STEP * 60000;

  return (
    Math.ceil(value / unit) *
    unit
  );
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }
  ).format(
    new Date(value)
  );
}

function formatTime(value) {
  const date =
    new Date(value);

  return (
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

function formatDateLabel(date) {
  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short"
    }
  ).format(date);
}

function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[character])
  );
}

/* ==============================
   初期化
============================== */

function init() {
  setTaskDefaults();
  setPeriodToday();
  renderColors();
  bindEvents();
  fillSettings();
  updateTaskMode();
  renderSpecialSettings();
  rebuildSchedule();
  renderTaskLists();
}

function setTaskDefaults() {
  const start =
    new Date(
      roundUp(Date.now())
    );

  const end =
    new Date(
      start.getTime() +
      60 * 60000
    );

  $("startAt").value =
    dateTimeInput(start);

  $("endAt").value =
    dateTimeInput(end);
}

function setPeriodToday() {
  const today =
    dayKey();

  $("viewStart").value =
    today;

  $("viewEnd").value =
    today;
}

/* ==============================
   イベント
============================== */

function bindEvents() {
  document
    .querySelectorAll("[data-screen]")
    .forEach((button) => {
      button.onclick = () => {
        showScreen(
          button.dataset.screen
        );
      };
    });

  document
    .querySelectorAll(
      'input[name="mode"]'
    )
    .forEach((input) => {
      input.onchange =
        updateTaskMode;
    });

  $("taskForm").onsubmit =
    submitTask;

  $("cancelEdit").onclick =
    resetTaskForm;

  $("openSettings").onclick = () => {
    $("settingsDialog").showModal();
  };

  $("closeSettings").onclick = () => {
    $("settingsDialog").close();
  };

  $("closeDetail").onclick = () => {
    $("detailDialog").close();
  };

  $("editTask").onclick =
    editSelectedTask;

  $("completeTask").onclick =
    completeSelectedTask;

  $("print").onclick = () => {
    window.print();
  };

  document
    .querySelectorAll(
      "[data-setting-tab]"
    )
    .forEach((button) => {
      button.onclick = () => {
        showSettingTab(
          button.dataset.settingTab
        );
      };
    });

  document
    .querySelectorAll(
      'input[name="baseBreak"],' +
      'input[name="specialBreak"]'
    )
    .forEach((input) => {
      input.onchange =
        toggleBreakInputs;
    });

  $("baseForm").onsubmit =
    saveBaseSetting;

  $("specialForm").onsubmit =
    saveSpecialSetting;

  $("viewStart").onchange =
    rebuildSchedule;

  $("viewEnd").onchange =
    rebuildSchedule;

  $("today").onclick = () => {
    setPeriodToday();
    rebuildSchedule();
  };

  $("showAll").onclick = () => {
    $("viewStart").value = "";
    $("viewEnd").value = "";
    rebuildSchedule();
  };

  for (
    const id of [
      "activeFrom",
      "activeTo",
      "doneFrom",
      "doneTo"
    ]
  ) {
    $(id).onchange =
      renderTaskLists;
  }

  document
    .querySelectorAll(
      "[data-clear-filter]"
    )
    .forEach((button) => {
      button.onclick = () => {
        const prefix =
          button.dataset.clearFilter;

        $(`${prefix}From`).value = "";
        $(`${prefix}To`).value = "";

        renderTaskLists();
      };
    });

  $("clearTasks").onclick = () => {
    if (
      data.tasks.length &&
      confirm(
        "すべてのタスクを削除しますか？"
      )
    ) {
      data.tasks = [];
      save();
      rebuildSchedule();
      renderTaskLists();
    }
  };
}

/* ==============================
   画面切り替え
============================== */

function showScreen(screenId) {
  document
    .querySelectorAll(".screen")
    .forEach((screen) => {
      screen.classList.toggle(
        "active",
        screen.id === screenId
      );
    });

  document
    .querySelectorAll(
      "[data-screen]"
    )
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.screen === screenId
      );
    });

  if (
    screenId === "scheduleScreen"
  ) {
    rebuildSchedule();
  }

  if (
    screenId === "listScreen"
  ) {
    renderTaskLists();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* ==============================
   タスク入力
============================== */

function updateTaskMode() {
  const automatic =
    document.querySelector(
      'input[name="mode"]:checked'
    ).value === "auto";

  $("startField").classList.toggle(
    "hidden",
    automatic
  );

  $("autoFields").classList.toggle(
    "hidden",
    !automatic
  );

  $("startAt").required =
    !automatic;

  $("duration").required =
    automatic;

  $("endLabel").textContent =
    automatic
      ? "終了時刻（期限）"
      : "終了時刻";
}

function renderColors() {
  $("colors").innerHTML =
    COLORS.map(
      (color, index) => `
        <label class="color">
          <input
            name="color"
            type="radio"
            value="${color}"
            ${index === 0 ? "checked" : ""}
          >
          <span style="background:${color}"></span>
        </label>
      `
    ).join("");

  document
    .querySelectorAll(
      'input[name="color"]'
    )
    .forEach((input) => {
      input.onchange = () => {
        selectedColor =
          input.value;
      };
    });
}

function submitTask(event) {
  event.preventDefault();

  const mode =
    document.querySelector(
      'input[name="mode"]:checked'
    ).value;

  const end =
    toMilliseconds(
      $("endAt").value
    );

  const start =
    mode === "fixed"
      ? toMilliseconds(
          $("startAt").value
        )
      : null;

  const amount =
    Number(
      $("duration").value
    );

  const multiplier =
    $("durationUnit").value === "hours"
      ? 60
      : 1;

  const duration =
    Math.ceil(
      amount *
      multiplier /
      STEP
    ) * STEP;

  $("formError").textContent = "";

  if (
    !$("taskName").value.trim()
  ) {
    showFormError(
      "タスク名を入力してください"
    );
    return;
  }

  if (!end) {
    showFormError(
      "終了時刻を入力してください"
    );
    return;
  }

  if (
    mode === "fixed" &&
    (
      !start ||
      start >= end
    )
  ) {
    showFormError(
      "開始時刻より後の終了時刻を入力してください"
    );
    return;
  }

  if (
    mode === "auto" &&
    duration <= 0
  ) {
    showFormError(
      "所要時間を入力してください"
    );
    return;
  }

  const taskData = {
    name:
      $("taskName").value.trim(),
    mode,
    start,
    end,
    duration:
      mode === "fixed"
        ? Math.ceil(
            (end - start) /
            60000 /
            STEP
          ) * STEP
        : duration,
    interruptible:
      document.querySelector(
        'input[name="interrupt"]:checked'
      ).value === "true",
    memo:
      $("memo").value.trim(),
    color:
      selectedColor
  };

  const editing =
    Boolean(editId);

  if (editing) {
    const task =
      data.tasks.find(
        (item) =>
          item.id === editId
      );

    if (task) {
      Object.assign(
        task,
        taskData
      );
    }
  } else {
    data.tasks.push({
      id: makeId(),
      ...taskData,
      createdAt: Date.now(),
      completedAt: null
    });
  }

  save();
  resetTaskForm();
  rebuildSchedule();
  renderTaskLists();

  showToast(
    editing
      ? "変更しました"
      : "追加しました"
  );

  showScreen(
    "scheduleScreen"
  );
}

function showFormError(message) {
  $("formError").textContent =
    message;
}

function resetTaskForm() {
  editId = null;

  $("formTitle").textContent =
    "タスクを追加";

  $("submitTask").textContent =
    "追加";

  $("cancelEdit").classList.add(
    "hidden"
  );

  $("taskName").value = "";
  $("memo").value = "";
  $("duration").value = 60;

  document.querySelector(
    'input[name="mode"][value="fixed"]'
  ).checked = true;

  document.querySelector(
    'input[name="interrupt"][value="true"]'
  ).checked = true;

  selectedColor =
    COLORS[0];

  document.querySelector(
    'input[name="color"]'
  ).checked = true;

  setTaskDefaults();
  updateTaskMode();
  showFormError("");
}

/* ==============================
   タスク詳細・編集・完了
============================== */

function openTaskDetail(taskId) {
  const task =
    data.tasks.find(
      (item) =>
        item.id === taskId
    );

  if (
    !task ||
    task.completedAt
  ) {
    return;
  }

  selectedId =
    taskId;

  $("detailName").textContent =
    task.name;

  $("detailType").textContent =
    task.mode === "fixed"
      ? "開始時刻"
      : "所要時間";

  $("detailValue").textContent =
    task.mode === "fixed"
      ? formatDateTime(task.start)
      : (
        `${task.duration}分` +
        (
          task.interruptible
            ? "（中断可）"
            : "（中断不可）"
        )
      );

  $("detailEnd").textContent =
    formatDateTime(task.end);

  $("detailMemo").textContent =
    task.memo || "—";

  $("detailDialog").showModal();
}

function editSelectedTask() {
  const task =
    data.tasks.find(
      (item) =>
        item.id === selectedId &&
        !item.completedAt
    );

  if (!task) {
    return;
  }

  editId =
    task.id;

  $("detailDialog").close();

  $("formTitle").textContent =
    "タスクを変更";

  $("submitTask").textContent =
    "変更";

  $("cancelEdit").classList.remove(
    "hidden"
  );

  $("taskName").value =
    task.name;

  $("memo").value =
    task.memo || "";

  $("startAt").value =
    task.start
      ? dateTimeInput(
          new Date(task.start)
        )
      : "";

  $("endAt").value =
    dateTimeInput(
      new Date(task.end)
    );

  $("duration").value =
    task.duration;

  document.querySelector(
    `input[name="mode"][value="${task.mode}"]`
  ).checked = true;

  document.querySelector(
    `input[name="interrupt"][value="${String(
      task.interruptible
    )}"]`
  ).checked = true;

  selectedColor =
    task.color;

  const colorInput =
    document.querySelector(
      `input[name="color"][value="${task.color}"]`
    );

  if (colorInput) {
    colorInput.checked = true;
  }

  updateTaskMode();
  showScreen("inputScreen");
}

function completeSelectedTask() {
  const task =
    data.tasks.find(
      (item) =>
        item.id === selectedId &&
        !item.completedAt
    );

  if (!task) {
    return;
  }

  task.completedAt =
    Date.now();

  save();

  $("detailDialog").close();

  rebuildSchedule();
  renderTaskLists();

  showToast(
    "完了しました"
  );
}

/* ==============================
   設定画面
============================== */

function fillSettings() {
  const base =
    data.base;

  $("baseStart").value =
    base.start;

  $("baseEnd").value =
    base.end;

  setRadio(
    "baseBreak",
    base.hasBreak
  );

  $("baseBreakStart").value =
    base.breakStart || "";

  $("baseBreakEnd").value =
    base.breakEnd || "";

  setRadio(
    "specialBreak",
    true
  );

  $("specialStart").value =
    base.start;

  $("specialEnd").value =
    base.end;

  $("specialBreakStart").value =
    base.breakStart || "";

  $("specialBreakEnd").value =
    base.breakEnd || "";

  toggleBreakInputs();
}

function setRadio(
  name,
  value
) {
  document.querySelector(
    `input[name="${name}"][value="${String(value)}"]`
  ).checked = true;
}

function toggleBreakInputs() {
  for (
    const prefix of [
      "base",
      "special"
    ]
  ) {
    const hasBreak =
      document.querySelector(
        `input[name="${prefix}Break"]:checked`
      ).value === "true";

    $(
      `${prefix}BreakTimes`
    ).classList.toggle(
      "hidden",
      !hasBreak
    );
  }
}

function showSettingTab(tab) {
  document
    .querySelectorAll(
      "[data-setting-tab]"
    )
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.settingTab === tab
      );
    });

  $("baseSettings").classList.toggle(
    "active",
    tab === "base"
  );

  $("specialSettings").classList.toggle(
    "active",
    tab === "special"
  );
}

function readSetting(prefix) {
  const hasBreak =
    document.querySelector(
      `input[name="${prefix}Break"]:checked`
    ).value === "true";

  return {
    start:
      $(`${prefix}Start`).value,
    end:
      $(`${prefix}End`).value,
    hasBreak,
    breakStart:
      hasBreak
        ? $(`${prefix}BreakStart`).value
        : "",
    breakEnd:
      hasBreak
        ? $(`${prefix}BreakEnd`).value
        : ""
  };
}

function validateSetting(
  setting,
  errorId
) {
  let message = "";

  if (
    !setting.start ||
    !setting.end ||
    timeToMinutes(setting.end) <=
      timeToMinutes(setting.start)
  ) {
    message =
      "終了時刻は開始時刻より後にしてください";
  } else if (
    setting.hasBreak &&
    (
      !setting.breakStart ||
      !setting.breakEnd ||
      timeToMinutes(setting.breakEnd) <=
        timeToMinutes(setting.breakStart) ||
      timeToMinutes(setting.breakStart) <
        timeToMinutes(setting.start) ||
      timeToMinutes(setting.breakEnd) >
        timeToMinutes(setting.end)
    )
  ) {
    message =
      "休憩時間を作業時間内で確認してください";
  }

  $(errorId).textContent =
    message;

  return !message;
}

function saveBaseSetting(event) {
  event.preventDefault();

  const setting =
    readSetting("base");

  if (
    !validateSetting(
      setting,
      "baseError"
    )
  ) {
    return;
  }

  data.base =
    setting;

  save();
  rebuildSchedule();

  showToast(
    "基底設定を保存しました"
  );
}

function saveSpecialSetting(event) {
  event.preventDefault();

  const date =
    $("specialDate").value;

  const setting =
    readSetting("special");

  if (!date) {
    return;
  }

  if (
    !validateSetting(
      setting,
      "specialError"
    )
  ) {
    return;
  }

  data.special[date] =
    setting;

  save();
  renderSpecialSettings();
  rebuildSchedule();

  showToast(
    "個別設定を保存しました"
  );
}

function renderSpecialSettings() {
  const dates =
    Object.keys(
      data.special
    ).sort();

  if (!dates.length) {
    $("specialList").innerHTML =
      "<p>個別設定はありません</p>";

    return;
  }

  $("specialList").innerHTML =
    dates.map(
      (date) => {
        const setting =
          data.special[date];

        const breakText =
          setting.hasBreak
            ? (
              `休憩 ` +
              `${setting.breakStart}～` +
              `${setting.breakEnd}`
            )
            : "休憩なし";

        return `
          <div class="special-item">
            <p>
              <strong>${date}</strong><br>
              ${setting.start}～${setting.end}
              ${breakText}
            </p>

            <button
              class="secondary"
              data-edit-day="${date}"
              type="button"
            >
              編集
            </button>

            <button
              class="danger"
              data-clear-day="${date}"
              type="button"
            >
              クリア
            </button>
          </div>
        `;
      }
    ).join("");

  document
    .querySelectorAll(
      "[data-edit-day]"
    )
    .forEach((button) => {
      button.onclick = () => {
        editSpecialSetting(
          button.dataset.editDay
        );
      };
    });

  document
    .querySelectorAll(
      "[data-clear-day]"
    )
    .forEach((button) => {
      button.onclick = () => {
        delete data.special[
          button.dataset.clearDay
        ];

        save();
        renderSpecialSettings();
        rebuildSchedule();
      };
    });
}

function editSpecialSetting(date) {
  const setting =
    data.special[date];

  $("specialDate").value =
    date;

  $("specialStart").value =
    setting.start;

  $("specialEnd").value =
    setting.end;

  setRadio(
    "specialBreak",
    setting.hasBreak
  );

  $("specialBreakStart").value =
    setting.breakStart || "";

  $("specialBreakEnd").value =
    setting.breakEnd || "";

  toggleBreakInputs();
}

function settingForDate(date) {
  return (
    data.special[dayKey(date)] ||
    data.base
  );
}

/* ==============================
   スケジュール計算
============================== */

function calculateSchedule() {
  const activeTasks =
    data.tasks.filter(
      (task) =>
        !task.completedAt
    );

  const occupied = [];
  const confirmedParts = [];
  const tentativeParts = [];
  const failedTasks = [];

  const fixedTasks =
    activeTasks
      .filter(
        (task) =>
          task.mode === "fixed"
      )
      .sort(
        (first, second) =>
          first.start -
          second.start
      );

  for (
    const task of fixedTasks
  ) {
    if (
      overlaps(
        occupied,
        task.start,
        task.end
      )
    ) {
      failedTasks.push({
        task,
        reason:
          "ほかの時間指定タスクと重なっています"
      });

      tentativeParts.push({
        task,
        start: task.start,
        end: task.end
      });

      continue;
    }

    occupied.push({
      start: task.start,
      end: task.end
    });

    confirmedParts.push({
      task,
      start: task.start,
      end: task.end
    });
  }

  const automaticTasks =
    activeTasks
      .filter(
        (task) =>
          task.mode === "auto"
      )
      .sort(
        (first, second) =>
          first.end -
            second.end ||
          first.createdAt -
            second.createdAt
      );

  for (
    const task of automaticTasks
  ) {
    const plan =
      findTaskPlan(
        task,
        occupied
      );

    if (!plan.length) {
      failedTasks.push({
        task,
        reason:
          "期限までに必要な空き時間を確保できません"
      });

      const tentativePlan =
        findTaskPlan(
          task,
          []
        );

      for (
        const part of tentativePlan
      ) {
        tentativeParts.push({
          ...part,
          task
        });
      }

      continue;
    }

    for (
      const part of plan
    ) {
      occupied.push(part);

      confirmedParts.push({
        ...part,
        task
      });
    }
  }

  confirmedParts.sort(
    (first, second) =>
      first.start -
      second.start
  );

  tentativeParts.sort(
    (first, second) =>
      first.start -
      second.start
  );

  return {
    parts: confirmedParts,
    tentative: tentativeParts,
    failed: failedTasks
  };
}

function findTaskPlan(
  task,
  occupied
) {
  const freeSlots = [];

  const today =
    startOfDay(Date.now());

  for (
    let cursor = today;
    cursor < task.end;
    cursor = addOneDay(cursor)
  ) {
    const date =
      new Date(cursor);

    const setting =
      settingForDate(date);

    const workStart =
      dateAtTime(
        date,
        setting.start
      );

    const workEnd =
      Math.min(
        dateAtTime(
          date,
          setting.end
        ),
        task.end
      );

    const breakStart =
      setting.hasBreak
        ? dateAtTime(
            date,
            setting.breakStart
          )
        : null;

    const breakEnd =
      setting.hasBreak
        ? dateAtTime(
            date,
            setting.breakEnd
          )
        : null;

    for (
      let slotStart = workStart;
      slotStart + STEP * 60000 <=
        workEnd;
      slotStart += STEP * 60000
    ) {
      const slotEnd =
        slotStart +
        STEP * 60000;

      const insideBreak =
        setting.hasBreak &&
        slotStart >= breakStart &&
        slotEnd <= breakEnd;

      if (insideBreak) {
        continue;
      }

      if (
        !overlaps(
          occupied,
          slotStart,
          slotEnd
        )
      ) {
        freeSlots.push({
          start: slotStart,
          end: slotEnd
        });
      }
    }
  }

  const requiredSlots =
    Math.ceil(
      task.duration / STEP
    );

  /*
   * 中断可能：
   * 期限に近い空き時間を必要数選ぶ
   */
  if (
    task.interruptible
  ) {
    if (
      freeSlots.length <
      requiredSlots
    ) {
      return [];
    }

    return mergeSlots(
      freeSlots.slice(
        freeSlots.length -
        requiredSlots
      )
    );
  }

  /*
   * 中断不可能：
   * 期限側から連続枠を探す
   */
  for (
    let index =
      freeSlots.length -
      requiredSlots;
    index >= 0;
    index--
  ) {
    const group =
      freeSlots.slice(
        index,
        index + requiredSlots
      );

    const continuous =
      group.every(
        (slot, groupIndex) =>
          groupIndex === 0 ||
          slot.start ===
            group[groupIndex - 1].end
      );

    if (continuous) {
      return [{
        start:
          group[0].start,
        end:
          group[
            group.length - 1
          ].end
      }];
    }
  }

  return [];
}

function overlaps(
  items,
  start,
  end
) {
  return items.some(
    (item) =>
      start < item.end &&
      end > item.start
  );
}

function mergeSlots(slots) {
  const output = [];

  for (
    const slot of slots
  ) {
    const last =
      output[
        output.length - 1
      ];

    if (
      last &&
      last.end === slot.start
    ) {
      last.end =
        slot.end;
    } else {
      output.push({
        ...slot
      });
    }
  }

  return output;
}

/* ==============================
   予定表表示
============================== */

function rebuildSchedule() {
  const result =
    calculateSchedule();

  const activeCount =
    data.tasks.filter(
      (task) =>
        !task.completedAt
    ).length;

  renderSchedule(result);

  $("resultMessage").textContent =
    `${activeCount - result.failed.length}件を配置、` +
    `${result.failed.length}件は仮予定です`;
}

function isVisibleDate(value) {
  const key =
    dayKey(
      new Date(value)
    );

  const from =
    $("viewStart").value;

  const to =
    $("viewEnd").value;

  return (
    (
      !from ||
      key >= from
    ) &&
    (
      !to ||
      key <= to
    )
  );
}

function renderSchedule(result) {
  const host =
    $("schedule");

  host.innerHTML = "";

  const days =
    new Map();

  const groups = [
    {
      type: "confirmed",
      items: result.parts
    },
    {
      type: "tentative",
      items: result.tentative
    }
  ];

  for (
    const group of groups
  ) {
    for (
      const part of group.items
    ) {
      if (
        !isVisibleDate(
          part.start
        )
      ) {
        continue;
      }

      const key =
        dayKey(
          new Date(part.start)
        );

      if (!days.has(key)) {
        days.set(
          key,
          {
            confirmed: [],
            tentative: []
          }
        );
      }

      days
        .get(key)
        [group.type]
        .push(part);
    }
  }

  if (!days.size) {
    host.innerHTML =
      '<p class="empty-cell">' +
      "選択期間に予定はありません" +
      "</p>";
  }

  for (
    const [key, groupsForDay]
    of days
  ) {
    host.append(
      renderScheduleDay(
        key,
        groupsForDay
      )
    );
  }

  if (
    result.failed.length
  ) {
    $("failed").innerHTML = `
      <div class="failure">
        <h3>
          スケジュールできませんでした
        </h3>

        <ul>
          ${result.failed.map(
            (item) => `
              <li>
                ${escapeHtml(item.task.name)}：
                ${escapeHtml(item.reason)}
              </li>
            `
          ).join("")}
        </ul>
      </div>
    `;
  } else {
    $("failed").innerHTML =
      "";
  }
}

function renderScheduleDay(
  key,
  groups
) {
  const date =
    new Date(
      `${key}T00:00`
    );

  const setting =
    settingForDate(date);

  const startMinutes =
    timeToMinutes(
      setting.start
    );

  const endMinutes =
    timeToMinutes(
      setting.end
    );

  const slotCount =
    (
      endMinutes -
      startMinutes
    ) / STEP;

  const box =
    document.createElement(
      "section"
    );

  box.className =
    "day";

  /*
   * 日付だけを表示する。
   * 「基底設定 08:00～20:00」などは表示しない。
   */
  box.innerHTML = `
    <div class="day-head">
      <h3>
        ${formatDateLabel(date)}
      </h3>
    </div>
  `;

  const timeRow =
    createTimeRow(
      startMinutes,
      slotCount
    );

  const confirmedLane =
    createLane(
      "確定予定",
      groups.confirmed,
      startMinutes,
      slotCount,
      setting,
      false
    );

  box.append(
    timeRow,
    confirmedLane
  );

  /*
   * 仮予定がある場合だけ
   * 仮予定の段を追加する
   */
  if (
    groups.tentative.length > 0
  ) {
    const tentativeLane =
      createLane(
        "仮予定",
        groups.tentative,
        startMinutes,
        slotCount,
        setting,
        true
      );

    box.append(
      tentativeLane
    );
  }

  return box;
}

function createTimeRow(
  startMinutes,
  slotCount
) {
  const row =
    document.createElement(
      "div"
    );

  row.className =
    "time-row";

  row.style.setProperty(
    "--slots",
    slotCount
  );

  row.innerHTML =
    '<div class="corner">時刻</div>';

  const finalMinutes =
    startMinutes +
    slotCount * STEP;

  for (
    let slot = 0;
    slot < slotCount;
    slot += 4
  ) {
    const cell =
      document.createElement(
        "div"
      );

    const columnSpan =
      Math.min(
        4,
        slotCount - slot
      );

    const currentMinutes =
      startMinutes +
      slot * STEP;

    cell.className =
      "time-label";

    cell.style.gridColumn =
      `${slot + 2} / span ${columnSpan}`;

    if (
      slot + 4 >= slotCount
    ) {
      cell.classList.add(
        "last-time"
      );

      cell.innerHTML = `
        <span>
          ${pad(
            Math.floor(
              currentMinutes / 60
            )
          )}:${pad(
            currentMinutes % 60
          )}
        </span>

        <span>
          ${pad(
            Math.floor(
              finalMinutes / 60
            )
          )}:${pad(
            finalMinutes % 60
          )}
        </span>
      `;
    } else {
      cell.textContent =
        `${pad(
          Math.floor(
            currentMinutes / 60
          )
        )}:${pad(
          currentMinutes % 60
        )}`;
    }

    row.append(cell);
  }

  return row;
}

function createLane(
  title,
  items,
  startMinutes,
  slotCount,
  setting,
  tentative
) {
  const row =
    document.createElement(
      "div"
    );

  row.className =
    tentative
      ? "timeline tentative"
      : "timeline";

  row.style.setProperty(
    "--slots",
    slotCount
  );

  row.innerHTML = `
    <div class="lane-title">
      ${title}
    </div>

    <div class="lane"></div>
  `;

  const body =
    row.querySelector(
      ".lane"
    );

  const rowEnds = [];

  if (
    setting.hasBreak
  ) {
    const shade =
      document.createElement(
        "div"
      );

    shade.className =
      "break-shade";

    shade.style.gridColumn =
      `${
        (
          timeToMinutes(
            setting.breakStart
          ) -
          startMinutes
        ) / STEP + 1
      } / ${
        (
          timeToMinutes(
            setting.breakEnd
          ) -
          startMinutes
        ) / STEP + 1
      }`;

    body.append(shade);
  }

  for (
    const part of items
  ) {
    const startDate =
      new Date(part.start);

    const endDate =
      new Date(part.end);

    const startSlot =
      (
        startDate.getHours() *
          60 +
        startDate.getMinutes() -
        startMinutes
      ) / STEP;

    const endSlot =
      (
        endDate.getHours() *
          60 +
        endDate.getMinutes() -
        startMinutes
      ) / STEP;

    let rowNumber =
      rowEnds.findIndex(
        (value) =>
          value <= startSlot
      );

    if (rowNumber < 0) {
      rowNumber =
        rowEnds.length;

      rowEnds.push(
        endSlot
      );
    } else {
      rowEnds[rowNumber] =
        endSlot;
    }

    const bar =
      document.createElement(
        "button"
      );

    bar.type =
      "button";

    bar.className =
      tentative
        ? "task-bar tentative-bar"
        : "task-bar";

    bar.style.gridColumn =
      `${startSlot + 1} / ` +
      `${endSlot + 1}`;

    bar.style.gridRow =
      String(rowNumber + 1);

    if (!tentative) {
      bar.style.background =
        part.task.color;
    }

    bar.textContent =
      tentative
        ? (
          `${part.task.name}` +
          "（配置不可）"
        )
        : (
          `${part.task.name} ` +
          `${formatTime(part.start)}–` +
          `${formatTime(part.end)}`
        );

    bar.onclick = () => {
      openTaskDetail(
        part.task.id
      );
    };

    body.append(bar);
  }

  if (!items.length) {
    const empty =
      document.createElement(
        "span"
      );

    empty.className =
      "lane-empty";

    empty.textContent =
      tentative
        ? "仮予定はありません"
        : "予定はありません";

    body.append(empty);
  }

  return row;
}

/* ==============================
   タスク一覧
============================== */

function renderTaskLists() {
  const activeTasks =
    data.tasks.filter(
      (task) =>
        !task.completedAt &&
        matchesListFilter(
          task.end,
          "active"
        )
    );

  const completedTasks =
    data.tasks.filter(
      (task) =>
        task.completedAt &&
        matchesListFilter(
          task.completedAt,
          "done"
        )
    );

  $("activeBody").innerHTML =
    makeTaskRows(
      activeTasks,
      false
    );

  $("doneBody").innerHTML =
    makeTaskRows(
      completedTasks,
      true
    );

  document
    .querySelectorAll(
      "[data-task]"
    )
    .forEach((row) => {
      row.onclick = () => {
        openTaskDetail(
          row.dataset.task
        );
      };
    });
}

function makeTaskRows(
  tasks,
  completed
) {
  if (!tasks.length) {
    return `
      <tr>
        <td
          colspan="4"
          class="empty-cell"
        >
          該当するタスクはありません
        </td>
      </tr>
    `;
  }

  const sortedTasks =
    [...tasks].sort(
      (first, second) =>
        completed
          ? second.completedAt -
            first.completedAt
          : first.end -
            second.end
    );

  return sortedTasks.map(
    (task) => `
      <tr
        ${completed
          ? ""
          : `class="click-row" data-task="${task.id}"`}
      >
        <td>
          ${escapeHtml(task.name)}
        </td>

        <td>
          ${task.mode === "fixed"
            ? formatDateTime(task.start)
            : (
              `${task.duration}分` +
              (
                task.interruptible
                  ? "（中断可）"
                  : "（中断不可）"
              )
            )}
        </td>

        <td>
          ${formatDateTime(
            completed
              ? task.completedAt
              : task.end
          )}
        </td>

        <td>
          ${escapeHtml(task.memo)}
        </td>
      </tr>
    `
  ).join("");
}

function matchesListFilter(
  value,
  prefix
) {
  const key =
    dayKey(
      new Date(value)
    );

  const from =
    $(`${prefix}From`).value;

  const to =
    $(`${prefix}To`).value;

  return (
    (
      !from ||
      key >= from
    ) &&
    (
      !to ||
      key <= to
    )
  );
}

/* ==============================
   通知
============================== */

function showToast(message) {
  const toast =
    $("toast");

  toast.textContent =
    message;

  toast.classList.add(
    "show"
  );

  clearTimeout(
    showToast.timer
  );

  showToast.timer =
    setTimeout(
      () => {
        toast.classList.remove(
          "show"
        );
      },
      1600
    );
}
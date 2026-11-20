/* KCeM 2027 — 홈페이지 스크립트
 * 모든 내용은 마스터 시트(웹 게시 CSV)에서 읽고, 연결 전에는 sample-data.js를 씁니다.
 * 이 파일은 운영 중 수정할 필요가 없습니다.
 */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DOW = ["일", "월", "화", "수", "목", "금", "토"];

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((v) => v.trim() !== ""));
  }
  function toObjects(rows) {
    const [head, ...body] = rows;
    if (!head) return [];
    const h = head.map((x) => x.trim());
    return body.map((r) => Object.fromEntries(h.map((k, i) => [k, (r[i] ?? "").trim()])));
  }

  async function loadData() {
    const urls = (window.SITE_CONFIG && window.SITE_CONFIG.csv) || {};
    const S = window.SAMPLE_DATA;
    const out = {};
    let sampleUsed = false;
    await Promise.all(
      ["settings", "program", "notices", "faq"].map(async (k) => {
        if (!urls[k]) { out[k] = S[k]; sampleUsed = true; return; }
        try {
          const res = await fetch(urls[k] + (urls[k].includes("?") ? "&" : "?") + "t=" + Date.now());
          if (!res.ok) throw new Error(res.status);
          const objs = toObjects(parseCSV(await res.text()));
          out[k] = k === "settings" ? Object.fromEntries(objs.map((o) => [o.key, o.value])) : objs;
        } catch (e) {
          console.warn("시트 로드 실패, 예시 데이터 사용:", k, e);
          out[k] = S[k]; sampleUsed = true;
        }
      })
    );
    out.sampleUsed = sampleUsed;
    return out;
  }

  /* ---------- 날짜 ---------- */
  const parseDate = (s) => {
    const m = String(s || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const fmtMD = (d) => d ? `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})` : "추후 공지";
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  /* ---------- 바인딩 ---------- */
  function bindSettings(s) {
    const ds = parseDate(s.date_start), de = parseDate(s.date_end);
    const derived = {
      date_range: ds
        ? `${ds.getFullYear()}. ${ds.getMonth() + 1}. ${ds.getDate()} (${DOW[ds.getDay()]})` +
          (de && +de !== +ds ? ` – ${de.getMonth() !== ds.getMonth() ? de.getMonth() + 1 + ". " : ""}${de.getDate()} (${DOW[de.getDay()]})` : "")
        : "추후 공지",
      deadline_lab_fmt: fmtMD(parseDate(s.deadline_lab)),
      deadline_abstract_fmt: fmtMD(parseDate(s.deadline_abstract)),
      deadline_register_fmt: fmtMD(parseDate(s.deadline_register)),
      title_en_html: esc(s.title_en || "").replace(/C\.\s?elegans/, "<i>C. elegans</i>"),
    };
    const v = { ...s, ...derived };
    $$("[data-bind]").forEach((el) => { const k = el.dataset.bind; if (v[k]) el.textContent = v[k]; });
    $$("[data-bind-html]").forEach((el) => { const k = el.dataset.bindHtml; if (v[k]) el.innerHTML = v[k]; });
    $$("[data-href]").forEach((el) => {
      const val = v[el.dataset.href];
      if (!val) { // 아직 주소가 없으면 페이지 안 앵커로 (새 탭 X)
        if ((el.getAttribute("href") || "").startsWith("#")) el.removeAttribute("target");
        return;
      }
      if (el.hasAttribute("data-mailto")) { el.href = "mailto:" + val; el.textContent = val; }
      else el.href = val;
      el.hidden = false; // 값이 있을 때만 보이는 링크 (예: 초록집 PDF)
    });
    if (s.title_en) document.title = s.title_en.replace(/^The\s+/, "");

    // D-day
    const dd = $("#dday");
    if (ds) {
      const diff = Math.round((ds - today()) / 86400000);
      const end = de || ds;
      dd.textContent = diff > 0 ? `D–${diff}` : today() <= end ? "TODAY" : "Thank you";
    } else dd.textContent = "TBA";
  }

  function renderTimeline(s) {
    const items = [
      { k: "deadline_lab", label: "참석자 명단 제출 마감", sub: "연구실별 엑셀" },
      { k: "deadline_abstract", label: "초록 제출 마감", sub: "구두 · 포스터 발표자" },
      { k: "deadline_register", label: "KSMCB 사전등록 마감", sub: "개인별 등록 · 결제" },
      { k: "date_start", label: "학술발표회 개최", sub: s.venue || "", event: true },
    ]
      .map((it) => ({ ...it, d: parseDate(s[it.k]) }));
    // 날짜가 정해진 항목은 날짜순, 사전등록 마감처럼 '추후 공지'인 항목은 개최일 바로 앞에
    const dated = items.filter((it) => it.d).sort((a, b) => a.d - b.d);
    const tba = items.filter((it) => !it.d && it.k === "deadline_register");
    const ev = dated.findIndex((it) => it.event);
    if (tba.length) dated.splice(ev < 0 ? dated.length : ev, 0, ...tba);
    items.length = 0; items.push(...dated);
    const t = today();
    const nextIdx = items.findIndex((it) => it.d && it.d >= t);
    $("#timeline").innerHTML = items
      .map((it, i) => {
        if (!it.d) return `<li class="tl tba">
          <div class="tl-date">추후<small>TBA</small></div>
          <p class="tl-label">${esc(it.label)}</p>
          <div class="tl-sub">${esc(it.sub)} · 추후 공지</div>
        </li>`;
        const cls = ["tl", it.d < t ? "past" : "", i === nextIdx ? "next" : "", it.event ? "event" : ""].join(" ");
        const left = Math.round((it.d - t) / 86400000);
        const flag = i === nextIdx ? `<span class="tl-flag">${left === 0 ? "오늘" : `${left}일 남음`}</span>` : "";
        return `<li class="${cls}">
          <div class="tl-date">${it.d.getMonth() + 1}.${String(it.d.getDate()).padStart(2, "0")}<small>${DOW[it.d.getDay()]}</small></div>
          <p class="tl-label">${esc(it.label)}</p>
          <div class="tl-sub">${esc(it.sub)}</div>${flag}
        </li>`;
      })
      .join("");
  }

  /* ---------- 공지 / FAQ ---------- */
  function renderNotices(list) {
    const shown = (list || [])
      .filter((n) => String(n["게시"] || "Y").toUpperCase() !== "N" && n["제목"])
      .sort((a, b) => String(b["날짜"]).localeCompare(String(a["날짜"])));
    $("#noticeList").innerHTML = shown.length
      ? shown.map((n) => `<li><time>${esc(n["날짜"])}</time><h3>${esc(n["제목"])}</h3><p>${esc(n["내용"])}</p></li>`).join("")
      : `<li class="empty">아직 공지가 없습니다.</li>`;
    if (shown[0]) {
      $("#ticker").hidden = false;
      $("#tickerText").textContent = `${shown[0]["날짜"]} · ${shown[0]["제목"]}`;
    }
  }
  function renderFAQ(list) {
    $("#faqList").innerHTML = (list || [])
      .filter((f) => f["질문"])
      .map((f) => `<details><summary>${esc(f["질문"])}</summary><p>${esc(f["답변"])}</p></details>`)
      .join("");
  }

  /* ---------- 초록 제출 폼 (구글 폼을 페이지 안에 넣음) ---------- */
  function renderAbstract(s) {
    const box = $("#absForm");
    const url = String(s.abstract_url || "").trim();
    const m = url.match(/^https:\/\/docs\.google\.com\/forms\/[^?#]+/);
    if (m) {
      const src = m[0].replace(/\/(edit|viewform)?$/, "") + "/viewform?embedded=true";
      box.innerHTML = `<iframe src="${esc(src)}" title="초록 제출 폼" loading="lazy">불러오는 중…</iframe>
        <p class="abs-alt">폼이 보이지 않으면 <a href="${esc(url)}" target="_blank" rel="noopener">새 창에서 열기 ↗</a></p>`;
    } else if (/^https?:\/\/(forms\.gle|goo\.gl)\/\w+/.test(url)) {
      box.innerHTML = `<p class="empty"><a class="btn btn-primary" href="${esc(url)}" target="_blank" rel="noopener">초록 제출 폼 열기 ↗</a></p>`;
    }
  }

  /* ---------- 프로그램 ---------- */
  const TYPE_CLASS = { 세션: "t-session", 발표: "t-talk", 기조강연: "t-keynote", 휴식: "t-break", 식사: "t-meal", 포스터: "t-poster" };
  // 설정 탭 program_open / stay_open 이 Y일 때만 공개 (없거나 N이면 '추후 공개')
  const isOpen = (v) => String(v || "").trim().toUpperCase() === "Y";
  const TBA = (msg) => `<div class="tba-box"><b>추후 공개</b><p>${esc(msg)}</p></div>`;

  function renderProgram(rows, s) {
    if (!isOpen(s.program_open)) {
      $("#dayTabs").innerHTML = "";
      $("#programList").innerHTML = TBA(`프로그램은 초록 접수(마감 ${fmtMD(parseDate(s.deadline_abstract))})가 끝난 뒤 공개합니다.`);
      return;
    }
    $("#printBtn").hidden = false;
    rows = (rows || []).filter((r) => r["제목"]);
    const days = [...new Set(rows.map((r) => r["일차"]))].sort((a, b) => a - b);
    const tabs = $("#dayTabs"), list = $("#programList");
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const toMin = (t) => { const m = String(t).match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
    const todayStr = ymd(today());
    let defaultDay = days[0];

    list.innerHTML = days.map((day) => {
      const items = rows.filter((r) => r["일차"] === day);
      const date = parseDate(items[0] && items[0]["날짜"]);
      if (date && ymd(date) === todayStr) defaultDay = day;
      return `<div class="p-day" data-day="${esc(day)}" role="tabpanel">
        ${items.map((r, i) => {
          const isToday = date && ymd(date) === todayStr;
          const s = toMin(r["시작"]), e = toMin(r["종료"]);
          const live = isToday && s != null && e != null && nowMin >= s && nowMin < e && r["구분"] !== "세션";
          const who = [r["발표자"], r["소속"]].filter(Boolean).join(" · ");
          const chair = r["좌장"] ? `좌장 ${r["좌장"]}` : "";
          const sub = [who, chair].filter(Boolean).join("  |  ");
          return `<div class="p-row ${TYPE_CLASS[r["구분"]] || ""} ${live ? "now" : ""}" style="--i:${i}">
            <span class="p-time">${esc(r["시작"])}${r["종료"] ? "–" + esc(r["종료"]) : ""}</span>
            <span class="p-type">${esc(r["구분"])}</span>
            <span class="p-title">${esc(r["제목"])}${sub ? `<span class="p-who">${esc(sub)}</span>` : ""}</span>
          </div>`;
        }).join("")}
      </div>`;
    }).join("");

    tabs.innerHTML = days.map((day) => {
      const first = rows.find((r) => r["일차"] === day);
      const d = parseDate(first && first["날짜"]);
      return `<button class="day-tab" role="tab" data-day="${esc(day)}">Day ${esc(day)}<small>${d ? `${d.getMonth() + 1}/${d.getDate()} ${DOW[d.getDay()]}` : ""}</small></button>`;
    }).join("");

    const select = (day) => {
      $$(".day-tab", tabs).forEach((t) => t.setAttribute("aria-selected", t.dataset.day === day));
      $$(".p-day", list).forEach((p) => {
        const on = p.dataset.day === day;
        p.hidden = !on;
        if (on) $$(".p-row", p).forEach((r) => { r.style.animation = "none"; r.offsetHeight; r.style.animation = ""; });
      });
    };
    $$(".day-tab", tabs).forEach((t) => t.addEventListener("click", () => select(t.dataset.day)));
    if (!rows.length) list.innerHTML = `<p class="empty">프로그램은 추후 공지됩니다.</p>`;
    else select(defaultDay);
  }

  /* ---------- 내비게이션 ---------- */
  function initNav() {
    const nav = $("#nav"), hero = $(".hero");
    const onScroll = () => nav.classList.toggle("solid", window.scrollY > hero.offsetHeight - 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    $("#navToggle").addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      $("#navToggle").setAttribute("aria-expanded", open);
    });
    $$("#navLinks a").forEach((a) => a.addEventListener("click", () => nav.classList.remove("open")));
  }

  /* ---------- 시작 ---------- */
  initNav();
  loadData().then((d) => {
    bindSettings(d.settings || {});
    renderTimeline(d.settings || {});
    renderNotices(d.notices);
    renderFAQ(d.faq);
    renderAbstract(d.settings || {});
    renderProgram(d.program, d.settings || {});
    const stayOpen = isOpen((d.settings || {}).stay_open);
    $("#stayDetail").hidden = !stayOpen;
    $("#stayTBA").hidden = stayOpen;
    if (d.sampleUsed) $("#dataBadge").textContent = "※ 현재 예시 데이터로 표시 중입니다 (마스터 시트 연결 전).";
  });
})();

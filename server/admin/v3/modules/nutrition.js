(function (global) {
  "use strict";
  let generation = 0;
  const labels = {
    breakfast: "საუზმე",
    lunch: "სადილი",
    dinner: "ვახშამი",
    snack: "წახემსება",
    balanced: "მრავალფეროვანი",
    vegetarian: "ვეგეტარიანული",
    vegan: "ვეგანური",
  };
  const allergens = {
    milk: "რძე",
    eggs: "კვერცხი",
    fish: "თევზი",
    shellfish: "კიბოსნაირები",
    nuts: "თხილეული",
    peanuts: "მიწის თხილი",
    soy: "სოია",
    gluten: "გლუტენი",
    sesame: "სეზამი",
    celery: "ნიახური",
    mustard: "მდოგვი",
    sulphites: "სულფიტები",
    lupin: "ლუპინი",
    molluscs: "მოლუსკები",
  };
  const ITEM_KEYS = ["name", "grams", "calories", "protein", "carbs", "fat"];
  const ITEM_LABELS = { name: "ინგრედიენტი", grams: "გრამი", calories: "კკალ", protein: "ცილა გ", carbs: "ნახშირწყალი გ", fat: "ცხიმი გ" };
  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ico = (name) => (typeof icon === "function" ? icon(name) : "");
  const V = () => global.AdminV3 || {};
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString("ka-GE") : "—");

  function metric(label, value, tone) {
    return `<div class="s-metric${tone ? ` is-${tone}` : ""}"><span>${esc(label)}</span><strong>${value}</strong></div>`;
  }

  function renderRecipes(root, recipes, can) {
    const list = root.querySelector("#nutrition-recipes");
    const rows = recipes
      .map(
        (r, i) => `<tr>
          <td><b>${esc(r.data.title) || '<span class="s-muted">უსახელო</span>'}</b></td>
          <td>${esc(labels[r.data.type])}</td>
          <td>${esc(labels[r.data.diet])}</td>
          <td class="num">${fmt(r.totals.calories)}</td>
          <td>${r.active ? '<span class="s-badge is-ok">მოქმედი</span>' : '<span class="s-badge">შეჩერებული</span>'}</td>
          <td class="num">${can ? `<button type="button" class="btn compact" data-edit="${i}">რედაქტირება</button>` : ""}</td>
        </tr>`,
      )
      .join("");
    list.innerHTML = recipes.length
      ? `<div class="s-table-wrap"><table class="s-table"><thead><tr><th>კერძი</th><th>კვება</th><th>არჩევანი</th><th class="num">კკალ · საბაზისო</th><th>სტატუსი</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="s-empty">${ico("layers")}<strong>კატალოგი ცარიელია</strong><span>დაამატე პირველი კერძი.</span></div>`;
    list.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => editRecipe(recipes[Number(b.dataset.edit)])));
    const add = root.querySelector("[data-add]");
    if (add)
      add.onclick = () =>
        editRecipe({
          id: crypto.randomUUID(),
          active: true,
          data: {
            title: "",
            type: "lunch",
            diet: "balanced",
            allergens: [],
            minutes: 15,
            source: "",
            instructions: "",
            items: [{ name: "", grams: 100, calories: 0, protein: 0, carbs: 0, fat: 0 }],
          },
        });
  }

  function editRecipe(row) {
    let draft = structuredClone(row.data);
    let active = row.active;
    const isNew = !row.data.title;
    const dialog = V().openDialog?.({
      title: isNew ? "ახალი კერძი" : "კერძის რედაქტირება",
      description: "ყველა მაჩვენებელი შეავსე მითითებული გრამებისთვის (არა 100 გრამზე). სახელში მიუთითე მომზადების მდგომარეობაც.",
      wide: true,
      body: '<form id="nutrition-recipe-form" class="s-stack" novalidate></form>',
      footer:
        '<p class="s-form-msg" data-message role="status" style="margin-right:auto"></p>' +
        '<button type="button" class="btn" data-close>გაუქმება</button>' +
        '<button type="submit" class="btn primary" form="nutrition-recipe-form">კერძის შენახვა</button>',
    });
    const box = document.getElementById("nutrition-recipe-form");
    const panel = box?.closest(".v3-dialog-panel");
    if (!box || !panel) return;
    panel.style.width = "min(920px, calc(100vw - 32px))";

    function draw() {
      const input = (key, label, type = "text", extra = "") =>
        `<label class="s-field"><span>${label}</span><input data-field="${key}" type="${type}" value="${esc(draft[key])}" ${extra}></label>`;
      const select = (key, label, values) =>
        `<label class="s-field"><span>${label}</span><select data-field="${key}">${values
          .map((v) => `<option value="${v}" ${draft[key] === v ? "selected" : ""}>${labels[v]}</option>`)
          .join("")}</select></label>`;
      const totals = draft.items.reduce(
        (acc, it) => {
          ["grams", "calories", "protein", "carbs", "fat"].forEach((k) => (acc[k] += Number(it[k]) || 0));
          return acc;
        },
        { grams: 0, calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      box.innerHTML = `
        <div class="s-form-grid">
          ${input("title", "დასახელება", "text", 'required maxlength="120" placeholder="მაგ. მოხარშული ქათმის მკერდი"')}
          ${select("type", "კვება", ["breakfast", "lunch", "dinner", "snack"])}
          ${select("diet", "კვების არჩევანი", ["balanced", "vegetarian", "vegan"])}
          ${input("minutes", "მომზადების წუთები", "number", 'min="0" step="1"')}
        </div>
        <div class="s-switch-row" style="padding-top:0">
          <div><b>აქტიურია</b><small>გამორთული კერძი ახალ რაციონში არ მოხვდება.</small></div>
          <input class="s-switch" data-active type="checkbox" role="switch" aria-label="აქტიურია" ${active ? "checked" : ""}>
        </div>
        <div class="s-field"><span>ალერგენები</span>
          <div class="s-chips">${Object.entries(allergens)
            .map(
              ([k, l]) =>
                `<label class="s-chip-check"><input data-allergen="${k}" type="checkbox" ${draft.allergens.includes(k) ? "checked" : ""}><span>${l}</span></label>`,
            )
            .join("")}</div>
        </div>
        <div class="s-card">
          <div class="s-table-wrap"><table class="s-table is-edit"><thead><tr>${ITEM_KEYS.map(
            (k) => `<th${k === "name" ? "" : ' class="num"'}>${ITEM_LABELS[k]}</th>`,
          ).join("")}<th></th></tr></thead><tbody>${draft.items
            .map(
              (item, i) =>
                `<tr>${ITEM_KEYS.map(
                  (k) =>
                    `<td><input aria-label="${ITEM_LABELS[k]} ${i + 1}" style="min-width:${k === "name" ? 180 : 72}px" data-item="${i}" data-key="${k}" type="${
                      k === "name" ? "text" : "number"
                    }" step="0.1" min="0" value="${esc(item[k])}"></td>`,
                ).join("")}<td><button type="button" class="btn ghost icon-only" data-remove="${i}" aria-label="ინგრედიენტის ამოღება" title="ამოღება">${ico("trash")}</button></td></tr>`,
            )
            .join("")}</tbody>
            <tfoot><tr><td><b>სულ</b></td>${["grams", "calories", "protein", "carbs", "fat"]
              .map((k) => `<td class="num"><b>${fmt(Math.round(totals[k] * 10) / 10)}</b></td>`)
              .join("")}<td></td></tr></tfoot></table></div>
          <div class="s-card-foot" style="justify-content:flex-start"><button class="btn compact" type="button" data-ingredient ${
            draft.items.length >= 20 ? "disabled" : ""
          }>${ico("plus")} ინგრედიენტის დამატება</button><span class="s-foot-note" style="margin:0 0 0 auto">${draft.items.length} / 20</span></div>
        </div>
        <label class="s-field"><span>მომზადება</span><textarea rows="4" data-field="instructions">${esc(draft.instructions)}</textarea></label>
        ${input("source", "კვებითი მონაცემების წყარო / ცნობარის ნომრები")}`;
      box.querySelectorAll("[data-remove]").forEach(
        (b) =>
          (b.onclick = () => {
            read();
            draft.items.splice(Number(b.dataset.remove), 1);
            draw();
          }),
      );
      box.querySelector("[data-ingredient]").onclick = () => {
        read();
        if (draft.items.length < 20) draft.items.push({ name: "", grams: 100, calories: 0, protein: 0, carbs: 0, fat: 0 });
        draw();
        box.querySelector(`[data-item="${draft.items.length - 1}"][data-key="name"]`)?.focus();
      };
      box.querySelectorAll("[data-item]").forEach((el) => el.addEventListener("change", () => { read(); draw(); }));
      V().watchDirty?.(box);
    }
    const read = () => {
      box.querySelectorAll("[data-field]").forEach(
        (el) => (draft[el.dataset.field] = el.dataset.field === "minutes" ? Number(el.value) : el.value.trim()),
      );
      draft.allergens = [...box.querySelectorAll("[data-allergen]:checked")].map((el) => el.dataset.allergen);
      box.querySelectorAll("[data-item]").forEach(
        (el) => (draft.items[Number(el.dataset.item)][el.dataset.key] = el.dataset.key === "name" ? el.value.trim() : Number(el.value)),
      );
      active = box.querySelector("[data-active]").checked;
    };
    panel.querySelector("[data-close]").onclick = () => void dialog.close();
    box.onsubmit = async (event) => {
      event.preventDefault();
      read();
      const button = panel.querySelector("[type=submit]");
      const message = panel.querySelector("[data-message]");
      if (!draft.title) {
        message.textContent = "დასახელება სავალდებულოა.";
        box.querySelector('[data-field="title"]')?.focus();
        return;
      }
      button.disabled = true;
      button.classList.add("is-loading");
      message.textContent = "";
      try {
        await api("/nutrition/recipes/" + encodeURIComponent(row.id), { method: "PUT", body: { data: draft, active } });
        V().setDirty?.(false);
        await dialog.close();
        toast(isNew ? "კერძი დაემატა" : "კერძი შენახულია", "ok");
        await global.renderNutrition();
      } catch (e) {
        message.textContent = e.message || "ვერ შეინახა";
        button.disabled = false;
        button.classList.remove("is-loading");
      }
    };
    draw();
    V().setDirty?.(false);
    box.querySelector('[data-field="title"]')?.focus();
  }

  global.renderNutrition = async function () {
    const root = document.getElementById("tab-nutrition");
    if (!root) return;
    const gen = ++generation;
    root.innerHTML = `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${"<i></i>".repeat(6)}</div></div>`;
    try {
      const [data, programs] = await Promise.all([api("/nutrition/overview"), api("/nutrition/programs")]);
      if (gen !== generation) return;
      const can = state.admin?.capabilities == null || state.admin.capabilities.includes("NUTRITION_MANAGE");
      const failRate = data.scans.total ? data.scans.failed / data.scans.total : 0;
      const usage = [
        metric("მომხმარებელი", fmt(data.usage.users)),
        metric("შენახული კვება", fmt(data.usage.meals)),
        metric("კვება · 7 დღე", fmt(data.usage.weekMeals)),
        metric("მოქმედი კვების გეგმა", fmt(programs.usage.active)),
        metric("დაგეგმილი კვება", fmt(programs.plans.meals)),
        metric("კერძი კატალოგში", fmt(programs.recipes.length)),
      ].join("");
      const ai = [
        metric("AI შეფასება · 7 დღე", fmt(data.scans.total)),
        metric("შეფასების შეცდომა", fmt(data.scans.failed), failRate > 0.2 ? "bad" : failRate > 0.05 ? "warn" : ""),
        metric("საშუალო AI დრო", `${(data.scans.averageMs / 1000).toFixed(1)} წმ`, data.scans.averageMs > 12000 ? "warn" : ""),
      ].join("");
      const sources = data.sources
        ? [
            metric("ფოტოდან", fmt(data.sources.photo)),
            metric("შტრიხკოდი / ეტიკეტი", fmt(data.sources.barcode + data.sources.label)),
            metric("აღწერით / ხმით", fmt(data.sources.text)),
            metric("ძებნა / ხელით", fmt(data.sources.search + data.sources.manual)),
          ].join("")
        : "";
      const extras = data.extras
        ? [
            metric("შენახული საკვები", fmt(data.extras.foods)),
            metric("ქეშირებული პროდუქტი", fmt(data.extras.products)),
            metric("ვარჯიშის ჩანაწერი", fmt(data.extras.activities)),
          ].join("")
        : "";
      root.innerHTML = `<div class="s-stack v3-tab-shell">
        <div class="s-section-title"><h3>გამოყენება</h3><button type="button" class="btn ghost compact" data-refresh>${ico("refresh")} განახლება</button></div>
        <div class="s-metrics">${usage}</div>
        <div class="s-section-title"><h3>AI შეფასება</h3></div>
        <div class="s-metrics">${ai}</div>
        ${sources ? `<div class="s-section-title"><h3>აღრიცხვის წყაროები · 30 დღე</h3></div><div class="s-metrics">${sources}</div>` : ""}
        ${extras ? `<div class="s-section-title"><h3>დამატებითი მონაცემები</h3></div><div class="s-metrics">${extras}</div>` : ""}
        <section class="s-card">
          <header class="s-card-head"><div><h3>სერვისის პარამეტრები</h3>
            <p>მომხმარებელი იღებს სავარაუდო შედეგს, ამოწმებს საკვებსა და პორციას და შემდეგ ინახავს. ხელით აღრიცხვა ყოველთვის ხელმისაწვდომია.</p></div></header>
          <div class="s-card-body">
            <label class="s-switch-row"><div><b>ფოტოდან AI შეფასება</b><small>ფოტოს გაგზავნამდე საჭიროა მოქმედი AI თანხმობა.</small></div>
              <input class="s-switch" type="checkbox" role="switch" id="nutrition-photo" ${data.settings.photoEnabled ? "checked" : ""} ${can ? "" : "disabled"}></label>
            <label class="s-switch-row"><div><b>რაციონისა და მიზნის შექმნა</b><small>საწყისი სამიზნე გამოითვლება შესაბამისობის შემოწმების შემდეგ.</small></div>
              <input class="s-switch" type="checkbox" role="switch" id="nutrition-program" ${data.settings.programEnabled ? "checked" : ""} ${can ? "" : "disabled"}></label>
          </div>
          ${can ? `<footer class="s-card-foot"><span class="s-foot-note" id="nutrition-feedback" role="status"></span><button type="button" class="btn primary" data-save disabled>ცვლილების შენახვა</button></footer>` : ""}
          <details class="s-details"><summary>${ico("shield")} კონფიდენციალურობა და ხარისხი</summary><div>
            <p>ფოტოს გაგზავნამდე საჭიროა მოქმედი AI თანხმობა. მიმღები: OpenRouter → Google Vertex AI. ფოტო მუშავდება მეხსიერებაში და მუდმივად არ ინახება. ეს გვერდი არ აჩვენებს კერძო კვების ჩანაწერებს ან ფოტოებს.</p>
            <p>კალორიები შეფასებაა, არა ზუსტი გაზომვა. შეცდომის დროს აპი სთავაზობს ხელით აღრიცხვას. შედეგი დიეტოლოგის დანიშნულება არ არის. კერძები USDA-ს ცნობარს ეყრდნობა; ადმინისტრატორი პასუხისმგებელია ცვლილების, ალერგენებისა და წყაროს სისწორეზე.</p>
          </div></details>
        </section>
        <section class="s-card">
          <header class="s-card-head"><div><h3>კერძების კატალოგი</h3>
            <p>ცვლილება გავრცელდება ახლად შედგენილ რაციონზე. უკვე შენახული კვება და მისი პორცია დარჩება.</p></div>
            ${can ? `<button type="button" class="btn primary compact" data-add>${ico("plus")} კერძის დამატება</button>` : ""}</header>
          <div class="s-card-body is-flush" id="nutrition-recipes" style="border-top:1px solid var(--s-line-soft)"></div>
        </section>
      </div>`;
      renderRecipes(root, programs.recipes, can);
      root.querySelector("[data-refresh]").onclick = () => void global.renderNutrition();
      const save = root.querySelector("[data-save]");
      if (save) {
        const photo = root.querySelector("#nutrition-photo");
        const program = root.querySelector("#nutrition-program");
        const status = root.querySelector("#nutrition-feedback");
        const initial = `${photo.checked}|${program.checked}`;
        const sync = () => {
          const changed = `${photo.checked}|${program.checked}` !== initial;
          save.disabled = !changed;
          status.textContent = changed ? "შეუნახავი ცვლილება" : "";
        };
        photo.onchange = sync;
        program.onchange = sync;
        save.onclick = async () => {
          save.disabled = true;
          save.classList.add("is-loading");
          try {
            await api("/nutrition/settings", {
              method: "PATCH",
              body: { photoEnabled: photo.checked, programEnabled: program.checked },
            });
            toast("პარამეტრები შენახულია", "ok");
            await global.renderNutrition();
          } catch (e) {
            status.textContent = e.message || "ვერ შეინახა";
            save.disabled = false;
          } finally {
            save.classList.remove("is-loading");
          }
        };
      }
    } catch (error) {
      if (gen !== generation) return;
      root.innerHTML = `<div class="s-card"><div class="s-empty">${ico("alert")}<strong>მოდული ვერ ჩაიტვირთა</strong><span data-msg></span><button type="button" class="btn" data-retry>ხელახლა ცდა</button></div></div>`;
      root.querySelector("[data-msg]").textContent = error.message || "";
      root.querySelector("[data-retry]").onclick = () => void global.renderNutrition();
    }
  };
})(window);

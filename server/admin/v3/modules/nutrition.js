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
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function renderRecipes(root, recipes, can) {
    const list = root.querySelector("#nutrition-recipes");
    list.innerHTML =
      '<div style="overflow:auto"><table style="width:100%;text-align:left"><thead><tr><th>კერძი</th><th>კვება</th><th>კკალ · საბაზისო</th><th>არჩევანი</th><th>სტატუსი</th><th></th></tr></thead><tbody>' +
      recipes
        .map(
          (r, i) =>
            '<tr><td style="padding:14px 8px">' +
            esc(r.data.title) +
            "</td><td>" +
            esc(labels[r.data.type]) +
            "</td><td>" +
            r.totals.calories +
            "</td><td>" +
            esc(labels[r.data.diet]) +
            "</td><td>" +
            (r.active ? "მოქმედი" : "შეჩერებული") +
            "</td><td>" +
            (can
              ? '<button class="btn" data-edit="' + i + '">რედაქტირება</button>'
              : "") +
            "</td></tr>",
        )
        .join("") +
      "</tbody></table></div>" +
      (can
        ? '<button class="btn primary" data-add>კერძის დამატება</button>'
        : "");
    list
      .querySelectorAll("[data-edit]")
      .forEach(
        (b) =>
          (b.onclick = () => editRecipe(root, recipes[Number(b.dataset.edit)])),
      );
    if (can)
      list.querySelector("[data-add]").onclick = () =>
        editRecipe(root, {
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
            items: [
              {
                name: "",
                grams: 100,
                calories: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
              },
            ],
          },
        });
  }
  function editRecipe(root, row) {
    const box = root.querySelector("#nutrition-editor");
    let draft = structuredClone(row.data),
      active = row.active;
    function draw() {
      const input = (key, label, type = "text") =>
        '<label style="display:grid;gap:6px">' +
        label +
        '<input class="input" data-field="' +
        key +
        '" type="' +
        type +
        '" value="' +
        esc(draft[key]) +
        '"></label>';
      const select = (key, values) =>
        "<label>" +
        { type: "კვება", diet: "კვების არჩევანი" }[key] +
        '<select class="input" data-field="' +
        key +
        '">' +
        values
          .map(
            (v) =>
              '<option value="' +
              v +
              '" ' +
              (draft[key] === v ? "selected" : "") +
              ">" +
              labels[v] +
              "</option>",
          )
          .join("") +
        "</select></label>";
      box.innerHTML =
        '<form style="display:grid;gap:18px;margin-top:24px;padding-top:24px;border-top:1px solid var(--border)"><h3>კერძის დეტალები</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px">' +
        input("title", "დასახელება") +
        select("type", ["breakfast", "lunch", "dinner", "snack"]) +
        select("diet", ["balanced", "vegetarian", "vegan"]) +
        input("minutes", "მომზადების წუთები", "number") +
        '</div><label>აქტიურია <input data-active type="checkbox" ' +
        (active ? "checked" : "") +
        "></label><fieldset><legend>ალერგენები</legend>" +
        Object.entries(allergens)
          .map(
            ([k, l]) =>
              '<label style="display:inline-flex;padding:8px;gap:6px"><input data-allergen="' +
              k +
              '" type="checkbox" ' +
              (draft.allergens.includes(k) ? "checked" : "") +
              ">" +
              l +
              "</label>",
          )
          .join("") +
        '</fieldset><p>ყველა მაჩვენებელი შეავსე ქვემოთ მითითებული გრამებისთვის, არა ავტომატურად 100 გრამზე. სახელში მიუთითე მომზადების მდგომარეობაც.</p><div style="overflow:auto"><table style="width:100%"><thead><tr>' +
        [
          "ინგრედიენტი",
          "გრამი",
          "კკალ",
          "ცილა გ",
          "ნახშირწყალი გ",
          "ცხიმი გ",
          "",
        ]
          .map((v) => "<th>" + v + "</th>")
          .join("") +
        "</tr></thead><tbody>" +
        draft.items
          .map(
            (item, i) =>
              "<tr>" +
              ["name", "grams", "calories", "protein", "carbs", "fat"]
                .map(
                  (k) =>
                    '<td><input aria-label="' +
                    {
                      name: "ინგრედიენტი",
                      grams: "გრამი",
                      calories: "კკალ",
                      protein: "ცილა",
                      carbs: "ნახშირწყალი",
                      fat: "ცხიმი",
                    }[k] +
                    " " +
                    (i + 1) +
                    '" class="input" style="min-width:' +
                    (k === "name" ? 180 : 72) +
                    'px;width:100%" data-item="' +
                    i +
                    '" data-key="' +
                    k +
                    '" type="' +
                    (k === "name" ? "text" : "number") +
                    '" step="0.1" min="0" value="' +
                    esc(item[k]) +
                    '"></td>',
                )
                .join("") +
              '<td><button type="button" class="btn" data-remove="' +
              i +
              '" aria-label="ინგრედიენტის ამოღება">×</button></td></tr>',
          )
          .join("") +
        '</tbody></table></div><button class="btn" type="button" data-ingredient>ინგრედიენტის დამატება</button><label>მომზადება<textarea class="input" rows="4" data-field="instructions">' +
        esc(draft.instructions) +
        "</textarea></label>" +
        input("source", "კვებითი მონაცემების წყარო / ცნობარის ნომრები") +
        '<p data-message role="status"></p><div style="display:flex;gap:12px"><button class="btn primary" type="submit">კერძის შენახვა</button><button class="btn" type="button" data-close>დახურვა</button></div></form>';
      const read = () => {
        box
          .querySelectorAll("[data-field]")
          .forEach(
            (el) =>
              (draft[el.dataset.field] =
                el.dataset.field === "minutes"
                  ? Number(el.value)
                  : el.value.trim()),
          );
        draft.allergens = [
          ...box.querySelectorAll("[data-allergen]:checked"),
        ].map((el) => el.dataset.allergen);
        box
          .querySelectorAll("[data-item]")
          .forEach(
            (el) =>
              (draft.items[Number(el.dataset.item)][el.dataset.key] =
                el.dataset.key === "name" ? el.value.trim() : Number(el.value)),
          );
        active = box.querySelector("[data-active]").checked;
      };
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
        if (draft.items.length < 20)
          draft.items.push({
            name: "",
            grams: 100,
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
          });
        draw();
      };
      box.querySelector("[data-close]").onclick = () => box.replaceChildren();
      box.querySelector("form").onsubmit = async (event) => {
        event.preventDefault();
        read();
        const button = box.querySelector("[type=submit]"),
          message = box.querySelector("[data-message]");
        button.disabled = true;
        message.textContent = "ინახება…";
        try {
          await api("/nutrition/recipes/" + encodeURIComponent(row.id), {
            method: "PUT",
            body: { data: draft, active },
          });
          await global.renderNutrition();
        } catch (e) {
          message.textContent = e.message || "ვერ შეინახა";
          button.disabled = false;
        }
      };
    }
    draw();
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  global.renderNutrition = async function () {
    const root = document.getElementById("tab-nutrition");
    if (!root) return;
    const gen = ++generation;
    root.innerHTML = '<p role="status">იტვირთება კვების მოდული…</p>';
    try {
      const [data, programs] = await Promise.all([
        api("/nutrition/overview"),
        api("/nutrition/programs"),
      ]);
      if (gen !== generation) return;
      const can =
        state.admin?.capabilities == null ||
        state.admin.capabilities.includes("NUTRITION_MANAGE");
      root.innerHTML =
        '<div class="v3-tab-shell" style="display:grid;gap:20px;width:100%"><div style="display:flex;flex-wrap:wrap;gap:16px">' +
        [
          [programs.usage.active, "მოქმედი კვების გეგმა"],
          [programs.plans.meals, "დაგეგმილი კვება"],
          [programs.recipes.length, "კერძი კატალოგში"],
          [data.usage.users, "მომხმარებელი"],
          [data.usage.meals, "შენახული კვება"],
          [data.usage.weekMeals, "კვება · 7 დღე"],
          [data.scans.total, "AI შეფასება · 7 დღე"],
          [data.scans.failed, "შეფასების შეცდომა"],
          [(data.scans.averageMs / 1000).toFixed(1) + " წმ", "საშუალო AI დრო"],
        ]
          .map(
            ([value, label]) =>
              '<article class="card" style="flex:1;min-width:160px;padding:22px"><strong style="font-size:30px">' +
              value +
              "</strong><p>" +
              label +
              "</p></article>",
          )
          .join("") +
        '<section class="card" style="width:100%;padding:24px;display:grid;gap:14px"><h2>ფოტოს შეფასება</h2><p>მომხმარებელი იღებს სავარაუდო შედეგს, ამოწმებს საკვებსა და პორციას და შემდეგ ინახავს. ხელით აღრიცხვა ყოველთვის ხელმისაწვდომია.</p><label style="display:flex;align-items:center;gap:12px"><input type="checkbox" id="nutrition-photo" ' +
        (data.settings.photoEnabled ? "checked " : "") +
        (can ? "" : "disabled") +
        '>ფოტოდან AI შეფასების ჩართვა</label><label><input type="checkbox" id="nutrition-program" ' +
        (data.settings.programEnabled ? "checked " : "") +
        (can ? "" : "disabled") +
        '> რაციონისა და მიზნის შექმნის ჩართვა</label><p role="status" id="nutrition-feedback"></p>' +
        (can
          ? '<button class="btn primary" data-save style="justify-self:start">ცვლილების შენახვა</button>'
          : "") +
        '</section><section class="card" style="padding:24px"><h2>კონფიდენციალურობა და ხარისხი</h2><p>ფოტოს გაგზავნამდე საჭიროა მოქმედი AI თანხმობა. მიმღები: OpenRouter → Google Vertex AI. ფოტო მუშავდება მეხსიერებაში და მუდმივად არ ინახება. ეს გვერდი არ აჩვენებს კერძო კვების ჩანაწერებს ან ფოტოებს.</p><p>კალორიები შეფასებაა, არა ზუსტი გაზომვა. შეცდომის დროს აპი სთავაზობს ხელით აღრიცხვას; საწყისი სამიზნე გამოითვლება შესაბამისობის შემოწმების შემდეგ. შედეგი დიეტოლოგის დანიშნულება არ არის. კერძები USDA-ს ცნობარს ეყრდნობა; ადმინისტრატორი პასუხისმგებელია ცვლილების, ალერგენებისა და წყაროს სისწორეზე.</p><button class="btn" data-refresh>სტატისტიკის განახლება</button></section><section class="card" style="padding:24px;width:100%"><h2>კერძების კატალოგი</h2><p>ცვლილება გავრცელდება ახლად შედგენილ რაციონზე. უკვე შენახული კვება და მისი პორცია დარჩება.</p><div id="nutrition-recipes"></div><div id="nutrition-editor"></div></section></div>';
      renderRecipes(root, programs.recipes, can);
      root.querySelector("[data-refresh]").onclick = () =>
        void global.renderNutrition();
      const save = root.querySelector("[data-save]");
      if (save)
        save.onclick = async () => {
          save.disabled = true;
          const status = root.querySelector("#nutrition-feedback");
          status.textContent = "ინახება…";
          try {
            await api("/nutrition/settings", {
              method: "PATCH",
              body: {
                photoEnabled: root.querySelector("#nutrition-photo").checked,
                programEnabled:
                  root.querySelector("#nutrition-program").checked,
              },
            });
            status.textContent = "შენახულია";
          } catch (e) {
            status.textContent = e.message || "ვერ შეინახა";
          } finally {
            save.disabled = false;
          }
        };
    } catch (error) {
      if (gen !== generation) return;
      root.innerHTML =
        '<p role="alert"></p><button class="btn">ხელახლა ცდა</button>';
      root.querySelector("p").textContent =
        error.message || "მოდული ვერ ჩაიტვირთა";
      root.querySelector("button").onclick = () =>
        void global.renderNutrition();
    }
  };
})(window);

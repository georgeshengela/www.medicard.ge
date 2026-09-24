(function (global) {
  "use strict";
  let generation = 0;
  global.renderNutrition = async function () {
    const root = document.getElementById("tab-nutrition");
    if (!root) return;
    const gen = ++generation;
    root.innerHTML = '<p role="status">იტვირთება კვების მოდული…</p>';
    try {
      const data = await api("/nutrition/overview");
      if (gen !== generation) return;
      const can =
        state.admin?.capabilities == null ||
        state.admin.capabilities.includes("NUTRITION_MANAGE");
      root.innerHTML =
        '<div class="v3-tab-shell" style="display:grid;gap:20px;width:100%"><div style="display:flex;flex-wrap:wrap;gap:16px">' +
        [
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
        '>ფოტოდან AI შეფასების ჩართვა</label><p role="status" id="nutrition-feedback"></p>' +
        (can
          ? '<button class="btn primary" data-save style="justify-self:start">ცვლილების შენახვა</button>'
          : "") +
        '</section><section class="card" style="padding:24px"><h2>კონფიდენციალურობა და ხარისხი</h2><p>ფოტოს გაგზავნამდე საჭიროა მოქმედი AI თანხმობა. მიმღები: OpenRouter → Google Vertex AI. ფოტო მუშავდება მეხსიერებაში და მუდმივად არ ინახება. ეს გვერდი არ აჩვენებს კერძო კვების ჩანაწერებს ან ფოტოებს.</p><p>კალორიები შეფასებაა, არა ზუსტი გაზომვა. შეცდომის დროს აპი სთავაზობს ხელით აღრიცხვას; ავტომატური დიეტა ან კალორიული დეფიციტი არ ინიშნება.</p><button class="btn" data-refresh>სტატისტიკის განახლება</button></section></div>';
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

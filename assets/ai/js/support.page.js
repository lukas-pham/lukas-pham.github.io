// Support agent playground: the repo's own tools + guards + demo driver (bundled in support-playground.js).
(function () {
  var root = document.querySelector("[data-support-pg]");
  if (!root) return;
  var log = root.querySelector(".pg-log");
  var steps = root.querySelector("[data-steps]");
  var form = root.querySelector(".pg-form");
  var input = root.querySelector(".pg-input");
  var session = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function say(cls, text) {
    var m = el("div", "pg-msg " + cls, text);
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }

  fetch("assets/ai/data/sample-store.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      session = SupportPlayground.createSession(data);
      say("pg-msg--agent", "Hi! Ask me about products, sizing, shipping or your order. (Sample store: Summit Drift Outfitters.)");
    })
    .catch(function () { say("pg-msg--system", "Could not load the sample store."); });

  function renderSteps(result, question) {
    var head = el("h4", null, "› " + question.slice(0, 60));
    steps.appendChild(head);
    if (!result.steps.length) steps.appendChild(el("div", "pg__empty", "No tool calls — answered from the conversation."));
    result.steps.forEach(function (s) {
      var box = el("div", "pg-step");
      var h = el("div", "pg-step__head");
      h.appendChild(el("span", "pg-step__tool" + (s.error ? " is-error" : ""), s.n + ". " + s.tool));
      box.appendChild(h);
      box.appendChild(el("p", null, s.summary));
      var d = el("details");
      d.appendChild(el("summary", null, "input / output"));
      d.appendChild(el("pre", null, "input  " + JSON.stringify(s.input, null, 1) + "\noutput " + JSON.stringify(s.output, null, 1)));
      box.appendChild(d);
      steps.appendChild(box);
    });
    var g = el("div", "pg-step");
    var gh = el("div", "pg-step__head");
    gh.appendChild(el("span", "pg-step__tool is-code", "guards (code)"));
    gh.appendChild(el("span", result.blocked.length ? "out-rejected" : "out-done", result.blocked.length ? "blocked" : "passed"));
    g.appendChild(gh);
    g.appendChild(el("p", null, result.blocked.length ? result.blocked.join("; ") : "Prices, order references, discount codes, claimed actions and product cards all checked against tool results."));
    steps.appendChild(g);
    steps.scrollTop = steps.scrollHeight;
  }

  function send(text) {
    if (!session || !text.trim()) return;
    say("pg-msg--user", text);
    var typing = say("pg-msg--agent", "…");
    session.send(text).then(function (r) {
      typing.remove();
      if (steps.querySelector(".pg__empty.start")) steps.innerHTML = "";
      renderSteps(r, text);
      if (r.blocked.length) say("pg-msg--blocked", "draft blocked by guards → safe fallback sent");
      say("pg-msg--agent", r.message);
      if (r.products.length) {
        var wrap = el("div", "pg-cards");
        r.products.forEach(function (p) {
          var c = el("div", "pg-card");
          if (p.image) { var img = el("img"); img.src = p.image + (p.image.indexOf("?") > -1 ? "&" : "?") + "width=120"; img.alt = ""; c.appendChild(img); }
          var t = el("span"); t.appendChild(el("b", null, p.title)); t.appendChild(document.createTextNode(p.price + (p.inStock ? "" : " · sold out"))); c.appendChild(t);
          wrap.appendChild(c);
        });
        log.appendChild(wrap);
      }
      if (r.handoff) say("pg-msg--system", "handed to the support team · ticket " + r.handoff.ticketId + " (" + r.handoff.reason + ")");
      log.scrollTop = log.scrollHeight;
    });
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); send(input.value); input.value = ""; });
  root.querySelector(".pg-suggest").addEventListener("click", function (e) {
    if (e.target.tagName === "BUTTON") send(e.target.textContent);
  });
})();

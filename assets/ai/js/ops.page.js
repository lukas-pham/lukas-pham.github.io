// Ops agent playground: the real engine, policy and demo driver (ops-playground.js) over the sample store.
(function () {
  var root = document.querySelector("[data-ops-pg]");
  if (!root) return;
  var eventsBox = root.querySelector("[data-events]");
  var queueBox = root.querySelector("[data-queue]");
  var alertsBox = root.querySelector("[data-alerts]");
  var sim = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function renderQueue() {
    queueBox.innerHTML = "";
    var list = sim.approvals();
    if (!list.length) { queueBox.appendChild(el("div", "pg__empty", "Nothing waiting. Holds, customer emails and reorders land here.")); return; }
    list.forEach(function (a) {
      var box = el("div", "pg-approval");
      var head = el("div", "pg-step__head");
      head.appendChild(el("span", "pg-step__tool is-human", a.id + " · " + a.action));
      head.appendChild(el("span", a.status === "pending" ? "out-queued" : a.status === "approved" ? "out-done" : "out-rejected", a.status));
      box.appendChild(head);
      var detail = a.action === "draft_customer_email" ? a.input.subject + "\n\n" + a.input.body : JSON.stringify(a.input);
      box.appendChild(el("pre", "pg-json", detail));
      box.appendChild(el("small", "muted", "Why a person: " + a.reason));
      if (a.status === "pending") {
        var act = el("div", "pg-approval__actions");
        var yes = el("button", "pg-btn pg-btn--approve", "Approve");
        var no = el("button", "pg-btn pg-btn--reject", "Reject");
        yes.type = no.type = "button";
        yes.onclick = function () { sim.decide(a.id, true).then(render); };
        no.onclick = function () { sim.decide(a.id, false).then(render); };
        act.appendChild(yes); act.appendChild(no);
        box.appendChild(act);
      } else if (a.result) {
        box.appendChild(el("small", "out-done", a.result));
      }
      queueBox.appendChild(box);
    });
  }

  function renderAlerts() {
    alertsBox.innerHTML = "";
    var list = sim.alerts();
    if (!list.length) { alertsBox.appendChild(el("div", "pg__empty", "Team alerts (#ops, #support, #purchasing) show up here.")); return; }
    list.forEach(function (a) { var d = el("div", "pg-step"); d.appendChild(el("span", "pg-step__tool is-code", "#" + a.channel)); d.appendChild(el("p", null, a.message)); alertsBox.appendChild(d); });
  }

  function render() { renderQueue(); renderAlerts(); }

  function eventRow(item, idx) {
    var row = el("div", "pg-event");
    var info = el("div");
    info.appendChild(el("span", null, item.label));
    var e = item.event;
    var small = el("small", null, e.topic + " · " + (e.orderName || "variant " + e.variantId + " → " + e.available + " left") + " · id " + e.id);
    info.appendChild(small);
    if (e.orderName) {
      sim.order(e.orderName).then(function (o) {
        if (o && o.note) info.appendChild(el("small", null, "note: “" + o.note + "”"));
      });
    }
    var btn = el("button", "pg-btn", "Send");
    btn.type = "button";
    var outBox = el("div", "pg-out");
    btn.onclick = function () {
      btn.disabled = true;
      sim.run(e).then(function (r) {
        row.classList.add("is-done");
        btn.textContent = r.duplicate ? "ignored" : "done";
        outBox.innerHTML = "";
        outBox.appendChild(el("div", "pg-step__head")).appendChild(el("span", r.duplicate ? "out-rejected" : r.usedAgent ? "pg-step__tool" : "pg-step__tool is-code", r.duplicate ? "duplicate delivery" : r.usedAgent ? "agent" : "rules only — no AI call"));
        outBox.appendChild(el("p", null, r.summary));
        r.actions.forEach(function (a) {
          var line = el("div", "pg-action");
          line.appendChild(el("span", "out-" + a.outcome, a.outcome));
          line.appendChild(el("span", null, a.action + " · " + a.detail));
          outBox.appendChild(line);
        });
        render();
      });
    };
    row.appendChild(info);
    row.appendChild(btn);
    var wrap = el("div");
    wrap.appendChild(row);
    wrap.appendChild(outBox);
    return wrap;
  }

  fetch("assets/ai/data/sample-store.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      sim = OpsPlayground.createOpsSim(data);
      sim.scenario.forEach(function (item, i) { eventsBox.appendChild(eventRow(item, i)); });
      root.querySelector("[data-run-all]").onclick = function () {
        var buttons = Array.prototype.slice.call(eventsBox.querySelectorAll(".pg-event button:not([disabled])"));
        (function next() { var b = buttons.shift(); if (!b) return; b.click(); setTimeout(next, 250); })();
      };
      render();
    });
})();

// MCP inspector playground: the server's real tool definitions (mcp-playground.js) on the sample store.
(function () {
  var root = document.querySelector("[data-mcp-pg]");
  if (!root) return;
  var list = root.querySelector(".pg-tools");
  var formBox = root.querySelector("[data-form]");
  var out = root.querySelector("[data-out]");
  var inspector = null;
  var current = null;
  var DEFAULTS = {
    sales_summary: { from: "2026-11-18", to: "2026-11-24" },
    top_products: { by: "units", limit: 5 },
    find_orders: { has_note: true, limit: 10 },
    get_order: { order: "#1110" },
    inventory_report: { max_quantity: 2, limit: 10 },
    search_products: { query: "jacket" },
    review_insights: { max_rating: 3 },
    preview_order_tags: { orders: "#1117, #1118", tags: "priority" },
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function fieldFor(name, schema, value) {
    var wrap = el("div", "pg-field");
    var opt = schema.optional ? " (optional)" : "";
    wrap.appendChild(el("label", null, name + opt + (schema.description ? " — " + schema.description : "")));
    var input;
    if (schema.enum) {
      input = el("select");
      input.appendChild(el("option", null, ""));
      schema.enum.forEach(function (v) { var o = el("option", null, v); o.value = v; input.appendChild(o); });
    } else if (schema.type === "boolean") {
      input = el("select");
      ["", "true", "false"].forEach(function (v) { var o = el("option", null, v); o.value = v; input.appendChild(o); });
    } else {
      input = el("input");
      input.type = schema.type === "number" || schema.type === "integer" ? "number" : "text";
      if (schema.type === "array") input.placeholder = "comma-separated";
    }
    input.name = name;
    input.dataset.type = schema.type || (schema.enum ? "string" : "string");
    if (value != null) input.value = String(value);
    wrap.appendChild(input);
    return wrap;
  }

  function select(tool) {
    current = tool;
    list.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.name === tool.name)); });
    formBox.innerHTML = "";
    formBox.appendChild(el("p", "muted", tool.description));
    var props = tool.inputSchema.properties || {};
    var req = tool.inputSchema.required || [];
    var defs = DEFAULTS[tool.name] || {};
    Object.keys(props).forEach(function (k) {
      var s = Object.assign({}, props[k], { optional: req.indexOf(k) === -1 });
      formBox.appendChild(fieldFor(k, s, defs[k]));
    });
    if (!Object.keys(props).length) formBox.appendChild(el("p", "pg__empty", "No arguments."));
    var run = el("button", "btn btn--glow btn--sm", "Call " + tool.name);
    run.type = "submit";
    formBox.appendChild(run);
  }

  root.querySelector("[data-form-wrap]").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!current) return;
    var args = {};
    formBox.querySelectorAll("input, select").forEach(function (i) {
      if (i.value === "") return;
      var t = i.dataset.type;
      if (t === "number" || t === "integer") args[i.name] = Number(i.value);
      else if (t === "boolean") args[i.name] = i.value === "true";
      else if (t === "array") args[i.name] = i.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      else args[i.name] = i.value;
    });
    out.innerHTML = "";
    out.appendChild(el("div", "caption", "→ " + current.name + " " + JSON.stringify(args)));
    inspector.call(current.name, args).then(function (r) {
      out.appendChild(el("p", null, r.summary));
      out.appendChild(el("pre", "pg-json", JSON.stringify(r.data, null, 2)));
      if (r.data && r.data.confirmation_token) {
        var b = el("button", "pg-btn pg-btn--approve", "Approve: call apply_order_tags with this token");
        b.type = "button";
        b.addEventListener("click", function () {
          inspector.call("apply_order_tags", { confirmation_token: r.data.confirmation_token }).then(function (x) {
            out.appendChild(el("p", "out-done", x.summary));
            out.appendChild(el("pre", "pg-json", JSON.stringify(x.data, null, 2)));
            b.disabled = true;
          });
        });
        out.appendChild(b);
      }
    }).catch(function (err) {
      var msg = err && err.issues ? err.issues.map(function (i) { return i.path.join(".") + ": " + i.message; }).join("; ") : String(err.message || err);
      out.appendChild(el("p", "out-rejected", "Rejected by the input schema: " + msg));
    });
  });

  fetch("assets/ai/data/sample-store.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      inspector = McpPlayground.createInspector(data, true);
      inspector.tools.forEach(function (t) {
        var b = el("button", t.write ? "is-write" : "", t.name);
        b.type = "button";
        b.dataset.name = t.name;
        b.title = t.write ? "Write tool — only with --allow-writes" : "Read-only";
        b.addEventListener("click", function () { select(t); });
        list.appendChild(b);
      });
      select(inspector.tools.find(function (t) { return t.name === "sales_summary"; }));
    });
})();

// Cart simulator: builds the Function's real input shape, runs the real Function code (wholesale-function.js),
// and renders what checkout would show. The progress block mirrors extensions/wholesale-tier-progress/src/Checkout.jsx.
(function () {
  var root = document.querySelector("[data-wholesale-pg]");
  if (!root || !window.WholesaleFunction) return;
  var TIERS = { tiers: [{ minQuantity: 12, percentage: 10 }, { minQuantity: 24, percentage: 15 }, { minQuantity: 48, percentage: 20 }] };
  var LINES = [
    { title: "Technical Hiking Socks", price: 24.99, qty: 10, excluded: false },
    { title: "Performance Technical Tee", price: 45, qty: 6, excluded: false },
    { title: "Convertible Zip-Off Pants", price: 75, qty: 0, excluded: false },
    { title: "Trekking Pole Set (tagged no-wholesale)", price: 119, qty: 0, excluded: true },
  ];
  var linesBox = root.querySelector("[data-lines]");
  var approved = root.querySelector("[data-approved]");
  var inBox = root.querySelector("[data-input]");
  var outBox = root.querySelector("[data-output]");
  var checkout = root.querySelector("[data-checkout]");
  var money = function (n) { return "$" + n.toFixed(2); };

  LINES.forEach(function (l, i) {
    var row = document.createElement("div");
    row.className = "sim-line";
    row.innerHTML = '<span></span><input type="number" min="0" max="200" aria-label="Quantity"><span class="muted"></span>';
    row.children[0].textContent = l.title;
    row.children[1].value = l.qty;
    row.children[2].textContent = money(l.price);
    row.children[1].addEventListener("input", function (e) { l.qty = Math.max(0, Math.min(200, parseInt(e.target.value || "0", 10))); run(); });
    linesBox.appendChild(row);
  });
  approved.addEventListener("change", run);

  function run() {
    var cartLines = LINES.map(function (l, i) { return { l: l, id: "gid://shopify/CartLine/" + i }; }).filter(function (x) { return x.l.qty > 0; });
    var input = {
      cart: {
        buyerIdentity: { customer: { wholesaleApproved: approved.checked ? { value: "true" } : null } },
        lines: cartLines.map(function (x, i) { return { id: x.id, quantity: x.l.qty, merchandise: { __typename: "ProductVariant", id: "gid://shopify/ProductVariant/" + (100 + i), product: { excludedFromWholesale: x.l.excluded } } }; }),
      },
      discount: { discountClasses: ["PRODUCT"] },
      shop: { tiers: { jsonValue: TIERS } },
    };
    var output = WholesaleFunction.cartLinesDiscountsGenerateRun(input);
    inBox.textContent = JSON.stringify(input, null, 1);
    outBox.textContent = JSON.stringify(output, null, 1);

    // Apply the Function's output the way checkout would.
    var cand = output.operations[0] && output.operations[0].productDiscountsAdd.candidates[0];
    var targeted = cand ? cand.targets.map(function (t) { return t.cartLine.id; }) : [];
    var pct = cand ? cand.value.percentage.value : 0;
    var subtotal = 0, discount = 0;
    var html = "";
    cartLines.forEach(function (x) {
      var lineTotal = x.l.price * x.l.qty;
      subtotal += lineTotal;
      if (targeted.indexOf(x.id) > -1) discount += Math.round(lineTotal * pct) / 100;
      html += '<div class="row"><span>' + x.l.title.replace(/ \(.*\)/, "") + " × " + x.l.qty + "</span><span>" + money(lineTotal) + "</span></div>";
    });
    if (!cartLines.length) html += '<div class="row"><small>Cart is empty</small></div>';
    if (cand) html += '<div class="row disc"><span>' + cand.message + "</span><span>−" + money(discount) + "</span></div>";
    html += '<div class="row" style="font-weight:600;border-top:1px solid #e2e5e9;margin-top:6px;padding-top:8px"><span>Subtotal</span><span>' + money(subtotal - discount) + "</span></div>";

    // Progress block — same logic as Checkout.jsx (it counts all units; see the known gap).
    if (approved.checked) {
      var units = cartLines.reduce(function (s, x) { return s + x.l.qty; }, 0);
      var tiers = TIERS.tiers;
      var current = tiers.slice().reverse().find(function (t) { return units >= t.minQuantity; });
      var next = tiers.find(function (t) { return units < t.minQuantity; });
      html += '<div class="sim-banner' + (current ? " success" : "") + '"><b>Wholesale pricing</b><br>';
      html += current ? current.percentage + "% off applied for " + units + " units." : "Wholesale pricing starts at " + tiers[0].minQuantity + " units (" + tiers[0].percentage + "% off).";
      if (next) html += '<div class="sim-bar"><span style="width:' + Math.round((units / next.minQuantity) * 100) + '%"></span></div><small>Add ' + (next.minQuantity - units) + " more units to get " + next.percentage + "% off.</small>";
      else html += "<br><small>You have the best wholesale price.</small>";
      html += "</div>";
      var fnPct = pct;
      var blockPct = current ? current.percentage : 0;
      if (fnPct !== blockPct) html += '<p style="margin:10px 0 0;color:#a14b00;font-size:12px">⚠ Known gap: the checkout block counts the excluded product, the Function does not (' + blockPct + "% vs " + fnPct + "%). Listed in the build log.</p>";
    } else {
      html += '<p style="margin:10px 0 0;font-size:12px;color:#5c6670">Not an approved wholesale customer: no discount, no progress block.</p>';
    }
    checkout.innerHTML = html;
  }
  run();
})();

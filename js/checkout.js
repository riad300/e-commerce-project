import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { collection, addDoc, serverTimestamp, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const CART_KEY = "cart";
const SHIPPING_BDT = 150;

function formatBDT(amount) {
  return "৳" + Number(amount || 0).toLocaleString("en-BD");
}
function readCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}
function writeCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items || []));
}
function calcSubtotal(items) {
  let total = 0;
  (items || []).forEach(it => total += (Number(it.price?.newPrice || 0) * Number(it.quantity || 1)));
  return Math.round(total);
}

// UI elements
const itemsBox = document.getElementById("itemsBox");
const subtotalBDT = document.getElementById("subtotalBDT");
const shippingBDT = document.getElementById("shippingBDT");
const totalBDT = document.getElementById("totalBDT");
const msg = document.getElementById("msg");
const placeOrderBtn = document.getElementById("placeOrderBtn");

const bkashBox = document.getElementById("bkashBox");
const nagadBox = document.getElementById("nagadBox");

const fullName = document.getElementById("fullName");
const phone = document.getElementById("phone");
const address = document.getElementById("address");

const bkashNumber = document.getElementById("bkashNumber");
const bkashTrx = document.getElementById("bkashTrx");
const nagadNumber = document.getElementById("nagadNumber");
const nagadTrx = document.getElementById("nagadTrx");

function getPayMethod() {
  const el = document.querySelector('input[name="pay"]:checked');
  return el ? el.value : "COD";
}

function togglePayUI() {
  const method = getPayMethod();
  bkashBox.classList.toggle("hidden", method !== "BKASH");
  nagadBox.classList.toggle("hidden", method !== "NAGAD");
}

document.querySelectorAll('input[name="pay"]').forEach(r => {
  r.addEventListener("change", togglePayUI);
});

togglePayUI();

// Render summary
const cart = readCart();
const sub = calcSubtotal(cart);
const total = sub + SHIPPING_BDT;

shippingBDT.textContent = formatBDT(SHIPPING_BDT);
subtotalBDT.textContent = formatBDT(sub);
totalBDT.textContent = formatBDT(total);

if (!cart.length) {
  itemsBox.innerHTML = "Cart is empty. <a href='shop.html'>Go shopping</a>";
} else {
  itemsBox.innerHTML = cart.map(it => {
    const qty = Number(it.quantity || 1);
    const price = Number(it.price?.newPrice || 0);
    return `<div class="summary-row">
      <span>${it.name} × ${qty}</span>
      <span>${formatBDT(price * qty)}</span>
    </div>`;
  }).join("");
}

// Auth guard + place order
let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  if (!currentUser) {
    alert("Please login first.");
    window.location.href = "account.html";
  }
});

placeOrderBtn.addEventListener("click", async () => {
  msg.textContent = "";

  if (!currentUser) return;

  if (!cart.length) {
    msg.textContent = "Cart is empty!";
    return;
  }

  // basic validation
  if (!fullName.value.trim() || !phone.value.trim() || !address.value.trim()) {
    msg.textContent = "Please fill name, phone and address.";
    return;
  }

  const method = getPayMethod();

  // dummy validation for bkash/nagad
  let paymentInfo = { method };

  if (method === "BKASH") {
    if (!bkashNumber.value.trim() || !bkashTrx.value.trim()) {
      msg.textContent = "bKash number & Transaction ID required (dummy).";
      return;
    }
    paymentInfo = { method, number: bkashNumber.value.trim(), trxId: bkashTrx.value.trim() };
  }

  if (method === "NAGAD") {
    if (!nagadNumber.value.trim() || !nagadTrx.value.trim()) {
      msg.textContent = "Nagad number & Transaction ID required (dummy).";
      return;
    }
    paymentInfo = { method, number: nagadNumber.value.trim(), trxId: nagadTrx.value.trim() };
  }

  try {
    placeOrderBtn.disabled = true;

    // 1) create order
    await addDoc(collection(db, "users", currentUser.uid, "orders"), {
      items: cart,
      subtotalBDT: sub,
      shippingBDT: SHIPPING_BDT,
      totalBDT: total,
      currency: "BDT",
      status: method === "COD" ? "pending" : "paid(dummy)",
      payment: paymentInfo,
      shipping: {
        fullName: fullName.value.trim(),
        phone: phone.value.trim(),
        address: address.value.trim()
      },
      createdAt: serverTimestamp()
    });

    // 2) clear cart
    writeCart([]);

    // (optional) also clear cloud cart document if you use it
    // await setDoc(doc(db, "carts", currentUser.uid), { items: [], updatedAt: Date.now() }, { merge: true });

    alert("Order placed ✅");
    window.location.href = "profile.html"; // or index.html

  } catch (err) {
    console.error(err);
    msg.textContent = "Order failed: " + err.message;
  } finally {
    placeOrderBtn.disabled = false;
  }
});

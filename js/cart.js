// js/cart.js (MODULE)
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc, getDoc, setDoc,
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ===================== BDT Formatter =====================
function formatBDT(amount) {
  const n = Number(amount || 0);
  return "৳" + n.toLocaleString("en-BD"); // example: ৳10,500
}

// ✅ OPTION A: data.json এ BDT price আছে → RATE = 1
const USD_TO_BDT = 1;

// (keep function name same so you don't change other code)
function priceBDT(amount) {
  return Math.round(Number(amount || 0) * USD_TO_BDT);
}

// ===================== LocalStorage Key =====================
const CART_KEY = "cart";

// -------------------- Local helpers --------------------
function readLocalCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}
function writeLocalCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items || []));
}

// -------------------- Firestore cart helpers --------------------
async function readCloudCart(uid) {
  const ref = doc(db, "carts", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().items || []) : [];
}
async function writeCloudCart(uid, items) {
  const ref = doc(db, "carts", uid);
  await setDoc(ref, { items: items || [], updatedAt: Date.now() }, { merge: true });
}

// -------------------- merge by id --------------------
function mergeCarts(localItems, cloudItems) {
  const map = new Map();

  const put = (it) => {
    const key = it.id ?? it.productId ?? it.name;
    if (!key) return;

    const prev = map.get(key);
    if (!prev) map.set(key, { ...it, quantity: Number(it.quantity || 1) });
    else map.set(key, { ...prev, ...it, quantity: Number(prev.quantity || 1) + Number(it.quantity || 1) });
  };

  (cloudItems || []).forEach(put);
  (localItems || []).forEach(put);
  return Array.from(map.values());
}

// ===================== State =====================
let currentUser = null;
let cart = readLocalCart();

// ✅ per item price always use this (BDT)
function getItemUnitPriceBDT(item) {
  // item.price.newPrice এখন BDT
  return priceBDT(item?.price?.newPrice || 0);
}

// ✅ calculate cart total in BDT
function calcItemsTotalBDT(items) {
  let total = 0;
  (items || []).forEach((it) => {
    total += getItemUnitPriceBDT(it) * Number(it.quantity || 1);
  });
  return Math.round(total);
}

// ===================== UI render =====================
function renderCartUI() {
  displayCartProduct();
  cartProductRoute();
  saveCardValues();

  const cartItem = document.querySelector(".header-cart-count");
  if (cartItem) cartItem.innerHTML = cart.length;
}

// ===================== Persist cart =====================
async function persistCart() {
  // local always keep updated (UI compatibility)
  writeLocalCart(cart);

  // if logged in -> cloud also
  if (currentUser) {
    await writeCloudCart(currentUser.uid, cart);
  }

  renderCartUI();
}

// ===================== AUTH sync =====================
onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;

  if (!user) {
    cart = readLocalCart();
    renderCartUI();
    return;
  }

  const local = readLocalCart();
  const cloud = await readCloudCart(user.uid);

  cart = mergeCarts(local, cloud);

  // save merged
  await writeCloudCart(user.uid, cart);
  writeLocalCart(cart);

  renderCartUI();
});

// ===================== CART UI =====================
function displayCartProduct() {
  const cartProduct = document.getElementById("cart-product");
  if (!cartProduct) return;

  if (!cart || cart.length === 0) {
    cartProduct.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;">Cart is empty</td></tr>`;
    return;
  }

  let results = "";
  cart.forEach((item) => {
    const unitBDT = getItemUnitPriceBDT(item);
    const subBDT = unitBDT * Number(item.quantity || 1);

    results += `
      <tr class="cart-item">
        <td></td>
        <td class="cart-image">
          <img src="${item.img.singleImage}" alt="" data-id="${item.id}" class="cart-product-image">
          <i class="bi bi-x delete-cart" data-id="${item.id}"></i>
        </td>
        <td>${item.name}</td>
        <td>${formatBDT(unitBDT)}</td>
        <td>${item.quantity}</td>
        <td>${formatBDT(subBDT)}</td>
      </tr>
    `;
  });

  cartProduct.innerHTML = results;
  removeCartItem();
}

function cartProductRoute() {
  const images = document.querySelectorAll(".cart-product-image");
  images.forEach((image) => {
    image.addEventListener("click", (e) => {
      const imageId = e.target.dataset.id;
      localStorage.setItem("productId", Number(imageId));
      window.location.href = "single-product.html";
    });
  });
}

function removeCartItem() {
  const btnDeleteCart = document.querySelectorAll(".delete-cart");

  btnDeleteCart.forEach((button) => {
    button.addEventListener("click", async (e) => {
      const id = Number(e.target.dataset.id);
      cart = cart.filter((item) => item.id !== id);
      await persistCart();
    });
  });
}

// ===================== Totals =====================
function saveCardValues() {
  const cartTotal = document.getElementById("cart-total");
  const subTotal = document.getElementById("subtotal");
  const fastCargo = document.getElementById("fast-cargo");

  if (!cartTotal || !subTotal || !fastCargo) return;

  const itemsTotalBDT = calcItemsTotalBDT(cart);

  // ✅ Shipping BDT
  const fastCargoPriceBDT = 150; // change if you want

  subTotal.innerHTML = formatBDT(itemsTotalBDT);
  cartTotal.innerHTML = formatBDT(itemsTotalBDT);

  fastCargo.onchange = (e) => {
    if (e.target.checked) cartTotal.innerHTML = formatBDT(itemsTotalBDT + fastCargoPriceBDT);
    else cartTotal.innerHTML = formatBDT(itemsTotalBDT);
  };
}

// ===================== CHECKOUT button (Recommended) =====================
// ✅ Best practice: cart page থেকে checkout.html এ redirect করো
const checkoutBtn = document.getElementById("checkoutBtn");

if (checkoutBtn) {
  checkoutBtn.type = "button";
  checkoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "checkout.html";
  });
}

// প্রথম load render
renderCartUI();

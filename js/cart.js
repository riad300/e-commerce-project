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

// ✅ যদি তোমার data.json এর দাম USD থাকে, তাহলে এখানে rate বসাও
// ✅ যদি তুমি data.json এ BDT দামই রাখো, তাহলে RATE = 1 রাখো
const USD_TO_BDT = 110; // চাইলে change করো
function priceBDT(usdAmount) {
  return Math.round(Number(usdAmount || 0) * USD_TO_BDT);
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
  // তোমার item.price.newPrice ইউএসডি হলে BDT তে convert হবে
  // item.price.newPrice যদি BDT থাকে, USD_TO_BDT = 1 করে দাও
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

// ===================== CHECKOUT → CREATE ORDER =====================
const checkoutBtn = document.getElementById("checkoutBtn");

if (checkoutBtn) {
  // ✅ Important: stop form submit reload
  checkoutBtn.type = "button";

  checkoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // 1) must login
    if (!currentUser) {
      alert("Please login to place an order.");
      window.location.href = "account.html";
      return;
    }

    // 2) cart empty
    if (!cart || cart.length === 0) {
      alert("Your cart is empty!");
      return;
    }

    // 3) total in BDT
    const totalBDT = calcItemsTotalBDT(cart);

    try {
      checkoutBtn.disabled = true;

      // ✅ save order in Firestore
      await addDoc(collection(db, "users", currentUser.uid, "orders"), {
        items: cart.map((it) => ({
          ...it,
          // ✅ order এ BDT unit price save
          priceBDT: getItemUnitPriceBDT(it)
        })),
        totalBDT,
        currency: "BDT",
        status: "pending",
        createdAt: serverTimestamp()
      });

      // 4) clear cart local + cloud
      cart = [];
      writeLocalCart(cart);
      await writeCloudCart(currentUser.uid, cart);

      alert("Order placed ✅");
      renderCartUI();

      // ✅ optional redirect
      // window.location.href = "profile.html";

    } catch (err) {
      console.error(err);
      alert("Order failed: " + err.message);
    } finally {
      checkoutBtn.disabled = false;
    }
  });
}

// প্রথম load render
renderCartUI();

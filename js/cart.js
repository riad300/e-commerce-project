// js/cart.js (MODULE)
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc, getDoc, setDoc,
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ✅ তোমার প্রোজেক্টে আসল key = "cart"
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

// merge by id
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

// -------------------- State --------------------
let currentUser = null;
let cart = readLocalCart();

// ✅ UI render
function renderCartUI() {
  displayCartProduct();
  cartProductRoute();
  saveCardValues();

  const cartItem = document.querySelector(".header-cart-count");
  if (cartItem) cartItem.innerHTML = cart.length;
}

// ✅ Persist = login থাকলে Firestore, না থাকলে localStorage
async function persistCart() {
  if (currentUser) {
    await writeCloudCart(currentUser.uid, cart);
  } else {
    writeLocalCart(cart);
  }
  renderCartUI();
}

// -------------------- AUTH: login হলে cloud cart load + merge --------------------
onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;

  if (!user) {
    // guest
    cart = readLocalCart();
    renderCartUI();
    return;
  }

  // logged-in: merge local + cloud
  const local = readLocalCart();
  const cloud = await readCloudCart(user.uid);
  cart = mergeCarts(local, cloud);

  // save to cloud + local for UI compatibility
  await writeCloudCart(user.uid, cart);
  writeLocalCart(cart);

  renderCartUI();
});

// -------------------- CART UI --------------------
function displayCartProduct() {
  let results = "";
  const cartProduct = document.getElementById("cart-product");
  if (!cartProduct) return;

  cart.forEach((item) => {
    results += `
      <tr class="cart-item">
        <td></td>
        <td class="cart-image">
          <img src="${item.img.singleImage}" alt="" data-id="${item.id}" class="cart-product-image">
          <i class="bi bi-x delete-cart" data-id="${item.id}"></i>
        </td>
        <td>${item.name}</td>
        <td>$${item.price.newPrice.toFixed(2)}</td>
        <td>${item.quantity}</td>
        <td>$${(item.price.newPrice * item.quantity).toFixed(2)}</td>
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
  const cartItem = document.querySelector(".header-cart-count");

  btnDeleteCart.forEach((button) => {
    button.addEventListener("click", async (e) => {
      const id = Number(e.target.dataset.id);
      cart = cart.filter((item) => item.id !== id);

      await persistCart();

      if (cartItem) cartItem.innerHTML = cart.length;
    });
  });
}

function saveCardValues() {
  const cartTotal = document.getElementById("cart-total");
  const subTotal = document.getElementById("subtotal");
  const fastCargo = document.getElementById("fast-cargo");
  const fastCargoPrice = 15;

  if (!cartTotal || !subTotal || !fastCargo) return;

  let itemsTotal = 0;
  cart.length > 0 && cart.map((item) => (itemsTotal += item.price.newPrice * item.quantity));

  subTotal.innerHTML = `$${itemsTotal.toFixed(2)}`;
  cartTotal.innerHTML = `$${itemsTotal.toFixed(2)}`;

  fastCargo.onchange = (e) => {
    if (e.target.checked) cartTotal.innerHTML = `$${(itemsTotal + fastCargoPrice).toFixed(2)}`;
    else cartTotal.innerHTML = `$${itemsTotal.toFixed(2)}`;
  };
}

// -------------------- ✅ CHECKOUT → CREATE ORDER (Daraz style) --------------------
function calcTotal(items) {
  let total = 0;
  (items || []).forEach((it) => {
    total += (it.price?.newPrice || 0) * (it.quantity || 1);
  });
  return Number(total.toFixed(2));
}

const checkoutBtn = document.getElementById("checkoutBtn");
if (checkoutBtn) {
  checkoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    // 1) must login
    if (!currentUser) {
      alert("Please login to place an order.");
      window.location.href = "account.html";
      return;
    }

    // 2) cart empty?
    if (!cart || cart.length === 0) {
      alert("Your cart is empty!");
      return;
    }

    // 3) create order under UID
    const total = calcTotal(cart);

    try {
      await addDoc(collection(db, "users", currentUser.uid, "orders"), {
        items: cart,
        total,
        status: "pending",
        createdAt: serverTimestamp()
      });

      // 4) clear cart (both local + cloud)
      cart = [];
      writeLocalCart(cart);
      await writeCloudCart(currentUser.uid, cart);

      alert("Order placed ✅");

      // UI refresh
      renderCartUI();
    } catch (err) {
      console.error(err);
      alert("Order failed: " + err.message);
    }
  });
}

// প্রথম load এ render (guest)
renderCartUI();

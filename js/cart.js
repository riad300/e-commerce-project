// js/cart.js (type=module)
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ====== 1) Guest cart (localStorage) helpers ======
const LS_KEY = "cart_items";

function readLocalCart() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}
function writeLocalCart(items) {
  localStorage.setItem(LS_KEY, JSON.stringify(items || []));
}

// ====== 2) Firestore cart helpers ======
async function readCloudCart(uid) {
  const ref = doc(db, "carts", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().items || []) : [];
}
async function writeCloudCart(uid, items) {
  const ref = doc(db, "carts", uid);
  await setDoc(ref, { items: items || [], updatedAt: Date.now() }, { merge: true });
}

// ====== 3) Merge logic (local + cloud) ======
// ধরলাম item structure: { id, title, price, quantity, img } — তোমার project অনুযায়ী adjust করতে পারো
function mergeCarts(localItems, cloudItems) {
  const map = new Map();
  const put = (it) => {
    const key = it.id ?? it.productId ?? it.title; // তোমার item এ যেটা unique
    if (!key) return;
    const prev = map.get(key);
    if (!prev) map.set(key, { ...it });
    else map.set(key, { ...prev, ...it, quantity: (prev.quantity || 1) + (it.quantity || 1) });
  };
  (cloudItems || []).forEach(put);
  (localItems || []).forEach(put);
  return Array.from(map.values());
}

// ====== 4) Single source of truth ======
let currentUser = null;
let cartItems = [];

// ✅ তোমার existing render function যদি থাকে, এখানে call করবে
function renderCartUI(items) {
  // TODO: এখানে তোমার পুরানো cart render logic call করো
  // example: displayCart(items)
  console.log("Render cart items:", items);
}

// ✅ Add/remove/update quantity হলে এই function কল করবে
async function persistCart(items) {
  cartItems = items || [];
  if (currentUser) {
    await writeCloudCart(currentUser.uid, cartItems);
  } else {
    writeLocalCart(cartItems);
  }
  renderCartUI(cartItems);
}

// ====== 5) Auth State: login হলে cloud cart load + migrate ======
onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;

  if (!user) {
    // Guest mode
    cartItems = readLocalCart();
    renderCartUI(cartItems);
    return;
  }

  // Logged-in mode
  const local = readLocalCart();
  const cloud = await readCloudCart(user.uid);

  // migrate/merge
  const merged = mergeCarts(local, cloud);

  // cloud এ save + local clear (optional)
  await writeCloudCart(user.uid, merged);
  writeLocalCart([]); // চাইলে রাখতেও পারো, কিন্তু সাধারণত clear করা হয়

  cartItems = merged;
  renderCartUI(cartItems);
});

// ---- Example usage ----
// যখন cart এ item add করবে:
// persistCart([...cartItems, newItem])

// quantity change হলে:
// cartItems[index].quantity = x; persistCart(cartItems)

// remove হলে:
// persistCart(cartItems.filter(...))
let cart = localStorage.getItem("cart")
    ? JSON.parse(localStorage.getItem("cart")) : []


function displayCartProduct() {
    let results = ""
    const cartProduct = document.getElementById("cart-product")
    cart.forEach((item) => {
        results += `
        <tr class="cart-item">
            <td></td>
            <td class="cart-image">
                <img src="${item.img.singleImage}" alt="" data-id=${item.id} class="cart-product-image">
                <i class="bi bi-x delete-cart" data-id=${item.id}></i>
            </td>
            <td>${item.name}</td>
            <td>$${item.price.newPrice.toFixed(2)}</td>
            <td>${item.quantity}</td>
            <td>$${(item.price.newPrice * item.quantity).toFixed(2)}</td>
        </tr>
        `
    })
    cartProduct.innerHTML = results
    removeCartItem()
}

displayCartProduct()

function cartProductRoute() {
    const images = document.querySelectorAll(".cart-product-image")
    images.forEach((image) => {
        image.addEventListener("click", (e) => {
            const imageId = e.target.dataset.id
            localStorage.setItem("productId", Number(imageId))
            window.location.href = "single-product.html"
        })
    })
}

cartProductRoute()


function removeCartItem() {

    const btnDeleteCart = document.querySelectorAll(".delete-cart");
    let cartItem = document.querySelector(".header-cart-count")

    btnDeleteCart.forEach((button) => {
        button.addEventListener("click", (e) => {
            const id = e.target.dataset.id;
            cart = cart.filter((item) => item.id !== Number(id));
            displayCartProduct()
            localStorage.setItem("cart", JSON.stringify(cart))
            cartItem.innerHTML = cart.length
            saveCardValues()
        });
    });
}


function saveCardValues() {
    const cartTotal = document.getElementById("cart-total")
    const subTotal = document.getElementById("subtotal")
    const fastCargo = document.getElementById("fast-cargo")
    const fastCargoPrice = 15
    let itemsTotal = 0

    cart.length > 0 && cart.map((item) => itemsTotal += item.price.newPrice * item.quantity)
    subTotal.innerHTML = `$${itemsTotal.toFixed(2)}`
    cartTotal.innerHTML = `$${itemsTotal.toFixed(2)}`
    fastCargo.addEventListener("change", (e) => {
        if (e.target.checked) {
            cartTotal.innerHTML = `$${(itemsTotal + fastCargoPrice).toFixed(2)}`
        } else {
            cartTotal.innerHTML = `$${itemsTotal.toFixed(2)}`
        }
    })
}


saveCardValues()

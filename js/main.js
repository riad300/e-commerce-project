import headerFunc from "./header.js";
import productFunc from "./product.js";
import searchFunc from "./search.js";

// Firebase (auth state)
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

//! add product to localstorage start
(async function () {
  const products = await fetch("js/data.json");
  const data = await products.json();

  data ? localStorage.setItem("products", JSON.stringify(data)) : [];
  productFunc(data);
  searchFunc(data);
})();
//! add product to localstorage end

// ✅ সব code DOM ready হওয়ার পরে run করানো (এটাই মূল fix)
window.addEventListener("DOMContentLoaded", () => {

  //! add cartItem to localstorage start
  const cartItem = document.querySelector(".header-cart-count");
  if (cartItem) {
    cartItem.innerHTML = localStorage.getItem("cart")
      ? JSON.parse(localStorage.getItem("cart")).length
      : "0";
  }
  //! add cartItem to localstorage end

  //! modal dialog start
  const modal = document.querySelector(".modal-dialog");
  const modalContent = document.querySelector(".modal-dialog .modal-content");
  const btnModalClose = document.querySelector(".modal-dialog .modal-close");

  if (btnModalClose) {
    btnModalClose.addEventListener("click", () => {
      modal.classList.remove("show");
    });
  }

  if (modal) {
    document.addEventListener("click", (e) => {
      if (!e.composedPath().includes(modalContent)) {
        modal.classList.remove("show");
      }
    });
  }

  if (modal) {
    setTimeout(() => {
      modal.classList.add("show");
    }, 3000);
  }
  //! modal dialog end

  // ✅ Profile icon / link fix (Daraz style)
  const accountLink = document.getElementById("accountLink");

  onAuthStateChanged(auth, (user) => {
    if (!accountLink) return;

    // login থাকলে → profile, না থাকলে → account
    accountLink.href = user ? "profile.html" : "account.html";

    // icon hidden থাকলে force show
    accountLink.style.display = "inline-flex";
  });
});
